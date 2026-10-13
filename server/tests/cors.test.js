const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

test('CORS Policy Verification', async (t) => {
  // Save original env
  const origCors = process.env.CORS_ORIGIN;
  const origNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = 'production';
  process.env.CORS_ORIGIN = 'https://binth.in,https://binth.netlify.app';

  // Clear module cache to re-evaluate CORS config
  delete require.cache[require.resolve('../server')];
  const app = require('../server');
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  t.after(async () => {
    server.close();
    const pool = require('../db');
    await pool.end();
    process.env.CORS_ORIGIN = origCors;
    process.env.NODE_ENV = origNodeEnv;
  });

  await t.test('allows requests from explicitly configured trusted origin', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': 'https://binth.in'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://binth.in');
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
  });

  await t.test('allows requests from secondary trusted origin in allowlist', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': 'https://binth.netlify.app'
      }
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), 'https://binth.netlify.app');
  });

  await t.test('rejects requests from untrusted/disallowed origin', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET',
      headers: {
        'Origin': 'https://malicious-attacker.com'
      }
    });

    // When an origin is rejected by CORS callback, express cors either returns 403 or omits CORS headers
    assert.notEqual(res.headers.get('access-control-allow-origin'), 'https://malicious-attacker.com');
  });

  await t.test('allows non-browser clients without Origin header (curl, mobile, server)', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      method: 'GET'
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.status);
  });
});
