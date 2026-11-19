import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessmentAnswerShortcut } from '../js/assessment-flow-engine.js';

const root = resolve(new URL('..', import.meta.url).pathname);

 test('numeric shortcuts map 1-based keys to zero-based answer indexes', () => {
  assert.equal(assessmentAnswerShortcut('1', 3), 0);
  assert.equal(assessmentAnswerShortcut('2', 3), 1);
  assert.equal(assessmentAnswerShortcut('3', 3), 2);
  assert.equal(assessmentAnswerShortcut('1', 4), 0);
  assert.equal(assessmentAnswerShortcut('4', 4), 3);
});

test('shortcuts reject unrelated keys and indexes outside the current option list', () => {
  for (const key of ['0', '5', 'a', 'A', 'Enter', 'ArrowRight', '', '11']) {
    assert.equal(assessmentAnswerShortcut(key, 3), null, `expected ${key} to be ignored`);
  }
  assert.equal(assessmentAnswerShortcut('3', 2), null);
  assert.equal(assessmentAnswerShortcut('1', 0), null);
  assert.equal(assessmentAnswerShortcut(1, 3), null);
});

test('keyboard shortcuts share the same validation, save and render path as pointer selection', async () => {
  const main = await readFile(resolve(root, 'js/main.js'), 'utf8');
  assert.match(main, /function recordAssessmentResponse\(section, selected\)/);
  assert.match(main, /function onAssessmentKeyboardShortcut\(event\)/);
  assert.match(main, /document\.addEventListener\('keydown', onAssessmentKeyboardShortcut\)/);
  assert.match(main, /recordAssessmentResponse\(practical \? 'practical' : 'aptitude', selected\)/);
  assert.match(main, /recordAssessmentResponse\('aptitude', Number\(answer\.dataset\.answer\)\)/);
  assert.match(main, /recordAssessmentResponse\('practical', Number\(practicalAnswer\.dataset\.practicalAnswer\)\)/);
  assert.match(main, /target\?\.closest\('input, textarea, select, \[contenteditable="true"\], \[role="textbox"\]'\)/);
  assert.match(main, /assessmentAnswerShortcut\(event\.key, item\?\.options\?\.length \|\| 0\)/);
});

test('aptitude and practical options expose numeric shortcuts to assistive technology', async () => {
  const main = await readFile(resolve(root, 'js/main.js'), 'utf8');
  assert.match(main, /data-answer="\$\{j\}" aria-keyshortcuts="\$\{j\+1\}" title="Press \$\{j\+1\} to select"/);
  assert.match(main, /data-practical-answer="\$\{j\}" aria-keyshortcuts="\$\{j\+1\}" title="Press \$\{j\+1\} to select"/);
  assert.match(main, /press 1, 2 or 3/);
});

test('step changes move keyboard focus to the new question and the review heading', async () => {
  const main = await readFile(resolve(root, 'js/main.js'), 'utf8');
  assert.match(main, /function scrollAssessmentToTop\(\)[\s\S]*?target\.focus\(\{ preventScroll: true \}\)/);
  assert.match(main, /id="aptitudeQuestionText" tabindex="-1" role="heading" aria-level="2"/);
  assert.match(main, /id="practicalQuestionText" tabindex="-1" role="heading" aria-level="2"/);
  assert.match(main, /Review your answers before submission<\/h3>/);
  assert.match(main, /tabindex="-1">Review your answers before submission/);
});

test('short landscape mobile keeps the assessment continue dock below rather than over answer options', async () => {
  const css = await readFile(resolve(root, 'public/calloria-mobile-responsive-v6-10.css'), 'utf8');
  const guard = await readFile(resolve(root, 'public/js/calloria-mobile-ui-guard-v6-10.js'), 'utf8');
  assert.match(css, /CALLORIA v6\.77 — assessment keyboard focus and short-landscape CTA safety/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(190px, 32vw\) !important/);
  assert.match(css, /body\.calloria-assessment-mode \.assessment-progress-panel\s*\{\s*display: none !important/);
  assert.match(css, /padding: 8px 10px calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(guard, /button\[data-action="assessment-next"\]/);
  assert.match(guard, /button\[data-action="practical-next"\]/);
  assert.match(guard, /button\[data-action="assessment-submit"\]/);
  assert.match(guard, /target\.click\(\)/);
});
