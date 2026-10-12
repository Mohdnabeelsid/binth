/**
 * BINTH.IN — Admin Routes (All require Bearer JWT)
 *
 * GET  /api/admin/metrics
 * GET  /api/admin/campaigns
 * POST /api/admin/campaigns
 * PUT  /api/admin/campaigns/:id
 * POST /api/admin/campaigns/:id/close
 * POST /api/admin/campaigns/:id/select-winner
 * GET  /api/admin/entries
 * GET  /api/admin/customers
 * GET  /api/admin/sources
 * POST /api/admin/sources
 * PUT  /api/admin/sources/:code
 * PATCH/api/admin/sources/:code/status
 * GET  /api/admin/reports
 * GET  /api/admin/export
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

// All admin routes require a valid JWT
router.use(requireAuth);

// ─── Helpers ───────────────────────────────────────────────────────────────

const WRITE_ROLES = ['super_admin', 'campaign_manager'];
const SUPER_ONLY = ['super_admin'];

/**
 * Mask a WhatsApp phone number for display: show first 4 digits + 6 stars.
 * e.g. "9847012345" → "9847******"
 */
function maskPhone(phone) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  return digits.slice(0, 4) + '******';
}

/**
 * Write to the audit log table. Fire-and-forget — don't let logging failures
 * break the main request flow.
 */
async function writeAuditLog(adminUserId, action, entityType, entityId, oldData = null, newData = null, ip = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (admin_user_id, action, entity_type, entity_id, old_data, new_data, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [adminUserId, action, entityType, String(entityId), oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, ip]
    );
  } catch (err) {
    console.error('[Audit] Write failed:', err.message);
  }
}

// ─── GET /api/admin/metrics ────────────────────────────────────────────────
router.get('/metrics', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM v_dashboard_metrics LIMIT 1`);
    res.json(rows[0] || {
      activeCampaigns: 0, totalCustomers: 0, totalEntries: 0,
      qrVisits: 0, formStarts: 0, conversionRate: '0.0'
    });
  } catch (err) {
    console.error('[Admin] GET /metrics error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching dashboard metrics.' });
  }
});

// ─── GET /api/admin/campaigns ──────────────────────────────────────────────
router.get('/campaigns', async (req, res) => {
  const { status } = req.query;
  try {
    const params = [];
    let where = '';
    if (status) {
      params.push(status);
      where = `WHERE c.status = $1`;
    }

    const { rows } = await pool.query(
      `SELECT
         c.id, c.title, c.prize_name AS prize, c.description, c.status,
         c.start_time AS "startTime", c.end_time AS "endTime", c.duration_hours AS "durationHours",
         c.created_at AS "createdAt",
         COUNT(e.id) AS "totalEntries",
         COALESCE(MAX(se_counts.visits), 0) AS "qrVisits",
         CASE
           WHEN COALESCE(MAX(se_counts.visits), 0) > 0
           THEN ROUND((COUNT(e.id)::numeric / MAX(se_counts.visits)::numeric) * 100.0, 1)
           ELSE 0
         END AS "conversionRate"
       FROM campaigns c
       LEFT JOIN entries e ON e.campaign_id = c.id
       LEFT JOIN LATERAL (
         SELECT SUM(CASE WHEN event_type = 'visit' THEN 1 ELSE 0 END) AS visits
         FROM source_events
       ) se_counts ON true
       ${where}
       GROUP BY c.id
       ORDER BY c.start_time DESC`,
      params
    );

    res.json(rows);
  } catch (err) {
    console.error('[Admin] GET /campaigns error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching campaigns.' });
  }
});

// ─── POST /api/admin/campaigns ─────────────────────────────────────────────
router.post('/campaigns', requireRole(WRITE_ROLES), async (req, res) => {
  const { title, prize, description, durationHours = 48, status = 'active' } = req.body || {};

  if (!title || !prize) {
    return res.status(400).json({ ok: false, error: 'Campaign title and prize name are required.' });
  }

  const VALID_STATUSES = ['draft', 'active', 'paused'];
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: `Status must be one of: ${VALID_STATUSES.join(', ')}.` });
  }

  const hours = parseInt(durationHours, 10);
  if (isNaN(hours) || hours < 1 || hours > 168) {
    return res.status(400).json({ ok: false, error: 'Duration must be between 1 and 168 hours.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO campaigns (title, prize_name, description, duration_hours, end_time, status, created_by)
       VALUES ($1, $2, $3, $4, NOW() + ($4 || ' hours')::INTERVAL, $5, $6)
       RETURNING id, title, prize_name AS prize, status, start_time AS "startTime", end_time AS "endTime"`,
      [title.trim(), prize.trim(), description?.trim() || null, hours, status, req.user.id]
    );

    const campaign = rows[0];
    await writeAuditLog(req.user.id, 'campaign.create', 'campaign', campaign.id, null, campaign, req.ip);

    res.status(201).json({ ok: true, ...campaign });
  } catch (err) {
    console.error('[Admin] POST /campaigns error:', err.message);
    res.status(500).json({ ok: false, error: 'Error creating campaign.' });
  }
});

// ─── PUT /api/admin/campaigns/:id ──────────────────────────────────────────
router.put('/campaigns/:id', requireRole(WRITE_ROLES), async (req, res) => {
  const { id } = req.params;
  const { title, prize, description, status } = req.body || {};

  const VALID_STATUSES = ['draft', 'active', 'paused', 'closed', 'archived'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: `Invalid status: ${status}.` });
  }

  try {
    const existing = await pool.query(`SELECT * FROM campaigns WHERE id = $1 LIMIT 1`, [id]);
    if (!existing.rows[0]) return res.status(404).json({ ok: false, error: 'Campaign not found.' });

    const { rows } = await pool.query(
      `UPDATE campaigns SET
         title = COALESCE($1, title),
         prize_name = COALESCE($2, prize_name),
         description = COALESCE($3, description),
         status = COALESCE($4, status),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, title, prize_name AS prize, status, start_time AS "startTime", end_time AS "endTime"`,
      [title?.trim() || null, prize?.trim() || null, description?.trim() || null, status || null, id]
    );

    await writeAuditLog(req.user.id, 'campaign.update', 'campaign', id, existing.rows[0], rows[0], req.ip);
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('[Admin] PUT /campaigns/:id error:', err.message);
    res.status(500).json({ ok: false, error: 'Error updating campaign.' });
  }
});

// ─── POST /api/admin/campaigns/:id/close ───────────────────────────────────
router.post('/campaigns/:id/close', requireRole(WRITE_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE campaigns SET status = 'closed', updated_at = NOW()
       WHERE id = $1 AND status != 'closed'
       RETURNING id, title, status`,
      [id]
    );

    if (!rows[0]) {
      return res.status(404).json({ ok: false, error: 'Campaign not found or already closed.' });
    }

    await writeAuditLog(req.user.id, 'campaign.close', 'campaign', id, null, rows[0], req.ip);
    res.json({ ok: true, message: 'Campaign closed.', campaign: rows[0] });
  } catch (err) {
    console.error('[Admin] POST /campaigns/:id/close error:', err.message);
    res.status(500).json({ ok: false, error: 'Error closing campaign.' });
  }
});

// ─── POST /api/admin/campaigns/:id/select-winner ───────────────────────────
router.post('/campaigns/:id/select-winner', requireRole(WRITE_ROLES), async (req, res) => {
  const { id } = req.params;
  const { reason = 'Official closing random draw' } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch campaign
    const campResult = await client.query(
      `SELECT id, title, status FROM campaigns WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!campResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ ok: false, error: 'Campaign not found.' });
    }

    const campaign = campResult.rows[0];

    // Block on active campaigns unless the caller is super_admin
    if (campaign.status === 'active' && req.user.role !== 'super_admin') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        ok: false,
        error: 'Campaign is currently active. Close the campaign before drawing a winner, or use a Super Admin account to override.'
      });
    }

    // Fetch all eligible entries
    const eligibleResult = await client.query(
      `SELECT e.id AS entry_id, e.entry_code, e.customer_id,
              c.parent_name, c.whatsapp_phone
       FROM entries e
       JOIN customers c ON c.id = e.customer_id
       WHERE e.campaign_id = $1 AND e.is_eligible = true`,
      [id]
    );

    if (eligibleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        ok: false,
        error: `No eligible entries found for campaign "${campaign.title}". No winner can be selected.`
      });
    }

    // ── Cryptographic Server-Side Winner Selection (CSPRNG) ──────────────────
    // Uses crypto.randomInt which reads from OS CSPRNG — never Math.random().
    const candidates = eligibleResult.rows;
    const selectedIndex = crypto.randomInt(0, candidates.length);
    const winner = candidates[selectedIndex];

    // Build cryptographic audit hash
    const entropyHex = crypto.randomBytes(32).toString('hex');
    const selectionHash = crypto.createHash('sha256')
      .update(`${id}:${winner.entry_id}:${entropyHex}:${new Date().toISOString()}`)
      .digest('hex');

    const auditMetadata = {
      totalCandidates: candidates.length,
      selectedIndex,
      serverTimestamp: new Date().toISOString(),
      campaignStatus: campaign.status
    };

    // Insert into winners ledger
    await client.query(
      `INSERT INTO winners
         (campaign_id, entry_id, customer_id, selection_reason, drawn_by_user_id, selection_hash, audit_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, winner.entry_id, winner.customer_id, reason, req.user.id, selectionHash, JSON.stringify(auditMetadata)]
    );

    // Write audit log
    await writeAuditLog(
      req.user.id, 'winner.select', 'campaign', id,
      null,
      { entryCode: winner.entry_code, entryId: winner.entry_id, selectionHash, candidateCount: candidates.length },
      req.ip
    );

    await client.query('COMMIT');

    res.json({
      ok: true,
      winnerName: winner.parent_name,
      entryCode: winner.entry_code,
      drawnAt: new Date().toISOString(),
      auditHash: selectionHash,
      totalCandidates: candidates.length
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[Admin] POST /campaigns/:id/select-winner error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error during winner selection.' });
  } finally {
    client.release();
  }
});

// ─── GET /api/admin/entries ────────────────────────────────────────────────
router.get('/entries', async (req, res) => {
  const { q, eligible } = req.query;

  try {
    const params = [];
    const conditions = [];

    if (q) {
      params.push(`%${q.trim()}%`);
      conditions.push(`(c.parent_name ILIKE $${params.length} OR c.whatsapp_phone ILIKE $${params.length})`);
    }

    if (eligible === 'true') {
      conditions.push(`e.is_eligible = true`);
    } else if (eligible === 'false') {
      conditions.push(`e.is_eligible = false`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await pool.query(
      `SELECT
         e.id, e.entry_code AS "entryCode",
         c.parent_name AS "parentName",
         c.whatsapp_phone AS "whatsappPhone",
         e.source_code AS "sourceCode",
         e.girl_age_range AS "ageRange",
         e.is_eligible AS "isEligible",
         e.ineligibility_reason AS "ineligibilityReason",
         e.marketing_consent AS "marketingConsent",
         e.submitted_at AS "submittedAt"
       FROM entries e
       JOIN customers c ON c.id = e.customer_id
       ${where}
       ORDER BY e.submitted_at DESC
       LIMIT 500`,
      params
    );

    // Mask phone numbers before sending to client
    const masked = rows.map(r => ({
      ...r,
      phoneMasked: maskPhone(r.whatsappPhone),
      whatsappPhone: undefined // Never expose raw phone to browser
    }));

    res.json(masked);
  } catch (err) {
    console.error('[Admin] GET /entries error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching entries.' });
  }
});

// ─── GET /api/admin/customers ──────────────────────────────────────────────
router.get('/customers', async (req, res) => {
  const { q } = req.query;

  try {
    const params = [];
    let where = '';

    if (q) {
      params.push(`%${q.trim()}%`);
      where = `WHERE c.parent_name ILIKE $1 OR c.whatsapp_phone ILIKE $1`;
    }

    const { rows } = await pool.query(
      `SELECT
         c.id,
         c.parent_name AS name,
         c.whatsapp_phone,
         c.location_district AS location,
         c.has_marketing_consent AS "hasMarketingConsent",
         c.marketing_consent_at AS "marketingConsentAt",
         c.is_purchaser AS "isPurchaser",
         c.created_at AS "createdAt",
         COUNT(e.id) AS "campaignsEnteredCount"
       FROM customers c
       LEFT JOIN entries e ON e.customer_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 500`,
      params
    );

    const masked = rows.map(r => ({
      ...r,
      phoneMasked: maskPhone(r.whatsapp_phone),
      whatsapp_phone: undefined
    }));

    res.json(masked);
  } catch (err) {
    console.error('[Admin] GET /customers error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching customers.' });
  }
});

// ─── GET /api/admin/sources ────────────────────────────────────────────────
router.get('/sources', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id, s.code, s.name, s.establishment, s.area, s.district,
         s.type, s.partner_name AS partner, s.is_active AS active,
         COALESCE(v.visits, 0) AS visits,
         COALESCE(st.starts, 0) AS starts,
         COALESCE(e.entries, 0) AS entries,
         COALESCE(e.eligible, 0) AS eligible,
         s.created_at AS "createdAt"
       FROM sources s
       LEFT JOIN (
         SELECT source_code, COUNT(*) AS visits
         FROM source_events WHERE event_type = 'visit'
         GROUP BY source_code
       ) v ON s.code = v.source_code
       LEFT JOIN (
         SELECT source_code, COUNT(*) AS starts
         FROM source_events WHERE event_type = 'start'
         GROUP BY source_code
       ) st ON s.code = st.source_code
       LEFT JOIN (
         SELECT source_code,
           COUNT(*) AS entries,
           COUNT(*) FILTER (WHERE is_eligible) AS eligible
         FROM entries GROUP BY source_code
       ) e ON s.code = e.source_code
       ORDER BY s.code ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error('[Admin] GET /sources error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching sources.' });
  }
});

// ─── POST /api/admin/sources ───────────────────────────────────────────────
router.post('/sources', requireRole(WRITE_ROLES), async (req, res) => {
  const { code, name, establishment, area, district, type = 'Boutique', partner } = req.body || {};

  if (!code || !name || !area) {
    return res.status(400).json({ ok: false, error: 'Source code, name, and area are required.' });
  }

  if (!/^[A-Z0-9_-]{3,35}$/.test(code.trim().toUpperCase())) {
    return res.status(400).json({ ok: false, error: 'Source code must be 3–35 uppercase letters, digits, hyphens, or underscores.' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO sources (code, name, establishment, area, district, type, partner_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, code, name, establishment, area, type, partner_name AS partner, is_active AS active`,
      [code.trim().toUpperCase(), name.trim(), establishment?.trim() || null, area.trim(), district?.trim() || null, type, partner?.trim() || null]
    );

    await writeAuditLog(req.user.id, 'source.create', 'source', rows[0].code, null, rows[0], req.ip);
    res.status(201).json({ ok: true, ...rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ ok: false, error: `A location with code "${code.toUpperCase()}" already exists. Codes must be unique.` });
    }
    console.error('[Admin] POST /sources error:', err.message);
    res.status(500).json({ ok: false, error: 'Error creating source.' });
  }
});

// ─── PUT /api/admin/sources/:code ──────────────────────────────────────────
router.put('/sources/:code', requireRole(WRITE_ROLES), async (req, res) => {
  const { code } = req.params;
  const { name, establishment, area, district, type, partner } = req.body || {};

  try {
    const existing = await pool.query(`SELECT * FROM sources WHERE code = $1 LIMIT 1`, [code.toUpperCase()]);
    if (!existing.rows[0]) return res.status(404).json({ ok: false, error: 'Source not found.' });

    const { rows } = await pool.query(
      `UPDATE sources SET
         name = COALESCE($1, name),
         establishment = COALESCE($2, establishment),
         area = COALESCE($3, area),
         district = COALESCE($4, district),
         type = COALESCE($5, type),
         partner_name = COALESCE($6, partner_name),
         updated_at = NOW()
       WHERE code = $7
       RETURNING id, code, name, establishment, area, type, partner_name AS partner, is_active AS active`,
      [name?.trim() || null, establishment?.trim() || null, area?.trim() || null, district?.trim() || null, type || null, partner?.trim() || null, code.toUpperCase()]
    );

    await writeAuditLog(req.user.id, 'source.update', 'source', code, existing.rows[0], rows[0], req.ip);
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('[Admin] PUT /sources/:code error:', err.message);
    res.status(500).json({ ok: false, error: 'Error updating source.' });
  }
});

// ─── PATCH /api/admin/sources/:code/status ─────────────────────────────────
router.patch('/sources/:code/status', requireRole(WRITE_ROLES), async (req, res) => {
  const { code } = req.params;
  const { active } = req.body || {};

  if (typeof active !== 'boolean') {
    return res.status(400).json({ ok: false, error: '"active" must be a boolean.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE sources SET is_active = $1, updated_at = NOW()
       WHERE code = $2
       RETURNING code, name, is_active AS active`,
      [active, code.toUpperCase()]
    );

    if (!rows[0]) return res.status(404).json({ ok: false, error: 'Source not found.' });
    res.json({ ok: true, ...rows[0] });
  } catch (err) {
    console.error('[Admin] PATCH /sources/:code/status error:', err.message);
    res.status(500).json({ ok: false, error: 'Error updating source status.' });
  }
});

// ─── DELETE /api/admin/sources/:code ───────────────────────────────────────
router.delete('/sources/:code', requireRole(WRITE_ROLES), async (req, res) => {
  const { code } = req.params;

  try {
    const existing = await pool.query(`SELECT * FROM sources WHERE code = $1 LIMIT 1`, [code.toUpperCase()]);
    if (!existing.rows[0]) {
      return res.status(404).json({ ok: false, error: 'Source not found.' });
    }

    await pool.query(`DELETE FROM sources WHERE code = $1`, [code.toUpperCase()]);

    await writeAuditLog(req.user.id, 'source.delete', 'source', code.toUpperCase(), existing.rows[0], null, req.ip);
    res.json({ ok: true, deleted: true, code: code.toUpperCase() });
  } catch (err) {
    console.error('[Admin] DELETE /sources/:code error:', err.message);
    res.status(500).json({ ok: false, error: 'Error deleting source.' });
  }
});

// ─── GET /api/admin/reports ────────────────────────────────────────────────
router.get('/reports', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM v_source_performance`);
    res.json(rows);
  } catch (err) {
    console.error('[Admin] GET /reports error:', err.message);
    res.status(500).json({ ok: false, error: 'Error fetching reports.' });
  }
});

// ─── GET /api/admin/export ─────────────────────────────────────────────────
router.get('/export', requireRole(SUPER_ONLY), async (req, res) => {
  const { type = 'source_performance' } = req.query;

  try {
    let rows = [];
    let csvHeader = '';

    if (type === 'source_performance') {
      const result = await pool.query(`SELECT * FROM v_source_performance`);
      rows = result.rows;
      csvHeader = 'Source Code,Location Name,Establishment,Area,Type,Partner,Active,Visits,Form Starts,Entries,Eligible,Conversion Rate\n';
    } else if (type === 'entries') {
      const result = await pool.query(
        `SELECT e.entry_code, c.parent_name, e.source_code, e.girl_age_range,
                e.is_eligible, e.marketing_consent, e.submitted_at
         FROM entries e
         JOIN customers c ON c.id = e.customer_id
         ORDER BY e.submitted_at DESC`
      );
      rows = result.rows;
      csvHeader = 'Entry Code,Parent Name,Source Code,Age Range,Eligible,Marketing Consent,Submitted At\n';
    } else {
      return res.status(400).json({ ok: false, error: `Unknown export type: "${type}". Supported: source_performance, entries.` });
    }

    // Escape CSV cell: wrap in double quotes, escape internal double quotes
    const escape = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const date = new Date().toISOString().slice(0, 10);
    const filename = `BINTH_${type}_${date}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.write('\uFEFF'); // BOM for Excel UTF-8 compatibility
    res.write(csvHeader);

    for (const row of rows) {
      const values = Object.values(row).map(escape).join(',');
      res.write(values + '\n');
    }

    await writeAuditLog(req.user.id, 'export.csv', 'report', type, null, { rowCount: rows.length }, req.ip);
    res.end();
  } catch (err) {
    console.error('[Admin] GET /export error:', err.message);
    res.status(500).json({ ok: false, error: 'Server error generating export.' });
  }
});

module.exports = router;
