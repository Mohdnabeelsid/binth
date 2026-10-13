/**
 * BINTH.IN — Marketing Consent Lifecycle & Audit Invariant Tests
 * 
 * Tests Section 6 requirements:
 * - Entry permitted without marketing consent.
 * - Explicit opt-in sets has_marketing_consent = true and marketing_consent_at.
 * - Entry without consent does NOT grant consent if previously not granted.
 * - A later entry without consent does NOT silently erase prior explicit consent.
 * - Explicit withdrawal marks consent as false with withdrawal timestamp.
 * - Re-opt-in clears withdrawal and re-establishes marketing eligibility.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('Marketing Consent Invariants & Lifecycle', () => {

  // Pure logic representation of the database consent state machine
  function processConsentUpdate(existingCustomer, submissionConsent, sourceCode, timestamp = new Date().toISOString()) {
    if (!existingCustomer) {
      // New Customer
      return {
        customer: {
          hasMarketingConsent: !!submissionConsent,
          marketingConsentAt: submissionConsent ? timestamp : null,
          consentWithdrawnAt: null
        },
        historyEvent: {
          consentStatus: submissionConsent ? 'opted_in' : 'opted_out',
          sourceCode: sourceCode || null,
          recordedAt: timestamp
        }
      };
    }

    // Existing Customer
    if (submissionConsent) {
      // Explicit Opt-In: Re-affirm or grant consent, clear withdrawal
      return {
        customer: {
          ...existingCustomer,
          hasMarketingConsent: true,
          marketingConsentAt: existingCustomer.marketingConsentAt || timestamp,
          consentWithdrawnAt: null
        },
        historyEvent: {
          consentStatus: 'opted_in',
          sourceCode: sourceCode || null,
          recordedAt: timestamp
        }
      };
    } else {
      // Submission without consent checkbox:
      // Invariant: Must NOT silently erase prior consent, nor grant false consent
      return {
        customer: {
          ...existingCustomer,
          hasMarketingConsent: existingCustomer.hasMarketingConsent, // Preserved!
          marketingConsentAt: existingCustomer.marketingConsentAt,     // Preserved without false renewal
          consentWithdrawnAt: existingCustomer.consentWithdrawnAt
        },
        historyEvent: existingCustomer.hasMarketingConsent ? null : {
          consentStatus: 'opted_out',
          sourceCode: sourceCode || null,
          recordedAt: timestamp
        }
      };
    }
  }

  function processConsentWithdrawal(customer, timestamp = new Date().toISOString()) {
    return {
      customer: {
        ...customer,
        hasMarketingConsent: false,
        consentWithdrawnAt: timestamp
      },
      historyEvent: {
        consentStatus: 'withdrawn',
        recordedAt: timestamp
      }
    };
  }

  it('new participant entering without consent is recorded with hasMarketingConsent = false', () => {
    const res = processConsentUpdate(null, false, 'MCH-SHOP-001', '2026-10-12T10:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, false);
    assert.equal(res.customer.marketingConsentAt, null);
    assert.equal(res.historyEvent.consentStatus, 'opted_out');
  });

  it('new participant entering with consent is recorded with hasMarketingConsent = true and timestamp', () => {
    const res = processConsentUpdate(null, true, 'MCH-SHOP-001', '2026-10-12T10:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, true);
    assert.equal(res.customer.marketingConsentAt, '2026-10-12T10:00:00Z');
    assert.equal(res.historyEvent.consentStatus, 'opted_in');
  });

  it('later entry without consent does NOT silently erase prior explicit opt-in', () => {
    const priorCustomer = {
      hasMarketingConsent: true,
      marketingConsentAt: '2026-10-01T08:00:00Z',
      consentWithdrawnAt: null
    };

    const res = processConsentUpdate(priorCustomer, false, 'ALP-BOUTIQUE-003', '2026-10-12T12:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, true, 'Prior consent must be preserved');
    assert.equal(res.customer.marketingConsentAt, '2026-10-01T08:00:00Z', 'Original consent timestamp must not be falsely overwritten');
  });

  it('later entry without consent does NOT grant consent to previously non-consenting user', () => {
    const priorCustomer = {
      hasMarketingConsent: false,
      marketingConsentAt: null,
      consentWithdrawnAt: null
    };

    const res = processConsentUpdate(priorCustomer, false, 'KCH-MALL-005', '2026-10-12T12:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, false);
    assert.equal(res.customer.marketingConsentAt, null);
  });

  it('explicit admin withdrawal revokes marketing eligibility and records withdrawal timestamp', () => {
    const activeCustomer = {
      hasMarketingConsent: true,
      marketingConsentAt: '2026-10-01T08:00:00Z',
      consentWithdrawnAt: null
    };

    const res = processConsentWithdrawal(activeCustomer, '2026-10-13T09:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, false);
    assert.equal(res.customer.consentWithdrawnAt, '2026-10-13T09:00:00Z');
    assert.equal(res.historyEvent.consentStatus, 'withdrawn');
  });

  it('subsequent explicit opt-in after withdrawal restores consent and clears withdrawal flag', () => {
    const withdrawnCustomer = {
      hasMarketingConsent: false,
      marketingConsentAt: '2026-10-01T08:00:00Z',
      consentWithdrawnAt: '2026-10-05T09:00:00Z'
    };

    const res = processConsentUpdate(withdrawnCustomer, true, 'TVM-STUDIO-007', '2026-10-13T10:00:00Z');
    assert.equal(res.customer.hasMarketingConsent, true);
    assert.equal(res.customer.consentWithdrawnAt, null, 'Withdrawal timestamp must be cleared upon fresh explicit opt-in');
    assert.equal(res.historyEvent.consentStatus, 'opted_in');
  });
});
