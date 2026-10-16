import unittest
from unittest.mock import MagicMock, patch
from app.config import settings

class TestPDFWorkerConfig(unittest.TestCase):
    def test_settings_loaded(self):
        self.assertIsNotNone(settings.APP_NAME)
        self.assertIn("PDFForge", settings.APP_NAME)

class TestRAGChunkingLogic(unittest.TestCase):
    def test_word_overlap_chunking(self):
        # Test custom chunking algorithm logic
        text = "word " * 500
        words = text.split()
        chunk_size = 100
        overlap = 20
        step = chunk_size - overlap
        
        chunks = []
        for i in range(0, len(words), step):
            ch = words[i:i + chunk_size]
            if ch:
                chunks.append(ch)
                
        self.assertGreater(len(chunks), 4)
        # Verify overlap exists between consecutive chunks
        self.assertEqual(chunks[0][-overlap:], chunks[1][:overlap])

if __name__ == '__main__':
    unittest.main()
