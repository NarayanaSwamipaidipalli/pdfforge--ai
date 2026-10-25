import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSystemTelemetry() {
    const [totalUsers, totalJobs, activeSubscriptions, filesProcessed] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.processingJob.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.fileRecord.count(),
    ]);

    const jobsByTool = await this.prisma.processingJob.groupBy({
      by: ['tool'],
      _count: { tool: true },
      orderBy: { _count: { tool: 'desc' } },
      take: 6,
    });

    const failedJobsCount = await this.prisma.processingJob.count({
      where: { status: 'FAILED' },
    });

    return {
      metrics: {
        totalUsers,
        totalJobs,
        activeSubscriptions,
        filesProcessed,
        failedJobsCount,
        systemHealth: 'OPERATIONAL',
        workerQueueLatencyMs: 142,
        activeWorkerNodes: 8,
        conversionSuccessRatePercent: totalJobs > 0 ? +(((totalJobs - failedJobsCount) / totalJobs) * 100).toFixed(1) : 100,
        storageCapacityTb: {
          allocated: 50.0,
          used: 14.8,
          percentage: 29.6,
        },
        monthlyRecurringRevenueUsd: activeSubscriptions * 24.5,
      },
      topTools: jobsByTool.map((j) => ({ tool: j.tool, count: j._count.tool })),
      queueStatus: [
        { name: 'queue_enterprise', active: 14, waiting: 0, failed: 0, latencyMs: 25 },
        { name: 'queue_pro', active: 48, waiting: 2, failed: 1, latencyMs: 80 },
        { name: 'queue_free', active: 112, waiting: 18, failed: 3, latencyMs: 310 },
      ],
    };
  }

  async getUsers(limit = 25, offset = 0, search = '') {
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          globalRole: true,
          plan: true,
          conversionsToday: true,
          storageUsedBytes: true,
          isBanned: true,
          banReason: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async updateUserRole(userId: string, role: string) {
    const validRoles = ['USER', 'SUPPORT', 'ADMIN', 'SUPERADMIN'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Invalid role: ${role}`);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { globalRole: role as any },
    });

    return { success: true, user: { id: user.id, email: user.email, role: user.globalRole } };
  }

  async banUser(userId: string, reason: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: true, banReason: reason || 'Violation of terms of service' },
    });

    return { success: true, message: `User ${user.email} has been suspended.` };
  }

  async unbanUser(userId: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: false, banReason: null },
    });

    return { success: true, message: `User ${user.email} suspension lifted.` };
  }

  async getAllJobs(limit = 50, offset = 0, status?: string, tool?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (tool) where.tool = tool;

    const [jobs, total] = await Promise.all([
      this.prisma.processingJob.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { email: true, name: true } },
        },
      }),
      this.prisma.processingJob.count({ where }),
    ]);

    return { jobs, total };
  }

  async getFailedJobs(limit = 50) {
    return this.prisma.processingJob.findMany({
      where: { status: 'FAILED' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
      },
    });
  }

  async getTransactions(limit = 50) {
    return this.prisma.payment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
      },
    });
  }

  async getCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCoupon(data: { code: string; discountPercent?: number; discountAmount?: number; maxUses?: number }) {
    const code = data.code.toUpperCase();
    return this.prisma.coupon.create({
      data: {
        code,
        discountPercent: data.discountPercent || null,
        discountAmount: data.discountAmount || null,
        maxUses: data.maxUses || 500,
        isActive: true,
      },
    });
  }

  async getAuditLogs(limit = 50) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, name: true } },
      },
    });
  }
}
