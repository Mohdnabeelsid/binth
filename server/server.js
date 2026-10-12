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

// ─── Security & Parsing Middleware ─────────────────────────────────────────

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, same-origin static)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
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
