"""Task boundary tests never use S3, Redis or an HTTP service."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app import celery_app as worker


JOB_ID = "2d730da9-bf59-4c7c-b3ac-a4dcd2bf6c34"
FILE = {"id": "e3258349-0dc7-4691-bdf3-3104258e9142", "originalName": "fixture.docx", "s3Key": "fixture.docx"}
CALLBACK = "http://gateway.invalid/api/v1/pdf/jobs/callback"


class WorkerTaskSecurityTests(unittest.TestCase):
    def test_unapproved_callbacks_and_job_paths_rejected_before_side_effects(self):
        with patch.object(worker, "get_s3_client") as s3, patch.object(worker.httpx, "post") as callback:
            for job_id, url in (("../../outside", None), (JOB_ID, "https://attacker.invalid")):
                with self.assertRaises(ValueError):
                    worker.process_pdf_task.run(job_id, "word-to-pdf", [FILE], {}, url)
            s3.assert_not_called()
            callback.assert_not_called()

    def test_upload_failure_never_reports_completion_or_touches_existing_directory(self):
        with tempfile.TemporaryDirectory(prefix="isolated-job-test-") as temporary:
            existing = Path(temporary) / JOB_ID
            existing.mkdir()
            sentinel = existing / "existing-data.txt"
            sentinel.write_text("keep", encoding="utf-8")
            s3 = MagicMock()
            s3.download_file.side_effect = lambda bucket, key, destination: Path(destination).write_bytes(b"synthetic-docx")
            s3.upload_file.side_effect = RuntimeError("synthetic-sensitive-backend-error")

            def convert(source, directory):
                output = Path(directory) / "converted.pdf"
                output.write_bytes(b"%PDF-synthetic-output")
                return str(output)

            with patch.multiple(worker.settings, TMP_STORAGE_DIR=temporary, API_GATEWAY_INTERNAL_URL="http://gateway.invalid", WORKER_CALLBACK_SECRET="synthetic-job-regression-secret-credential"), patch.object(worker, "get_s3_client", return_value=s3), patch.object(worker.conversions, "office_to_pdf", side_effect=convert), patch.object(worker.httpx, "post") as callback, patch.object(worker.process_pdf_task, "retry", side_effect=RuntimeError("retry-requested")) as retry:
                with self.assertRaisesRegex(RuntimeError, "retry-requested"):
                    worker.process_pdf_task.run(JOB_ID, "word-to-pdf", [FILE], {}, CALLBACK)
                self.assertEqual(callback.call_count, 1)
                self.assertEqual(callback.call_args.kwargs["json"]["status"], "FAILED")
                self.assertEqual(callback.call_args.kwargs["json"]["errorMessage"], "Document processing failed")
                self.assertEqual(str(retry.call_args.kwargs["exc"]), "Document processing failed")
            self.assertEqual(sentinel.read_text(encoding="utf-8"), "keep")
            self.assertEqual(list(Path(temporary).iterdir()), [existing])
