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

  // Seed default super_admin if no admin user exists
  const adminEmail = (process.env.ADMIN_DEFAULT_EMAIL || 'admin@binth.in').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'BinthAdmin2026!';
  const adminName = process.env.ADMIN_DEFAULT_NAME || 'BINTH Administrator';

  try {
    const { rows } = await pool.query(
      `SELECT id, email, role FROM admin_users WHERE email = $1 LIMIT 1`,
      [adminEmail]
    );

    if (rows.length === 0) {
      console.log(`\n👤 Creating initial super_admin user: ${adminEmail}...`);
      const salt = await bcrypt.genSalt(12);
      const hash = await bcrypt.hash(adminPassword, salt);

      await pool.query(
        `INSERT INTO admin_users (full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, 'super_admin', true)`,
        [adminName, adminEmail, hash]
      );

      console.log('✅ Super admin user created successfully!');
      console.log('──────────────────────────────────────────────────────');
      console.log(` Email:    ${adminEmail}`);
      console.log(` Password: ${adminPassword}`);
      console.log(` Role:     super_admin`);
      console.log(' ⚠️  Please change this password after initial deployment!');
      console.log('──────────────────────────────────────────────────────');
    } else {
      console.log(`\nℹ️  Admin user "${adminEmail}" already exists. (ID: ${rows[0].id})`);
    }
  } catch (err) {
    console.error('❌ Error checking/creating default admin user:', err.message);
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
