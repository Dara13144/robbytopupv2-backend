const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prod = await prisma.product.upsert({
    where: { slug: 'bullet-echo' },
    update: {
      name: 'Bullet Echo',
      category: 'MOBILE_GAME',
      image: '/images/games/bullet-echo.png',
      isActive: true,
    },
    create: {
      name: 'Bullet Echo',
      slug: 'bullet-echo',
      category: 'MOBILE_GAME',
      image: '/images/games/bullet-echo.png',
      isActive: true,
    },
  });

  const packages = [
    { name: '80 Bucks', amount: 80, price: 0.99, category: 'NORMAL' },
    { name: '500 Bucks', amount: 500, price: 4.99, category: 'BEST_SELLER', badge: 'POPULAR' },
    { name: '1,200 Bucks', amount: 1200, price: 9.99, category: 'BEST_SELLER', badge: 'HOT' },
    { name: '2,500 Bucks', amount: 2500, price: 19.99, category: 'NORMAL' },
    { name: '6,500 Bucks', amount: 6500, price: 49.99, category: 'NORMAL', badge: 'VIP' },
    { name: '14,000 Bucks', amount: 14000, price: 99.99, category: 'NORMAL', badge: 'BEST VALUE' },
    { name: 'Season Battle Pass', amount: 1, price: 9.99, category: 'BEST_SELLER', badge: 'PASS' },
  ];

  for (const pkg of packages) {
    const existing = await prisma.package.findFirst({
      where: { productId: prod.id, name: pkg.name }
    });
    if (!existing) {
      await prisma.package.create({
        data: {
          productId: prod.id,
          name: pkg.name,
          amount: pkg.amount,
          price: pkg.price,
          category: pkg.category,
          badge: pkg.badge,
          isActive: true,
        }
      });
    } else {
      await prisma.package.update({
        where: { id: existing.id },
        data: {
          price: pkg.price,
          category: pkg.category,
          badge: pkg.badge,
          isActive: true,
        }
      });
    }
  }

  console.log('Successfully seeded Bullet Echo in SQLite database:', prod.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
