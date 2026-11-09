import { AdminService } from './admin.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('administrator privilege boundaries', () => {
  let prisma: any, service: AdminService, accounts: Map<string, any>;
  beforeEach(() => {
    accounts = new Map([
      ['root', { id: 'root', globalRole: 'SUPERADMIN', isBanned: false }],
      ['admin', { id: 'admin', globalRole: 'ADMIN', isBanned: false }],
      ['user', { id: 'user', globalRole: 'USER', isBanned: false }],
    ]);
    prisma = { user: { findUnique: jest.fn(async ({ where }) => accounts.get(where.id)),
      update: jest.fn(async ({ where, data }) => ({ ...accounts.get(where.id), ...data })), count: jest.fn().mockResolvedValue(1) },
      userSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, auditLog: { create: jest.fn() } };
    prisma.$transaction = jest.fn(async callback => callback(prisma));
    service = new AdminService(prisma);
  });
  it('reports settled revenue per currency without fabricating or converting amounts', async () => {
    prisma.subscription = { count: jest.fn().mockResolvedValue(5) };
    prisma.processingJob = { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) };
    prisma.fileRecord = { count: jest.fn().mockResolvedValue(0) };
    prisma.payment = { groupBy: jest.fn().mockResolvedValue([
      { currency: 'INR', _sum: { amount: 99 } },
      { currency: 'USD', _sum: { amount: 12 } },
    ]) };

    const { metrics } = await service.getSystemTelemetry();

    // Five active subscriptions must not become a fabricated 5 * 24.5 = 122.5 USD figure.
    expect(metrics.monthlyRecurringRevenueUsd).toBe(12);
    expect(metrics.revenueByCurrency).toEqual({ INR: 99, USD: 12 });
    // INR is never folded into the USD total at any exchange rate.
    expect(metrics.monthlyRecurringRevenueUsd).not.toBeCloseTo(122.5);
    const where = prisma.payment.groupBy.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
    expect(where.createdAt.gte.getUTCDate()).toBe(1);
  });

  it('reports zero revenue when no payments have settled this period', async () => {
    prisma.subscription = { count: jest.fn().mockResolvedValue(9) };
    prisma.processingJob = { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]) };
    prisma.fileRecord = { count: jest.fn().mockResolvedValue(0) };
    prisma.payment = { groupBy: jest.fn().mockResolvedValue([]) };

    const { metrics } = await service.getSystemTelemetry();
    expect(metrics.monthlyRecurringRevenueUsd).toBe(0);
    expect(metrics.revenueByCurrency).toEqual({});
  });

  it('prevents an administrator from assigning super-administrator privileges', async () => {
    await expect(service.updateUserRole('user', 'SUPERADMIN', 'admin')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('prevents ordinary/banned actors and administrative self-modification', async () => {
    await expect(service.banUser('admin', 'fixture', 'user')).rejects.toThrow(ForbiddenException);
    accounts.get('admin').isBanned = true;
    await expect(service.unbanUser('user', 'admin')).rejects.toThrow(ForbiddenException);
    await expect(service.updateUserRole('root', 'USER', 'root')).rejects.toThrow(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('protects administrators from an ordinary administrator ban', async () => {
    await expect(service.banUser('root', 'fixture', 'admin')).rejects.toThrow(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
  it('revokes credentials and session records when an authorized actor changes access', async () => {
    await service.updateUserRole('user', 'ADMIN', 'root');
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user' }, data: {
      globalRole: 'ADMIN', refreshTokenHash: null, tokenVersion: { increment: 1 },
    } });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({ where: { userId: 'user' }, data: { isRevoked: true } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: { userId: 'root', action: 'ADMIN_ROLE', resource: 'user', metadata: { role: 'ADMIN', isBanned: false } } });
  });
});
