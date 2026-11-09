import unittest
import fitz
from pydantic import ValidationError
from app.main import GenerateInvoiceRequest
from app.processors.invoice_generator import generate_invoice_pdf


class ReceiptTests(unittest.TestCase):
    def test_recorded_values_and_escaped_contact(self):
        data = dict(invoiceNumber='receipt-test', invoiceDate='2026-01-02',
                    amount=99, currency='INR', customerName='<b>Account & Co</b>',
                    customerEmail='receipt@example.com')
        pdf = generate_invoice_pdf(data)
        with fitz.open(stream=pdf, filetype='pdf') as doc:
            text = ''.join(page.get_text() for page in doc)
        for value in ('INR 99.00', '2026-01-02', 'receipt-test', '<b>Account & Co</b>'):
            self.assertIn(value, text)
        for invented in ('4242', '8.25%', 'US-84', 'Monthly Renewal', 'SHA-256', '12.00'):
            self.assertNotIn(invented, text)

    def test_incomplete_or_invalid_record_rejected(self):
        valid = dict(invoiceNumber='receipt-test', invoiceDate='2026-01-02',
                     amount=99, currency='INR', customerEmail='receipt@example.com')
        for field in ('amount', 'currency', 'invoiceDate', 'invoiceNumber'):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                GenerateInvoiceRequest(**{k: v for k, v in valid.items() if k != field})
        for value in (-1, float('nan'), float('inf')):
            with self.assertRaises(ValidationError):
                GenerateInvoiceRequest(**{**valid, 'amount': value})
