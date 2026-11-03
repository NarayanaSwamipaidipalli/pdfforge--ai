import os
import csv
import subprocess
from typing import List, Optional, Dict, Any
import pymupdf
from PIL import Image

def pdf_to_images(input_path: str, output_dir: str, dpi: int = 200, img_format: str = "png") -> List[str]:
    """Renders every PDF page into high-resolution images."""
    os.makedirs(output_dir, exist_ok=True)
    doc = pymupdf.open(input_path)
    output_files = []
    
    zoom = dpi / 72.0
    matrix = pymupdf.Matrix(zoom, zoom)
    
    for i, page in enumerate(doc):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        out_file = os.path.join(output_dir, f"page_{i + 1}.{img_format}")
        pix.save(out_file)
        output_files.append(out_file)
        
    doc.close()
    return output_files

def images_to_pdf(image_paths: List[str], output_path: str) -> str:
    """Converts a collection of images (JPG, PNG, WebP) into a consolidated PDF."""
    result_doc = pymupdf.open()
    
    for img_path in image_paths:
        try:
            with Image.open(img_path) as img:
                if img.mode in ("RGBA", "P"):
                    img = img.convert("RGB")
                    temp_rgb = img_path + ".rgb.jpg"
                    img.save(temp_rgb, "JPEG")
                    img_doc = pymupdf.open(temp_rgb)
                    pdf_bytes = img_doc.convert_to_pdf()
                    img_pdf = pymupdf.open("pdf", pdf_bytes)
                    result_doc.insert_pdf(img_pdf)
                    img_doc.close()
                    img_pdf.close()
                    if os.path.exists(temp_rgb):
                        os.remove(temp_rgb)
                else:
                    img_bytes = pymupdf.open(img_path)
                    pdf_bytes = img_bytes.convert_to_pdf()
                    img_pdf = pymupdf.open("pdf", pdf_bytes)
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
    doc = pymupdf.open(input_path)
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
        
        doc = pymupdf.open(input_path)
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
        doc = pymupdf.open(input_path)
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
        
    doc = pymupdf.open()
    page = doc.new_page()
    rect = page.rect
    
    # Use PyMuPDF Story API for robust HTML styling
    try:
        story = pymupdf.Story(html=html_content)
        body = story.body()
        writer = pymupdf.DocumentWriter(output_path)
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
            page.insert_text(pymupdf.Point(72, 72), "Converted HTML Document", fontsize=16)
            doc.save(output_path)
            doc.close()
        return output_path

def office_to_pdf(input_path: str, output_dir: str) -> str:
    """Convert with the installed LibreOffice engine; never return a lossy placeholder."""
    import shutil
    import signal
    import tempfile
    from pathlib import Path
    from app.config import settings

    source = Path(input_path).resolve(strict=True)
    allowed = {".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt", ".ods", ".odp", ".rtf", ".txt", ".csv"}
    if not source.is_file() or source.suffix.lower() not in allowed:
        raise ValueError("Unsupported office document type")
    executable = shutil.which("libreoffice")
    if not executable:
        raise RuntimeError("LibreOffice is required for office-to-PDF conversion")
    target_dir = Path(output_dir).resolve()
    target_dir.mkdir(parents=True, exist_ok=True)
    destination = target_dir / f"{source.stem}.pdf"

    # Each invocation gets a fresh profile and staging directory. A stale output or
    # another concurrent LibreOffice process cannot be mistaken for success.
    with tempfile.TemporaryDirectory(prefix="pdfforge-office-", dir=target_dir) as temporary:
        staging = Path(temporary)
        profile = staging / "profile"
        user_profile = profile / "user"
        user_profile.mkdir(parents=True)
        (user_profile / "registrymodifications.xcu").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>'
            '<oor:items xmlns:oor="http://openoffice.org/2001/registry">'
            '<item oor:path="/org.openoffice.Office.Common/Security/Scripting">'
            '<prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop>'
            '<prop oor:name="DisableMacrosExecution" oor:op="fuse"><value>true</value></prop>'
            '<prop oor:name="BlockUntrustedRefererLinks" oor:op="fuse"><value>true</value></prop></item>'
            '</oor:items>', encoding="utf-8",
        )
        converted = staging / "converted"
        converted.mkdir()
        scratch = staging / "tmp"
        scratch.mkdir()
        command = [
            executable, f"-env:UserInstallation={profile.as_uri()}",
            "--headless", "--nologo", "--nodefault", "--norestore",
            "--convert-to", "pdf", "--outdir", str(converted), str(source),
        ]
        try:
            process = subprocess.Popen(
                command, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                start_new_session=os.name != "nt",
                # The document converter does not need API, storage or queue secrets.
                env={
                    "PATH": os.environ.get("PATH", os.defpath), "HOME": str(profile),
                    "TMPDIR": str(scratch), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8",
                    "SAL_USE_VCLPLUGIN": "svp",
                },
            )
        except OSError:
            raise RuntimeError("LibreOffice could not be started") from None
        try:
            process.communicate(timeout=settings.OFFICE_CONVERSION_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            if os.name != "nt":
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            else:
                process.kill()
            process.communicate()
            raise RuntimeError("Office-to-PDF conversion timed out") from None
        generated = converted / f"{source.stem}.pdf"
        if process.returncode != 0 or not generated.is_file():
            raise RuntimeError("LibreOffice failed to convert the document")
        try:
            with pymupdf.open(generated) as document:
                if not document.is_pdf or document.needs_pass or document.page_count < 1:
                    raise ValueError("Invalid converted PDF")
        except Exception:
            raise RuntimeError("LibreOffice did not produce a valid PDF") from None
        os.replace(generated, destination)
    return str(destination)
