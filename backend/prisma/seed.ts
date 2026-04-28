import 'dotenv/config';
import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main() {
  const firmName = process.env.SEED_FIRM_NAME ?? 'My CA Firm';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@ca360.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';
  const adminName = process.env.SEED_ADMIN_NAME ?? 'Managing Partner';

  // Idempotent: only seed if no firm exists yet.
  const existing = await prisma.caFirm.findFirst();
  if (existing) {
    console.log('A firm already exists — skipping seed.');
    return;
  }

  const firm = await prisma.caFirm.create({
    data: {
      name: firmName,
      plan: 'starter',
    },
  });

  const branch = await prisma.branch.create({
    data: {
      firmId: firm.id,
      name: 'Head Office',
      city: 'Mumbai',
      isHq: true,
    },
  });

  const passwordHash = await hash(adminPassword);

  const admin = await prisma.user.create({
    data: {
      firmId: firm.id,
      branchId: branch.id,
      name: adminName,
      email: adminEmail,
      role: UserRole.MANAGING_PARTNER,
      passwordHash,
      isActive: true,
    },
  });

  await prisma.branch.update({
    where: { id: branch.id },
    data: { headUserId: admin.id },
  });

  console.log('');
  console.log('────────────────────────────────────────────────────────');
  console.log('  CA360 seeded successfully');
  console.log('────────────────────────────────────────────────────────');
  console.log(`  Firm:    ${firm.name}`);
  console.log(`  Branch:  ${branch.name}, ${branch.city}`);
  console.log(`  Admin:   ${admin.email}`);
  console.log('');
  console.log(`  Login at http://localhost:5173 with:`);
  console.log(`    Email:    ${adminEmail}`);
  console.log(`    Password: ${adminPassword}`);
  console.log('');
  console.log(`  On first login, scan the QR with Google Authenticator/Authy.`);
  console.log('────────────────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
