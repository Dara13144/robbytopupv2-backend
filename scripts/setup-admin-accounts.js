const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashAdmin123 = await bcrypt.hash('admin123', 10);

  // 1. admin@topup.com
  await prisma.user.upsert({
    where: { email: 'admin@topup.com' },
    update: { password: hashAdmin123, role: 'ADMIN' },
    create: { email: 'admin@topup.com', password: hashAdmin123, role: 'ADMIN' }
  });

  // 2. admin@gmail.com
  await prisma.user.upsert({
    where: { email: 'admin@gmail.com' },
    update: { password: hashAdmin123, role: 'ADMIN' },
    create: { email: 'admin@gmail.com', password: hashAdmin123, role: 'ADMIN' }
  });

  const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
  console.log('ACTIVE ADMIN ACCOUNTS:');
  admins.forEach(a => console.log(`- Email: ${a.email} | Role: ${a.role}`));
}

main().finally(() => prisma.$disconnect());
