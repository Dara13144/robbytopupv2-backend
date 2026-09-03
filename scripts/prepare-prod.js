const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const dbUrl = process.env.DATABASE_URL || '';
const isPostgres = dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:');
const isProd = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID) || isPostgres;

if (isProd) {
  const src = path.join(__dirname, '..', 'prisma', 'schema.prod.prisma');
  const dest = path.join(__dirname, '..', 'prisma', 'schema.prisma');

  // Provide fallback for DIRECT_URL if missing
  if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
    process.env.DIRECT_URL = process.env.DATABASE_URL.replace('?pgbouncer=true', '').replace('&pgbouncer=true', '');
  }

  try {
    console.log('[Build] Preparing production Prisma schema (PostgreSQL)...');
    fs.copyFileSync(src, dest);
    console.log('[Build] Production schema ready.');
  } catch (err) {
    console.error('[Build] Failed to prepare production schema:', err.message);
    process.exit(1);
  }
} else {
  console.log('[Build] Skipping production schema preparation (local dev).');
}

