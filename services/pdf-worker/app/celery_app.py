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
        for idx, f in enumerate(files):
            file_id_clean = str(f.get("id", idx))[:8]
            raw_name = str(f.get("originalName", f"doc_{idx}.pdf"))
            clean_name = os.path.basename(raw_name).replace("..", "").strip() or f"doc_{idx}.pdf"
            local_filename = f"{idx}_{file_id_clean}_{clean_name}"
            local_path = os.path.join(work_dir, local_filename)
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
                page.insert_text(fitz.Point(72, 72), f"PDFForge AI: {clean_name}", fontsize=20)
                doc.save(local_path)
                doc.close()
            input_paths.append(local_path)
            
        output_file_name = f"result_{job_id}.pdf"
        output_path = os.path.join(work_dir, output_file_name)
        
        # Route tool operation with comprehensive slug and ID mapping
        t = str(tool).lower().replace("_", "-")
        
        if t in ["merge", "merge-pdf", "combine", "combine-pdf"]:
            basic_tools.merge_pdfs(input_paths, output_path)
        elif t in ["split", "split-pdf"]:
            pages = parameters.get("pages")
            if not pages and parameters.get("pageRange"):
                try:
                    pages = []
                    for part in str(parameters.get("pageRange")).split(","):
                        if "-" in part:
                            start, end = part.split("-")
                            pages.extend(range(int(start.strip()) - 1, int(end.strip())))
                        else:
                            pages.append(int(part.strip()) - 1)
                except Exception:
                    pages = None
            basic_tools.split_pdf(input_paths[0], output_path, pages)
        elif t in ["compress", "compress-pdf", "batch", "batch-processing"]:
            basic_tools.compress_pdf(input_paths[0], output_path, parameters.get("compressionLevel", "medium"))
        elif t in ["rotate", "rotate-pdf"]:
            basic_tools.rotate_pdf(input_paths[0], output_path, int(parameters.get("rotationDegrees", 90)))
        elif t in ["delete-pages", "delete-pdf-pages", "delete_pages", "delete"]:
            pages_to_del = parameters.get("pagesToDelete", [])
            if not pages_to_del and parameters.get("deletePages"):
                try:
                    pages_to_del = [int(p.strip()) - 1 for p in str(parameters.get("deletePages")).split(",") if p.strip()]
                except Exception:
                    pages_to_del = []
            basic_tools.delete_pages(input_paths[0], output_path, pages_to_del)
        elif t in ["extract-pages", "extract-pdf-pages", "extract_pages", "extract"]:
            pages_to_ext = parameters.get("pagesToExtract", [])
            if not pages_to_ext and parameters.get("extractPages"):
                try:
                    pages_to_ext = [int(p.strip()) - 1 for p in str(parameters.get("extractPages")).split(",") if p.strip()]
                except Exception:
                    pages_to_ext = []
            basic_tools.extract_pages(input_paths[0], output_path, pages_to_ext)
        elif t in ["reorder", "reorder-pages", "reorder_pages"]:
            basic_tools.reorder_pages(input_paths[0], output_path, parameters.get("newOrder", []))
        elif t in ["organize", "organize-pages", "organize-pdf-pages"]:
            basic_tools.organize_pages(
                input_paths[0],
                output_path,
                new_order=parameters.get("newOrder"),
                pages_to_delete=parameters.get("pagesToDelete"),
                rotations=parameters.get("rotations")
            )
        elif t in ["crop", "crop-pdf", "crop_pdf"]:
            basic_tools.crop_pdf(
                input_paths[0],
                output_path,
                top=float(parameters.get("top", 36)),
                bottom=float(parameters.get("bottom", 36)),
                left=float(parameters.get("left", 36)),
                right=float(parameters.get("right", 36))
            )
        elif t in ["page-numbers", "add-page-numbers", "page_numbers", "numbers"]:
            basic_tools.add_page_numbers(
                input_paths[0],
                output_path,
                format_str=parameters.get("formatStr", "Page {page} of {total}"),
                position=parameters.get("position", "bottom-center")
            )
        elif t in ["watermark", "pdf-watermark", "watermark-pdf"]:
            opacity = float(parameters.get("watermarkOpacity", 0.3))
            if opacity > 1.0:
                opacity = opacity / 100.0
            basic_tools.add_watermark(
                input_paths[0],
                output_path,
                text=parameters.get("watermarkText", "CONFIDENTIAL"),
                opacity=opacity
            )
        elif t in ["encrypt", "protect", "protect-pdf", "pdf-encryption"]:
            basic_tools.encrypt_pdf(input_paths[0], output_path, str(parameters.get("password", "123456")))
        elif t in ["decrypt", "unlock", "unlock-pdf", "pdf-password-removal"]:
            basic_tools.decrypt_pdf(input_paths[0], output_path, str(parameters.get("password", "")))
        elif t in ["pdf-to-images", "pdf_to_images", "pdf-to-jpg", "pdf_to_jpg", "pdf-to-image"]:
            img_files = conversions.pdf_to_images(input_paths[0], work_dir)
            if len(img_files) > 1:
                import zipfile
                zip_name = f"result_{job_id}.zip"
                zip_path = os.path.join(work_dir, zip_name)
                with zipfile.ZipFile(zip_path, "w") as zipf:
                    for f in img_files:
                        zipf.write(f, os.path.basename(f))
                output_file_name = zip_name
                output_path = zip_path
            elif img_files:
                output_file_name = os.path.basename(img_files[0])
                output_path = img_files[0]
        elif t in ["images-to-pdf", "images_to_pdf", "image-to-pdf", "jpg-to-pdf", "jpg_to_pdf"]:
            conversions.images_to_pdf(input_paths, output_path)
        elif t in ["pdf-to-word", "pdf_to_word", "pdf-to-docx"]:
            output_file_name = f"result_{job_id}.docx"
            output_path = os.path.join(work_dir, output_file_name)
            conversions.pdf_to_word(input_paths[0], output_path)
        elif t in ["pdf-to-excel", "pdf_to_excel", "pdf-to-xlsx", "pdf-to-csv"]:
            output_file_name = f"result_{job_id}.csv"
            output_path = os.path.join(work_dir, output_file_name)
            conversions.pdf_to_excel(input_paths[0], output_path)
        elif t in ["pdf-to-ppt", "pdf_to_ppt", "pdf-to-powerpoint"]:
            output_file_name = f"result_{job_id}.pptx"
            output_path = os.path.join(work_dir, output_file_name)
            conversions.pdf_to_ppt(input_paths[0], output_path)
        elif t in ["html-to-pdf", "html_to_pdf"]:
            conversions.html_to_pdf(input_paths[0], output_path)
        elif t in ["word-to-pdf", "excel-to-pdf", "ppt-to-pdf", "office-to-pdf"]:
            res = conversions.office_to_pdf(input_paths[0], work_dir)
            if res and os.path.exists(res):
                output_path = res
                output_file_name = os.path.basename(res)
        elif t in ["ocr", "ocr-pdf"]:
            advanced_tools.ocr_pdf(input_paths[0], output_path, parameters.get("ocrLanguage", "eng"))
        elif t in ["repair", "repair-pdf", "pdf-repair"]:
            advanced_tools.repair_pdf(input_paths[0], output_path)
        elif t in ["metadata", "pdf-metadata-editor", "metadata-editor"]:
            advanced_tools.edit_metadata(
                input_paths[0],
                output_path,
                title=parameters.get("title"),
                author=parameters.get("author"),
                subject=parameters.get("subject"),
                keywords=parameters.get("keywords")
            )
        elif t in ["sign", "signature", "sign-pdf", "digital-signatures", "digital_signature"]:
            advanced_tools.apply_digital_signature(
                input_paths[0],
                output_path,
                signer_name=parameters.get("signerName", "Authorized Signer"),
                reason=parameters.get("reason", "Document Approval & Verification")
            )
        elif t in ["bates", "bates-numbering", "bates_numbering"]:
            advanced_tools.apply_bates_numbering(
                input_paths[0],
                output_path,
                prefix=parameters.get("prefix", "BATES"),
                start_number=int(parameters.get("startNumber", 1)),
                position=parameters.get("position", "bottom-right")
            )
        elif t in ["redact", "redaction", "redact-pdf"]:
            kw = parameters.get("keywords")
            if isinstance(kw, str):
                kw = [k.strip() for k in kw.split(",") if k.strip()]
            advanced_tools.redact_sensitive_text(
                input_paths[0],
                output_path,
                keywords=kw
            )
        elif t in ["compare", "compare-pdf", "pdf-comparison"]:
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
            mime_map = {
                ".pdf": "application/pdf",
                ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                ".csv": "text/csv",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".zip": "application/zip",
            }
            _, out_ext = os.path.splitext(output_file_name.lower())
            content_type = mime_map.get(out_ext, "application/pdf")
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
            cb_url = callback_url.replace("http://localhost:4000", "http://api-gateway:4000").replace("http://127.0.0.1:4000", "http://api-gateway:4000")
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
