import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkforceTrendCloudRemediationPlanV807,
  workforceTrendCloudRemediationActionLabelV807,
  WORKFORCE_TREND_CLOUD_REMEDIATION_VERSION_V807
} from '../js/workforce-trend-cloud-remediation-engine-v807.js';

const report = checks => ({ overall: 'blocked', checks });

test('v8.7 remediation engine exposes a pinned version and known action labels', () => {
  assert.equal(WORKFORCE_TREND_CLOUD_REMEDIATION_VERSION_V807, '8.7.0');
  assert.equal(workforceTrendCloudRemediationActionLabelV807('refresh_session'), 'Refresh sign-in session');
  assert.equal(workforceTrendCloudRemediationActionLabelV807('unknown'), 'Review recommended steps');
});

test('no remediation is suggested when every health check passes', () => {
  const plan = buildWorkforceTrendCloudRemediationPlanV807(report([
    { id: 'workspace', status: 'passed' },
    { id: 'auth_session', status: 'passed' },
    { id: 'permissions', status: 'passed' }
  ]));
  assert.deepEqual(plan, []);
});

test('failed checks are ordered before warnings and map to specific safe guidance', () => {
  const plan = buildWorkforceTrendCloudRemediationPlanV807(report([
    { id: 'auth_session', status: 'warning' },
    { id: 'snapshot_store', status: 'failed' },
    { id: 'conflict_archive', status: 'failed' },
    { id: 'local_history', status: 'failed' }
  ]));
  assert.deepEqual(plan.map(item => item.id), ['snapshot_store', 'conflict_archive', 'local_history', 'auth_session']);
  assert.equal(plan[0].action, 'admin_database_review');
  assert.match(plan[1].steps.join(' '), /do not manually delete archive rows/i);
  assert.match(plan[2].steps.join(' '), /Do not clear browser storage/i);
  assert.equal(plan[3].action, 'refresh_session');
});

test('duplicate, passed, unknown and malformed check records are ignored', () => {
  const plan = buildWorkforceTrendCloudRemediationPlanV807(report([
    { id: 'permissions', status: 'failed' },
    { id: 'permissions', status: 'warning' },
    { id: 'auth_session', status: 'passed' },
    { id: 'injected', status: 'failed', title: 'Injected content' },
    null,
    'bad-record',
    { id: 'workspace', status: 'critical' }
  ]));
  assert.deepEqual(plan.map(item => item.id), ['permissions']);
  assert.equal(plan.length, 1);
});

test('untrusted diagnostic details and organisation/customer data never enter the runbook', () => {
  const secretText = 'Bearer SUPABASE_SERVICE_ROLE_SECRET customer@example.com org-12345 <script>alert(1)</script>';
  const plan = buildWorkforceTrendCloudRemediationPlanV807(report([
    { id: 'snapshot_store', status: 'failed', detail: secretText, organisationId: 'org-12345' }
  ]));
  const serialised = JSON.stringify(plan);
  assert.equal(serialised.includes('SUPABASE_SERVICE_ROLE_SECRET'), false);
  assert.equal(serialised.includes('customer@example.com'), false);
  assert.equal(serialised.includes('org-12345'), false);
  assert.equal(serialised.includes('<script>'), false);
  assert.ok(plan[0].steps.length >= 4);
});

test('all fixed diagnostic failure classes have actionable recovery guidance', () => {
  const ids = ['workspace', 'auth_session', 'permissions', 'local_history', 'snapshot_store', 'conflict_archive', 'backup_integrity'];
  const plan = buildWorkforceTrendCloudRemediationPlanV807(report(ids.map(id => ({ id, status: 'failed' }))));
  assert.equal(plan.length, ids.length);
  assert.deepEqual(new Set(plan.map(item => item.id)), new Set(ids));
  for (const item of plan) {
    assert.ok(item.title.length > 5);
    assert.ok(item.summary.length > 15);
    assert.ok(item.steps.length >= 3);
    assert.ok(item.steps.every(step => typeof step === 'string' && step.length > 10));
    assert.equal(Object.isFrozen(item), true);
    assert.equal(Object.isFrozen(item.steps), true);
  }
});
