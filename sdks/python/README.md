# pdfforge

Official Python SDK for the **PDFForge AI – Enterprise PDF Intelligence Platform**.

Supports both synchronous and asynchronous workflows with full Pydantic v2 type safety.

## Installation

```bash
pip install pdfforge
```

## Quick Start (Synchronous)

```python
from pdfforge import PDFForgeClient

client = PDFForgeClient(
    api_key="your_api_key_here",
    base_url="https://api.pdfforge.ai/api/v1"
)

# 1. Process files in a single line
job = client.process(
    tool="compress",
    files=["quarterly_report.pdf"],
    parameters={"compressionLevel": "high"}
)
print(f"Compressed file key: {job.outputFileKey}")

# 2. Extract structured data from an invoice
invoice = client.ai.extract_invoice(job.inputFilesPayload[0]["fileId"])
print(f"Invoice #{invoice.invoiceNumber} Total: {invoice.currency} {invoice.totalAmount}")
```

## Quick Start (Asynchronous / FastAPI / Celery)

```python
import asyncio
from pdfforge import AsyncPDFForgeClient

async def main():
    async with AsyncPDFForgeClient(api_key="your_api_key_here") as client:
        job = await client.process(
            tool="merge",
            files=["cover.pdf", "body.pdf", "appendix.pdf"]
        )
        print("Merged completed:", job.id)

asyncio.run(main())
```

## License

Apache-2.0
