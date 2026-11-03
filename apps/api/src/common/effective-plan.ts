import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PlanTier, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const rank: PlanTier[] = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];
export const PLAN_LIMITS = {
  FREE: { maxFileBytes: 25 * 1024 * 1024, batch: 3, monthlyAi: 5 },
  PRO: { maxFileBytes: 250 * 1024 * 1024, batch: 50, monthlyAi: 500 },
  BUSINESS: { maxFileBytes: 500 * 1024 * 1024, batch: 200, monthlyAi: 2500 },
  ENTERPRISE: { maxFileBytes: 2048 * 1024 * 1024, batch: 1000, monthlyAi: -1 },
};

export async function effectivePlan(db: Pick<Prisma.TransactionClient, 'subscription'>,
  user: { id: string; plan: PlanTier }, now = new Date()): Promise<PlanTier> {
  const history = await db.subscription.findMany({ where: { userId: user.id },
    select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true } });
  // Preserve existing manual grants only for accounts with no subscription history.
  // Once billing exists, cached User.plan cannot outlive the paid/trial period.
  if (history.length === 0) return rank.includes(user.plan) ? user.plan : 'FREE';
  return history.reduce((best, subscription) => {
    const valid = ['ACTIVE', 'TRIALING'].includes(subscription.status) && subscription.currentPeriodStart <= now && subscription.currentPeriodEnd > now;
    return valid && rank.indexOf(subscription.plan) > rank.indexOf(best) ? subscription.plan : best;
  }, 'FREE' as PlanTier);
}

export async function quotaTransaction<T>(db: PrismaService, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await db.$transaction(action, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
    catch (error) { if ((error as any)?.code !== 'P2034' || attempt >= 3) throw error; }
  }
}

export async function reserveAiUsage(db: PrismaService, userId: string, fileId: string) {
  return quotaTransaction(db, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.isBanned) throw new UnauthorizedException('Account is unavailable');
    const plan = await effectivePlan(tx, user);
    const limit = PLAN_LIMITS[plan].monthlyAi;
    const now = new Date();
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    if (limit >= 0 && await tx.aiJob.count({ where: { userId, createdAt: { gte: first } } }) >= limit) {
      throw new BadRequestException('Monthly AI request limit reached for your current plan');
    }
    // Reserve an attempt before provider work, including failed attempts, to bound concurrent usage.
    await tx.aiJob.create({ data: { userId, fileId, jobType: 'QUOTA_RESERVATION', status: 'QUEUED' } });
  });
}
