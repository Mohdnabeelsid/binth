-- ============================================================================
-- BINTH.IN — Production PostgreSQL Database Schema
-- Phase 1: Customer Acquisition, 48-Hour QR Giveaway & Boutique Attribution
-- Target Platform: Kerala Handmade Girlswear (Ages 5–16)
-- ============================================================================

-- Enable Cryptographic & UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. Custom Enum Types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'closed', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE admin_role AS ENUM ('super_admin', 'campaign_manager', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM ('Boutique', 'Concept Store', 'Kids Studio', 'Artisan Hub');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE event_type AS ENUM ('visit', 'start');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. Staff & Identity Administration
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role admin_role NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- ============================================================================
-- 3. Giveaway Campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  prize_name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_hours INT NOT NULL DEFAULT 48 CHECK (duration_hours > 0),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '48 hours'),
  status campaign_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_campaign_timing CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_timing ON campaigns(start_time, end_time);

-- ============================================================================
-- 4. Physical QR Source Locations (Boutiques & Ateliers across Kerala)
-- ============================================================================

CREATE TABLE IF NOT EXISTS sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(35) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  establishment VARCHAR(255),
  area VARCHAR(255) NOT NULL,
  district VARCHAR(100),
  type source_type NOT NULL DEFAULT 'Boutique',
  partner_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_source_code_format CHECK (code ~ '^[A-Z0-9_-]{3,35}$')
);

CREATE INDEX IF NOT EXISTS idx_sources_code ON sources(code);
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(is_active);

-- ============================================================================
-- 5. Customer Master Directory (Central Identity Hierarchy)
-- Marketing consent and giveaway entries are activities, not identity definition.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_name VARCHAR(150) NOT NULL,
  whatsapp_phone VARCHAR(20) NOT NULL UNIQUE,
  location_district VARCHAR(100) DEFAULT 'Kerala',
  has_marketing_consent BOOLEAN NOT NULL DEFAULT false,
  marketing_consent_at TIMESTAMPTZ,
  consent_withdrawn_at TIMESTAMPTZ,
  is_purchaser BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_whatsapp_phone_format CHECK (whatsapp_phone ~ '^[0-9+]{10,15}$')
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(whatsapp_phone);
CREATE INDEX IF NOT EXISTS idx_customers_marketing ON customers(has_marketing_consent);
CREATE INDEX IF NOT EXISTS idx_customers_purchaser ON customers(is_purchaser);

-- ============================================================================
-- 5b. Customer Consent Audit Trail
-- Preserves explicit opt-in, decline, and withdrawal events over time.
-- A later entry without consent cannot silently erase prior consent history,
-- and marketing eligibility respects the latest explicit consent state.
-- ============================================================================

CREATE TABLE IF NOT EXISTS customer_consent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  consent_status VARCHAR(20) NOT NULL CHECK (consent_status IN ('opted_in', 'opted_out', 'withdrawn')),
  source_code VARCHAR(35) REFERENCES sources(code) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  client_ip_hash VARCHAR(64),
  user_agent TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_history_customer ON customer_consent_history(customer_id, recorded_at DESC);

-- ============================================================================
-- 6. Participant Giveaway Entries
-- Strict Rule: 1 entry per participant per campaign (Enforced via Unique Constraint)
-- Child Privacy: No child full names, date of birth, photographs, or addresses.
-- ============================================================================

CREATE TABLE IF NOT EXISTS entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_code VARCHAR(50) NOT NULL UNIQUE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  source_code VARCHAR(35) REFERENCES sources(code) ON DELETE SET NULL,
  girl_age_range VARCHAR(20) NOT NULL,
  clothing_interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_eligible BOOLEAN NOT NULL DEFAULT true,
  ineligibility_reason TEXT,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  client_ip_hash VARCHAR(64),
  user_agent TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_age_range CHECK (girl_age_range IN ('5-7', '8-10', '11-13', '14-16')),
  CONSTRAINT uq_campaign_customer UNIQUE (campaign_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_entries_campaign ON entries(campaign_id);
CREATE INDEX IF NOT EXISTS idx_entries_customer ON entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_entries_source_code ON entries(source_code);
CREATE INDEX IF NOT EXISTS idx_entries_eligibility ON entries(campaign_id, is_eligible);
CREATE INDEX IF NOT EXISTS idx_entries_submitted_at ON entries(submitted_at);

-- ============================================================================
-- 7. Attribution & Interaction Tracking Events (Visits & Form Starts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS source_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code VARCHAR(35) NOT NULL REFERENCES sources(code) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  client_ip_hash VARCHAR(64),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_events_lookup ON source_events(source_code, event_type);
CREATE INDEX IF NOT EXISTS idx_source_events_created ON source_events(created_at);

-- ============================================================================
-- 8. Official Winner Selection Ledger & Cryptographic Audit
-- Server-side only; Math.random() in browser JS is strictly prohibited.
-- ============================================================================

CREATE TABLE IF NOT EXISTS winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  entry_id UUID NOT NULL REFERENCES entries(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'official' CHECK (status IN ('official', 'superseded', 'disqualified')),
  selection_reason TEXT NOT NULL DEFAULT 'Official closing random draw',
  drawn_by_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  selection_hash VARCHAR(64) NOT NULL, -- SHA-256 hash of selection entropy
  audit_metadata JSONB DEFAULT '{}'::jsonb,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_winners_campaign ON winners(campaign_id);
CREATE INDEX IF NOT EXISTS idx_winners_entry ON winners(entry_id);
CREATE INDEX IF NOT EXISTS idx_winners_status ON winners(campaign_id, status);

-- ============================================================================
-- 9. System Audit Logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- 10. Reporting & Intelligence Views
-- ============================================================================

-- Source Performance Report View with exact conversion formula:
-- Conversion Rate = (Successful Submissions Attributed ÷ Recorded Landing Visits) * 100
CREATE OR REPLACE VIEW v_source_performance AS
SELECT 
  s.code AS "sourceCode",
  s.name AS "locationName",
  s.establishment,
  s.area,
  s.type,
  s.partner_name AS "partner",
  s.is_active AS "active",
  COALESCE(v.visit_count, 0) AS "visits",
  COALESCE(st.start_count, 0) AS "starts",
  COALESCE(e.entry_count, 0) AS "entries",
  COALESCE(e.eligible_count, 0) AS "eligible",
  CASE 
    WHEN COALESCE(v.visit_count, 0) > 0 
    THEN ROUND((COALESCE(e.entry_count, 0)::numeric / v.visit_count::numeric) * 100.0, 1)
    ELSE 0.0
  END AS "conversionRate"
FROM sources s
LEFT JOIN (
  SELECT source_code, COUNT(*) AS visit_count 
  FROM source_events 
  WHERE event_type = 'visit' 
  GROUP BY source_code
) v ON s.code = v.source_code
LEFT JOIN (
  SELECT source_code, COUNT(*) AS start_count 
  FROM source_events 
  WHERE event_type = 'start' 
  GROUP BY source_code
) st ON s.code = st.source_code
LEFT JOIN (
  SELECT 
    source_code, 
    COUNT(*) AS entry_count,
    COUNT(*) FILTER (WHERE is_eligible = true) AS eligible_count
  FROM entries 
  GROUP BY source_code
) e ON s.code = e.source_code
ORDER BY "entries" DESC, "visits" DESC;

-- Dashboard Overview Metrics View
CREATE OR REPLACE VIEW v_dashboard_metrics AS
SELECT 
  (SELECT COUNT(*) FROM campaigns WHERE status = 'active') AS "activeCampaigns",
  (SELECT COUNT(*) FROM customers) AS "totalCustomers",
  (SELECT COUNT(*) FROM entries) AS "totalEntries",
  (SELECT COUNT(*) FROM source_events WHERE event_type = 'visit') AS "qrVisits",
  (SELECT COUNT(*) FROM source_events WHERE event_type = 'start') AS "formStarts",
  CASE 
    WHEN (SELECT COUNT(*) FROM source_events WHERE event_type = 'visit') > 0
    THEN ROUND(
      ((SELECT COUNT(*)::numeric FROM entries) / 
       (SELECT COUNT(*)::numeric FROM source_events WHERE event_type = 'visit')) * 100.0, 1
    )
    ELSE 0.0
  END AS "conversionRate";

-- ============================================================================
-- 11. Initial Seed Data: 15 Target Campaign Locations across Kerala
-- ============================================================================

INSERT INTO sources (code, name, establishment, area, district, type, partner_name, is_active)
VALUES
  ('MCH-SHOP-001', 'Mananchira Boutique Partner', 'Crafts Council Pavilion', 'Mananchira, Kozhikode', 'Kozhikode', 'Boutique', 'Malabar Handloom Guild', true),
  ('MCH-STORE-002', 'SM Street Traditional Atelier', 'Mittai Theruvu Heritage Arcade', 'SM Street, Kozhikode', 'Kozhikode', 'Concept Store', 'Zamorin Crafts Society', true),
  ('ALP-BOUTIQUE-003', 'Mullakkal Handloom Corner', 'Mullakkal Central Atelier', 'Mullakkal, Alappuzha', 'Alappuzha', 'Boutique', 'Backwater Weaves Collective', true),
  ('ALP-STORE-004', 'Backwater Artisan Hub', 'Punnamada Craft Studio', 'Punnamada, Alappuzha', 'Alappuzha', 'Artisan Hub', 'Coir & Loom Artisans', true),
  ('KCH-MALL-005', 'Marine Drive Concept Atelier', 'Marine Walkway Centre', 'Marine Drive, Kochi', 'Ernakulam', 'Concept Store', 'Cochin Artisan Guild', true),
  ('KCH-STUDIO-006', 'Panampilly Kids Space', 'Little Atelier Hub', 'Panampilly Nagar, Kochi', 'Ernakulam', 'Kids Studio', 'Kochi Boutique Collective', true),
  ('TVM-STUDIO-007', 'Kowdiar Craft Pavilion', 'Royal Heritage Arcade', 'Kowdiar, Thiruvananthapuram', 'Thiruvananthapuram', 'Kids Studio', 'Travancore Weaves Guild', true),
  ('TVM-SHOP-008', 'Statue Handloom House', 'MG Road Boutique Corner', 'Statue, Thiruvananthapuram', 'Thiruvananthapuram', 'Boutique', 'Capital Artisans Guild', true),
  ('TCR-STORE-009', 'Round North Heritage Hub', 'Swaraj Heritage Space', 'Round North, Thrissur', 'Thrissur', 'Concept Store', 'Thrissur Handloom Society', true),
  ('TCR-STUDIO-010', 'Guruvayur Traditional Pavilion', 'East Nada Craft Centre', 'Guruvayur, Thrissur', 'Thrissur', 'Artisan Hub', 'Temple Loom Weavers', true),
  ('KNR-SHOP-011', 'Payyambalam Weavers Point', 'Coastal Weaves Atelier', 'Payyambalam, Kannur', 'Kannur', 'Boutique', 'Malabar Loom Cooperative', true),
  ('KTY-STORE-012', 'Baker Junction Little Atelier', 'Baker Craft Arcade', 'Baker Junction, Kottayam', 'Kottayam', 'Concept Store', 'Highland Textile Guild', true),
  ('PLK-STUDIO-013', 'Fort Maidan Heritage Studio', 'Tipu Fort View Hub', 'Fort Maidan, Palakkad', 'Palakkad', 'Kids Studio', 'Palghat Handloom Guild', true),
  ('KLM-BOUTIQUE-014', 'Asramam Craft Gallery', 'Asramam Link Boutique', 'Asramam, Kollam', 'Kollam', 'Boutique', 'Quilon Artisan Society', true),
  ('MLP-HUB-015', 'Kottakkal Traditional Centre', 'Arya Vaidya Heritage Arcade', 'Kottakkal, Malappuram', 'Malappuram', 'Artisan Hub', 'Eranad Artisans Circle', true)
ON CONFLICT (code) DO NOTHING;

-- Initial Active 48-Hour Campaign Seed
INSERT INTO campaigns (title, prize_name, description, duration_hours, start_time, end_time, status)
VALUES (
  'Onam & Festive Little Princess Giveaway',
  'Handmade Pure Cotton Festive Kurti Set',
  'Exclusive 48-hour boutique giveaway welcoming Kerala families to BINTH.IN handmade collections for girls ages 5–16.',
  48,
  NOW(),
  NOW() + INTERVAL '48 hours',
  'active'
) ON CONFLICT DO NOTHING;

