const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const r1 = await prisma.product.updateMany({
    where: { 
      OR: [
        { name: 'FREE FIRE | INDONESIA' },
        { slug: 'free-fire-indonesia' }
      ]
    },
    data: { name: 'FREE FIRE | KHMER' }
  });
  console.log('Updated Free Fire:', r1);

  const r2 = await prisma.product.updateMany({
    where: { 
      OR: [
        { name: 'MOBILE LEGENDS | INDONESIA' },
        { slug: 'mobile-legends-indonesia' }
      ]
    },
    data: { name: 'MOBILE LEGENDS | KHMER' }
  });
  console.log('Updated MLBB:', r2);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
