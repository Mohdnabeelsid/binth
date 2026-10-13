/**
 * BINTH.IN — Phase 1 REST API Backend & Static Server
 * 
 * Production-ready Express server that handles:
 * - Public giveaway endpoints (visit tracking, form start, entry submission)
 * - Admin portal endpoints (metrics, campaigns, entries, sources, reports, CSV exports)
 * - Secure JWT authentication & RBAC for staff
 * - Static hosting of the framework-less frontend (index.html, admin/*.html, assets/)
 */

const path = require('path');
const express = require('express');
const cors = require('cors');

// ─── Environment Configuration ─────────────────────────────────────────────
// Load .env from current directory, fallback to parent directory
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ─── Route Handlers ────────────────────────────────────────────────────────
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Trust reverse proxies (Render, Railway, Heroku, Nginx, Cloudflare)
// Needed for correct req.ip in rate limiters and audit logs
app.set('trust proxy', 1);

// ─── Production Environment Security Validation ───────────────────────────
if (NODE_ENV === 'production') {
  const missingSecrets = [];
  if (!process.env.DATABASE_URL) {
    missingSecrets.push('DATABASE_URL');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace_this')) {
    missingSecrets.push('JWT_SECRET (must be at least 32 characters of high-entropy secret)');
  }
  if (!process.env.IP_HASH_SALT || process.env.IP_HASH_SALT.includes('replace_this')) {
    missingSecrets.push('IP_HASH_SALT (must be set for secure pseudonymization)');
  }
  if (missingSecrets.length > 0) {
    console.error('FATAL: Startup aborted due to missing/insecure production configuration:\n - ' + missingSecrets.join('\n - '));
    process.exit(1);
  }
}

// ─── Security & Parsing Middleware ─────────────────────────────────────────

// CORS configuration: strictly enforce allowlist, never combine wildcard with credentials
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultDevOrigins = ['http://localhost:3000', 'http://localhost:8000', 'http://127.0.0.1:3000', 'http://127.0.0.1:8000'];
const allowedOrigins = configuredOrigins.length > 0
  ? configuredOrigins
  : (NODE_ENV === 'production' ? [] : defaultDevOrigins);

const allowAllOrigins = allowedOrigins.includes('*');

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Requests with no origin header (curl, mobile apps, same-process static)
      if (!origin) {
        return callback(null, true);
      }

      // 2. Wildcard mode (strictly non-credentialed)
      if (allowAllOrigins) {
        return callback(null, true);
      }

      // 3. Explicit allowlist check
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // 4. Reject disallowed origin
      const corsError = new Error(`Origin ${origin} is not allowed by CORS.`);
      corsError.status = 403;
      return callback(corsError, false);
    },
    credentials: !allowAllOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  })
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Request logging (clean, minimal)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.originalUrl.startsWith('/api')) {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${color}${status}\x1b[0m (${duration}ms)`);
    }
  });
  next();
});

// ─── API Routes ────────────────────────────────────────────────────────────

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);

// 404 for unhandled API requests
app.all('/api/*', (req, res) => {
  res.status(404).json({
    ok: false,
    error: `API route ${req.method} ${req.originalUrl} not found.`
  });
});

// ─── Static Frontend Serving ───────────────────────────────────────────────
const frontendRoot = path.resolve(__dirname, '..');

// Serve static assets and HTML files with clean URL resolution
app.use(
  express.static(frontendRoot, {
    extensions: ['html'],
    index: 'index.html',
    maxAge: NODE_ENV === 'production' ? '1h' : '0'
  })
);

// Route shortcuts
app.get('/admin', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'admin', 'index.html'));
});

app.get('/admin/', (req, res) => {
  res.sendFile(path.join(frontendRoot, 'admin', 'index.html'));
});

// Fallback 404 for web pages
app.use((req, res) => {
  res.status(404).sendFile(path.join(frontendRoot, 'index.html'));
});

// ─── Global Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: NODE_ENV === 'production' ? 'Internal server error.' : err.message
  });
});

// ─── Server Startup ────────────────────────────────────────────────────────
// Only listen when executed directly (node server.js), not when imported by serverless handlers
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  BINTH.IN Backend Server running in [${NODE_ENV}] mode`);
    console.log(`  Port:         ${PORT}`);
    console.log(`  Frontend:     http://localhost:${PORT}/`);
    console.log(`  Admin Portal: http://localhost:${PORT}/admin/`);
    console.log(`  API Health:   http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received. Closing HTTP server gracefully...');
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  });
}

module.exports = app;
