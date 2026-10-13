const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Pure evaluation function mirroring the SQL timing predicate:
 * now >= start_time AND now < end_time
 */
function isCampaignActive(now, startTime, endTime) {
  const n = new Date(now).getTime();
  const s = new Date(startTime).getTime();
  const e = new Date(endTime).getTime();

  return n >= s && n < e;
}

test('Campaign 48-Hour Lifecycle Timing Boundaries', async (t) => {
  const startTime = '2026-10-12T00:00:00.000Z';
  const endTime = '2026-10-14T00:00:00.000Z'; // Exactly 48 hours later

  await t.test('rejects submissions before campaign start (start - 1ms)', () => {
    const beforeStart = '2026-10-11T23:59:59.999Z';
    assert.equal(isCampaignActive(beforeStart, startTime, endTime), false);
  });

  await t.test('accepts submissions exactly at start_time boundary (start + 0ms)', () => {
    const exactStart = '2026-10-12T00:00:00.000Z';
    assert.equal(isCampaignActive(exactStart, startTime, endTime), true);
  });

  await t.test('accepts submissions during mid-campaign window', () => {
    const midPoint = '2026-10-13T12:00:00.000Z';
    assert.equal(isCampaignActive(midPoint, startTime, endTime), true);
  });

  await t.test('accepts submissions just before end_time (end - 1ms)', () => {
    const justBeforeEnd = '2026-10-13T23:59:59.999Z';
    assert.equal(isCampaignActive(justBeforeEnd, startTime, endTime), true);
  });

  await t.test('rejects submissions exactly at end_time boundary (end + 0ms) [half-open interval]', () => {
    const exactEnd = '2026-10-14T00:00:00.000Z';
    assert.equal(isCampaignActive(exactEnd, startTime, endTime), false);
  });

  await t.test('rejects submissions after end_time (end + 1ms)', () => {
    const afterEnd = '2026-10-14T00:00:00.001Z';
    assert.equal(isCampaignActive(afterEnd, startTime, endTime), false);
  });
});
