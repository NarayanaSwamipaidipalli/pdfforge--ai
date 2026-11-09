"""HTTP boundary tests. Every external operation is mocked; no services are used."""
import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import main
from app.config import Settings


TEST_SECRET = "worker-regression-synthetic-credential-2026"
AUTH = {"x-pdfforge-worker-secret": TEST_SECRET}
JOB = {
    "jobId": "2d730da9-bf59-4c7c-b3ac-a4dcd2bf6c34", "tool": "word-to-pdf",
    "files": [{"id": "e3258349-0dc7-4691-bdf3-3104258e9142", "originalName": "fixture.docx", "s3Key": "fixture.docx"}],
}
AI_OPERATIONS = {
    "/ai/summarize": "summarize_document",
    "/ai/chat": "chat_with_document",
    "/ai/extract-invoice": "extract_invoice_data",
    "/ai/analyze-contract": "analyze_contract_data",
    "/ai/extract-text": "extract_tables_and_text",
}
PAYLOADS = {"/jobs/process": JOB, "/invoices/generate": {}}
PAYLOADS.update({path: {"s3Key": "fixture.pdf", **({"question": "What?"} if path == "/ai/chat" else {})} for path in AI_OPERATIONS})


class WorkerHttpSecurityTests(unittest.TestCase):
    def setUp(self):
        self.configuration = patch.multiple(
            main.settings, WORKER_CALLBACK_SECRET=TEST_SECRET,
            API_GATEWAY_INTERNAL_URL="http://gateway.invalid",
        )
        self.configuration.start()
        self.addCleanup(self.configuration.stop)
        self.client = TestClient(main.app)

    def test_every_api_route_is_protected_before_side_effects(self):
        registered = {route.path for route in main.app.routes if route.path.startswith("/api/v1/")}
        self.assertEqual(registered, {f"/api/v1{path}" for path in PAYLOADS})
        with patch.object(main.process_pdf_task, "delay") as queue, patch.object(main, "get_s3_client") as s3, patch.object(main, "generate_invoice_pdf") as invoice:
            for path, payload in PAYLOADS.items():
                for header in ({}, {"x-pdfforge-worker-secret": ""}, {"x-pdfforge-worker-secret": "wrong-credential"}):
                    with self.subTest(path=path, header_present=bool(header)):
                        response = self.client.post(f"/api/v1{path}", json=payload, headers=header)
                        self.assertEqual(response.status_code, 401)
                        self.assertNotIn(TEST_SECRET, response.text)
            queue.assert_not_called()
            s3.assert_not_called()
            invoice.assert_not_called()

    def test_missing_configuration_fails_closed(self):
        with patch.object(main.settings, "WORKER_CALLBACK_SECRET", ""), patch.object(main.process_pdf_task, "delay") as queue:
            self.assertEqual(self.client.post("/api/v1/jobs/process", json=JOB, headers=AUTH).status_code, 503)
            queue.assert_not_called()

    def test_health_remains_public(self):
        self.assertEqual(self.client.get("/health").status_code, 200)

    def test_authenticated_jobs_queue_with_serializable_ids(self):
        with patch.object(main.process_pdf_task, "delay", return_value=SimpleNamespace(id="task-id")) as queue:
            response = self.client.post("/api/v1/jobs/process", json={**JOB, "callbackUrl": "http://gateway.invalid/api/v1/pdf/jobs/callback"}, headers=AUTH)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["status"], "ACCEPTED")
            self.assertEqual(queue.call_args.args[0], JOB["jobId"])
            self.assertEqual(queue.call_args.args[2][0]["id"], JOB["files"][0]["id"])

    def test_queue_failure_is_not_reported_as_success_or_leaked(self):
        with patch.object(main.process_pdf_task, "delay", side_effect=RuntimeError(TEST_SECRET)):
            response = self.client.post("/api/v1/jobs/process", json=JOB, headers=AUTH)
            self.assertEqual(response.status_code, 503)
            self.assertNotIn(TEST_SECRET, response.text)

    def test_unapproved_callbacks_and_traversal_job_ids_rejected(self):
        with patch.object(main.process_pdf_task, "delay") as queue:
            for callback in ("https://attacker.invalid", "http://gateway.invalid.evil/api/v1/pdf/jobs/callback", "http://gateway.invalid/api/v1/pdf/jobs/callback?redirect=evil"):
                self.assertEqual(self.client.post("/api/v1/jobs/process", json={**JOB, "callbackUrl": callback}, headers=AUTH).status_code, 400)
            self.assertEqual(self.client.post("/api/v1/jobs/process", json={**JOB, "jobId": "../../outside"}, headers=AUTH).status_code, 422)
            queue.assert_not_called()

    def test_all_ai_routes_reject_local_files_even_when_authenticated(self):
        with patch.object(main, "get_s3_client") as s3:
            for path in AI_OPERATIONS:
                response = self.client.post(f"/api/v1{path}", json={**PAYLOADS[path], "localPath": "/etc/passwd"}, headers=AUTH)
                self.assertEqual(response.status_code, 422)
            s3.assert_not_called()

    def test_authenticated_ai_uses_temporary_downloads_and_cleans_up(self):
        paths = []

        def download(bucket, key, destination):
            Path(destination).write_bytes(b"synthetic-document")
            paths.append(destination)

        for route, operation_name in AI_OPERATIONS.items():
            s3 = MagicMock()
            s3.download_file.side_effect = download
            def analyze(path, **kwargs):
                self.assertTrue(Path(path).is_file())
                return {"result": "ok"}
            with self.subTest(route=route), patch.object(main, "get_s3_client", return_value=s3), patch.object(main.document_intelligence, operation_name, side_effect=analyze) as operation:
                response = self.client.post(f"/api/v1{route}", json=PAYLOADS[route], headers=AUTH)
                self.assertEqual(response.status_code, 200)
                operation.assert_called_once()
                self.assertFalse(Path(paths[-1]).exists())

    def test_download_failure_does_not_expose_backend_details(self):
        s3 = MagicMock()
        s3.download_file.side_effect = RuntimeError(TEST_SECRET)
        with patch.object(main, "get_s3_client", return_value=s3):
            response = self.client.post("/api/v1/ai/summarize", json=PAYLOADS["/ai/summarize"], headers=AUTH)
            self.assertEqual(response.status_code, 502)
            self.assertNotIn(TEST_SECRET, response.text)

    def test_authenticated_invoice_returns_pdf_and_sanitizes_filename(self):
        response = self.client.post("/api/v1/invoices/generate", json={"invoiceNumber": "fixture\r\nInjected: value", "invoiceDate": "2026-01-02", "amount": 99, "currency": "INR", "customerEmail": "receipt@example.com"}, headers=AUTH)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.content.startswith(b"%PDF-"))
        self.assertNotIn("\r", response.headers["content-disposition"])


class WorkerConfigurationTests(unittest.TestCase):
    def test_production_requires_explicit_safe_configuration_without_leaking_input(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(ValidationError) as error:
                Settings(ENVIRONMENT="production", WORKER_CALLBACK_SECRET=TEST_SECRET)
            self.assertNotIn(TEST_SECRET, str(error.exception))
            valid = dict(
                ENVIRONMENT="production", WORKER_CALLBACK_SECRET=TEST_SECRET,
                CELERY_BROKER_URL="redis://queue.invalid:6379/0",
                CELERY_RESULT_BACKEND="redis://queue.invalid:6379/1",
                S3_BUCKET_NAME="synthetic-fixtures", API_GATEWAY_INTERNAL_URL="http://gateway.invalid",
            )
            self.assertEqual(Settings(**valid).ENVIRONMENT, "production")
            hostport = {name: value for name, value in valid.items() if name != "API_GATEWAY_INTERNAL_URL"}
            self.assertEqual(
                Settings(**hostport, API_GATEWAY_HOSTPORT="gateway.invalid:10000").API_GATEWAY_INTERNAL_URL,
                "http://gateway.invalid:10000",
            )
            for secret in ("", "short", "CHANGEME_GENERATE_A_LONG_RANDOM_SECRET"):
                with self.assertRaises(ValidationError):
                    Settings(**{**valid, "WORKER_CALLBACK_SECRET": secret})
            for origin in ("file:///tmp/doc", "https://user:password@gateway.invalid", "https://gateway.invalid/other", "https://gateway.invalid?key=value"):
                with self.assertRaises(ValidationError):
                    Settings(**{**valid, "API_GATEWAY_INTERNAL_URL": origin})

    def test_no_implicit_env_file_or_insecure_credential_defaults(self):
        with patch.dict(os.environ, {}, clear=True):
            config = Settings()
            self.assertEqual(config.WORKER_CALLBACK_SECRET, "")
            self.assertEqual(config.AWS_ACCESS_KEY_ID, "")
            self.assertEqual(config.AWS_SECRET_ACCESS_KEY, "")
            self.assertFalse(Settings.model_config.get("env_file"))
