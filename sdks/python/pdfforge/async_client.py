import os
import asyncio
from typing import Optional, List, Dict, Any, Union
import httpx

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

class _AsyncAiNamespace:
    def __init__(self, client: "AsyncPDFForgeClient"):
        self._client = client

    async def summarize(
        self,
        file_id: str,
        mode: str = "bullet_points",
        provider: str = "openai",
        model: Optional[str] = None,
    ) -> AiSummaryResponse:
        payload = {"fileId": file_id, "mode": mode, "provider": provider}
        if model:
            payload["model"] = model
        data = await self._client._request("POST", "/ai/summarize", json=payload)
        return AiSummaryResponse.model_validate(data)

    async def chat(
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
        data = await self._client._request("POST", "/ai/chat", json=payload)
        return AiChatResponse.model_validate(data)

    async def extract_invoice(self, file_id: str, provider: Optional[str] = None) -> InvoiceExtractionResult:
        payload = {"fileId": file_id}
        if provider:
            payload["provider"] = provider
        data = await self._client._request("POST", "/ai/extract/invoice", json=payload)
        return InvoiceExtractionResult.model_validate(data)

    async def analyze_contract(self, file_id: str, provider: Optional[str] = None) -> ContractAnalysisResult:
        payload = {"fileId": file_id}
        if provider:
            payload["provider"] = provider
        data = await self._client._request("POST", "/ai/analyze/contract", json=payload)
        return ContractAnalysisResult.model_validate(data)

class AsyncPDFForgeClient:
    """
    Asynchronous Python Client for PDFForge AI Enterprise Platform using httpx.
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
        self.client = httpx.AsyncClient(timeout=timeout)
        self.ai = _AsyncAiNamespace(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def close(self):
        await self.client.aclose()

    def _get_headers(self) -> Dict[str, str]:
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "PDFForge-AsyncPythonSDK/1.0.0",
        }
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        elif self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        return headers

    async def _request(self, method: str, endpoint: str, **kwargs) -> Any:
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {**self._get_headers(), **kwargs.pop("headers", {})}

        try:
            resp = await self.client.request(method, url, headers=headers, **kwargs)
        except httpx.HTTPError as e:
            raise PDFForgeError(f"Async network error: {str(e)}")

        if not resp.is_success:
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

    async def upload_file(
        self,
        file_input: Union[str, bytes],
        filename: Optional[str] = None,
        mime_type: str = "application/pdf",
    ) -> FileRecord:
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

        presign_data = await self._request(
            "POST",
            "/files/presign-upload",
            json={"fileName": filename, "fileSizeBytes": file_size, "mimeType": mime_type},
        )
        presign = PresignUploadResponse.model_validate(presign_data)

        # Upload directly to S3
        s3_resp = await self.client.put(presign.uploadUrl, content=content, headers={"Content-Type": mime_type})
        if not s3_resp.is_success:
            raise PDFForgeError(f"Async S3 upload failed with status {s3_resp.status_code}")

        confirmed = await self._request("POST", "/files/confirm-upload", json={"fileId": presign.fileId})
        return FileRecord.model_validate(confirmed)

    async def create_job(
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
        data = await self._request("POST", "/pdf/jobs", json=payload)
        return ProcessingJob.model_validate(data)

    async def get_job(self, job_id: str) -> ProcessingJob:
        data = await self._request("GET", f"/pdf/jobs/{job_id}")
        return ProcessingJob.model_validate(data)

    async def wait_for_job(
        self,
        job_id: str,
        poll_interval: float = 1.0,
        timeout: float = 120.0,
    ) -> ProcessingJob:
        start_time = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - start_time < timeout:
            job = await self.get_job(job_id)
            if job.status == "COMPLETED":
                return job
            if job.status == "FAILED":
                raise JobFailedError(job_id, job.errorMessage or "Job execution failed")
            await asyncio.sleep(poll_interval)
        raise JobTimeoutError(job_id, timeout)

    async def process(
        self,
        tool: str,
        files: List[Union[str, bytes]],
        parameters: Optional[Dict[str, Any]] = None,
    ) -> ProcessingJob:
        uploaded_ids = []
        for item in files:
            rec = await self.upload_file(item)
            uploaded_ids.append(rec.id)

        job = await self.create_job(tool, uploaded_ids, parameters)
        return await self.wait_for_job(job.id)
