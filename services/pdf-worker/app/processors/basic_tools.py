import os
import io
from typing import List, Optional, Dict, Any
import fitz  # PyMuPDF
from PIL import Image

def merge_pdfs(input_paths: List[str], output_path: str) -> str:
    """Merges multiple PDF documents into a single sequential PDF."""
    result_doc = fitz.open()
    for path in input_paths:
        with fitz.open(path) as doc:
            result_doc.insert_pdf(doc)
    result_doc.save(output_path, garbage=4, deflate=True)
    result_doc.close()
    return output_path

def split_pdf(input_path: str, output_path: str, page_ranges: Optional[List[int]] = None) -> str:
    """Splits or slices specified pages from a PDF document."""
    doc = fitz.open(input_path)
    result_doc = fitz.open()
    
    total_pages = len(doc)
    pages_to_keep = page_ranges if page_ranges else list(range(total_pages))
    
    for p in pages_to_keep:
        if 0 <= p < total_pages:
            result_doc.insert_pdf(doc, from_page=p, to_page=p)
            
    result_doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    result_doc.close()
    return output_path

def compress_pdf(input_path: str, output_path: str, level: str = "medium") -> str:
    """
    Compresses PDF using vector garbage collection, stream deflation,
    and genuine image resolution downsampling.
    """
    doc = fitz.open(input_path)
    
    quality = 75
    max_dim = 1600
    if level in ["high", "extreme"]:
        quality = 50
        max_dim = 1000
    elif level == "low":
        quality = 85
        max_dim = 2000

    # Downsample and recompress embedded images
    for page in doc:
        image_list = page.get_images(full=True)
        for img_info in image_list:
            xref = img_info[0]
            try:
                base_image = doc.extract_image(xref)
                if not base_image:
                    continue
                image_bytes = base_image.get("image")
                if not image_bytes:
                    continue
                
                with Image.open(io.BytesIO(image_bytes)) as pil_img:
                    # Check if resizing is needed
                    orig_w, orig_h = pil_img.size
                    if orig_w > max_dim or orig_h > max_dim:
                        scale = min(max_dim / orig_w, max_dim / orig_h)
                        new_w = max(1, int(orig_w * scale))
                        new_h = max(1, int(orig_h * scale))
                        pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    
                    if pil_img.mode in ("RGBA", "P"):
                        pil_img = pil_img.convert("RGB")
                    
                    out_buffer = io.BytesIO()
                    pil_img.save(out_buffer, format="JPEG", quality=quality, optimize=True)
                    compressed_bytes = out_buffer.getvalue()
                    
                    # Only replace if actually smaller
                    if len(compressed_bytes) < len(image_bytes):
                        doc.replace_image(xref, stream=compressed_bytes)
            except Exception:
                continue

    doc.save(
        output_path,
        garbage=4,
        deflate=True,
        deflate_images=True,
        deflate_fonts=True,
        clean=True,
        linear=True  # Fast Web View
    )
    doc.close()
    return output_path

def rotate_pdf(input_path: str, output_path: str, degrees: int = 90, pages: Optional[List[int]] = None) -> str:
    """Rotates all or specified pages in the PDF by 90, 180, or 270 degrees."""
    doc = fitz.open(input_path)
    for i, page in enumerate(doc):
        if pages is None or i in pages:
            current_rotation = page.rotation
            page.set_rotation((current_rotation + degrees) % 360)
            
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def delete_pages(input_path: str, output_path: str, pages_to_delete: List[int]) -> str:
    """Removes targeted page numbers (0-indexed) from the PDF document."""
    doc = fitz.open(input_path)
    for p in sorted(pages_to_delete, reverse=True):
        if 0 <= p < len(doc):
            doc.delete_page(p)
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    return output_path

def extract_pages(input_path: str, output_path: str, pages_to_extract: List[int]) -> str:
    """Extracts only targeted page numbers into a standalone PDF."""
    return split_pdf(input_path, output_path, pages_to_extract)

def reorder_pages(input_path: str, output_path: str, new_order: List[int]) -> str:
    """Rearranges the page order of a PDF to match new_order list."""
    doc = fitz.open(input_path)
    result_doc = fitz.open()
    
    for p in new_order:
        if 0 <= p < len(doc):
            result_doc.insert_pdf(doc, from_page=p, to_page=p)
            
    result_doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    result_doc.close()
    return output_path

def organize_pages(
    input_path: str,
    output_path: str,
    new_order: Optional[List[int]] = None,
    pages_to_delete: Optional[List[int]] = None,
    rotations: Optional[Dict[int, int]] = None
) -> str:
    """
    Unified page organizer: deletes unneeded pages, reorders remaining,
    and applies selective rotations in a single pass.
    """
    doc = fitz.open(input_path)
    total = len(doc)
    to_delete = set(pages_to_delete or [])
    
    # Determine base order
    base_order = [p for p in (new_order or list(range(total))) if p not in to_delete and 0 <= p < total]
    if not base_order:
        base_order = [p for p in range(total) if p not in to_delete]
    if not base_order:
        base_order = [0]
        
    result_doc = fitz.open()
    for idx, p in enumerate(base_order):
        result_doc.insert_pdf(doc, from_page=p, to_page=p)
        if rotations and (p in rotations or idx in rotations):
            rot_deg = rotations.get(p, rotations.get(idx, 0))
            page = result_doc[-1]
            page.set_rotation((page.rotation + rot_deg) % 360)
            
    result_doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    result_doc.close()
    return output_path

def crop_pdf(
    input_path: str,
    output_path: str,
    top: float = 36,
    bottom: float = 36,
    left: float = 36,
    right: float = 36,
    pages: Optional[List[int]] = None
) -> str:
    """Crops page margins by adjusting the visible cropbox rectangle."""
    doc = fitz.open(input_path)
    for i, page in enumerate(doc):
        if pages is None or i in pages:
            rect = page.rect
            new_rect = fitz.Rect(
                rect.x0 + left,
                rect.y0 + top,
                max(rect.x0 + left + 50, rect.x1 - right),
                max(rect.y0 + top + 50, rect.y1 - bottom)
            )
            page.set_cropbox(new_rect)
            
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def add_page_numbers(
    input_path: str,
    output_path: str,
    format_str: str = "Page {page} of {total}",
    position: str = "bottom-center",
    font_size: int = 10,
    start_page: int = 1
) -> str:
    """Inserts sequential page number stamps onto every page."""
    doc = fitz.open(input_path)
    total_pages = len(doc)
    
    for i, page in enumerate(doc):
        cur_num = start_page + i
        text = format_str.replace("{page}", str(cur_num)).replace("{total}", str(total_pages))
        rect = page.rect
        
        # Position calculations
        if position == "bottom-right":
            pt = fitz.Point(rect.width - 120, rect.height - 24)
        elif position == "bottom-left":
            pt = fitz.Point(36, rect.height - 24)
        elif position == "top-right":
            pt = fitz.Point(rect.width - 120, 36)
        elif position == "top-center":
            pt = fitz.Point(rect.width / 2 - (len(text) * font_size * 0.25), 36)
        else:  # bottom-center
            pt = fitz.Point(rect.width / 2 - (len(text) * font_size * 0.25), rect.height - 24)
            
        page.insert_text(
            pt,
            text,
            fontsize=font_size,
            fontname="Helvetica",
            color=(0.3, 0.3, 0.3)
        )
        
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def add_watermark(
    input_path: str,
    output_path: str,
    text: str = "CONFIDENTIAL",
    opacity: float = 0.3,
    font_size: int = 42,
    rotation: int = 45
) -> str:
    """Draws diagonal translucent text watermark across every page of the PDF."""
    doc = fitz.open(input_path)
    
    for page in doc:
        rect = page.rect
        center_x = rect.width / 2
        center_y = rect.height / 2
        
        pt = fitz.Point(center_x - (len(text) * font_size * 0.25), center_y)
        if rotation in (0, 90, 180, 270):
            page.insert_text(
                pt,
                text,
                fontsize=font_size,
                rotate=rotation,
                color=(0.7, 0.7, 0.7),
                fill_opacity=opacity
            )
        else:
            page.insert_text(
                pt,
                text,
                fontsize=font_size,
                morph=(pt, fitz.Matrix(rotation)),
                color=(0.7, 0.7, 0.7),
                fill_opacity=opacity
            )
        
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def encrypt_pdf(input_path: str, output_path: str, user_pw: str, owner_pw: Optional[str] = None) -> str:
    """Encrypts PDF using AES-256 standard encryption with granular access permissions."""
    doc = fitz.open(input_path)
    perm = int(
        fitz.PDF_PERM_PRINT
        | fitz.PDF_PERM_COPY
        | fitz.PDF_PERM_ANNOTATE
    )
    doc.save(
        output_path,
        encryption=fitz.PDF_ENCRYPT_AES_256,
        user_pw=user_pw,
        owner_pw=owner_pw or user_pw,
        permissions=perm,
        garbage=3
    )
    doc.close()
    return output_path

def decrypt_pdf(input_path: str, output_path: str, password: str) -> str:
    """Removes password protection and encryption from a PDF document."""
    doc = fitz.open(input_path)
    if doc.is_encrypted:
        success = doc.authenticate(password)
        if not success:
            raise ValueError("Invalid password supplied for PDF decryption")
            
    doc.save(output_path, encryption=fitz.PDF_ENCRYPT_NONE, garbage=4, deflate=True)
    doc.close()
    return output_path
