const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pure evaluation function mirroring the conversion rate formula in v_source_performance:
 * CASE WHEN visits > 0 THEN ROUND((entries::numeric / visits::numeric) * 100.0, 1) ELSE 0.0 END
 */
function calculateConversionRate(entries, visits) {
  if (!visits || visits <= 0) return 0.0;
  return Math.round((entries / visits) * 1000) / 10;
}

test('Analytics and Conversion Rate Calculations', async (t) => {
  await t.test('calculates exact conversion rate percentage', () => {
    // 25 entries from 100 visits = 25.0%
    assert.equal(calculateConversionRate(25, 100), 25.0);

    // 10 entries from 30 visits = 33.3%
    assert.equal(calculateConversionRate(10, 30), 33.3);

    // 1 entry from 7 visits = 14.3%
    assert.equal(calculateConversionRate(1, 7), 14.3);
  });

  await t.test('safely handles 0 visits without dividing by zero', () => {
    assert.equal(calculateConversionRate(0, 0), 0.0);
    assert.equal(calculateConversionRate(5, 0), 0.0);
  });

  await t.test('handles 100% conversion rate accurately', () => {
    assert.equal(calculateConversionRate(50, 50), 100.0);
  });
});
