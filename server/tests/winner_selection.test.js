const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('Winner Selection Logic & Safeguards', async (t) => {
  // Mock simulation of winner draw decision matrix in select-winner route
  function simulateDrawDecision({
    campaignStatus,
    eligibleCount,
    hasPriorWinner,
    isReroll,
    userRole,
    rerollReason
  }) {
    if (campaignStatus !== 'closed') {
      return { status: 400, error: 'Campaign must be closed before selecting a winner.' };
    }

    if (hasPriorWinner) {
      if (!isReroll) {
        return { status: 409, error: 'An official winner has already been selected for this campaign.' };
      }
      if (userRole !== 'super_admin') {
        return { status: 403, error: 'Only a Super Administrator is authorized to perform a winner reroll.' };
      }
      if (!rerollReason || rerollReason.trim().length < 5) {
        return { status: 400, error: 'An explicit reroll reason of at least 5 characters is required.' };
      }
    }

    if (eligibleCount === 0) {
      return { status: 422, error: 'No eligible entries found for campaign.' };
    }

    // CSPRNG selection
    const selectedIndex = crypto.randomInt(0, eligibleCount);
    return {
      status: 200,
      ok: true,
      selectedIndex,
      isReroll: !!isReroll
    };
  }

  await t.test('rejects draw attempt when campaign is still active', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'active',
      eligibleCount: 10,
      hasPriorWinner: false,
      isReroll: false,
      userRole: 'super_admin'
    });
    assert.equal(res.status, 400);
    assert.match(res.error, /must be closed/);
  });

  await t.test('rejects draw attempt when campaign is in draft status', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'draft',
      eligibleCount: 5,
      hasPriorWinner: false,
      isReroll: false,
      userRole: 'campaign_manager'
    });
    assert.equal(res.status, 400);
  });

  await t.test('rejects draw when closed campaign has 0 eligible entries', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 0,
      hasPriorWinner: false,
      isReroll: false,
      userRole: 'campaign_manager'
    });
    assert.equal(res.status, 422);
    assert.match(res.error, /No eligible entries/);
  });

  await t.test('successfully executes draw on closed campaign with eligible entries', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 50,
      hasPriorWinner: false,
      isReroll: false,
      userRole: 'campaign_manager'
    });
    assert.equal(res.status, 200);
    assert.equal(res.ok, true);
    assert.ok(res.selectedIndex >= 0 && res.selectedIndex < 50);
  });

  await t.test('blocks duplicate official draw when winner was already selected', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 50,
      hasPriorWinner: true,
      isReroll: false,
      userRole: 'super_admin'
    });
    assert.equal(res.status, 409);
    assert.match(res.error, /already been selected/);
  });

  await t.test('denies reroll attempt by campaign_manager role', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 50,
      hasPriorWinner: true,
      isReroll: true,
      userRole: 'campaign_manager',
      rerollReason: 'Winner unresponsive'
    });
    assert.equal(res.status, 403);
    assert.match(res.error, /Only a Super Administrator/);
  });

  await t.test('rejects reroll attempt by super_admin without documented reason', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 50,
      hasPriorWinner: true,
      isReroll: true,
      userRole: 'super_admin',
      rerollReason: ''
    });
    assert.equal(res.status, 400);
    assert.match(res.error, /reroll reason/);
  });

  await t.test('authorizes reroll by super_admin with documented reason', () => {
    const res = simulateDrawDecision({
      campaignStatus: 'closed',
      eligibleCount: 50,
      hasPriorWinner: true,
      isReroll: true,
      userRole: 'super_admin',
      rerollReason: 'Winner disqualified due to non-verifiable phone'
    });
    assert.equal(res.status, 200);
    assert.equal(res.ok, true);
    assert.equal(res.isReroll, true);
  });
});
