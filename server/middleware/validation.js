/**
 * BINTH.IN — Shared Validation Utilities
 * Server-side validation rules mirroring the frontend's Validation module.
 * Never trust client-side validation alone.
 */

const VALID_AGE_RANGES = ['5-7', '8-10', '11-13', '14-16'];

const VALID_INTERESTS = [
  'everyday wear', 'kurtis', 'dresses', 'festive wear', 'casual outings',
  'traditional', 'casual_cotton', 'festive_ethnic', 'school_uniform',
  'printed_cotton', 'handloom', 'embroidered', 'contemporary_fusion'
];

/**
 * Normalize and validate a WhatsApp phone number.
 * Accepts Indian 10-digit numbers (starting with 6-9) or +91-prefixed.
 * Returns { valid, normalized } where normalized is the 10-digit string without prefix.
 */
function validatePhone(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false };
  const cleaned = raw.trim().replace(/[\s\-().]/g, '');

  // Strip +91, 91 or 0 prefix if present
  let digits = cleaned;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);

  if (!/^[6-9]\d{9}$/.test(digits)) {
    return { valid: false };
  }
  return { valid: true, normalized: digits };
}

/**
 * Validate parent name: trimmed, 2–100 characters, letters and spaces only.
 */
function validateParentName(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false };
  const trimmed = raw.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return { valid: false };
  // Allow letters and combining marks (including Malayalam/Indic vowel signs and viramas), spaces, dots, hyphens
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(trimmed)) return { valid: false };
  return { valid: true, sanitized: trimmed };
}

/**
 * Validate age range: must be one of the four permitted tiers.
 * Normalizes Unicode en-dash (\u2013) and em-dash (\u2014) to standard ASCII hyphen (-).
 */
function validateAgeRange(raw) {
  if (!raw || typeof raw !== 'string') return { valid: false };
  const normalized = raw.replace(/[\u2013\u2014]/g, '-').trim();
  if (!VALID_AGE_RANGES.includes(normalized)) return { valid: false };
  return { valid: true, value: normalized };
}

/**
 * Validate clothing interests array: at least 1 valid known key.
 */
function validateInterests(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { valid: false };
  const filtered = raw
    .map(i => (typeof i === 'string' ? i.trim().toLowerCase() : ''))
    .filter(i => VALID_INTERESTS.includes(i));
  if (filtered.length === 0) return { valid: false };
  return { valid: true, values: filtered };
}

module.exports = { validatePhone, validateParentName, validateAgeRange, validateInterests };
