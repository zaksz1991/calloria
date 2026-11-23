import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKFORCE_TREND_CLOUD_RECOVERY_PROGRESS_VERSION_V808,
  buildWorkforceTrendRecoveryStorageKeyV808,
  normaliseWorkforceTrendRecoveryProgressV808,
  updateWorkforceTrendRecoveryProgressV808,
  summariseWorkforceTrendRecoveryProgressV808,
  loadWorkforceTrendRecoveryProgressV808,
  saveWorkforceTrendRecoveryProgressV808
} from '../js/workforce-trend-cloud-recovery-progress-engine-v808.js';

const plan = [
  { id: 'local_history', steps: ['Protect local history', 'Verify the backup', 'Recover the source browser'] },
  { id: 'auth_session', steps: ['Refresh the session', 'Run diagnostics'] }
];

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  raw(key) { return this.#values.get(key); }
}

test('v8.8 exports a pinned recovery progress engine version', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_RECOVERY_PROGRESS_VERSION_V808, '8.8.0');
});

test('storage namespace is stable, organisation-scoped and does not expose the raw identifier', () => {
  const first = buildWorkforceTrendRecoveryStorageKeyV808('org-ruffneck-prod-123');
  assert.equal(first, buildWorkforceTrendRecoveryStorageKeyV808('org-ruffneck-prod-123'));
  assert.notEqual(first, buildWorkforceTrendRecoveryStorageKeyV808('org-other-456'));
  assert.equal(first.includes('org-ruffneck-prod-123'), false);
  assert.equal(buildWorkforceTrendRecoveryStorageKeyV808(''), '');
  assert.equal(buildWorkforceTrendRecoveryStorageKeyV808('x'.repeat(257)), '');
});

test('normalisation retains only current allow-listed remediation IDs and valid unique step indexes', () => {
  const safe = normaliseWorkforceTrendRecoveryProgressV808({
    local_history: [2, 0, 2, -1, 99, '1'],
    auth_session: [1],
    unknown_check: [0],
    injected: '<script>'
  }, plan);
  assert.deepEqual(safe, { local_history: [0, 2], auth_session: [1] });
  assert.equal(Object.isFrozen(safe), true);
  assert.equal(Object.isFrozen(safe.local_history), true);
});

test('updating a checklist adds and removes a single valid step without mutating prior state', () => {
  const initial = Object.freeze({ local_history: Object.freeze([0]) });
  const added = updateWorkforceTrendRecoveryProgressV808(initial, 'local_history', 2, true, plan);
  assert.deepEqual(added, { local_history: [0, 2] });
  assert.deepEqual(initial, { local_history: [0] });
  const removed = updateWorkforceTrendRecoveryProgressV808(added, 'local_history', 0, false, plan);
  assert.deepEqual(removed, { local_history: [2] });
  const ignored = updateWorkforceTrendRecoveryProgressV808(removed, 'unknown', 0, true, plan);
  assert.deepEqual(ignored, { local_history: [2] });
});

test('progress summary reports completion percentage without claiming verification', () => {
  const summary = summariseWorkforceTrendRecoveryProgressV808(plan, {
    local_history: [0, 1, 2],
    auth_session: [0]
  });
  assert.deepEqual(summary, [
    { id: 'local_history', completed: 3, total: 3, allCompleted: true, percent: 100 },
    { id: 'auth_session', completed: 1, total: 2, allCompleted: false, percent: 50 }
  ]);
});

test('storage round-trip persists only schema version, remediation identifiers and step indexes', () => {
  const storage = new MemoryStorage();
  const key = buildWorkforceTrendRecoveryStorageKeyV808('org-sensitive-id');
  const progress = { local_history: [0, 2], auth_session: [1] };
  assert.equal(saveWorkforceTrendRecoveryProgressV808(storage, key, progress, plan), true);
  const raw = storage.raw(key);
  assert.equal(raw.includes('org-sensitive-id'), false);
  assert.deepEqual(JSON.parse(raw), {
    schemaVersion: 1,
    checks: { local_history: [0, 2], auth_session: [1] }
  });
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(storage, key, plan), progress);
});

test('loading drops stale step indexes and IDs no longer present in the current runbook', () => {
  const storage = new MemoryStorage();
  const key = 'calloria:test';
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, checks: {
    local_history: [0, 1, 2, 3],
    auth_session: [1],
    previous_check: [0]
  } }));
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(storage, key, plan), {
    local_history: [0, 1, 2],
    auth_session: [1]
  });
});

test('malformed, unsupported and unavailable storage fails closed with empty progress', () => {
  const brokenJson = { getItem: () => '{not-json' };
  const unsupported = { getItem: () => JSON.stringify({ schemaVersion: 99, checks: { local_history: [0] } }) };
  const denied = { getItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(brokenJson, 'x', plan), {});
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(unsupported, 'x', plan), {});
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(denied, 'x', plan), {});
  assert.deepEqual(loadWorkforceTrendRecoveryProgressV808(null, 'x', plan), {});
});

test('save returns false when browser storage is unavailable or rejects writes', () => {
  const denied = { setItem: () => { throw new Error('quota or policy'); } };
  assert.equal(saveWorkforceTrendRecoveryProgressV808(denied, 'x', { local_history: [0] }, plan), false);
  assert.equal(saveWorkforceTrendRecoveryProgressV808(null, 'x', {}, plan), false);
  assert.equal(saveWorkforceTrendRecoveryProgressV808({ setItem() {} }, '', {}, plan), false);
});

test('normalising against a cleared runbook removes resolved issue progress', () => {
  const retained = normaliseWorkforceTrendRecoveryProgressV808({ local_history: [0], auth_session: [1] }, []);
  assert.deepEqual(retained, {});
});
