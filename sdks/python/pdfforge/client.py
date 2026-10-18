import os
import hmac
import hashlib
import time
from typing import Optional, List, Dict, Any, Union
import requests

from .models import (
    FileRecord,
    PresignUploadResponse,
    ProcessingJob,
    AiSummaryResponse,
    AiChatResponse,
    InvoiceExtractionResult,
    ContractAnalysisResult,
)
from .exceptions import (
    PDFForgeError,
    AuthenticationError,
    RateLimitError,
    JobFailedError,
    JobTimeoutError,
)

class _AiNamespace:
    def __init__(self, client: "PDFForgeClient"):
        self._client = client

    def summarize(
        self,
        file_id: str,
        mode: str = "bullet_points",
        provider: str = "openai",
        model: Optional[str] = None,
    ) -> AiSummaryResponse:
        payload = {"fileId": file_id, "mode": mode, "provider": provider}
        if model:
            payload["model"] = model
        data = self._client._request("POST", "/ai/summarize", json=payload)
        return AiSummaryResponse.model_validate(data)

    def chat(
        self,
        file_id: str,
        message: str,
        conversation_history: Optional[List[Dict[str, str]]] = None,
        provider: str = "openai",
        model: Optional[str] = None,
    ) -> AiChatResponse:
        payload = {
            "fileId": file_id,
            "message": message,
            "conversationHistory": conversation_history or [],
            "provider": provider,
        }
        if model:
            payload["model"] = model
        data = self._client._request("POST", "/ai/chat", json=payload)
        return AiChatResponse.model_validate(data)

    def extract_invoice(self, file_id: str, provider: Optional[str] = None) -> InvoiceExtractionResult:
        payload = {"fileId": file_id}
        if provider:
            payload["provider"] = provider
        data = self._client._request("POST", "/ai/extract/invoice", json=payload)
        return InvoiceExtractionResult.model_validate(data)

    def analyze_contract(self, file_id: str, provider: Optional[str] = None) -> ContractAnalysisResult:
        payload = {"fileId": file_id}
        if provider:
            payload["provider"] = provider
        data = self._client._request("POST", "/ai/analyze/contract", json=payload)
        return ContractAnalysisResult.model_validate(data)

class PDFForgeClient:
    """
    Synchronous Python Client for PDFForge AI Enterprise Platform.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        access_token: Optional[str] = None,
        base_url: str = "http://localhost:4000/api/v1",
        timeout: float = 60.0,
    ):
        self.api_key = api_key or os.environ.get("PDFFORGE_API_KEY")
        self.access_token = access_token
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()
        self.ai = _AiNamespace(self)

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "PDFForge-PythonSDK/1.0.0",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        elif self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {**self._get_headers(), **kwargs.pop("headers", {})}

        try:
            resp = self.session.request(method, url, headers=headers, timeout=self.timeout, **kwargs)
        except requests.RequestException as e:
            raise PDFForgeError(f"Network error: {str(e)}")

        if not resp.ok:
            try:
                body = resp.json()
            except Exception:
                body = {"message": resp.text}

            msg = body.get("message", f"Request failed with status {resp.status_code}")
            if resp.status_code == 401:
                raise AuthenticationError(msg)
            elif resp.status_code == 429:
                retry = int(resp.headers.get("Retry-After", 60))
                raise RateLimitError(msg, retry_after=retry)
            else:
                raise PDFForgeError(msg, status_code=resp.status_code, response_body=body)

        return resp.json()

    # ==========================================
    # FILE UPLOAD & MANAGEMENT
    # ==========================================

    def upload_file(
        self,
        file_input: Union[str, bytes],
        filename: Optional[str] = None,
        mime_type: str = "application/pdf",
    ) -> FileRecord:
        """Uploads a local file or raw bytes to PDFForge S3 storage."""
        if isinstance(file_input, str):
            if not filename:
                filename = os.path.basename(file_input)
            with open(file_input, "rb") as f:
                content = f.read()
        else:
            content = file_input
            if not filename:
                filename = "document.pdf"

        file_size = len(content)

        # 1. Obtain presigned URL
        presign_data = self._request(
            "POST",
            "/files/presign-upload",
            json={"fileName": filename, "fileSizeBytes": file_size, "mimeType": mime_type},
        )
        presign = PresignUploadResponse.model_validate(presign_data)

        # 2. Upload directly to S3 / MinIO
        s3_resp = requests.put(presign.uploadUrl, data=content, headers={"Content-Type": mime_type})
        if not s3_resp.ok:
            raise PDFForgeError(f"Storage upload failed with HTTP {s3_resp.status_code}")

        # 3. Confirm upload
        confirmed = self._request("POST", "/files/confirm-upload", json={"fileId": presign.fileId})
        return FileRecord.model_validate(confirmed)

    def get_download_url(self, file_id: str) -> str:
        """Generates a temporary signed download URL for an output document."""
        data = self._request("GET", f"/files/{file_id}/download")
        return data["downloadUrl"]

    def download_file(self, file_id: str, output_path: Optional[str] = None) -> bytes:
        """Downloads the file content and optionally writes it to disk."""
        url = self.get_download_url(file_id)
        resp = requests.get(url)
        if not resp.ok:
            raise PDFForgeError(f"Download failed with HTTP {resp.status_code}")
        
        content = resp.content
        if output_path:
            with open(output_path, "wb") as f:
                f.write(content)
        return content

    # ==========================================
    # JOB DISPATCH & PROCESSING
    # ==========================================

    def create_job(
        self,
        tool: str,
        file_ids: List[str],
        parameters: Optional[Dict[str, Any]] = None,
        webhook_url: Optional[str] = None,
    ) -> ProcessingJob:
        payload = {
            "tool": tool,
            "fileIds": file_ids,
            "parameters": parameters or {},
        }
        if webhook_url:
            payload["webhookUrl"] = webhook_url
        data = self._request("POST", "/pdf/jobs", json=payload)
        return ProcessingJob.model_validate(data)

    def get_job(self, job_id: str) -> ProcessingJob:
        data = self._request("GET", f"/pdf/jobs/{job_id}")
        return ProcessingJob.model_validate(data)

    def wait_for_job(
        self,
        job_id: str,
        poll_interval: float = 1.0,
        timeout: float = 120.0,
    ) -> ProcessingJob:
        start_time = time.time()
        while time.time() - start_time < timeout:
            job = self.get_job(job_id)
            if job.status == "COMPLETED":
                return job
            if job.status == "FAILED":
                raise JobFailedError(job_id, job.errorMessage or "Job execution failed")
            time.sleep(poll_interval)
        raise JobTimeoutError(job_id, timeout)

    def process(
        self,
        tool: str,
        files: List[Union[str, bytes]],
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ProcessingJob:
        """Convenience helper: Uploads files, creates job, and blocks until finished."""
        uploaded_ids = []
        for item in files:
            rec = self.upload_file(item)
            uploaded_ids.append(rec.id)

        job = self.create_job(tool, uploaded_ids, parameters)
        return self.wait_for_job(job.id)

    # ==========================================
    # WEBHOOK SECURITY
    # ==========================================

    @staticmethod
    def verify_webhook_signature(raw_payload: bytes, signature_header: str, secret: str) -> bool:
        """Verifies the HMAC-SHA256 signature of incoming webhooks."""
        if not signature_header or not secret:
            return False
        computed = hmac.new(secret.encode("utf-8"), raw_payload, hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, signature_header)
