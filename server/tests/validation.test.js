const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validatePhone,
  validateParentName,
  validateAgeRange,
  validateInterests
} = require('../middleware/validation');

test('Phone Validation — Indian Mobile Standards', async (t) => {
  await t.test('accepts valid 10-digit mobile starting with 6, 7, 8, 9', () => {
    assert.deepEqual(validatePhone('9847012345'), { valid: true, normalized: '9847012345' });
    assert.deepEqual(validatePhone('8123456789'), { valid: true, normalized: '8123456789' });
    assert.deepEqual(validatePhone('7012345678'), { valid: true, normalized: '7012345678' });
    assert.deepEqual(validatePhone('6234567890'), { valid: true, normalized: '6234567890' });
  });

  await t.test('strips +91 prefix and whitespace cleanly', () => {
    assert.deepEqual(validatePhone('+91 98470 12345'), { valid: true, normalized: '9847012345' });
    assert.deepEqual(validatePhone('+91-9847012345'), { valid: true, normalized: '9847012345' });
    assert.deepEqual(validatePhone('919847012345'), { valid: true, normalized: '9847012345' });
  });

  await t.test('strips single leading 0 cleanly', () => {
    assert.deepEqual(validatePhone('09847012345'), { valid: true, normalized: '9847012345' });
  });

  await t.test('rejects invalid mobile numbers', () => {
    assert.equal(validatePhone('').valid, false);
    assert.equal(validatePhone(null).valid, false);
    assert.equal(validatePhone('12345').valid, false); // too short
    assert.equal(validatePhone('5847012345').valid, false); // starts with 5 (invalid in India)
    assert.equal(validatePhone('984701234500').valid, false); // too long
    assert.equal(validatePhone('abcdefghij').valid, false); // letters
  });
});

test('Parent Name Validation — Unicode & Safety', async (t) => {
  await t.test('accepts standard English and punctuated names', () => {
    assert.deepEqual(validateParentName('Ananya Menon'), { valid: true, sanitized: 'Ananya Menon' });
    assert.deepEqual(validateParentName("Mary D'Souza"), { valid: true, sanitized: "Mary D'Souza" });
    assert.deepEqual(validateParentName('Dr. K. R. Nair'), { valid: true, sanitized: 'Dr. K. R. Nair' });
  });

  await t.test('accepts Malayalam Unicode script names', () => {
    const res = validateParentName('അനന്യ മേനോൻ');
    assert.equal(res.valid, true);
    assert.equal(res.sanitized, 'അനന്യ മേനോൻ');
  });

  await t.test('rejects names that are too short or contain disallowed characters', () => {
    assert.equal(validateParentName('A').valid, false);
    assert.equal(validateParentName('').valid, false);
    assert.equal(validateParentName('<script>alert(1)</script>').valid, false);
    assert.equal(validateParentName('User123').valid, false);
    assert.equal(validateParentName('a'.repeat(101)).valid, false);
  });
});

test('Age Range Validation — Dash Normalization', async (t) => {
  await t.test('accepts standard ASCII hyphen age ranges', () => {
    assert.deepEqual(validateAgeRange('5-7'), { valid: true, value: '5-7' });
    assert.deepEqual(validateAgeRange('8-10'), { valid: true, value: '8-10' });
    assert.deepEqual(validateAgeRange('11-13'), { valid: true, value: '11-13' });
    assert.deepEqual(validateAgeRange('14-16'), { valid: true, value: '14-16' });
  });

  await t.test('normalizes Unicode en-dash (\\u2013) from frontend forms to hyphen', () => {
    assert.deepEqual(validateAgeRange('5\u20137'), { valid: true, value: '5-7' });
    assert.deepEqual(validateAgeRange('8\u201310'), { valid: true, value: '8-10' });
    assert.deepEqual(validateAgeRange('11\u201313'), { valid: true, value: '11-13' });
    assert.deepEqual(validateAgeRange('14\u201316'), { valid: true, value: '14-16' });
  });

  await t.test('rejects unapproved age brackets', () => {
    assert.equal(validateAgeRange('0-4').valid, false);
    assert.equal(validateAgeRange('18-25').valid, false);
    assert.equal(validateAgeRange('').valid, false);
    assert.equal(validateAgeRange(null).valid, false);
  });
});

test('Clothing Interests Validation — Frontend & Backend Harmony', async (t) => {
  await t.test('accepts frontend form options (e.g. kurtis, dresses)', () => {
    const res = validateInterests(['everyday wear', 'kurtis']);
    assert.equal(res.valid, true);
    assert.deepEqual(res.values, ['everyday wear', 'kurtis']);
  });

  await t.test('accepts canonical backend keys (e.g. traditional, casual_cotton)', () => {
    const res = validateInterests(['traditional', 'festive_ethnic']);
    assert.equal(res.valid, true);
    assert.deepEqual(res.values, ['traditional', 'festive_ethnic']);
  });

  await t.test('rejects empty arrays or lists with no recognized values', () => {
    assert.equal(validateInterests([]).valid, false);
    assert.equal(validateInterests(['unknown_style_xyz']).valid, false);
    assert.equal(validateInterests(null).valid, false);
  });
});
