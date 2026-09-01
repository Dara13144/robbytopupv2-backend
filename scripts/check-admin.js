const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  let admin = await prisma.user.findUnique({
    where: { email: 'admin@topup.com' }
  });

  const hash = await bcrypt.hash('admin123', 10);
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email: 'admin@topup.com',
        password: hash,
        role: 'ADMIN'
      }
    });
    console.log('Created admin account:', admin.email);
  } else {
    await prisma.user.update({
      where: { email: 'admin@topup.com' },
      data: { password: hash, role: 'ADMIN' }
    });
    console.log('Updated admin account password and role:', admin.email);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
