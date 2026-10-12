/**
 * BINTH.IN — PostgreSQL Connection Pool (Supabase Compatible)
 * Uses environment-configured DATABASE_URL.
 * Supports connection pooling and SSL for Supabase Serverless & Vercel execution.
 */

const path = require('path');

// Ensure environment variables are loaded if db.js is required directly
if (!process.env.DATABASE_URL) {
  try {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (e) {
    // ignore if dotenv cannot be loaded
  }
}

const { Pool } = require('pg');

// Detect SSL requirement (Supabase requires SSL; supports ?sslmode=require)
const dbUrl = process.env.DATABASE_URL || '';
const needsSsl = process.env.NODE_ENV === 'production' ||
  dbUrl.includes('supabase') ||
  dbUrl.includes('pooler') ||
  dbUrl.includes('sslmode=require');

// Cache the pool across serverless function re-invocations (warm starts)
if (!global.__binthPgPool) {
  global.__binthPgPool = new Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
    // Keep max connections small for serverless/Supabase connection limits
    max: parseInt(process.env.DB_POOL_MAX, 10) || 4,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 15_000,
  });

  global.__binthPgPool.on('error', (err) => {
    console.error('[DB] Unexpected pool error on idle client:', err.message);
  });
}

const pool = global.__binthPgPool;

module.exports = pool;

