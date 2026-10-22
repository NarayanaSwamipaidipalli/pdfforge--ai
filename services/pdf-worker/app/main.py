from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from app.config import settings
from app.celery_app import process_pdf_task

app = FastAPI(
    title="PDFForge AI - PDF Processing Worker Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

class FileItem(BaseModel):
    id: str
    originalName: str
    s3Key: str

class ProcessJobRequest(BaseModel):
    jobId: str
    tool: str
    files: List[FileItem]
    parameters: Optional[Dict[str, Any]] = {}
    callbackUrl: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "supportedTools": [
            "merge", "split", "compress", "rotate", "delete_pages",
            "extract_pages", "reorder", "watermark", "encrypt", "decrypt",
            "pdf_to_word", "pdf_to_excel", "pdf_to_images", "images_to_pdf",
            "ocr", "compare", "repair", "metadata", "signature", "bates", "redact"
        ]
    }

@app.post("/api/v1/jobs/process")
async def dispatch_job(payload: ProcessJobRequest, background_tasks: BackgroundTasks):
    """
    Accepts processing requests from API Gateway and dispatches to Celery queue
    or background worker thread.
    """
    try:
        # Enqueue in Celery
        task = process_pdf_task.delay(
            payload.jobId,
            payload.tool,
            [f.model_dump() for f in payload.files],
            payload.parameters,
            payload.callbackUrl
        )
        return {
            "status": "ACCEPTED",
            "jobId": payload.jobId,
            "celeryTaskId": str(task.id)
        }
    except Exception as e:
        # Fallback to local background tasks if Redis broker isn't active in dev
        background_tasks.add_task(
            process_pdf_task,
            None,
            payload.jobId,
            payload.tool,
            [f.model_dump() for f in payload.files],
            payload.parameters,
            payload.callbackUrl
        )
        return {
            "status": "ACCEPTED_LOCAL_FALLBACK",
            "jobId": payload.jobId,
            "info": str(e)
        }

from fastapi.responses import Response
from app.processors.invoice_generator import generate_invoice_pdf

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

@app.post("/api/v1/invoices/generate")
async def generate_invoice_endpoint(payload: GenerateInvoiceRequest):
    """
    Generates an enterprise vector PDF invoice receipt using ReportLab.
    """
    try:
        pdf_bytes = generate_invoice_pdf(payload.model_dump())
        filename = payload.invoiceNumber or "invoice"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename={filename}.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice generation failed: {str(e)}")
