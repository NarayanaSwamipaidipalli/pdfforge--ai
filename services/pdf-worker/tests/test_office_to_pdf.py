"""Run inside the actual worker image: exercises real LibreOffice, images and tables."""
import os
import shutil
import subprocess
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import MagicMock, patch

import pymupdf
from docx import Document
from docx.shared import Inches
from PIL import Image, ImageDraw

from app.processors.conversions import office_to_pdf


def make_rich_docx(directory, name="fixture"):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    image_path = directory / f"{name}.png"
    image = Image.new("RGB", (240, 120), "#2161aa")
    ImageDraw.Draw(image).rectangle((20, 20, 220, 100), fill="#f4a340")
    image.save(image_path)
    document = Document()
    document.add_heading("PDFForge conversion fixture", level=1)
    document.add_paragraph(f"BEFORE_TABLE_{name}")
    table = document.add_table(rows=3, cols=2)
    table.style = "Table Grid"
    for row, values in zip(table.rows, (("ITEM", "AMOUNT"), (f"TABLE_CELL_{name}", "125.50"), ("TOTAL", "125.50"))):
        for cell, value in zip(row.cells, values):
            cell.text = value
    document.add_paragraph(f"AFTER_TABLE_{name}")
    document.add_picture(str(image_path), width=Inches(2.4))
    document.add_paragraph(f"AFTER_IMAGE_{name}")
    source = directory / f"{name}.docx"
    document.save(source)
    return source


class RealOfficeConversionTests(unittest.TestCase):
    def test_real_image_has_libreoffice_and_preserves_images_tables_and_order(self):
        self.assertIsNotNone(shutil.which("libreoffice"), "Run these tests inside the production worker Docker image")
        with tempfile.TemporaryDirectory(prefix="office-fixture-") as directory:
            source = make_rich_docx(directory)
            result = Path(office_to_pdf(str(source), str(Path(directory) / "output")))
            self.assertTrue(result.is_file())
            with pymupdf.open(result) as pdf:
                text = "\n".join(page.get_text(sort=True) for page in pdf)
                self.assertGreaterEqual(pdf.page_count, 1)
                for sentinel in ("BEFORE_TABLE_fixture", "TABLE_CELL_fixture", "AFTER_TABLE_fixture", "AFTER_IMAGE_fixture", "125.50"):
                    self.assertIn(sentinel, text)
                self.assertLess(text.index("BEFORE_TABLE_fixture"), text.index("TABLE_CELL_fixture"))
                self.assertLess(text.index("TABLE_CELL_fixture"), text.index("AFTER_TABLE_fixture"))
                self.assertGreaterEqual(sum(len(page.get_images()) for page in pdf), 1)
                self.assertGreaterEqual(sum(len(page.get_drawings()) for page in pdf), 1, "Table borders must remain visible")
                artifact_dir = os.getenv("TEST_ARTIFACT_DIR")
                if artifact_dir:
                    artifacts = Path(artifact_dir)
                    artifacts.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(source, artifacts / "image-table-fixture.docx")
                    shutil.copy2(result, artifacts / "image-table-result.pdf")
                    pdf[0].get_pixmap(dpi=120).save(artifacts / "image-table-result.png")

    def test_concurrent_conversions_use_independent_profiles(self):
        with tempfile.TemporaryDirectory(prefix="office-concurrent-") as directory:
            sources = [make_rich_docx(Path(directory) / str(index), f"parallel_{index}") for index in range(2)]
            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(lambda source: office_to_pdf(str(source), str(source.parent / "output")), sources))
            for index, result in enumerate(results):
                with pymupdf.open(result) as pdf:
                    text = "\n".join(page.get_text() for page in pdf)
                    self.assertIn(f"TABLE_CELL_parallel_{index}", text)
                    self.assertGreaterEqual(sum(len(page.get_images()) for page in pdf), 1)
                self.assertFalse(list(Path(result).parent.glob("pdfforge-office-*")))


class OfficeConversionFailureTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="office-failure-")
        self.addCleanup(self.directory.cleanup)
        self.source = make_rich_docx(self.directory.name)
        self.output = Path(self.directory.name) / "output"

    def test_missing_libreoffice_never_silently_uses_lossy_renderer(self):
        with patch("shutil.which", return_value=None):
            with self.assertRaisesRegex(RuntimeError, "LibreOffice is required"):
                office_to_pdf(str(self.source), str(self.output))

    def test_failed_conversion_cannot_reuse_stale_pdf(self):
        self.output.mkdir()
        stale = self.output / "fixture.pdf"
        stale.write_bytes(b"existing-test-file")
        process = MagicMock(returncode=0)
        with patch("shutil.which", return_value="/synthetic/libreoffice"), patch("subprocess.Popen", return_value=process):
            with self.assertRaisesRegex(RuntimeError, "failed to convert"):
                office_to_pdf(str(self.source), str(self.output))
        self.assertEqual(stale.read_bytes(), b"existing-test-file")

    def test_timeout_terminates_conversion_and_reports_failure(self):
        process = MagicMock(pid=123456789)
        process.communicate.side_effect = [subprocess.TimeoutExpired("synthetic", 1), (b"", b"")]
        with patch("shutil.which", return_value="/synthetic/libreoffice"), patch("subprocess.Popen", return_value=process), patch("os.killpg", create=True) as kill_group:
            with self.assertRaisesRegex(RuntimeError, "timed out"):
                office_to_pdf(str(self.source), str(self.output))
            if os.name != "nt":
                kill_group.assert_called_once()
            else:
                process.kill.assert_called_once()
        self.assertFalse(list(self.output.glob("pdfforge-office-*")))

    def test_converter_does_not_inherit_service_credentials(self):
        def convert(command, **kwargs):
            target = Path(command[command.index("--outdir") + 1]) / "fixture.pdf"
            with pymupdf.open() as pdf:
                pdf.new_page().insert_text((72, 72), "synthetic result")
                pdf.save(target)
            return MagicMock(returncode=0)

        with patch.dict(os.environ, {"WORKER_CALLBACK_SECRET": "synthetic-secret", "AWS_SECRET_ACCESS_KEY": "synthetic-key"}), patch("shutil.which", return_value="/synthetic/libreoffice"), patch("subprocess.Popen", side_effect=convert) as launch:
            office_to_pdf(str(self.source), str(self.output))
            environment = launch.call_args.kwargs["env"]
            self.assertNotIn("WORKER_CALLBACK_SECRET", environment)
            self.assertNotIn("AWS_SECRET_ACCESS_KEY", environment)
