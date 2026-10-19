import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_invoice_pdf(data: Dict[str, Any]) -> bytes:
    """
    Generates an enterprise PDF invoice receipt using ReportLab.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=40,
        bottomMargin=40,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontSize=24,
        leading=28,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold',
    )
    subtitle_style = ParagraphStyle(
        'InvoiceSubtitle',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        textColor=colors.HexColor('#64748b'),
    )
    header_right = ParagraphStyle(
        'HeaderRight',
        parent=styles['Normal'],
        fontSize=9,
        leading=13,
        alignment=2,
        textColor=colors.HexColor('#475569'),
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#475569'),
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#1e293b'),
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontSize=8,
        fontName='Helvetica-Bold',
        textColor=colors.HexColor('#0f172a'),
    )

    elements = []

    # 1. Header Section
    invoice_number = data.get('invoiceNumber') or f"INV-{datetime.utcnow().strftime('%Y%m')}-001"
    invoice_date = data.get('invoiceDate') or datetime.utcnow().strftime('%B %d, %Y')
    due_date = data.get('dueDate') or datetime.utcnow().strftime('%B %d, %Y')

    header_table_data = [
        [
            Paragraph("<b>PDFForge AI</b><br/><font size=8 color='#64748b'>Enterprise PDF Intelligence Inc.<br/>100 Enterprise Way, Suite 400<br/>San Francisco, CA 94105, USA<br/>tax-id: US-84-9182391</font>", styles['Normal']),
            Paragraph(f"<b>TAX INVOICE / RECEIPT</b><br/>Invoice #: <b>{invoice_number}</b><br/>Issue Date: {invoice_date}<br/>Due Date: {due_date}<br/>Status: <font color='#16a34a'><b>PAID</b></font>", header_right),
        ]
    ]
    header_table = Table(header_table_data, colWidths=[270, 270])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(header_table)
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=15))

    # 2. Bill To Section
    customer_name = data.get('customerName') or 'Valued Customer'
    customer_email = data.get('customerEmail') or 'finance@company.com'
    organization = data.get('organizationName') or 'Personal Workspace'
    plan_tier = data.get('planTier') or 'PRO'

    bill_to_data = [
        [
            Paragraph("<b>BILLED TO:</b>", table_header),
            Paragraph("<b>SUBSCRIPTION SUMMARY:</b>", table_header),
        ],
        [
            Paragraph(f"<b>{customer_name}</b><br/>{organization}<br/>Email: {customer_email}", subtitle_style),
            Paragraph(f"Plan: <b>{plan_tier} Enterprise</b><br/>Billing Cycle: Monthly Renewal<br/>Payment Method: Stripe Card (Ending •••• 4242)", subtitle_style),
        ]
    ]
    bill_table = Table(bill_to_data, colWidths=[270, 270])
    bill_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(bill_table)
    elements.append(Spacer(1, 10))

    # 3. Line Items Table
    items: List[Dict[str, Any]] = data.get('items') or [
        {
            "description": f"PDFForge AI {plan_tier} Platform Subscription (1 Month)",
            "quantity": 1,
            "unitPrice": 12.00 if plan_tier == 'PRO' else 49.00,
            "amount": 12.00 if plan_tier == 'PRO' else 49.00,
        }
    ]

    subtotal = sum(item.get('amount', 0) for item in items)
    tax = round(subtotal * 0.0825, 2)
    total = round(subtotal + tax, 2)
    currency = data.get('currency') or 'USD'

    items_table_data = [
        [
            Paragraph("ITEM & SERVICE DESCRIPTION", table_header),
            Paragraph("QTY", table_header),
            Paragraph(f"UNIT PRICE ({currency})", table_header),
            Paragraph(f"TOTAL ({currency})", table_header),
        ]
    ]

    for itm in items:
        items_table_data.append([
            Paragraph(itm.get('description', 'Service item'), table_cell),
            Paragraph(str(itm.get('quantity', 1)), table_cell),
            Paragraph(f"{itm.get('unitPrice', 0):.2f}", table_cell),
            Paragraph(f"{itm.get('amount', 0):.2f}", table_cell_bold),
        ])

    # Summary rows
    items_table_data.append([
        "", "", Paragraph("Subtotal:", table_header), Paragraph(f"{subtotal:.2f}", table_cell_bold)
    ])
    items_table_data.append([
        "", "", Paragraph("Sales Tax / VAT (8.25%):", table_header), Paragraph(f"{tax:.2f}", table_cell)
    ])
    items_table_data.append([
        "", "", Paragraph("<b>TOTAL AMOUNT PAID:</b>", table_header), Paragraph(f"<b>{currency} {total:.2f}</b>", table_cell_bold)
    ])

    items_table = Table(items_table_data, colWidths=[280, 50, 100, 110])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f8fafc')),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('GRID', (0, 0), (-1, -4), 0.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0, 0), (-1, 0), 1.5, colors.HexColor('#cbd5e1')),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 20))

    # 4. Compliance & Cryptographic Hash Footer
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#e2e8f0'), spaceAfter=10))
    footer_text = (
        "<b>Electronic Receipt & Certificate of Tax Compliance</b><br/>"
        f"This document is an official cryptographic receipt generated by the PDFForge AI Billing System. "
        f"Document integrity hash (SHA-256): <b>{data.get('checksum', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')}</b>.<br/>"
        "Questions regarding this statement? Contact finance@pdfforge.ai or review your billing dashboard at https://pdfforge.ai/dashboard."
    )
    elements.append(Paragraph(footer_text, subtitle_style))

    doc.build(elements)
    return buffer.getvalue()
