const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const pkg = await prisma.package.deleteMany({
      where: { product: { slug: { in: ['2048', '2048-game'] } } }
    });
    console.log('Deleted packages:', pkg.count);
    const prod = await prisma.product.deleteMany({
      where: { slug: { in: ['2048', '2048-game'] } }
    });
    console.log('Deleted products:', prod.count);
  } catch (err) {
    console.error('Delete error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
