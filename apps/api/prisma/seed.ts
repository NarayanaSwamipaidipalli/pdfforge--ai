import { PrismaClient, GlobalRole, PlanTier, OrgRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting PDFForge AI Enterprise database seed...');

  // 1. Create Super Admin User
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('AdminPassword123!', salt);
  const userPasswordHash = await bcrypt.hash('UserPassword123!', salt);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@pdfforge.ai' },
    update: {},
    create: {
      email: 'admin@pdfforge.ai',
      name: 'Global System Administrator',
      passwordHash: adminPasswordHash,
      globalRole: GlobalRole.SUPERADMIN,
      plan: PlanTier.ENTERPRISE,
      isEmailVerified: true,
      storageUsedBytes: BigInt(104857600), // 100 MB
    },
  });

  console.log(`✅ SuperAdmin user seeded: ${superAdmin.email}`);

  // 2. Create Pro User
  const proUser = await prisma.user.upsert({
    where: { email: 'alex.morgan@enterprise.com' },
    update: {},
    create: {
      email: 'alex.morgan@enterprise.com',
      name: 'Alex Morgan',
      passwordHash: userPasswordHash,
      globalRole: GlobalRole.USER,
      plan: PlanTier.PRO,
      isEmailVerified: true,
      storageUsedBytes: BigInt(524288000), // 500 MB
      conversionsToday: 14,
    },
  });

  console.log(`✅ Pro user seeded: ${proUser.email}`);

  // 3. Create Enterprise Organization Workspace
  const enterpriseOrg = await prisma.organization.upsert({
    where: { slug: 'apex-global-legal' },
    update: {},
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

  // Assign Organization Membership
  await prisma.organizationMember.upsert({
    where: {
      orgId_userId: {
        orgId: enterpriseOrg.id,
        userId: proUser.id,
      },
    },
    update: {},
    create: {
      orgId: enterpriseOrg.id,
      userId: proUser.id,
      role: OrgRole.OWNER,
    },
  });

  console.log(`✅ Enterprise Workspace seeded: ${enterpriseOrg.name}`);

  // 4. Create Active Subscription Record
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: 'sub_enterprise_apex_2026' },
    update: {},
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

  // 5. Seed Demonstration PDF File Records
  const sampleFile = await prisma.fileRecord.upsert({
    where: { storedKey: 'uploads/2026-10-16/master_services_agreement.pdf' },
    update: {},
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

  // 6. Seed Demonstration Processing Jobs
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

  // 7. Seed Production API Key
  const keySalt = await bcrypt.genSalt(10);
  const keyHash = await bcrypt.hash('pdf_live_9a87f10b83e4499d91f2e1320491a0c8', keySalt);

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
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
