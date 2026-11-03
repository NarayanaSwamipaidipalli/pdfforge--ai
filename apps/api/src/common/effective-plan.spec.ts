import { BadRequestException } from '@nestjs/common';
import { effectivePlan, reserveAiUsage } from './effective-plan';
import { FilesService } from '../files/files.service';
import { PdfJobsService } from '../pdf-jobs/pdf-jobs.service';

describe('Effective subscription entitlements', () => {
  const now = new Date('2026-11-03T12:00:00Z');
  const subscription = (plan = 'PRO', overrides = {}) => ({ plan, status: 'ACTIVE',
    currentPeriodStart: new Date('2026-10-01Z'), currentPeriodEnd: new Date('2026-12-01Z'), ...overrides });
  const account = { id: 'synthetic-user', plan: 'ENTERPRISE' as const };

  it('preserves manual grants only when no subscription history exists', async () => {
    const db = { subscription: { findMany: jest.fn().mockResolvedValue([]) } } as any;
    expect(await effectivePlan(db, account, now)).toBe('ENTERPRISE');
  });

  it.each([
    { currentPeriodEnd: now }, { currentPeriodEnd: new Date('2026-10-01Z') },
    { currentPeriodStart: new Date('2026-12-01Z'), currentPeriodEnd: new Date('2027-01-01Z') },
    { status: 'CANCELED' }, { status: 'PAST_DUE' }, { status: 'UNPAID' },
  ])('never preserves cached paid access for inactive history %p', async overrides => {
    const db = { subscription: { findMany: jest.fn().mockResolvedValue([subscription('ENTERPRISE', overrides)]) } } as any;
    expect(await effectivePlan(db, account, now)).toBe('FREE');
  });

  it('uses the highest currently active/trial subscription across providers', async () => {
    const db = { subscription: { findMany: jest.fn().mockResolvedValue([
      subscription('ENTERPRISE', { status: 'CANCELED' }), subscription('PRO'), subscription('BUSINESS', { status: 'TRIALING' }),
    ]) } } as any;
    expect(await effectivePlan(db, account, now)).toBe('BUSINESS');
  });

  it('blocks ordinary and multipart oversized uploads after the subscription expires', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(account) },
      subscription: { findMany: jest.fn().mockResolvedValue([subscription('ENTERPRISE', { currentPeriodEnd: new Date(0) })]) },
      fileRecord: { create: jest.fn() } };
    const files = new FilesService(prisma, { get: (_key, fallback) => fallback } as any);
    const dto = { fileName: 'large.pdf', fileSizeBytes: 26 * 1024 * 1024, mimeType: 'application/pdf', checksumSha256: 'synthetic' };
    await expect(files.generatePresignedUpload(dto, account.id)).rejects.toThrow(BadRequestException);
    await expect(files.initiateMultipartUpload(dto, account.id)).rejects.toThrow(BadRequestException);
    expect(prisma.fileRecord.create).not.toHaveBeenCalled();
  });

  it('uses current daily job attempts rather than stale cached plan/counters', async () => {
    const prisma: any = {
      fileRecord: { findMany: jest.fn().mockResolvedValue([{ id: 'file', originalName: 'file.pdf', storedKey: 'synthetic.pdf', fileSizeBytes: 5 }]) },
      user: { findUnique: jest.fn().mockResolvedValue({ ...account, conversionsToday: 0 }) },
      subscription: { findMany: jest.fn().mockResolvedValue([subscription('ENTERPRISE', { currentPeriodEnd: new Date(0) })]) },
      processingJob: { count: jest.fn().mockResolvedValue(10), create: jest.fn() },
    };
    prisma.$transaction = jest.fn(action => action(prisma));
    const jobs = new PdfJobsService(prisma, {} as any, { get: (_key, fallback) => fallback } as any);
    await expect(jobs.createJob({ tool: 'compress', fileIds: ['file'] }, account.id)).rejects.toThrow('daily conversion limit');
    expect(prisma.processingJob.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });

  it('reserves AI attempts atomically and applies the free quota to expired paid accounts', async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue(account) },
      subscription: { findMany: jest.fn().mockResolvedValue([subscription('ENTERPRISE', { currentPeriodEnd: new Date(0) })]) },
      aiJob: { count: jest.fn().mockResolvedValue(5), create: jest.fn() } };
    prisma.$transaction = jest.fn(action => action(prisma));
    await expect(reserveAiUsage(prisma, account.id, 'file')).rejects.toThrow('Monthly AI request limit');
    expect(prisma.aiJob.create).not.toHaveBeenCalled();
    prisma.aiJob.count.mockResolvedValue(4);
    await reserveAiUsage(prisma, account.id, 'file');
    expect(prisma.aiJob.create).toHaveBeenCalledWith({ data: { userId: account.id, fileId: 'file', jobType: 'QUOTA_RESERVATION', status: 'QUEUED' } });
  });
});
