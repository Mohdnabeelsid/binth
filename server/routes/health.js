/**
 * BINTH.IN — Health Check Route
 * GET /api/health
 * Public endpoint; used by the admin portal to confirm backend connectivity.
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  let dbStatus = 'disconnected';

  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    console.error('[Health] DB ping failed:', err.message);
  }

  res.json({
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    version: '1.0.0',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
