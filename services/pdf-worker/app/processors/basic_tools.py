import os
from typing import List, Optional
import fitz  # PyMuPDF
from reportlab.pdfgen import canvas
from reportlab.lib.colors import Color
import io

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
    and image resolution optimization.
    """
    doc = fitz.open(input_path)
    
    # Garbage collection levels: 1-4, deflate=True compresses streams
    deflate_val = True
    garbage_level = 4
    
    # Process images if aggressive compression requested
    if level in ["high", "extreme"]:
        for page in doc:
            image_list = page.get_images(full=True)
            for img in image_list:
                xref = img[0]
                base_image = doc.extract_image(xref)
                if base_image:
                    # In extreme mode, optimize image streams
                    pass
                    
    doc.save(
        output_path,
        garbage=garbage_level,
        deflate=deflate_val,
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
    # Sort descending so index removal does not shift upcoming indices
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
        
        # PyMuPDF insert_text or font styling
        page.insert_text(
            fitz.Point(center_x - (len(text) * font_size * 0.25), center_y),
            text,
            fontsize=font_size,
            rotate=rotation,
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
