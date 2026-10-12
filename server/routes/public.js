/**
 * BINTH.IN — Public Giveaway Routes (No Auth Required)
 *
 * GET  /api/campaigns/active?source=CODE  — Active campaign info
 * POST /api/giveaway/visit                — Record a landing-page QR visit
 * POST /api/giveaway/start               — Record a form interaction start
 * POST /api/giveaway/entries             — Submit a participant entry
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { validatePhone, validateParentName, validateAgeRange, validateInterests } = require('../middleware/validation');

// ─── Rate Limiting ─────────────────────────────────────────────────────────

// Strict limiter for entry submission: 5 submissions per 10 minutes per IP
const entryLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 600_000,
  max: parseInt(process.env.RATE_LIMIT_MAX_ENTRIES, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many entry attempts from this network. Please try again after 10 minutes.' },
  keyGenerator: (req) => {
    // Hash the IP for privacy before using as rate-limit key
    return crypto.createHash('sha256')
      .update((req.ip || '0.0.0.0') + (process.env.IP_HASH_SALT || 'binth-salt'))
      .digest('hex');
  }
});

// Light limiter for tracking endpoints: 120/min per IP
const trackingLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many tracking requests.' }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Generate a cryptographically random 6-char entry code.
 * Format: ENT-XXXXXX (base32-like, omits ambiguous chars I/O/0/1)
 */
function generateEntryCode() {
  const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  let code = 'ENT-';
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

/**
 * SHA-256 hash of IP address with a server-side salt for pseudonymization.
 */
function hashIp(ip) {
  return crypto.createHash('sha256')
    .update((ip || '0.0.0.0') + (process.env.IP_HASH_SALT || 'binth-salt'))
    .digest('hex');
}

// ─── GET /api/campaigns/active ─────────────────────────────────────────────
router.get('/campaigns/active', async (req, res) => {
  const { source } = req.query;

  try {
    // Find the currently active campaign (most recently started)
    const { rows } = await pool.query(
      `SELECT id, title, prize_name AS prize, description, duration_hours AS "durationHours",
              start_time AS "startTime", end_time AS "endTime", status
       FROM campaigns
       WHERE status = 'active'
         AND NOW() BETWEEN start_time AND end_time
       ORDER BY start_time DESC
       LIMIT 1`
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: 'No active giveaway campaign found at this time.' });
    }

    const campaign = rows[0];
    let sourceValid = false;

    // Verify source code is registered and active (if provided)
    if (source) {
      const srcResult = await pool.query(
        `SELECT 1 FROM sources WHERE code = $1 AND is_active = true LIMIT 1`,
        [source.trim().toUpperCase()]
      );
      sourceValid = srcResult.rows.length > 0;
    }

    res.json({ ...campaign, sourceValid, sourceProvided: !!source });
  } catch (err) {
    console.error('[Public] GET /campaigns/active error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error fetching campaign.' });
  }
});

// ─── POST /api/giveaway/visit ──────────────────────────────────────────────
router.post('/giveaway/visit', trackingLimiter, async (req, res) => {
  const { sourceCode } = req.body || {};

  if (!sourceCode || typeof sourceCode !== 'string') {
    return res.json({ ok: false, error: 'No valid source code provided.' });
  }

  const code = sourceCode.trim().toUpperCase();

  try {
    // Verify source exists in our system
    const { rows: srcRows } = await pool.query(
      `SELECT 1 FROM sources WHERE code = $1 LIMIT 1`,
      [code]
    );

    if (!srcRows[0]) {
      // Don't error — just silently skip unknown codes (direct traffic or URL fiddling)
      return res.json({ ok: true, recorded: false });
    }

    await pool.query(
      `INSERT INTO source_events (source_code, event_type, client_ip_hash, user_agent)
       VALUES ($1, 'visit', $2, $3)`,
      [code, hashIp(req.ip), req.get('user-agent') || null]
    );

    res.json({ ok: true, recorded: true });
  } catch (err) {
    console.error('[Public] POST /giveaway/visit error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error recording visit.' });
  }
});

// ─── POST /api/giveaway/start ──────────────────────────────────────────────
router.post('/giveaway/start', trackingLimiter, async (req, res) => {
  const { sourceCode } = req.body || {};

  if (!sourceCode || typeof sourceCode !== 'string') {
    return res.json({ ok: false, error: 'No valid source code provided.' });
  }

  const code = sourceCode.trim().toUpperCase();

  try {
    const { rows: srcRows } = await pool.query(
      `SELECT 1 FROM sources WHERE code = $1 LIMIT 1`,
      [code]
    );

    if (!srcRows[0]) {
      return res.json({ ok: true, recorded: false });
    }

    await pool.query(
      `INSERT INTO source_events (source_code, event_type, client_ip_hash, user_agent)
       VALUES ($1, 'start', $2, $3)`,
      [code, hashIp(req.ip), req.get('user-agent') || null]
    );

    res.json({ ok: true, recorded: true });
  } catch (err) {
    console.error('[Public] POST /giveaway/start error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error recording form start.' });
  }
});

// ─── POST /api/giveaway/entries ────────────────────────────────────────────
router.post('/giveaway/entries', entryLimiter, async (req, res) => {
  const body = req.body || {};

  // ── Server-Side Validation ────────────────────────────────────────────────
  const nameResult = validateParentName(body.parentName);
  if (!nameResult.valid) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid parent or guardian name (2–100 characters).' });
  }

  const phoneResult = validatePhone(body.whatsappPhone);
  if (!phoneResult.valid) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid 10-digit Indian WhatsApp number.' });
  }

  const ageResult = validateAgeRange(body.ageRange);
  if (!ageResult.valid) {
    return res.status(400).json({ ok: false, error: 'Please select a valid age range for your daughter.' });
  }

  const interestsResult = validateInterests(body.clothingInterests);
  if (!interestsResult.valid) {
    return res.status(400).json({ ok: false, error: 'Please select at least one clothing interest.' });
  }

  // Normalize & sanitize inputs
  const parentName = nameResult.sanitized;
  const whatsappPhone = phoneResult.normalized;
  const ageRange = ageResult.value;
  const clothingInterests = interestsResult.values;
  const marketingConsent = body.marketingConsent === true;
  const rawSourceCode = typeof body.sourceCode === 'string' ? body.sourceCode.trim().toUpperCase() : null;
  const ipHash = hashIp(req.ip);
  const userAgent = req.get('user-agent') || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── 1. Check for an active campaign ──────────────────────────────────────
    const campaignResult = await client.query(
      `SELECT id FROM campaigns
       WHERE status = 'active'
         AND NOW() BETWEEN start_time AND end_time
       ORDER BY start_time DESC
       LIMIT 1`
    );

    if (!campaignResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ ok: false, error: 'This giveaway campaign has closed. Thank you for your interest.' });
    }

    const campaignId = campaignResult.rows[0].id;

    // ── 2. Validate source code (strip if unrecognized) ───────────────────────
    let sourceCode = null;
    if (rawSourceCode) {
      const srcCheck = await client.query(
        `SELECT code FROM sources WHERE code = $1 AND is_active = true LIMIT 1`,
        [rawSourceCode]
      );
      sourceCode = srcCheck.rows[0]?.code || null;
    }

    // ── 3. Upsert customer (create or update contact, never overwrite consent) ─
    const customerResult = await client.query(
      `INSERT INTO customers (parent_name, whatsapp_phone, has_marketing_consent, marketing_consent_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (whatsapp_phone) DO UPDATE SET
         parent_name = EXCLUDED.parent_name,
         has_marketing_consent = CASE
           WHEN EXCLUDED.has_marketing_consent = true THEN true
           ELSE customers.has_marketing_consent
         END,
         marketing_consent_at = CASE
           WHEN EXCLUDED.has_marketing_consent = true AND customers.has_marketing_consent = false
           THEN NOW()
           ELSE customers.marketing_consent_at
         END,
         updated_at = NOW()
       RETURNING id`,
      [
        parentName,
        whatsappPhone,
        marketingConsent,
        marketingConsent ? 'NOW()' : null
      ]
    );

    const customerId = customerResult.rows[0].id;

    // ── 4. Duplicate entry check: 1 entry per participant per campaign ─────────
    const duplicateCheck = await client.query(
      `SELECT entry_code FROM entries
       WHERE campaign_id = $1 AND customer_id = $2
       LIMIT 1`,
      [campaignId, customerId]
    );

    if (duplicateCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        ok: false,
        error: 'This WhatsApp number has already been entered in the current giveaway campaign. Limited to one entry per participant.'
      });
    }

    // ── 5. Generate unique entry code ─────────────────────────────────────────
    let entryCode;
    let codeUnique = false;
    let attempts = 0;
    while (!codeUnique && attempts < 10) {
      entryCode = generateEntryCode();
      const codeCheck = await client.query(
        `SELECT 1 FROM entries WHERE entry_code = $1 LIMIT 1`,
        [entryCode]
      );
      codeUnique = codeCheck.rows.length === 0;
      attempts++;
    }

    if (!codeUnique) {
      await client.query('ROLLBACK');
      return res.status(500).json({ ok: false, error: 'Server could not generate a unique entry code. Please try again.' });
    }

    // ── 6. Insert entry ───────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO entries
         (entry_code, campaign_id, customer_id, source_code, girl_age_range,
          clothing_interests, is_eligible, marketing_consent, client_ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9)`,
      [
        entryCode,
        campaignId,
        customerId,
        sourceCode,
        ageRange,
        JSON.stringify(clothingInterests),
        marketingConsent,
        ipHash,
        userAgent
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      entryCode,
      message: 'Giveaway entry successfully registered. Thank you for participating!'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    // Catch Postgres unique constraint violation as a safety net
    if (err.code === '23505' && err.constraint === 'uq_campaign_customer') {
      return res.status(409).json({
        ok: false,
        error: 'This WhatsApp number has already been entered in the current giveaway campaign.'
      });
    }
    console.error('[Public] POST /giveaway/entries error:', err.message, err.code);
    res.status(500).json({ ok: false, error: 'Server error recording your entry. Please try again.' });
  } finally {
    client.release();
  }
});

module.exports = router;
