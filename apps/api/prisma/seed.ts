import { PrismaClient, GlobalRole, PlanTier, OrgRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting PDFForge AI Enterprise database seed...');

  // Configuration via environment variables with secure production-ready defaults
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@pdfforge.ai').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPassword123!';
  const adminName = process.env.ADMIN_NAME || 'Global System Administrator';

  const proEmail = (process.env.PRO_USER_EMAIL || 'alex.morgan@enterprise.com').toLowerCase();
  const proPassword = process.env.PRO_USER_PASSWORD || 'UserPassword123!';
  const proName = process.env.PRO_USER_NAME || 'Alex Morgan';

  // 1. Create or Update Super Admin User
  const salt = await bcrypt.genSalt(12);
  const adminPasswordHash = await bcrypt.hash(adminPassword, salt);
  const proPasswordHash = await bcrypt.hash(proPassword, salt);

  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash: adminPasswordHash,
      globalRole: GlobalRole.SUPERADMIN,
      plan: PlanTier.ENTERPRISE,
      isEmailVerified: true,
    },
    create: {
      email: adminEmail,
      name: adminName,
      passwordHash: adminPasswordHash,
      globalRole: GlobalRole.SUPERADMIN,
      plan: PlanTier.ENTERPRISE,
      isEmailVerified: true,
      storageUsedBytes: BigInt(104857600), // 100 MB initial
    },
  });

  console.log(`✅ SuperAdmin user seeded: ${superAdmin.email} (Role: ${superAdmin.globalRole})`);

  // Admin Workspace
  const adminOrgSlug = `${adminEmail.split('@')[0]}-admin-workspace`;
  const adminOrg = await prisma.organization.upsert({
    where: { slug: adminOrgSlug },
    update: {
      ownerId: superAdmin.id,
      plan: PlanTier.ENTERPRISE,
    },
    create: {
      name: `${adminName}'s Workspace`,
      slug: adminOrgSlug,
      ownerId: superAdmin.id,
      plan: PlanTier.ENTERPRISE,
      storageLimitBytes: BigInt(107374182400), // 100 GB
      storageUsedBytes: BigInt(0),
      monthlyJobsLimit: 50000,
      jobsUsedThisMonth: 0,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      orgId_userId: {
        orgId: adminOrg.id,
        userId: superAdmin.id,
      },
    },
    update: {
      role: OrgRole.OWNER,
    },
    create: {
      orgId: adminOrg.id,
      userId: superAdmin.id,
      role: OrgRole.OWNER,
    },
  });

  // 2. Create or Update Pro User
  const proUser = await prisma.user.upsert({
    where: { email: proEmail },
    update: {
      name: proName,
      passwordHash: proPasswordHash,
      globalRole: GlobalRole.USER,
      plan: PlanTier.PRO,
      isEmailVerified: true,
    },
    create: {
      email: proEmail,
      name: proName,
      passwordHash: proPasswordHash,
      globalRole: GlobalRole.USER,
      plan: PlanTier.PRO,
      isEmailVerified: true,
      storageUsedBytes: BigInt(524288000), // 500 MB
      conversionsToday: 14,
    },
  });

  console.log(`✅ Pro user seeded: ${proUser.email} (Role: ${proUser.globalRole})`);

  // 3. Create or Update Enterprise Organization Workspace
  const enterpriseOrg = await prisma.organization.upsert({
    where: { slug: 'apex-global-legal' },
    update: {
      ownerId: proUser.id,
      plan: PlanTier.BUSINESS,
    },
    create: {
      name: 'Apex Global Legal & Compliance',
      slug: 'apex-global-legal',
      ownerId: proUser.id,
      plan: PlanTier.BUSINESS,
      storageLimitBytes: BigInt(107374182400), // 100 GB
      storageUsedBytes: BigInt(15242880000),  // 15.2 GB
      monthlyJobsLimit: 25000,
      jobsUsedThisMonth: 1420,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      orgId_userId: {
        orgId: enterpriseOrg.id,
        userId: proUser.id,
      },
    },
    update: {
      role: OrgRole.OWNER,
    },
    create: {
      orgId: enterpriseOrg.id,
      userId: proUser.id,
      role: OrgRole.OWNER,
    },
  });

  console.log(`✅ Enterprise Workspace seeded: ${enterpriseOrg.name}`);

  // 4. Create or Update Active Subscription Record
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: 'sub_enterprise_apex_2026' },
    update: {
      userId: proUser.id,
      orgId: enterpriseOrg.id,
      plan: PlanTier.BUSINESS,
      status: 'ACTIVE',
      provider: 'stripe',
    },
    create: {
      userId: proUser.id,
      orgId: enterpriseOrg.id,
      plan: PlanTier.BUSINESS,
      status: 'ACTIVE',
      provider: 'stripe',
      stripeCustomerId: 'cus_apex_corp_99',
      stripeSubscriptionId: 'sub_enterprise_apex_2026',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 5. Seed Demonstration PDF File Record
  const sampleFile = await prisma.fileRecord.upsert({
    where: { storedKey: 'uploads/2026-10-16/master_services_agreement.pdf' },
    update: {
      userId: proUser.id,
      orgId: enterpriseOrg.id,
    },
    create: {
      userId: proUser.id,
      orgId: enterpriseOrg.id,
      originalName: 'Master_Services_Agreement_2026.pdf',
      storedKey: 'uploads/2026-10-16/master_services_agreement.pdf',
      fileSizeBytes: BigInt(4404019), // 4.2 MB
      mimeType: 'application/pdf',
      pageCount: 18,
      checksumSha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      isVirusScanned: true,
      isClean: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  // 6. Seed Demonstration Processing Job (Idempotent check)
  const existingJob = await prisma.processingJob.findFirst({
    where: {
      userId: proUser.id,
      outputFileKey: 'processed/sample_compressed.pdf',
    },
  });

  if (!existingJob) {
    await prisma.processingJob.create({
      data: {
        userId: proUser.id,
        orgId: enterpriseOrg.id,
        tool: 'compress',
        status: 'COMPLETED',
        priority: 'HIGH',
        inputFilesPayload: [{ fileId: sampleFile.id, name: sampleFile.originalName }],
        parametersPayload: { compressionLevel: 'medium' },
        outputFileKey: 'processed/sample_compressed.pdf',
        outputFileSizeBytes: BigInt(1153433), // 1.1 MB
        progress: 100,
        durationMs: 1420,
        completedAt: new Date(),
      },
    });
  }

  // 7. Seed Production API Key (Idempotent check)
  const existingKey = await prisma.apiKey.findFirst({
    where: {
      userId: proUser.id,
      keyPrefix: 'pdf_live_9a',
    },
  });

  if (!existingKey) {
    const keySalt = await bcrypt.genSalt(10);
    const keyHash = await bcrypt.hash('pdf_live_9a87f10b83e4499d91f2e1320491a0c8', keySalt);

    await prisma.apiKey.create({
      data: {
        userId: proUser.id,
        orgId: enterpriseOrg.id,
        name: 'Production Worker Key',
        keyPrefix: 'pdf_live_9a',
        keyHash,
        permissions: ['pdf:read', 'pdf:process', 'ai:query'],
        rateLimitRpm: 300,
        lastUsedAt: new Date(),
      },
    });
  }

  // 8. Seed Promotional Coupons
  const promotionalCoupons = [
    {
      code: 'WELCOME50',
      discountPercent: 50,
      maxUses: 1000,
      isActive: true,
    },
    {
      code: 'PRO2026',
      discountPercent: 20,
      maxUses: 500,
      isActive: true,
    },
    {
      code: 'ENTERPRISE100',
      discountAmount: 100,
      maxUses: 100,
      isActive: true,
    },
  ];

  if ((prisma as any).coupon) {
    for (const coupon of promotionalCoupons) {
      await (prisma as any).coupon.upsert({
        where: { code: coupon.code },
        update: {
          isActive: coupon.isActive,
        },
        create: coupon,
      });
    }
  }

  console.log('🚀 Database seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
