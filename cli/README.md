# pdfforge-cli

Official Command Line Interface for the **PDFForge AI – Enterprise PDF Intelligence Platform**.

Automate PDF processing pipelines, run OCR, execute AI document summaries, extract invoices, and monitor enterprise clusters directly from your terminal or CI/CD pipelines.

## Installation

```bash
npm install -g pdfforge-cli
# or run directly with npx:
npx pdfforge-cli --help
```

## Authentication

```bash
pdfforge login --email admin@pdfforge.ai --password "AdminPassword123!"
```

## Commands

### 1. Document Operations
```bash
# Merge multiple documents into one
pdfforge merge report_part1.pdf report_part2.pdf -o merged_annual.pdf

# Compress a PDF with configurable quality
pdfforge compress contract.pdf --level high -o contract_compressed.pdf

# Watermark documents with enterprise classification stamps
pdfforge watermark policy.pdf --text "STRICTLY CONFIDENTIAL" -o policy_watermarked.pdf

# Run Optical Character Recognition (OCR) on scanned documents
pdfforge ocr scanned_invoice.pdf --lang eng -o searchable.pdf
```

### 2. AI Document Intelligence
```bash
# Executive document summarization & key action points
pdfforge ai summarize quarterly_financials.pdf --mode bullet_points

# Interactive RAG Q&A with document vector search
pdfforge ai ask master_services_agreement.pdf --question "What are the indemnification limits and payment terms?"

# Automated invoice / receipt extraction
pdfforge ai invoice vendor_bill_october.pdf
```

### 3. Cluster Observability
```bash
pdfforge telemetry
```

## License

Apache-2.0
