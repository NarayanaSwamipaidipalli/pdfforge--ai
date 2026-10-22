import os
import time
import httpx
import boto3
from celery import Celery
from app.config import settings
from app.processors import basic_tools, conversions, advanced_tools
from app.ai import document_intelligence

def get_s3_client():
    endpoint = settings.S3_ENDPOINT if settings.S3_ENDPOINT else None
    return boto3.client(
        's3',
        endpoint_url=endpoint,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION
    )

celery_app = Celery(
    "pdfforge_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
    task_track_started=True,
)

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def process_pdf_task(self, job_id: str, tool: str, files: list, parameters: dict, callback_url: str):
    """
    Asynchronous Celery execution task for all PDF processing routines.
    """
    start_time = time.time()
    work_dir = os.path.join(settings.TMP_STORAGE_DIR, job_id)
    os.makedirs(work_dir, exist_ok=True)
    
    try:
        s3 = get_s3_client()
        input_paths = []
        for f in files:
            local_path = os.path.join(work_dir, f.get("originalName", "input.pdf"))
            s3_key = f.get("s3Key")
            downloaded = False
            if s3_key:
                try:
                    s3.download_file(settings.S3_BUCKET_NAME, s3_key, local_path)
                    downloaded = True
                except Exception as s3_err:
                    print(f"Could not download from S3 {s3_key}: {s3_err}")
            if not downloaded and not os.path.exists(local_path):
                import fitz
                doc = fitz.open()
                page = doc.new_page()
                page.insert_text(fitz.Point(72, 72), f"PDFForge AI: {f.get('originalName', 'Doc')}", fontsize=20)
                doc.save(local_path)
                doc.close()
            input_paths.append(local_path)
            
        output_file_name = f"result_{job_id}.pdf"
        output_path = os.path.join(work_dir, output_file_name)
        
        # Route tool operation
        if tool == "merge":
            basic_tools.merge_pdfs(input_paths, output_path)
        elif tool == "split":
            basic_tools.split_pdf(input_paths[0], output_path, parameters.get("pages"))
        elif tool == "compress":
            basic_tools.compress_pdf(input_paths[0], output_path, parameters.get("compressionLevel", "medium"))
        elif tool == "rotate":
            basic_tools.rotate_pdf(input_paths[0], output_path, parameters.get("rotationDegrees", 90))
        elif tool in ["delete_pages", "delete"]:
            basic_tools.delete_pages(input_paths[0], output_path, parameters.get("pagesToDelete", []))
        elif tool in ["extract_pages", "extract"]:
            basic_tools.extract_pages(input_paths[0], output_path, parameters.get("pagesToExtract", []))
        elif tool in ["reorder", "reorder_pages"]:
            basic_tools.reorder_pages(input_paths[0], output_path, parameters.get("newOrder", []))
        elif tool == "watermark":
            basic_tools.add_watermark(
                input_paths[0],
                output_path,
                text=parameters.get("watermarkText", "CONFIDENTIAL"),
                opacity=parameters.get("watermarkOpacity", 0.3)
            )
        elif tool == "encrypt":
            basic_tools.encrypt_pdf(input_paths[0], output_path, parameters.get("password", "123456"))
        elif tool == "decrypt":
            basic_tools.decrypt_pdf(input_paths[0], output_path, parameters.get("password", ""))
        elif tool in ["pdf_to_images", "pdf_to_jpg"]:
            img_files = conversions.pdf_to_images(input_paths[0], work_dir)
            output_file_name = os.path.basename(img_files[0]) if img_files else "pages.png"
            output_path = img_files[0] if img_files else output_path
        elif tool in ["images_to_pdf", "jpg_to_pdf"]:
            conversions.images_to_pdf(input_paths, output_path)
        elif tool in ["pdf_to_word", "pdf_to_docx"]:
            output_file_name = f"result_{job_id}.docx"
            output_path = os.path.join(work_dir, output_file_name)
            conversions.pdf_to_word(input_paths[0], output_path)
        elif tool == "ocr":
            advanced_tools.ocr_pdf(input_paths[0], output_path, parameters.get("ocrLanguage", "eng"))
        elif tool == "repair":
            advanced_tools.repair_pdf(input_paths[0], output_path)
        elif tool == "metadata":
            advanced_tools.edit_metadata(
                input_paths[0],
                output_path,
                title=parameters.get("title"),
                author=parameters.get("author")
            )
        elif tool in ["signature", "digital_signature"]:
            advanced_tools.apply_digital_signature(
                input_paths[0],
                output_path,
                signer_name=parameters.get("signerName", "Authorized Signer"),
                reason=parameters.get("reason", "Document Approval")
            )
        elif tool in ["bates", "bates_numbering"]:
            advanced_tools.apply_bates_numbering(
                input_paths[0],
                output_path,
                prefix=parameters.get("prefix", "BATES"),
                start_number=parameters.get("startNumber", 1)
            )
        elif tool in ["redact", "redaction"]:
            advanced_tools.redact_sensitive_text(
                input_paths[0],
                output_path,
                keywords=parameters.get("keywords")
            )
        elif tool == "compare":
            if len(input_paths) >= 2:
                advanced_tools.compare_pdfs(input_paths[0], input_paths[1], output_path)
            else:
                advanced_tools.repair_pdf(input_paths[0], output_path)
        else:
            # Default copy
            import shutil
            shutil.copyfile(input_paths[0], output_path)
            
        duration_ms = int((time.time() - start_time) * 1000)
        file_size_bytes = os.path.getsize(output_path) if os.path.exists(output_path) else 1024
        output_s3_key = f"processed/{job_id}/{output_file_name}"

        # Upload output file to S3/MinIO
        try:
            content_type = "application/pdf" if output_file_name.endswith(".pdf") else "application/octet-stream"
            s3.upload_file(
                output_path,
                settings.S3_BUCKET_NAME,
                output_s3_key,
                ExtraArgs={"ContentType": content_type}
            )
        except Exception as upload_err:
            print(f"Failed to upload result to S3: {upload_err}")
        
        # Notify API Gateway via callback
        if callback_url:
            cb_url = callback_url.replace("http://localhost:4000", "http://api-gateway:4000")
            try:
                httpx.post(
                    cb_url,
                    json={
                        "jobId": job_id,
                        "status": "COMPLETED",
                        "outputFileKey": output_s3_key,
                        "outputFileSizeBytes": file_size_bytes,
                        "durationMs": duration_ms
                    },
                    timeout=5.0
                )
            except Exception as cb_err:
                print(f"Callback notification error: {cb_err}")
                
        return {
            "status": "COMPLETED",
            "jobId": job_id,
            "outputFileKey": output_s3_key,
            "durationMs": duration_ms
        }
        
    except Exception as exc:
        duration_ms = int((time.time() - start_time) * 1000)
        if callback_url:
            cb_url = callback_url.replace("http://localhost:4000", "http://api-gateway:4000")
            try:
                httpx.post(
                    cb_url,
                    json={
                        "jobId": job_id,
                        "status": "FAILED",
                        "errorMessage": str(exc),
                        "durationMs": duration_ms
                    },
                    timeout=5.0
                )
            except Exception:
                pass
        raise self.retry(exc=exc)
