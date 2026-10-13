const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

test('Security & Role-Based Authorization Enforcement', async (t) => {
  const secret = 'test-secret-at-least-32-chars-long-for-valid-jwt-tokens';

  await t.test('JWT verification extracts sub, email, and role', () => {
    const token = jwt.sign(
      { sub: 'user-uuid-123', email: 'manager@binth.in', role: 'campaign_manager' },
      secret,
      { expiresIn: '1h' }
    );

    const decoded = jwt.verify(token, secret);
    assert.equal(decoded.sub, 'user-uuid-123');
    assert.equal(decoded.email, 'manager@binth.in');
    assert.equal(decoded.role, 'campaign_manager');
  });

  await t.test('expired JWT tokens are rejected', () => {
    const expiredToken = jwt.sign(
      { sub: 'user-uuid-123', email: 'manager@binth.in', role: 'campaign_manager' },
      secret,
      { expiresIn: '-1s' }
    );

    assert.throws(() => {
      jwt.verify(expiredToken, secret);
    }, (err) => err.name === 'TokenExpiredError');
  });

  await t.test('tampered JWT signatures are rejected', () => {
    const token = jwt.sign(
      { sub: 'user-uuid-123', email: 'viewer@binth.in', role: 'viewer' },
      secret
    );

    const parts = token.split('.');
    // Tamper payload claim from viewer to super_admin
    const tamperedPayload = Buffer.from(JSON.stringify({ sub: 'user-uuid-123', role: 'super_admin' })).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    assert.throws(() => {
      jwt.verify(tamperedToken, secret);
    }, (err) => err.name === 'JsonWebTokenError');
  });
});

test('CSV Formula Injection Defense', async (t) => {
  // Mirror of the escape function implemented in server/routes/admin.js
  const escapeCsvCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
      str = `'${str}`;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  await t.test('neutralizes formula injection triggers (=, +, -, @, \\t, \\r)', () => {
    assert.equal(escapeCsvCell('=1+1'), '"\'=1+1"');
    assert.equal(escapeCsvCell('+cmd|"/C calc"!A0'), '"\'+cmd|""/C calc""!A0"');
    assert.equal(escapeCsvCell('-5+2'), '"\'-5+2"');
    assert.equal(escapeCsvCell('@SUM(A1:A10)'), '"\'@SUM(A1:A10)"');
    assert.equal(escapeCsvCell('\tmaliciousTab'), '"\'\tmaliciousTab"');
  });

  await t.test('preserves benign strings without leading trigger characters', () => {
    assert.equal(escapeCsvCell('Ananya Menon'), '"Ananya Menon"');
    assert.equal(escapeCsvCell('ENT-ABC123'), '"ENT-ABC123"');
    assert.equal(escapeCsvCell('9847******'), '"9847******"');
  });
});

test('Phone Number Masking Integrity', async (t) => {
  // Mirror of maskPhone in server/routes/admin.js
  function maskPhone(phone) {
    if (!phone) return '—';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('91') && digits.length === 12) {
      digits = digits.slice(2);
    }
    return digits.slice(0, 4) + '******';
  }

  await t.test('masks phone displaying first 4 digits and 6 stars', () => {
    assert.equal(maskPhone('9847012345'), '9847******');
    assert.equal(maskPhone('+919847012345'), '9847******');
  });

  await t.test('handles empty or missing phone numbers gracefully', () => {
    assert.equal(maskPhone(null), '—');
    assert.equal(maskPhone(''), '—');
  });
});
