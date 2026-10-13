/**
 * BINTH.IN — Database Initialization & Migration Script
 * 
 * 1. Connects to PostgreSQL using DATABASE_URL
 * 2. Runs database/schema.sql (tables, enums, triggers, views, initial 15 sources)
 * 3. Seeds the initial super_admin user if none exists
 * 
 * Usage:
 *   node scripts/init-db.js
 *   or: npm run db:init
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = require('../db');

async function initializeDatabase() {
  console.log('🚀 BINTH.IN Database Initialization Starting...\n');

  // Verify connection with retry logic for container/cloud cold-starts
  let connected = false;
  let attempts = 0;
  const maxAttempts = 10;
  
  while (!connected && attempts < maxAttempts) {
    attempts++;
    try {
      const res = await pool.query('SELECT current_database(), current_user, version()');
      console.log(`Connected to database: "${res.rows[0].current_database}" as user: "${res.rows[0].current_user}"`);
      connected = true;
    } catch (err) {
      if (attempts < maxAttempts) {
        console.log(`⏳ Waiting for database connection (attempt ${attempts}/${maxAttempts})...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        console.error('❌ Database connection failed after maximum retries. Please check your DATABASE_URL:');
        console.error(err.message);
        process.exit(1);
      }
    }
  }

  // Read schema.sql
  const schemaPath = path.resolve(__dirname, '..', '..', 'database', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Schema file not found at: ${schemaPath}`);
    process.exit(1);
  }

  console.log(`\n📄 Reading schema from: ${schemaPath}`);
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Execute schema DDL
  console.log('⚙️  Applying database schema (enums, tables, indices, views, seed sources)...');
  try {
    await pool.query(schemaSql);
    console.log('✅ Database schema applied successfully.');
  } catch (err) {
    console.error('❌ Error executing schema DDL:', err.message);
    process.exit(1);
  }

  // Seed initial super_admin only if no super admin exists
  const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || '';
  const adminName = process.env.ADMIN_DEFAULT_NAME || 'BINTH Administrator';

  try {
    const { rows } = await pool.query(
      `SELECT id, email, role FROM admin_users WHERE role = 'super_admin' LIMIT 1`
    );

    if (rows.length === 0) {
      if (!adminEmail || !adminPassword) {
        console.log('\nℹ️  No existing super_admin found.');
        console.log('   To initialize the first administrator, provide:');
        console.log('   ADMIN_DEFAULT_EMAIL=your-email@binth.in');
        console.log('   ADMIN_DEFAULT_PASSWORD=<strong-random-password-min-12-chars>\n');
      } else if (adminPassword.length < 10) {
        console.error('❌ ADMIN_DEFAULT_PASSWORD must be at least 10 characters long.');
        await pool.end();
        process.exit(1);
      } else {
        console.log(`\n👤 Provisioning initial super_admin user: ${adminEmail}...`);
        const salt = await bcrypt.genSalt(12);
        const hash = await bcrypt.hash(adminPassword, salt);

        await pool.query(
          `INSERT INTO admin_users (full_name, email, password_hash, role, is_active)
           VALUES ($1, $2, $3, 'super_admin', true)
           ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'super_admin'`,
          [adminName, adminEmail, hash]
        );

        console.log('✅ Initial super_admin user configured securely.');
        console.log(`   Email: ${adminEmail}`);
        console.log('   (Password was securely hashed and not logged.)\n');
      }
    } else {
      console.log(`\nℹ️  Super admin user already exists (${rows[0].email}).`);
    }
  } catch (err) {
    console.error('❌ Error checking/creating default admin user:', err.message);
    await pool.end();
    process.exit(1);
  }

  console.log('\n🎉 Database initialization completed successfully!');
  await pool.end();
  process.exit(0);
}

initializeDatabase().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
