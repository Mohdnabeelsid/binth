/**
 * BINTH.IN — Unified Static Serving & Security Isolation Tests (Option 2)
 *
 * Verifies that the single Render service:
 * 1. Serves the landing page (index.html) and admin portal cleanly.
 * 2. Emits required production security headers (nosniff, SAMEORIGIN, etc.).
 * 3. Strictly blocks client access to server code, schema files, configs, and .env.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// Set minimal test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-123456789012345678901234567890';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.IP_HASH_SALT = 'test-salt';

const app = require('../server');

describe('Option 2: Unified Static Frontend & Security Isolation', () => {
  let server;
  let port;

  before(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  function makeRequest(path) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method: 'GET'
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  it('serves landing page (GET /) with 200 OK and HTML content', async () => {
    const res = await makeRequest('/');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.match(res.body, /BINTH/);
  });

  it('injects production security headers on web responses', async () => {
    const res = await makeRequest('/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  });

  it('serves admin portal (GET /admin/) with 200 OK', async () => {
    const res = await makeRequest('/admin/');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'], /text\/html/);
  });

  it('strictly blocks direct client access to backend server code (/server/server.js)', async () => {
    const res = await makeRequest('/server/server.js');
    assert.equal(res.statusCode, 404);
  });

  it('strictly blocks direct client access to database schema (/database/schema.sql)', async () => {
    const res = await makeRequest('/database/schema.sql');
    assert.equal(res.statusCode, 404);
  });

  it('strictly blocks direct client access to package configuration (/package.json)', async () => {
    const res = await makeRequest('/package.json');
    assert.equal(res.statusCode, 404);
  });

  it('strictly blocks direct client access to deployment manifest (/render.yaml)', async () => {
    const res = await makeRequest('/render.yaml');
    assert.equal(res.statusCode, 404);
  });
});
