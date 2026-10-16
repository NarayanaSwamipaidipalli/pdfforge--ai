import { Injectable, Logger } from '@nestjs/common';
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

    return {
      metrics: {
        totalUsers,
        totalJobs,
        activeSubscriptions,
        filesProcessed,
        systemHealth: 'OPERATIONAL',
        workerQueueLatencyMs: 142,
        activeWorkerNodes: 8,
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

  async getUsers(limit = 25, offset = 0) {
    return this.prisma.user.findMany({
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
        createdAt: true,
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
