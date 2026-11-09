import { BillingService } from './billing.service';
import axios from 'axios';

describe('Recorded payment receipts', () => {
  const record = { invoiceNumber: 'receipt-test', createdAt: new Date('2026-01-02T12:00:00Z'), amount: 99, currency: 'INR' };
  let prisma: any;
  let service: BillingService;
  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn().mockResolvedValue({ name: 'Account (test)', email: 'receipt@example.com' }) }, invoice: { findFirst: jest.fn().mockResolvedValue(record) } };
    service = new BillingService(prisma, { get: (key: string, fallback?: string) => key === 'WORKER_CALLBACK_SECRET' ? 'receipt-renderer-test-credential' : fallback } as any);
  });
  afterEach(() => jest.restoreAllMocks());
  it('requests only the latest owned paid record and passes its exact values', async () => {
    const post = jest.spyOn(axios, 'post').mockResolvedValue({ data: Buffer.from('%PDF-1.4\n'), headers: { 'x-doxera-receipt-version': '1' } });
    await service.generateInvoicePdf('account-test');
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith({ where: { userId: 'account-test', status: 'PAID' }, orderBy: { createdAt: 'desc' } });
    expect(post.mock.calls[0][1]).toEqual({ invoiceNumber: 'receipt-test', invoiceDate: '2026-01-02', amount: 99, currency: 'INR', customerName: 'Account (test)', customerEmail: 'receipt@example.com' });
  });
  it('builds an escaped fallback with correct cross-reference offsets', async () => {
    jest.spyOn(axios, 'post').mockRejectedValue(new Error('offline'));
    const { buffer } = await service.generateInvoicePdf('account-test');
    const pdf = buffer.toString('ascii');
    expect(pdf).toContain('INR 99.00');
    expect(pdf).toContain('2026-01-02');
    expect(pdf).toContain('Account \\(test\\)');
    expect(pdf).not.toMatch(/4242|8\.25%|Monthly Renewal|SHA-256/);
    const xref = Number(pdf.match(/startxref\n(\d+)/)![1]);
    expect(pdf.slice(xref, xref + 4)).toBe('xref');
    const offsets = [...pdf.matchAll(/(\d{10}) 00000 n/g)].map(match => Number(match[1]));
    offsets.forEach((offset, index) => expect(pdf.slice(offset)).toMatch(new RegExp(`^${index + 1} 0 obj`)));
  });
  it('does not create a receipt without an owned paid record', async () => {
    prisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.generateInvoicePdf('account-test')).rejects.toThrow('No paid invoice');
  });
  it('uses recorded-value fallback when the worker still runs the old sample renderer', async () => {
    jest.spyOn(axios, 'post').mockResolvedValue({ data: Buffer.from('%PDF-1.4\nold sample receipt'), headers: {} });
    const { buffer } = await service.generateInvoicePdf('account-test');
    expect(buffer.toString('ascii')).toContain('INR 99.00');
    expect(buffer.toString('ascii')).not.toContain('old sample receipt');
  });
  it('rejects invalid recorded amounts', async () => {
    prisma.invoice.findFirst.mockResolvedValue({ ...record, amount: NaN });
    await expect(service.generateInvoicePdf('account-test')).rejects.toThrow('incomplete');
  });
});
