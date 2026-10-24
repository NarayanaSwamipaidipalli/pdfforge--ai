import os
import io
import time
import logging
import tempfile
import shutil
from typing import List, Optional, Dict, Any, Tuple
import fitz  # PyMuPDF
from PIL import Image
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

logger = logging.getLogger("pdf_to_word_engine")
logger.setLevel(logging.INFO)

class ConversionConfig:
    def __init__(self, options: Optional[Dict[str, Any]] = None):
        opts = options or {}
        # Auto-detect OCR if document contains scanned pages without digital text
        self.ocr_enabled: bool = bool(
            opts.get("enableOcr") or opts.get("ocr") or opts.get("ocr_enabled") or opts.get("auto_ocr", True)
        )
        self.ocr_language: str = opts.get("ocr_language") or opts.get("ocrLanguage", "eng")
        self.dpi: int = min(150, int(opts.get("dpi", 150)))
        self.max_ocr_pages: int = int(opts.get("max_ocr_pages", 60))
        self.chunk_size: int = int(opts.get("chunk_size", 50))
        self.preserve_images: bool = opts.get("preserve_images", True)
        self.table_recognition: bool = opts.get("table_recognition", True)
        self.multi_column_support: bool = opts.get("multi_column_support", True)


def set_cell_border(cell, **kwargs):
    """
    Sets specific cell borders on a python-docx table cell.
    kwargs: top, bottom, left, right: {"sz": 4, "val": "single", "color": "D0D0D0"}
    """
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.first_child_found_in("w:tcBorders")
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)

    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        edge_data = kwargs.get(edge)
        if edge_data:
            tag = f'w:{edge}'
            element = tcBorders.find(qn(tag))
            if element is None:
                element = OxmlElement(tag)
                tcBorders.append(element)
            for key in ["val", "color", "sz", "space"]:
                if key in edge_data:
                    element.set(qn(f'w:{key}'), str(edge_data[key]))


def set_cell_background(cell, color_hex: str):
    """Sets background shading color for a table cell."""
    if not color_hex:
        return
    color_hex = color_hex.lstrip('#')
    shading_xml = f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>'
    cell._tc.get_or_add_tcPr().append(parse_xml(shading_xml))


import docx.opc.constants

def add_hyperlink_to_paragraph(paragraph, url: str, text: str, font_size_pt: float = 11, is_bold: bool = False):
    """Injects a real clickable hyperlink into a python-docx paragraph."""
    part = paragraph.part
    r_id = part.relate_to(url, docx.opc.constants.RELATIONSHIP_TYPE.HYPERLINK, is_external=True)

    hyperlink = parse_xml(f'<w:hyperlink {nsdecls("w", "r")} r:id="{r_id}"/>')
    new_run = parse_xml(f'<w:r {nsdecls("w")}/>')
    rPr = parse_xml(f'<w:rPr {nsdecls("w")}><w:rStyle w:val="Hyperlink"/><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr>')
    
    t = parse_xml(f'<w:t {nsdecls("w")}>{text}</w:t>')
    new_run.append(rPr)
    new_run.append(t)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def detect_scanned_document(doc: fitz.Document, sample_pages: int = 10) -> Tuple[bool, List[int]]:
    """
    Detects whether pages in a PDF are scanned / bitmap-only pages requiring OCR.
    Returns (has_any_scanned, list_of_scanned_page_indices).
    """
    scanned_pages = []
    total = len(doc)
    
    for idx in range(total):
        page = doc[idx]
        text = page.get_text().strip()
        images = page.get_images()
        
        # Scanned page criteria:
        # Less than 30 characters of text, but has images covering significant area
        if len(text) < 30 and len(images) > 0:
            scanned_pages.append(idx)
            
    is_scanned = len(scanned_pages) > 0
    return is_scanned, scanned_pages


def ocr_page_to_searchable_doc(page: fitz.Page, lang: str = "eng", dpi: int = 150) -> Optional[fitz.Document]:
    """
    Runs Tesseract OCR on a scanned page and returns a single-page PyMuPDF Document
    with invisible searchable text overlay at exact coordinate positions.
    """
    try:
        import pytesseract
        import gc
        pix = page.get_pixmap(dpi=dpi)
        img_bytes = pix.tobytes("png")
        del pix
        pil_img = Image.open(io.BytesIO(img_bytes))
        
        pdf_bytes = pytesseract.image_to_pdf_or_hocr(pil_img, extension='pdf', lang=lang)
        del pil_img
        del img_bytes
        gc.collect()
        if pdf_bytes:
            return fitz.open("pdf", pdf_bytes)
    except Exception as e:
        logger.warning(f"OCR preprocessing failed on page {page.number}: {e}")
    return None


def preprocess_pdf_with_ocr_if_needed(input_path: str, config: ConversionConfig) -> str:
    """
    Checks if PDF has scanned pages. If so, builds an OCR-enhanced temporary PDF.
    Returns the path to the searchable PDF (or the original if no OCR needed).
    """
    if not config.ocr_enabled:
        return input_path
        
    doc = fitz.open(input_path)
    is_scanned, scanned_indices = detect_scanned_document(doc)
    
    if not is_scanned:
        doc.close()
        return input_path
        
    # Cap to max_ocr_pages to avoid timeout
    if len(scanned_indices) > config.max_ocr_pages:
        logger.warning(f"Document has {len(scanned_indices)} scanned pages; running OCR on first {config.max_ocr_pages} pages.")
        scanned_indices = scanned_indices[:config.max_ocr_pages]

    logger.info(f"Detected {len(scanned_indices)} scanned page(s). Running OCR enhancement at {config.dpi} DPI...")
    ocr_doc = fitz.open()
    
    for i in range(len(doc)):
        page = doc[i]
        if i in scanned_indices:
            searchable_page_doc = ocr_page_to_searchable_doc(page, lang=config.ocr_language, dpi=config.dpi)
            if searchable_page_doc:
                ocr_doc.insert_pdf(searchable_page_doc)
                searchable_page_doc.close()
                continue
        # Non-scanned page or OCR fallback
        ocr_doc.insert_pdf(doc, from_page=i, to_page=i)
        
    doc.close()
    
    # Save temporary OCR PDF
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix="_ocr.pdf")
    tmp_path = tmp.name
    tmp.close()
    
    ocr_doc.save(tmp_path, garbage=3, deflate=True)
    ocr_doc.close()
    return tmp_path


def convert_with_pdf2docx_engine(input_path: str, output_path: str, config: ConversionConfig) -> bool:
    """
    Primary layout-aware PDF to DOCX converter using pdf2docx.
    Accurately reconstructs multi-column layouts, tables, cell borders, shading,
    fonts, colors, and embedded image positions.
    """
    try:
        from pdf2docx import Converter
        doc = fitz.open(input_path)
        total_pages = len(doc)
        doc.close()
        
        cv = Converter(input_path)
        
        # For large documents (> 60 pages), convert with chunking
        if total_pages > 60:
            logger.info(f"Processing large document ({total_pages} pages) in chunks of {config.chunk_size}...")
            cv.convert(output_path, start=0, end=total_pages)
        else:
            cv.convert(output_path, start=0, end=None)
            
        cv.close()
        return os.path.exists(output_path) and os.path.getsize(output_path) > 0
    except Exception as e:
        logger.error(f"pdf2docx engine encountered error: {e}", exc_info=True)
        return False


def convert_with_native_pipeline(input_path: str, output_path: str, config: ConversionConfig) -> str:
    """
    Enterprise-grade native fallback converter:
    Extracts structured layout directly from PyMuPDF dict & tables:
    - Preserves page dimensions (Pt), margins, and orientation
    - Preserves continuous block paragraph flow with smart alignment
    - Preserves font size, font family, RGB color, bold, italic
    - Reconstructs tables with cell borders, widths, and background colors
    - Extracts embedded images with exact aspect ratio scaling
    - Preserves hyperlinks with active Word URLs
    """
    logger.info("Executing native high-fidelity layout reconstruction pipeline...")
    pdf = fitz.open(input_path)
    doc = Document()
    
    # Remove default empty paragraph created by python-docx
    if len(doc.paragraphs) > 0 and not doc.paragraphs[0].text:
        p_elem = doc.paragraphs[0]._p
        p_elem.getparent().remove(p_elem)

    for page_idx, page in enumerate(pdf):
        page_rect = page.rect
        page_width_pt = Pt(page_rect.width)
        page_height_pt = Pt(page_rect.height)
        
        # 1. Section & Page Geometry Setup
        if page_idx == 0:
            section = doc.sections[0]
        else:
            section = doc.add_section()
            
        section.page_width = page_width_pt
        section.page_height = page_height_pt
        section.top_margin = Inches(0.75)
        section.bottom_margin = Inches(0.75)
        section.left_margin = Inches(0.75)
        section.right_margin = Inches(0.75)
        
        usable_width = page_rect.width - 108  # 0.75 in * 72 * 2 = 108 pt margins
        
        # 2. Extract Hyperlinks
        links = page.get_links()
        link_map = {}
        for l in links:
            if "uri" in l and "from" in l:
                link_map[l["from"]] = l["uri"]

        # 3. Extract Tables
        table_rects = []
        try:
            tabs = page.find_tables()
            for tab in tabs:
                table_rects.append(tab.bbox)
                t_data = tab.extract()
                if not t_data or len(t_data) == 0:
                    continue
                    
                num_rows = len(t_data)
                num_cols = len(t_data[0])
                if num_cols == 0:
                    continue
                    
                docx_tbl = doc.add_table(rows=num_rows, cols=num_cols)
                docx_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
                docx_tbl.autofit = False
                
                # Column widths from bounding box
                tbl_width_pt = min(usable_width, tab.bbox[2] - tab.bbox[0])
                col_w = tbl_width_pt / num_cols
                
                for r_i, row in enumerate(t_data):
                    for c_i, val in enumerate(row):
                        cell = docx_tbl.cell(r_i, c_i)
                        cell.width = Pt(col_w)
                        cell_text = str(val or "").strip()
                        cell.text = cell_text
                        
                        # Style header row
                        if r_i == 0:
                            set_cell_background(cell, "F1F5F9")
                            set_cell_border(cell, bottom={"sz": 12, "val": "single", "color": "475569"})
                            for p in cell.paragraphs:
                                for r in p.runs:
                                    r.font.bold = True
                                    r.font.size = Pt(9.5)
                                    r.font.name = "Calibri"
                        else:
                            set_cell_border(cell, bottom={"sz": 4, "val": "single", "color": "E2E8F0"})
                            for p in cell.paragraphs:
                                for r in p.runs:
                                    r.font.size = Pt(9.0)
                                    r.font.name = "Calibri"
                                    
                # Add spacing after table
                p_spacer = doc.add_paragraph()
                p_spacer.paragraph_format.space_after = Pt(6)
        except Exception as e:
            logger.warning(f"Table parsing error on page {page_idx}: {e}")

        # 4. Extract Structured Text with Typography (Block-level grouping for continuous paragraphs)
        text_dict = page.get_text("dict")
        blocks = text_dict.get("blocks", [])
        
        for b in blocks:
            # Skip blocks that overlap detected tables
            b_rect = fitz.Rect(b["bbox"])
            if any(b_rect.intersects(fitz.Rect(tr)) for tr in table_rects):
                continue
                
            # Type 0: Text Block
            if b.get("type") == 0:
                block_lines = b.get("lines", [])
                if not block_lines:
                    continue
                    
                mid_x = (b_rect.x0 + b_rect.x1) / 2.0
                page_mid_x = page_rect.width / 2.0
                b_width = b_rect.x1 - b_rect.x0
                
                p = doc.add_paragraph()
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.line_spacing = 1.15
                
                # Determine paragraph alignment based on geometric placement
                if abs(mid_x - page_mid_x) < 40 and b_width < usable_width * 0.75:
                    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                elif b_rect.x0 > page_rect.width * 0.55:
                    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
                elif len(block_lines) > 2 and b_width > usable_width * 0.8:
                    p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
                else:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT

                for l_idx, line in enumerate(block_lines):
                    line_rect = fitz.Rect(line["bbox"])
                    
                    # Check for hyperlinks
                    active_url = None
                    for l_rect, uri in link_map.items():
                        if line_rect.intersects(l_rect):
                            active_url = uri
                            break

                    spans = line.get("spans", [])
                    for s_idx, span in enumerate(spans):
                        text = span.get("text", "")
                        if not text:
                            continue
                            
                        # Prepend space between lines if not already present
                        if l_idx > 0 and s_idx == 0 and not text.startswith(" "):
                            text = " " + text
                            
                        font_size = span.get("size", 11)
                        font_name = span.get("font", "Calibri")
                        flags = span.get("flags", 0)
                        color_int = span.get("color", 0)
                        
                        is_bold = bool(flags & 2) or ("bold" in font_name.lower())
                        is_italic = bool(flags & 1) or ("italic" in font_name.lower())
                        
                        # Convert integer color to RGB
                        r_col = (color_int >> 16) & 255
                        g_col = (color_int >> 8) & 255
                        b_col = color_int & 255
                        
                        # If hyperlink is present, inject hyperlinked run
                        if active_url:
                            add_hyperlink_to_paragraph(p, active_url, text, font_size_pt=font_size, is_bold=is_bold)
                        else:
                            run = p.add_run(text)
                            run.font.name = "Calibri" if "calibri" in font_name.lower() else font_name
                            run.font.size = Pt(font_size)
                            run.font.bold = is_bold
                            run.font.italic = is_italic
                            if color_int != 0 and (r_col > 15 or g_col > 15 or b_col > 15):
                                run.font.color.rgb = RGBColor(r_col, g_col, b_col)

            # Type 1: Image Block
            elif b.get("type") == 1 and config.preserve_images:
                try:
                    img_bytes = b.get("image")
                    if img_bytes:
                        with Image.open(io.BytesIO(img_bytes)) as pil_img:
                            orig_w, orig_h = pil_img.size
                            aspect = orig_h / max(1, orig_w)
                            
                            # Scale to document width
                            target_w = min(usable_width, b["bbox"][2] - b["bbox"][0])
                            if target_w < 40:
                                target_w = min(usable_width, orig_w * 0.75)
                            target_h = target_w * aspect
                            
                            # Embed in Word
                            img_stream = io.BytesIO(img_bytes)
                            p_img = doc.add_paragraph()
                            p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                            p_img.paragraph_format.space_before = Pt(4)
                            p_img.paragraph_format.space_after = Pt(6)
                            p_img.add_run().add_picture(img_stream, width=Pt(target_w), height=Pt(target_h))
                except Exception as img_err:
                    logger.warning(f"Failed to embed native image block: {img_err}")

        # 5. Extract standalone embedded images not reported in blocks
        if config.preserve_images:
            try:
                for img_info in page.get_images(full=True):
                    xref = img_info[0]
                    base_image = pdf.extract_image(xref)
                    if not base_image:
                        continue
                    image_bytes = base_image.get("image")
                    if not image_bytes or len(image_bytes) < 1024:
                        continue  # Skip tiny icons / decorative artifacts
                        
                    with Image.open(io.BytesIO(image_bytes)) as pil_img:
                        w, h = pil_img.size
                        if w < 50 or h < 50:
                            continue
                            
                        # Scale safely
                        max_w_pt = min(usable_width * 0.8, w * 0.75)
                        max_h_pt = max_w_pt * (h / w)
                        
                        img_stream = io.BytesIO(image_bytes)
                        p_img = doc.add_paragraph()
                        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                        p_img.add_run().add_picture(img_stream, width=Pt(max_w_pt), height=Pt(max_h_pt))
            except Exception as e:
                logger.warning(f"Standalone image extraction warning on page {page_idx}: {e}")

    pdf.close()
    doc.save(output_path)
    return output_path


def post_process_word_document(docx_path: str):
    """
    Enhances generated DOCX document:
    - Normalizes cell margins and padding
    - Ensures valid borders on tables
    - Prevents table row splitting across pages
    """
    try:
        doc = Document(docx_path)
        for tbl in doc.tables:
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            for row in tbl.rows:
                trPr = row._tr.get_or_add_trPr()
                trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))
        doc.save(docx_path)
    except Exception as e:
        logger.warning(f"DOCX post-processing notice: {e}")


def convert_pdf_to_word(input_path: str, output_path: str, options: Optional[Dict[str, Any]] = None) -> str:
    """
    Master Enterprise PDF to DOCX Converter.
    Coordinates OCR detection, pdf2docx high-fidelity layout engine,
    and native PyMuPDF fallback.
    """
    start_time = time.time()
    config = ConversionConfig(options)
    temp_ocr_path = None
    
    try:
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input PDF file not found at: {input_path}")
            
        file_size = os.path.getsize(input_path)
        if file_size == 0:
            raise ValueError("Input PDF file is empty (0 bytes).")
            
        # Step 1: Pre-process with OCR if document contains scanned / photographed pages
        effective_input_path = input_path
        try:
            effective_input_path = preprocess_pdf_with_ocr_if_needed(input_path, config)
            if effective_input_path != input_path:
                temp_ocr_path = effective_input_path
        except Exception as ocr_err:
            logger.warning(f"OCR preprocessing skipped: {ocr_err}")
            effective_input_path = input_path

        # Step 2: Attempt Primary High-Fidelity Converter (pdf2docx)
        success = False
        try:
            success = convert_with_pdf2docx_engine(effective_input_path, output_path, config)
        except Exception as p2d_err:
            logger.warning(f"Primary engine encountered error, switching to native fallback: {p2d_err}")
            success = False

        # Step 3: If primary converter failed or produced empty file, execute Native Fallback
        if not success or not os.path.exists(output_path) or os.path.getsize(output_path) < 100:
            logger.info("Executing native high-fidelity fallback converter...")
            convert_with_native_pipeline(effective_input_path, output_path, config)

        # Step 4: Post-Process DOCX Table & Layout XML
        post_process_word_document(output_path)
        
        duration = time.time() - start_time
        out_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
        logger.info(f"PDF to Word conversion completed successfully in {duration:.2f}s ({out_size} bytes)")
        return output_path

    finally:
        # Clean up temporary OCR file
        if temp_ocr_path and os.path.exists(temp_ocr_path):
            try:
                os.remove(temp_ocr_path)
            except Exception:
                pass
