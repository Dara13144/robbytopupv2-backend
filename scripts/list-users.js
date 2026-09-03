const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('ALL USERS IN DATABASE:');
  users.forEach(u => {
    console.log(`- Email: ${u.email} | Role: ${u.role} | ID: ${u.id}`);
  });
}

main().finally(() => prisma.$disconnect());
