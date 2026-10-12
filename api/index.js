/**
 * BINTH.IN — Vercel Serverless Function Handler
 * 
 * Proxies incoming /api/* requests to the Express application backed by Supabase PostgreSQL.
 */

const app = require('../server/server');

module.exports = (req, res) => {
  // Normalize URL path so Express router handles requests consistently
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return app(req, res);
};
