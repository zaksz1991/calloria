import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('CRM imports and runs the case lifecycle engine against the existing saved case records', () => {
  assert.match(main, /from '\.\/case-lifecycle-engine\.js'/);
  assert.match(main, /migrated\.cases\s*=\s*Array\.isArray\(migrated\.cases\)[\s\S]*normalizeCaseLifecycle/);
  assert.match(main, /caseFollowUpMetrics\(state\.cases,caseLifecycleClock\(\)\)/);
});

test('CRM renders a reopened-case worklist and resolution evidence workflow', () => {
  assert.match(main, /Reopened case follow-up worklist/);
  assert.match(main, /id="caseReopenForm"/);
  assert.match(main, /id="caseFollowUpCompleteForm"/);
  assert.match(main, /id="caseFollowUpReviewForm"/);
  assert.match(main, /Customer explicitly confirmed the issue is resolved/);
  assert.match(readFileSync(new URL('../js/case-lifecycle-engine.js', import.meta.url), 'utf8'), /Only the employee who claimed this follow-up/);
});

test('case follow-up escalation is routed to CRM from the supervisor assistance desk', () => {
  assert.match(main, /caseReference\?`<button class="btn small primary" data-action="open-case-followup"/);
  assert.match(main, /caseReference:action\.dataset\.caseReference/);
  assert.match(main, /caseReference:caseRecord\.reference[\s\S]*channel:'Case follow-up'/);
});

test('case follow-up controls have responsive styling', () => {
  for (const selector of ['.case-followup-panel', '.case-followup-queue-row', '.case-followup-facts', '.case-confirm-check']) {
    assert.ok(styles.includes(selector), `Missing CSS selector ${selector}`);
  }
  assert.match(styles, /@media[\s\S]*case-followup-facts/);
});

test('package syntax check includes the new case lifecycle engine', () => {
  assert.match(pkg.scripts.check, /node --check js\/case-lifecycle-engine\.js/);
});
