"""Render recorded receipt values; never infer taxes, plans or payment methods."""
import io
from html import escape
from typing import Any, Dict

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable


def generate_invoice_pdf(data: Dict[str, Any]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=48,
                            leftMargin=48, topMargin=48, bottomMargin=48)
    styles = getSampleStyleSheet()
    text = lambda value: escape(str(value))
    elements = [Paragraph('Doxera', styles['Title']),
                Paragraph('Payment receipt', styles['Heading1']),
                HRFlowable(width='100%', color=colors.HexColor('#6366f1')),
                Spacer(1, 20)]
    lines = [
        ('Receipt reference', data['invoiceNumber']),
        ('Recorded date (UTC)', data['invoiceDate']),
        ('Recorded amount paid', f"{data['currency']} {data['amount']:.2f}"),
        ('Recorded status', 'PAID'),
    ]
    for label, value in lines:
        elements.extend([Paragraph(f'<b>{label}</b><br/>{text(value)}', styles['Normal']), Spacer(1, 16)])
    elements.append(Paragraph('Current account contact', styles['Heading2']))
    for value in (data.get('customerName'), data['customerEmail']):
        if value:
            elements.append(Paragraph(text(value), styles['Normal']))
    elements.extend([Spacer(1, 30), Paragraph(
        'This receipt reflects the stored payment record. Historical plan, tax and payment method details are not recorded on this receipt.',
        styles['Normal'])])
    doc.build(elements)
    return buffer.getvalue()
