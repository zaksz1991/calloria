import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV651Test as v651 } from '../build/calloria-ruffneck-platform-support-v6-51.mjs';
import { __calloriaV652Test as v652, calloriaPlatformSupportCaseDeskPluginV652 } from '../build/calloria-platform-support-case-desk-v6-52.mjs';

const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });
const fixturePath = new URL('./fixtures/v6-51-platform-support.fixture.js', import.meta.url);
const baseInput = (overrides = {}) => ({
  platformId: 'ruffneck-lms',
  customerReference: 'CUS-SIM-001',
  customerName: 'Learner 001',
  requestType: 'Progress or completion records',
  priority: 'normal',
  details: 'Learner reports that the completed module still appears incomplete after reviewing the course status.',
  sequence: 1,
  owner: 'Test Agent',
  ...overrides,
});

function transformedSource(source) {
  const prior = v651.transformMain(context(), source);
  assert.ok(prior, 'v6.51 transform should succeed before the v6.52 transform');
  return v652.transformMain(context(), prior.code);
}

test('creates a valid RuffNeck support case with priority-based SLA and CRM-safe fields', () => {
  const item = v652.create(baseInput(), 1_800_000_000_000);
  assert.equal(item.platformId, 'ruffneck-lms');
  assert.equal(item.platformName, 'RuffNeck LMS');
  assert.equal(item.channel, 'Platform Support');
  assert.equal(item.status, 'Open');
  assert.equal(item.slaMinutes, 1440);
  assert.equal(Date.parse(item.slaDueAt) - Date.parse(item.createdAt), 1440 * 60_000);
  assert.equal(item.qa, null);
  assert.equal(item.qaEligible, false);
  assert.equal(item.customerReference, 'CUS-SIM-001');
  assert.match(item.reference, /^RNS-/);
  assert.equal(item.history.length, 1);
});

test('critical requests automatically enter the escalation queue and use a 30-minute SLA', () => {
  const item = v652.create(baseInput({ priority: 'critical' }), 1_800_000_000_000);
  assert.equal(item.status, 'Escalated');
  assert.equal(item.slaMinutes, 30);
  assert.match(item.escalationReason, /Critical-priority/);
});

test('high and low priorities use the configured simulated response targets', () => {
  assert.equal(v652.create(baseInput({ priority: 'high' }), 1000).slaMinutes, 120);
  assert.equal(v652.create(baseInput({ priority: 'low' }), 1000).slaMinutes, 2880);
});

test('rejects unsupported services, invalid request types, non-synthetic references and incomplete details', () => {
  assert.throws(() => v652.create(baseInput({ platformId: 'unknown' }), 1000), /supported RuffNeck service/);
  assert.throws(() => v652.create(baseInput({ requestType: 'Unlisted request' }), 1000), /request type/);
  assert.throws(() => v652.create(baseInput({ customerReference: 'real-customer@example.com' }), 1000), /synthetic customer reference/);
  assert.throws(() => v652.create(baseInput({ customerName: 'Jane Smith' }), 1000), /synthetic label/);
  assert.throws(() => v652.create(baseInput({ details: 'Too short' }), 1000), /at least 12 characters/);
  assert.throws(() => v652.create(baseInput({ priority: 'urgent' }), 1000), /valid support priority/);
});

test('redacts credentials, card-like number strings, email addresses and phone numbers', () => {
  const safe = v652.redact('OTP: 123456; password is BlueSecret; card 4111 1111 1111 1111; mail learner@example.com; phone +234 801 234 5678');
  assert.doesNotMatch(safe, /123456|BlueSecret|4111|learner@example\.com|801 234 5678/);
  assert.match(safe, /REDACTED/);
});

test('records case status updates and a required resolution note in the case history', () => {
  const item = v652.create(baseInput(), 1_800_000_000_000);
  v652.update(item, { status: 'In Progress', note: 'Checked module status and confirmed the course owner is reviewing the completion record.' }, 1_800_000_001_000);
  assert.equal(item.status, 'In Progress');
  assert.equal(item.history.length, 2);
  v652.update(item, { status: 'Resolved', note: 'The course record was corrected by the authorised owner and the learner confirmed the status is now complete.' }, 1_800_000_002_000);
  assert.equal(item.status, 'Resolved');
  assert.ok(item.resolvedAt);
  assert.equal(item.history.length, 3);
  assert.match(item.notes, /Resolved:/);
});

test('rejects missing case, invalid status and resolution without a substantive note', () => {
  assert.throws(() => v652.update(null, { status: 'Resolved', note: 'Resolved correctly today.' }, 1000), /unavailable/);
  const item = v652.create(baseInput(), 1000);
  assert.throws(() => v652.update(item, { status: 'Deleted', note: 'This update is long enough.' }, 2000), /valid case status/);
  assert.throws(() => v652.update(item, { status: 'Resolved', note: 'done' }, 2000), /resolution note/);
});

test('transforms the v6.51 service directory into a ticket desk and connects the ticket to CRM', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.ok(result);
  assert.match(result.code, new RegExp(v652.marker));
  assert.match(result.code, /RuffNeck support case desk/);
  assert.match(result.code, /platformSupportCases: \[\]/);
  assert.match(result.code, /id="platformSupportCaseForm"/);
  assert.match(result.code, /data-platform-case-update/);
  assert.match(result.code, /state\.cases\.push\(/);
  assert.match(result.code, /createSystemEvent\(state\.systemEvents,platformId,'Opened platform support case'/);
  assert.match(result.code, /pushOperationEvent\('platform-support'/);
  assert.match(result.code, /slaDueAt/);
  assert.match(result.code, /qaEligible:false/);
  assert.equal(v652.transformMain(context(), result.code), null);
});

test('keeps platform support tickets outside the QA score and displays the platform metadata in CRM', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.match(result.code, /c\.qaEligible===false\?'N\/A'/);
  assert.match(result.code, /Platform:<\/strong>/);
  assert.match(result.code, /Priority:<\/strong>/);
  assert.match(result.code, /SLA due:<\/strong>/);
});

test('injects the case desk after the v6.51 playbook and activates responsive case styling', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  const guideAt = result.code.indexOf('${calloriaRenderPlatformGuideV651()}');
  const deskAt = result.code.indexOf('${calloriaRenderPlatformCaseDeskV652()}');
  assert.ok(guideAt >= 0 && deskAt > guideAt);
  assert.match(result.code, /calloriaEnsurePlatformCaseStylesV652\(\)/);
  assert.match(result.code, /@media\(max-width:760px\)/);
});

test('fails closed when any required v6.51 or CRM anchor has drifted', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const prior = v651.transformMain(context(), source);
  assert.ok(prior);
  const changed = context();
  const result = v652.transformMain(changed, prior.code.replace('<p><strong>Issue:</strong> ${escapeHTML(c.title)}</p>', '<p><strong>Ticket:</strong> ${escapeHTML(c.title)}</p>'));
  assert.equal(result, null);
  assert.match(changed.warnings.join(' '), /CRM case detail issue row/);
});

test('transformed application remains valid JavaScript', async () => {
  const source = await readFile(fixturePath, 'utf8');
  const result = transformedSource(source);
  assert.ok(result);
  const dir = await mkdtemp(join(tmpdir(), 'calloria-v652-'));
  const output = join(dir, 'main-v652.mjs');
  try {
    await writeFile(output, result.code);
    const check = spawnSync(process.execPath, ['--check', output], { encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('registers v6.52 after the v6.51 platform directory and preserves the earlier plugin chain', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-platform-support-case-desk-v6-52\.mjs/);
  assert.ok(config.indexOf('calloriaRuffNeckPlatformSupportPlugin()') < config.indexOf('calloriaPlatformSupportCaseDeskPluginV652()'));
  for (const item of ['calloriaVoiceResponseWorkflowPlugin()', 'calloriaInboundQAReviewBridgePlugin()', 'calloriaScenarioBasedPromotionExamPlugin()']) {
    assert.match(config, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('plugin transforms only main.js and is safe to register repeatedly', async () => {
  const plugin = calloriaPlatformSupportCaseDeskPluginV652();
  const source = await readFile(fixturePath, 'utf8');
  const prior = v651.transformMain(context(), source);
  assert.ok(prior);
  assert.equal(plugin.transform.call(context(), prior.code, '/repo/js/other.js'), null);
  const transformed = plugin.transform.call(context(), prior.code, '/repo/js/main.js');
  assert.ok(transformed);
  assert.equal(plugin.transform.call(context(), transformed.code, '/repo/js/main.js'), null);
});
