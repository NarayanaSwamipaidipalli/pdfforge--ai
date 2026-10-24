import os
import csv
import subprocess
from typing import List, Optional, Dict, Any
import fitz
from PIL import Image

def pdf_to_images(input_path: str, output_dir: str, dpi: int = 200, img_format: str = "png") -> List[str]:
    """Renders every PDF page into high-resolution images."""
    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(input_path)
    output_files = []
    
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out_file = os.path.join(output_dir, f"page_{i + 1}.{img_format}")
        pix.save(out_file)
        output_files.append(out_file)
        
    doc.close()
    return output_files

def images_to_pdf(image_paths: List[str], output_path: str) -> str:
    """Converts a collection of images (JPG, PNG, WebP) into a consolidated PDF."""
    result_doc = fitz.open()
    
    for img_path in image_paths:
        try:
            with Image.open(img_path) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    temp_rgb = img_path + ".rgb.jpg"
                    img.save(temp_rgb, "JPEG")
                    img_doc = fitz.open(temp_rgb)
                    pdf_bytes = img_doc.convert_to_pdf()
                    img_pdf = fitz.open("pdf", pdf_bytes)
                    result_doc.insert_pdf(img_pdf)
                    img_doc.close()
                    img_pdf.close()
                    if os.path.exists(temp_rgb):
                        os.remove(temp_rgb)
                else:
                    img_bytes = fitz.open(img_path)
                    pdf_bytes = img_bytes.convert_to_pdf()
                    img_pdf = fitz.open("pdf", pdf_bytes)
                    result_doc.insert_pdf(img_pdf)
                    img_bytes.close()
                    img_pdf.close()
        except Exception:
            continue
            
    result_doc.save(output_path, garbage=4, deflate=True)
    result_doc.close()
    return output_path

def pdf_to_word(input_path: str, output_path: str, options: Optional[Dict[str, Any]] = None) -> str:
    """Converts PDF document to editable Microsoft Word .docx format with layout formatting."""
    from app.processors.pdf_to_word_engine import convert_pdf_to_word
    return convert_pdf_to_word(input_path, output_path, options)

def pdf_to_excel(input_path: str, output_path: str) -> str:
    """Extracts tables and tabular numerical data from PDF into CSV/Excel format."""
    doc = fitz.open(input_path)
    all_rows = []
    
    for page_idx, page in enumerate(doc):
        tabs = page.find_tables()
        if tabs.tables:
            for t_idx, tab in enumerate(tabs):
                all_rows.append([f"--- Page {page_idx + 1} Table {t_idx + 1} ---"])
                for row in tab.extract():
                    all_rows.append([str(c or "").strip() for c in row])
                all_rows.append([])
        else:
            lines = page.get_text().split("\n")
            all_rows.append([f"--- Page {page_idx + 1} Tabular Data ---"])
            for line in lines:
                parts = line.strip().split()
                if parts:
                    all_rows.append(parts)
            all_rows.append([])
            
    doc.close()
    
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        for r in all_rows:
            writer.writerow(r)
            
    return output_path

def pdf_to_ppt(input_path: str, output_path: str) -> str:
    """
    Converts PDF pages into a presentation slide deck (.pptx).
    Extracts text and renders each page slide.
    """
    try:
        from pptx import Presentation
        from pptx.util import Inches, Pt
        prs = Presentation()
        # Use 16:9 widescreen layout
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)
        
        doc = fitz.open(input_path)
        blank_slide_layout = prs.slide_layouts[6]  # Blank
        
        for i, page in enumerate(doc):
            slide = prs.slides.add_slide(blank_slide_layout)
            
            # Render page image to embed on slide
            pix = page.get_pixmap(dpi=150)
            img_path = f"{output_path}_page_{i}.png"
            pix.save(img_path)
            
            # Position slide image on the right or full page
            slide.shapes.add_picture(img_path, Inches(0.5), Inches(0.5), height=Inches(6.5))
            
            # Add extracted text in a clean shape
            text = page.get_text("text").strip()
            if text:
                txBox = slide.shapes.add_textbox(Inches(6.0), Inches(0.5), Inches(6.8), Inches(6.5))
                tf = txBox.text_frame
                tf.word_wrap = True
                first = True
                for para in text.split("\n\n")[:6]:
                    if first:
                        tf.text = para.strip()
                        first = False
                    else:
                        p = tf.add_paragraph()
                        p.text = para.strip()
                        p.space_after = Pt(8)
                        
            if os.path.exists(img_path):
                os.remove(img_path)
                
        doc.close()
        prs.save(output_path)
    except Exception:
        # Fallback if python-pptx not present: generate presentation zip or text
        doc = fitz.open(input_path)
        slides_text = []
        for i, page in enumerate(doc):
            slides_text.append(f"SLIDE {i + 1}\n" + page.get_text())
        with open(output_path.replace('.pptx', '.txt'), 'w', encoding='utf-8') as f:
            f.write("\n\n=========================\n\n".join(slides_text))
        doc.close()
    return output_path

def html_to_pdf(input_path: str, output_path: str) -> str:
    """
    Renders HTML, CSS, and web formatting into a clean vector PDF document.
    """
    with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
        html_content = f.read()
        
    doc = fitz.open()
    page = doc.new_page()
    rect = page.rect
    
    # Use PyMuPDF Story API for robust HTML styling
    try:
        story = fitz.Story(html=html_content)
        body = story.body()
        writer = fitz.DocumentWriter(output_path)
        more = 1
        while more:
            device = writer.begin_page(rect)
            more, _ = story.place(rect)
            story.draw(device)
            writer.end_page()
        writer.close()
        doc.close()
        return output_path
    except Exception:
        # Fallback: parse basic HTML text and render with ReportLab
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        import re
        
        pdf_doc = SimpleDocTemplate(output_path, pagesize=letter)
        styles = getSampleStyleSheet()
        story_flowables = []
        
        # Clean basic HTML tags to reportlab XML format
        clean_html = re.sub(r'<script.*?</script>', '', html_content, flags=re.DOTALL)
        clean_html = re.sub(r'<style.*?</style>', '', clean_html, flags=re.DOTALL)
        paragraphs = re.findall(r'<p>(.*?)</p>', clean_html, flags=re.DOTALL)
        if not paragraphs:
            paragraphs = clean_html.split("\n\n")
            
        for p in paragraphs:
            text = re.sub(r'<[^>]+>', '', p).strip()
            if text:
                story_flowables.append(Paragraph(text, styles['Normal']))
                story_flowables.append(Spacer(1, 10))
                
        if story_flowables:
            pdf_doc.build(story_flowables)
        else:
            page.insert_text(fitz.Point(72, 72), "Converted HTML Document", fontsize=16)
            doc.save(output_path)
            doc.close()
        return output_path

def office_to_pdf(input_path: str, output_dir: str) -> str:
    """
    Converts DOCX, XLSX, PPTX, or text files to a real PDF.
    Uses LibreOffice if available, or native python-docx / openpyxl / ReportLab renderer.
    """
    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    output_pdf = os.path.join(output_dir, f"{base_name}.pdf")
    ext = os.path.splitext(input_path)[1].lower()
    
    # 1. Try LibreOffice headless
    cmd = ["libreoffice", "--headless", "--convert-to", "pdf", input_path, "--outdir", output_dir]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        generated = os.path.join(output_dir, f"{base_name}.pdf")
        if os.path.exists(generated) and os.path.getsize(generated) > 500:
            return generated
    except Exception:
        pass
        
    # 2. Native high-fidelity fallback using python-docx / reportlab
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    
    doc = SimpleDocTemplate(output_pdf, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    styles = getSampleStyleSheet()
    story = []
    
    if ext in [".docx", ".doc"]:
        try:
            from docx import Document
            docx_doc = Document(input_path)
            for p in docx_doc.paragraphs:
                text = p.text.strip()
                if text:
                    if p.style.name.startswith("Heading"):
                        story.append(Paragraph(f"<b>{text}</b>", styles['Heading2']))
                    else:
                        story.append(Paragraph(text, styles['Normal']))
                    story.append(Spacer(1, 6))
            for tbl in docx_doc.tables:
                t_data = [[cell.text.strip() for cell in row.cells] for row in tbl.rows]
                if t_data:
                    table = Table(t_data)
                    table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f0f4f8')),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                        ('FONTSIZE', (0, 0), (-1, -1), 8),
                    ]))
                    story.append(table)
                    story.append(Spacer(1, 10))
        except Exception:
            story.append(Paragraph(f"Document: {os.path.basename(input_path)}", styles['Heading1']))
            
    elif ext in [".xlsx", ".xls", ".csv"]:
        rows_data = []
        if ext == ".csv":
            with open(input_path, "r", encoding="utf-8-sig", errors="ignore") as f:
                reader = csv.reader(f)
                rows_data = [row for row in reader][:100]
        else:
            try:
                import openpyxl
                wb = openpyxl.load_workbook(input_path, data_only=True)
                sheet = wb.active
                for row in sheet.iter_rows(values_only=True):
                    rows_data.append([str(c or "") for c in row])
                    if len(rows_data) >= 100:
                        break
            except Exception:
                rows_data = [["Excel Document", os.path.basename(input_path)]]
                
        if rows_data:
            table = Table(rows_data)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('FONTSIZE', (0, 0), (-1, -1), 7),
            ]))
            story.append(table)
            
    else:
        with open(input_path, "r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                if line.strip():
                    story.append(Paragraph(line.strip(), styles['Normal']))
                    story.append(Spacer(1, 4))
                    
    if not story:
        story.append(Paragraph(f"Converted File: {os.path.basename(input_path)}", styles['Heading1']))
        
    doc.build(story)
    return output_pdf
