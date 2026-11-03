'use strict';

// Manual create-only administrator provisioning, never loaded by services or CI.
async function main() {
  if (process.env.PDFFORGE_ALLOW_NEW_ADMIN !== 'true') throw new Error('Administrator provisioning requires explicit opt-in');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be supplied explicitly');
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !email.includes('@') || !password || password.length < 16) throw new Error('Provide ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 16 characters');
  const { PrismaClient } = require('@prisma/client');
  const bcrypt = require('bcryptjs');
  const crypto = require('crypto');
  const prisma = new PrismaClient();
  try {
    if (await prisma.user.findUnique({ where: { email } })) throw new Error('Account already exists; refusing to modify it');
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { email, passwordHash, name: process.env.ADMIN_NAME || 'Administrator', globalRole: 'SUPERADMIN', provider: 'LOCAL', isEmailVerified: false } });
      const org = await tx.organization.create({ data: { name: 'Administrator workspace', slug: `admin-${crypto.randomUUID()}`, ownerId: user.id, plan: 'FREE' } });
      await tx.organizationMember.create({ data: { orgId: org.id, userId: user.id, role: 'OWNER' } });
    });
    console.log('New administrator created. No existing account was modified.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Administrator provisioning failed; no credentials are logged.'); process.exitCode = 1; });