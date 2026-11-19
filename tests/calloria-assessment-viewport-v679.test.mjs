import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const [main, css, guard] = await Promise.all([
  readFile(resolve(root, 'js/main.js'), 'utf8'),
  readFile(resolve(root, 'public/calloria-mobile-responsive-v6-10.css'), 'utf8'),
  readFile(resolve(root, 'public/js/calloria-mobile-ui-guard-v6-10.js'), 'utf8')
]);

test('mobile assessment dock clearance is measured from its rendered height and actual bottom inset', () => {
  assert.match(guard, /function measureDockClearance\(\)/);
  assert.match(guard, /getBoundingClientRect\(\)/);
  assert.match(guard, /getComputedStyle\(dock\)/);
  assert.match(guard, /height \+ bottom \+ 16/);
  assert.match(guard, /--calloria-v611-assessment-dock-clearance/);
  assert.match(guard, /new ResizeObserver\(scheduleDockClearanceMeasure\)/);
});

test('visual viewport resize and scrolling schedule a fresh clearance measurement', () => {
  assert.match(guard, /visualViewport\?\.addEventListener\('resize', scheduleRefresh/);
  assert.match(guard, /visualViewport\?\.addEventListener\('scroll', syncViewportMetrics/);
  assert.match(guard, /scheduleDockClearanceMeasure\(\)/);
  assert.match(guard, /--calloria-v611-browser-bottom-inset/);
});

test('the mobile dock continues to proxy the original aptitude, practical and final submit actions', () => {
  assert.match(guard, /button\[data-action="assessment-next"\]/);
  assert.match(guard, /button\[data-action="practical-next"\]/);
  assert.match(guard, /button\[data-action="assessment-submit"\]/);
  assert.match(guard, /target\.click\(\)/);
  assert.match(guard, /original\.disabled/);
  assert.match(guard, /original\.setAttribute\('aria-hidden', 'true'\)/);
});

test('mobile assessment content reserves the measured dock height instead of using a fixed guess', () => {
  assert.match(css, /CALLORIA v6\.79 — assessment viewport fit, mobile scroll clearance and dock safety/);
  assert.match(css, /padding-bottom: calc\(var\(--calloria-v611-assessment-dock-clearance, 128px\) \+ 12px\) !important/);
  assert.match(css, /scroll-padding-bottom: calc\(var\(--calloria-v611-assessment-dock-clearance, 128px\) \+ 12px\)/);
  assert.match(css, /scroll-margin-bottom: calc\(var\(--calloria-v611-assessment-dock-clearance, 128px\) \+ 18px\)/);
});

test('phone layouts remove the duplicate progress panel and compact answers without hiding them', () => {
  assert.match(css, /body\.calloria-assessment-mode \.assessment-progress-panel\s*\{\s*display: none !important/);
  assert.match(css, /\.assessment-card \.answer-option\s*\{[\s\S]*?min-height: 48px/);
  assert.match(css, /Extra compression for short portrait devices; the page itself still scrolls/);
  assert.match(css, /min-height: 44px/);
  assert.match(css, /max-width: 360px/);
  assert.doesNotMatch(css, /\.answer-option\s*\{[^}]*display:\s*none/);
});

test('assessment content and question text remain scrollable and all four-choice render paths remain intact', () => {
  assert.match(css, /body\.calloria-assessment-mode \{[\s\S]*?overflow-y: auto !important/);
  assert.match(css, /body\.calloria-assessment-mode \.content-wrap \{[\s\S]*?padding-bottom:/);
  assert.match(main, /q\.options\.map\(\(o,j\)=>`<button type="button" class="answer-option/);
  assert.match(main, /step\.options\.map\(\(o,j\)=>`<button type="button" class="answer-option/);
  assert.match(main, /data-action="assessment-next"/);
  assert.match(main, /data-action="practical-next"/);
  assert.match(main, /data-action="assessment-submit"/);
});

test('recruitment scoring thresholds and assessment content are not changed by the viewport upgrade', () => {
  assert.match(main, /const passed = correct >= 5 && practicalScore >= 2 && !breached/);
  assert.match(main, /const recruitmentQuestions = \[/);
  assert.match(main, /const practicalCallSteps = \[/);
  assert.match(main, /markAssessmentSubmitted\(state/);
});
