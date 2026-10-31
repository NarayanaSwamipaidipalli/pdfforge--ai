import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="fitz")

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
from app.celery_app import get_s3_client
from app.ai import document_intelligence
import tempfile
import os

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

def download_temp_s3_file(s3_key: str) -> str:
    s3 = get_s3_client()
    suffix = os.path.splitext(s3_key)[1] or ".pdf"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp_path = tmp.name
    tmp.close()
    s3.download_file(settings.S3_BUCKET_NAME, s3_key, tmp_path)
    return tmp_path

class AiBaseRequest(BaseModel):
    s3Key: Optional[str] = None
    localPath: Optional[str] = None

class AiSummarizeRequest(AiBaseRequest):
    focusTopics: Optional[List[str]] = None
    targetLength: Optional[str] = "balanced"

class AiChatRequest(AiBaseRequest):
    question: str

class AiExtractInvoiceRequest(AiBaseRequest):
    pass

class AiAnalyzeContractRequest(AiBaseRequest):
    pass

class AiExtractTextRequest(AiBaseRequest):
    pass

@app.post("/api/v1/ai/summarize")
async def ai_summarize_endpoint(payload: AiSummarizeRequest):
    path_to_clean = None
    try:
        if payload.s3Key:
            local_path = download_temp_s3_file(payload.s3Key)
            path_to_clean = local_path
        elif payload.localPath and os.path.exists(payload.localPath):
            local_path = payload.localPath
        else:
            raise HTTPException(status_code=400, detail="Must provide valid s3Key or localPath")
            
        result = document_intelligence.summarize_document(
            local_path,
            focus_topics=payload.focusTopics,
            target_length=payload.targetLength or "balanced"
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Summarization failed: {str(e)}")
    finally:
        if path_to_clean and os.path.exists(path_to_clean):
            try:
                os.remove(path_to_clean)
            except Exception:
                pass

@app.post("/api/v1/ai/chat")
async def ai_chat_endpoint(payload: AiChatRequest):
    path_to_clean = None
    try:
        if payload.s3Key:
            local_path = download_temp_s3_file(payload.s3Key)
            path_to_clean = local_path
        elif payload.localPath and os.path.exists(payload.localPath):
            local_path = payload.localPath
        else:
            raise HTTPException(status_code=400, detail="Must provide valid s3Key or localPath")
            
        result = document_intelligence.chat_with_document(local_path, payload.question)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Chat failed: {str(e)}")
    finally:
        if path_to_clean and os.path.exists(path_to_clean):
            try:
                os.remove(path_to_clean)
            except Exception:
                pass

@app.post("/api/v1/ai/extract-invoice")
async def ai_extract_invoice_endpoint(payload: AiExtractInvoiceRequest):
    path_to_clean = None
    try:
        if payload.s3Key:
            local_path = download_temp_s3_file(payload.s3Key)
            path_to_clean = local_path
        elif payload.localPath and os.path.exists(payload.localPath):
            local_path = payload.localPath
        else:
            raise HTTPException(status_code=400, detail="Must provide valid s3Key or localPath")
            
        result = document_intelligence.extract_invoice_data(local_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice extraction failed: {str(e)}")
    finally:
        if path_to_clean and os.path.exists(path_to_clean):
            try:
                os.remove(path_to_clean)
            except Exception:
                pass

@app.post("/api/v1/ai/analyze-contract")
async def ai_analyze_contract_endpoint(payload: AiAnalyzeContractRequest):
    path_to_clean = None
    try:
        if payload.s3Key:
            local_path = download_temp_s3_file(payload.s3Key)
            path_to_clean = local_path
        elif payload.localPath and os.path.exists(payload.localPath):
            local_path = payload.localPath
        else:
            raise HTTPException(status_code=400, detail="Must provide valid s3Key or localPath")
            
        result = document_intelligence.analyze_contract_data(local_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract analysis failed: {str(e)}")
    finally:
        if path_to_clean and os.path.exists(path_to_clean):
            try:
                os.remove(path_to_clean)
            except Exception:
                pass

@app.post("/api/v1/ai/extract-text")
async def ai_extract_text_endpoint(payload: AiExtractTextRequest):
    path_to_clean = None
    try:
        if payload.s3Key:
            local_path = download_temp_s3_file(payload.s3Key)
            path_to_clean = local_path
        elif payload.localPath and os.path.exists(payload.localPath):
            local_path = payload.localPath
        else:
            raise HTTPException(status_code=400, detail="Must provide valid s3Key or localPath")
            
        result = document_intelligence.extract_tables_and_text(local_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Text extraction failed: {str(e)}")
    finally:
        if path_to_clean and os.path.exists(path_to_clean):
            try:
                os.remove(path_to_clean)
            except Exception:
                pass
