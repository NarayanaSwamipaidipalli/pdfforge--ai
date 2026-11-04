import hmac
import logging
import os
import re
import tempfile
import warnings
from contextlib import contextmanager
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, FastAPI, Header, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, Field

from app.ai import document_intelligence
from app.celery_app import get_s3_client, process_pdf_task
from app.config import settings
from app.processors.invoice_generator import generate_invoice_pdf

warnings.filterwarnings("ignore", category=FutureWarning, module="fitz")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Doxera - PDF Processing Worker Engine",
    version="1.0.0",
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)


def require_worker_auth(
    x_pdfforge_worker_secret: Optional[str] = Header(default=None, alias="x-pdfforge-worker-secret"),
):
    expected = settings.WORKER_CALLBACK_SECRET
    if not expected:
        raise HTTPException(status_code=503, detail="Worker authentication is not configured")
    if not x_pdfforge_worker_secret or not hmac.compare_digest(
        x_pdfforge_worker_secret.encode("utf-8"), expected.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid worker authentication")


# Every API route shares this dependency, including future endpoints added here.
protected = APIRouter(prefix="/api/v1", dependencies=[Depends(require_worker_auth)])


class FileItem(BaseModel):
    id: UUID
    originalName: str = Field(min_length=1, max_length=255)
    s3Key: str = Field(min_length=1, max_length=1024)


class ProcessJobRequest(BaseModel):
    jobId: UUID
    tool: str = Field(min_length=1, max_length=100)
    files: List[FileItem] = Field(min_length=1, max_length=100)
    parameters: Dict[str, Any] = Field(default_factory=dict)
    callbackUrl: Optional[str] = None


@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "service": settings.APP_NAME}


@protected.post("/jobs/process")
async def dispatch_job(payload: ProcessJobRequest):
    if payload.callbackUrl:
        expected_callback = f"{settings.API_GATEWAY_INTERNAL_URL.rstrip('/')}/api/v1/pdf/jobs/callback"
        if not settings.API_GATEWAY_INTERNAL_URL or payload.callbackUrl != expected_callback:
            raise HTTPException(status_code=400, detail="Unapproved job callback URL")
    try:
        task = process_pdf_task.delay(
            str(payload.jobId), payload.tool,
            [f.model_dump(mode="json") for f in payload.files],
            payload.parameters, payload.callbackUrl,
        )
    except Exception:
        logger.warning("PDF processing queue unavailable")
        raise HTTPException(status_code=503, detail="Processing queue unavailable") from None
    return {"status": "ACCEPTED", "jobId": str(payload.jobId), "celeryTaskId": str(task.id)}


class GenerateInvoiceRequest(BaseModel):
    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[str] = None
    dueDate: Optional[str] = None
    customerName: Optional[str] = "Valued Customer"
    customerEmail: Optional[str] = "billing@company.com"
    organizationName: Optional[str] = "Enterprise Workspace"
    planTier: Optional[str] = "PRO"
    items: Optional[List[Dict[str, Any]]] = None
    currency: Optional[str] = "USD"
    checksum: Optional[str] = None


@protected.post("/invoices/generate")
async def generate_invoice_endpoint(payload: GenerateInvoiceRequest):
    try:
        pdf_bytes = generate_invoice_pdf(payload.model_dump())
    except Exception:
        raise HTTPException(status_code=500, detail="Invoice generation failed") from None
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", payload.invoiceNumber or "invoice")[:100]
    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}.pdf"'},
    )


@contextmanager
def downloaded_document(s3_key: str):
    with tempfile.TemporaryDirectory(prefix="pdfforge-ai-") as directory:
        path = os.path.join(directory, "document.pdf")
        try:
            get_s3_client().download_file(settings.S3_BUCKET_NAME, s3_key, path)
        except Exception:
            raise HTTPException(status_code=502, detail="Document download failed") from None
        yield path


class AiBaseRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    s3Key: str = Field(min_length=1, max_length=1024)


class AiSummarizeRequest(AiBaseRequest):
    focusTopics: Optional[List[str]] = None
    targetLength: Optional[str] = "balanced"


class AiChatRequest(AiBaseRequest):
    question: str = Field(min_length=1)


def run_document_operation(s3_key, operation, **kwargs):
    with downloaded_document(s3_key) as local_path:
        try:
            return operation(local_path, **kwargs)
        except Exception:
            raise HTTPException(status_code=500, detail="Document analysis failed") from None


@protected.post("/ai/summarize")
async def ai_summarize_endpoint(payload: AiSummarizeRequest):
    return run_document_operation(
        payload.s3Key, document_intelligence.summarize_document,
        focus_topics=payload.focusTopics, target_length=payload.targetLength or "balanced",
    )


@protected.post("/ai/chat")
async def ai_chat_endpoint(payload: AiChatRequest):
    return run_document_operation(payload.s3Key, document_intelligence.chat_with_document, question=payload.question)


@protected.post("/ai/extract-invoice")
async def ai_extract_invoice_endpoint(payload: AiBaseRequest):
    return run_document_operation(payload.s3Key, document_intelligence.extract_invoice_data)


@protected.post("/ai/analyze-contract")
async def ai_analyze_contract_endpoint(payload: AiBaseRequest):
    return run_document_operation(payload.s3Key, document_intelligence.analyze_contract_data)


@protected.post("/ai/extract-text")
async def ai_extract_text_endpoint(payload: AiBaseRequest):
    return run_document_operation(payload.s3Key, document_intelligence.extract_tables_and_text)


app.include_router(protected)
