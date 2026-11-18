import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const engine = readFileSync(new URL('../public/promise-control-engine.js', import.meta.url), 'utf8');

test('promise control engine loads before the main application module', () => {
  assert.match(html, /<script src="\/commitment-engine\.js"><\/script>\s*<script src="\/promise-control-engine\.js"><\/script>\s*<script type="module" src="\/js\/main\.js"><\/script>/);
  assert.match(main, /const PromiseControlEngine = globalThis\.CalloriaPromiseControlEngine/);
});

test('management navigation and view routing expose the Promise Control desk', () => {
  assert.match(html, /data-view="promiseControl"[^>]*aria-label="Customer promise control"/);
  assert.match(main, /promiseControl:\['SUPERVISOR DESK','Customer promise control'/);
  assert.match(main, /case 'promiseControl': renderPromiseControl\(\); break;/);
  assert.match(main, /function renderPromiseControl\(\)/);
});

test('portfolio uses the existing commitment store, accelerated clock and callback records', () => {
  assert.match(main, /PromiseControlEngine\.buildPortfolio\(commitmentStore\(\),commitmentShiftSnapshot\(\),state\.callbacks,state\.supervisorRequests\)/);
  assert.match(main, /MISSING CALLBACK TASK/);
  assert.match(main, /Owner workload and exposure/);
});

test('promise escalation creation is reason-required and blocks duplicate active requests', () => {
  assert.match(main, /function openPromiseEscalationModal\(commitmentId\)/);
  assert.match(main, /id="promiseEscalationRaiseForm"/);
  assert.match(main, /PromiseControlEngine\.raiseEscalation\(/);
  assert.match(engine, /already exists/);
  assert.match(engine, /reason\.length < 20/);
});

test('supervisor recovery review requires independent ownership and a documented recovery action', () => {
  assert.match(main, /id="promiseEscalationReviewForm"/);
  assert.match(main, /PromiseControlEngine\.resolveEscalation\(/);
  assert.match(engine, /reviewer\.toLowerCase\(\) === owner\.toLowerCase\(\)/);
  assert.match(engine, /actionTaken\.length < 20/);
});

test('reviewing a promise escalation does not complete the underlying callback commitment', () => {
  assert.match(main, /the customer callback commitment remains open/);
  assert.match(engine, /request\.status = 'resolved'/);
  assert.doesNotMatch(engine, /item\.status\s*=\s*'Complete'/);
});

test('escalation buttons are not intercepted as Promise worklist navigation buttons', () => {
  assert.match(main, /e\.target\.closest\('\[data-commitment-id\]:not\(\[data-action\]\)'\)/);
  assert.match(main, /data-action="raise-promise-escalation" data-commitment-id=/);
});

test('promise requests cannot be one-click closed from the generic supervisor desk', () => {
  assert.match(main, /item\.commitmentId\?`<button class="btn small primary" data-action="open-promise-control">Open promise control/);
  assert.match(main, /case 'open-promise-control':state\.currentView='promiseControl'/);
});

test('mobile Promise Control styling and syntax checks cover the new engine', () => {
  assert.match(css, /\.promise-control-table/);
  assert.match(css, /@media\(max-width:760px\)\{\.promise-control-metrics/);
  assert.match(pkg.scripts.check, /node --check public\/promise-control-engine\.js/);
});
