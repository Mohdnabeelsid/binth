-- ============================================================================
-- Migration 001: Customer Consent History and Winner Safeguards
-- Safe, idempotent migration for BINTH.IN Phase 1
-- Preserves existing customers, entries, campaigns, and sources without data loss.
-- ============================================================================

-- 1. Add explicit consent withdrawal timestamp to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS consent_withdrawn_at TIMESTAMPTZ;

-- 2. Create customer consent audit history table
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

-- 3. Add winner status column to track official vs superseded draws
ALTER TABLE winners ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'official' CHECK (status IN ('official', 'superseded', 'disqualified'));

CREATE INDEX IF NOT EXISTS idx_winners_status ON winners(campaign_id, status);
