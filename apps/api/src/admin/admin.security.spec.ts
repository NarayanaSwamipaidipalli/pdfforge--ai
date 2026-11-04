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
