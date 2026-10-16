import re
from typing import List, Dict, Any
import fitz

def extract_tables_and_text(input_path: str) -> Dict[str, Any]:
    """
    Extracts structured layout data, paragraphs, and tables from a PDF document.
    """
    doc = fitz.open(input_path)
    pages_data = []
    total_words = 0
    
    for page_idx, page in enumerate(doc):
        text = page.get_text("text")
        words = len(text.split())
        total_words += words
        
        # PyMuPDF 1.23+ native table finder
        tables = []
        try:
            tabs = page.find_tables()
            for t in tabs:
                tables.append({
                    "rowCount": t.row_count,
                    "colCount": t.col_count,
                    "header": t.header.names if t.header else [],
                    "rows": t.extract()
                })
        except Exception:
            pass
            
        pages_data.append({
            "pageNumber": page_idx + 1,
            "wordCount": words,
            "text": text,
            "tables": tables
        })
        
    doc.close()
    return {
        "pageCount": len(pages_data),
        "totalWords": total_words,
        "pages": pages_data
    }

def chunk_document_for_rag(input_path: str, chunk_size_words: int = 250, overlap_words: int = 30) -> List[Dict[str, Any]]:
    """
    Splits PDF text into semantic chunks with page citations for RAG embeddings.
    """
    doc = fitz.open(input_path)
    chunks = []
    chunk_id = 0
    
    for page_idx, page in enumerate(doc):
        text = page.get_text("text")
        words = text.split()
        
        for i in range(0, len(words), chunk_size_words - overlap_words):
            chunk_words = words[i:i + chunk_size_words]
            if not chunk_words:
                continue
            chunk_text = " ".join(chunk_words)
            chunks.append({
                "chunkIndex": chunk_id,
                "pageNumber": page_idx + 1,
                "textSnippet": chunk_text,
                "tokenEstimate": int(len(chunk_words) * 1.3)
            })
            chunk_id += 1
            
    doc.close()
    return chunks
