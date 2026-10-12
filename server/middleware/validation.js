/**
 * BINTH.IN — Shared Validation Utilities
 * Server-side validation rules mirroring the frontend's Validation module.
 * Never trust client-side validation alone.
 */

const VALID_AGE_RANGES = ['5-7', '8-10', '11-13', '14-16'];

const VALID_INTERESTS = [
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

  // Strip +91 or 0 prefix if present
  let digits = cleaned;
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);

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
  // Allow letters (including Malayalam/Unicode), spaces, dots, hyphens
  if (!/^[\p{L}\s.'-]+$/u.test(trimmed)) return { valid: false };
  return { valid: true, sanitized: trimmed };
}

/**
 * Validate age range: must be one of the four permitted tiers.
 */
function validateAgeRange(raw) {
  if (!raw || !VALID_AGE_RANGES.includes(raw)) return { valid: false };
  return { valid: true, value: raw };
}

/**
 * Validate clothing interests array: at least 1 valid known key.
 */
function validateInterests(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return { valid: false };
  const filtered = raw.filter(i => VALID_INTERESTS.includes(i));
  if (filtered.length === 0) return { valid: false };
  return { valid: true, values: filtered };
}

module.exports = { validatePhone, validateParentName, validateAgeRange, validateInterests };
