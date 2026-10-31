import os
import io
from typing import List, Optional, Dict, Any, Union
import pymupdf
from PIL import Image

def parse_page_indices(raw: Any, preserve_order: bool = False) -> List[int]:
    """
    Safely parses diverse page specifications (string, int, list, comma-separated, ranges)
    into normalized 0-indexed integers.
    """
    if raw is None or raw == "" or raw is False:
        return []
        
    def extract_raw_numbers(val: Any) -> List[int]:
        extracted = []
        if isinstance(val, (int, float)):
            extracted.append(int(val))
        elif isinstance(val, (list, tuple, set)):
            for item in val:
                extracted.extend(extract_raw_numbers(item))
        elif isinstance(val, str):
            for part in str(val).split(','):
                part = part.strip()
                if not part:
                    continue
                if '-' in part:
                    sub = part.split('-')
                    if len(sub) == 2:
                        try:
                            s, e = int(sub[0].strip()), int(sub[1].strip())
                            if s > e:
                                s, e = e, s
                            extracted.extend(range(s, e + 1))
                        except ValueError:
                            pass
                else:
                    try:
                        extracted.append(int(part))
                    except ValueError:
                        pass
        return extracted

    nums = extract_raw_numbers(raw)
    if not nums:
        return []
        
    # If lowest page number is >= 1, it's 1-indexed (e.g. page 1, 2, 3), convert to 0-indexed
    # If 0 is present (already 0-indexed), keep as is
    if min(nums) >= 1:
        nums = [n - 1 for n in nums]
        
    if preserve_order:
        seen = set()
        res = []
        for x in nums:
            if x not in seen:
                seen.add(x)
                res.append(x)
        return res
    else:
        return sorted(list(set(nums)))

def merge_pdfs(input_paths: List[str], output_path: str) -> str:
    """Merges multiple PDF documents into a single sequential PDF."""
    result_doc = pymupdf.open()
    for path in input_paths:
        with pymupdf.open(path) as doc:
            result_doc.insert_pdf(doc)
    result_doc.save(output_path, garbage=4, deflate=True)
    result_doc.close()
    return output_path

def split_pdf(input_path: str, output_path: str, page_ranges: Any = None) -> str:
    """Splits or slices specified pages from a PDF document."""
    doc = pymupdf.open(input_path)
    result_doc = pymupdf.open()
    
    total_pages = len(doc)
    parsed = parse_page_indices(page_ranges) if page_ranges is not None and page_ranges != "" and page_ranges != [] else []
    pages_to_keep = [p for p in parsed if isinstance(p, int) and 0 <= p < total_pages]
    if not pages_to_keep:
        pages_to_keep = list(range(total_pages))
    
    for p in pages_to_keep:
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
    doc = pymupdf.open(input_path)
    
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

def rotate_pdf(input_path: str, output_path: str, degrees: int = 90, pages: Any = None) -> str:
    """Rotates all or specified pages in the PDF by 90, 180, or 270 degrees."""
    doc = pymupdf.open(input_path)
    target_pages = set(parse_page_indices(pages)) if pages else None
    for i, page in enumerate(doc):
        if target_pages is None or i in target_pages:
            current_rotation = page.rotation
            page.set_rotation((current_rotation + int(degrees)) % 360)
            
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def delete_pages(input_path: str, output_path: str, pages_to_delete: Any) -> str:
    """Removes targeted page numbers from the PDF document safely."""
    doc = pymupdf.open(input_path)
    total_pages = len(doc)
    
    parsed = parse_page_indices(pages_to_delete)
    valid_to_del = {p for p in parsed if isinstance(p, int) and 0 <= p < total_pages}
    
    if not valid_to_del:
        doc.save(output_path, garbage=4, deflate=True)
        doc.close()
        return output_path
        
    if len(valid_to_del) >= total_pages:
        doc.close()
        raise ValueError(
            f"Cannot delete all {total_pages} page(s) from document. A valid PDF must retain at least one page."
        )
        
    for p in sorted(valid_to_del, reverse=True):
        doc.delete_page(p)
        
    doc.save(output_path, garbage=4, deflate=True)
    doc.close()
    return output_path

def extract_pages(input_path: str, output_path: str, pages_to_extract: Any) -> str:
    """Extracts only targeted page numbers into a standalone PDF."""
    return split_pdf(input_path, output_path, pages_to_extract)

def reorder_pages(input_path: str, output_path: str, new_order: Any) -> str:
    """Rearranges the page order of a PDF to match new_order list."""
    doc = pymupdf.open(input_path)
    result_doc = pymupdf.open()
    total_pages = len(doc)
    
    parsed = parse_page_indices(new_order, preserve_order=True)
    order = [p for p in parsed if isinstance(p, int) and 0 <= p < total_pages]
    if not order:
        order = list(range(total_pages))
    
    for p in order:
        result_doc.insert_pdf(doc, from_page=p, to_page=p)
            
    result_doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    result_doc.close()
    return output_path

def organize_pages(
    input_path: str,
    output_path: str,
    new_order: Any = None,
    pages_to_delete: Any = None,
    rotations: Optional[Dict[Any, int]] = None
) -> str:
    """
    Unified page organizer: deletes unneeded pages, reorders remaining,
    and applies selective rotations in a single pass.
    """
    doc = pymupdf.open(input_path)
    total = len(doc)
    to_delete = set(parse_page_indices(pages_to_delete)) if pages_to_delete else set()
    order_parsed = parse_page_indices(new_order, preserve_order=True) if new_order else []
    
    # Determine base order
    candidate_order = order_parsed if order_parsed else list(range(total))
    base_order = [p for p in candidate_order if isinstance(p, int) and p not in to_delete and 0 <= p < total]
    if not base_order:
        base_order = [p for p in range(total) if p not in to_delete]
    if not base_order:
        base_order = [0]
        
    result_doc = pymupdf.open()
    for idx, p in enumerate(base_order):
        result_doc.insert_pdf(doc, from_page=p, to_page=p)
        if rotations:
            rot_deg = rotations.get(p, rotations.get(str(p), rotations.get(idx, 0)))
            page = result_doc[-1]
            page.set_rotation((page.rotation + int(rot_deg)) % 360)
            
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
    pages: Any = None
) -> str:
    """Crops page margins by adjusting the visible cropbox rectangle."""
    doc = pymupdf.open(input_path)
    target_pages = set(parse_page_indices(pages)) if pages else None
    for i, page in enumerate(doc):
        if target_pages is None or i in target_pages:
            rect = page.rect
            new_rect = pymupdf.Rect(
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
    doc = pymupdf.open(input_path)
    total_pages = len(doc)
    
    for i, page in enumerate(doc):
        cur_num = start_page + i
        text = format_str.replace("{page}", str(cur_num)).replace("{total}", str(total_pages))
        rect = page.rect
        
        # Position calculations
        if position == "bottom-right":
            pt = pymupdf.Point(rect.width - 120, rect.height - 24)
        elif position == "bottom-left":
            pt = pymupdf.Point(36, rect.height - 24)
        elif position == "top-right":
            pt = pymupdf.Point(rect.width - 120, 36)
        elif position == "top-center":
            pt = pymupdf.Point(rect.width / 2 - (len(text) * font_size * 0.25), 36)
        else:  # bottom-center
            pt = pymupdf.Point(rect.width / 2 - (len(text) * font_size * 0.25), rect.height - 24)
            
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
    doc = pymupdf.open(input_path)
    
    for page in doc:
        rect = page.rect
        center_x = rect.width / 2
        center_y = rect.height / 2
        
        pt = pymupdf.Point(center_x - (len(text) * font_size * 0.25), center_y)
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
                morph=(pt, pymupdf.Matrix(rotation)),
                color=(0.7, 0.7, 0.7),
                fill_opacity=opacity
            )
        
    doc.save(output_path, garbage=3, deflate=True)
    doc.close()
    return output_path

def encrypt_pdf(input_path: str, output_path: str, user_pw: str, owner_pw: Optional[str] = None) -> str:
    """Encrypts PDF using AES-256 standard encryption with granular access permissions."""
    doc = pymupdf.open(input_path)
    perm = int(
        pymupdf.PDF_PERM_PRINT
        | pymupdf.PDF_PERM_COPY
        | pymupdf.PDF_PERM_ANNOTATE
    )
    doc.save(
        output_path,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=user_pw,
        owner_pw=owner_pw or user_pw,
        permissions=perm,
        garbage=3
    )
    doc.close()
    return output_path

def decrypt_pdf(input_path: str, output_path: str, password: str) -> str:
    """Removes password protection and encryption from a PDF document."""
    doc = pymupdf.open(input_path)
    if doc.is_encrypted:
        success = doc.authenticate(password)
        if not success:
            raise ValueError("Invalid password supplied for PDF decryption")
            
    doc.save(output_path, encryption=pymupdf.PDF_ENCRYPT_NONE, garbage=4, deflate=True)
    doc.close()
    return output_path
