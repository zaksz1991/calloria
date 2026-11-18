import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

 test('the main 3D application loads the callback commitment engine before its module', () => {
  assert.match(html, /<script src="\/commitment-engine\.js"><\/script>\s*<script type="module" src="\/js\/main\.js"><\/script>/);
  assert.match(main, /const CommitmentEngine = globalThis\.CalloriaCommitmentEngine/);
});

test('customer commitments migrate into the same saved employment profile', () => {
  assert.match(main, /customerCommitments: globalThis\.CalloriaCommitmentEngine\?\.createState/);
  assert.match(main, /migrated\.customerCommitments = globalThis\.CalloriaCommitmentEngine\?\.normaliseState/);
  assert.match(main, /function commitmentStore\(\)/);
});

test('the Promises view is available in navigation and application routing', () => {
  assert.match(html, /data-view="commitments"[\s\S]*id="commitmentCount"/);
  assert.match(main, /commitments:\['CUSTOMER PROMISE CONTROL'/);
  assert.match(main, /case 'commitments': renderCommitments\(\); break;/);
  assert.match(main, /function renderCommitments\(\)/);
});

test('callback wrap-up records a named promise and agreed simulated due plan', () => {
  assert.match(main, /id="callbackPlan"/);
  assert.match(main, /id="commitmentDescription"/);
  assert.match(main, /CommitmentEngine\.validateCreation\(input,shift\)/);
  assert.match(main, /CommitmentEngine\.createCommitment\(commitmentStore\(\),callbackDraft\.input/);
  assert.match(main, /createCallbackRecordFromCommitment\(createdCommitment/);
});

test('linked callback due checks use the game shift clock instead of wall-clock time', () => {
  assert.match(main, /function commitmentShiftSnapshot\(\)/);
  assert.match(main, /function callbackIsDue\(callback\)/);
  assert.match(main, /CommitmentEngine\.classify\(item,commitmentShiftSnapshot\(\)\)/);
  assert.match(main, /if\(!callbackIsDue\(callback\)\)/);
});

test('callback outcome and independent supervisor review are recorded with audit events', () => {
  assert.match(main, /function recordCommitmentOutcome\(commitmentId,outcome,summary/);
  assert.match(main, /CommitmentEngine\.recordOutcome\(commitmentStore\(\),commitmentId/);
  assert.match(main, /CommitmentEngine\.closeAfterReview\(commitmentStore\(\),item\.id/);
  assert.match(main, /id==='commitmentOutcomeForm'/);
  assert.match(main, /id==='commitmentReviewForm'/);
});

test('inbound and outbound callback attempts retain their commitment link', () => {
  assert.match(main, /commitmentId:linkedCallback\?\.commitmentId\|\|null/);
  assert.match(main, /const linkedCommitment=callbackId\?state\.callbacks\.find/);
  assert.match(main, /if\(active\.commitmentId\)\{/);
  assert.match(main, /scheduleRetryForCommitment\(result\.item/);
});

test('the commitment desk has responsive worklist styling and the check script validates the UMD engine', () => {
  assert.match(css, /\.commitment-workspace/);
  assert.match(css, /@media\(max-width:760px\)\{\.commitment-workspace/);
  assert.match(pkg.scripts.check, /node --check public\/commitment-engine\.js/);
});
