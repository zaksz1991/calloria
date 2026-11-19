import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFile(path.join(root, file), 'utf8');

test('assessment entry, result and offer use a dedicated viewport mode that removes the 3D hero and navigation chrome', async () => {
  const main = await read('js/main.js');
  const css = await read('public/calloria-mobile-responsive-v6-10.css');
  assert.match(main, /function syncAssessmentViewportMode\(/);
  assert.match(main, /syncAssessmentViewportMode\(!state\.hired && state\.currentView === 'overview' && \['assessment','offer','failed'\]\.includes\(state\.stage\)\)/);
  assert.match(main, /function renderAssessmentResult\(\)\s*\{\s*syncAssessmentViewportMode\(true\)/);
  assert.match(main, /function beginAssessment\(\)[\s\S]*?renderView\(\);scrollAssessmentToTop\(\)/);
  assert.match(css, /body\.calloria-assessment-mode \.world-panel[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /body\.calloria-assessment-mode \.topbar[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /body\.calloria-assessment-mode \.sidebar[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /body\.calloria-assessment-mode \.content-wrap[\s\S]*?margin:\s*0 auto\s*!important/);
});

test('aptitude and practical assessments expose visible, labelled, keyboard-operable answer buttons', async () => {
  const main = await read('js/main.js');
  const aptitude = main.slice(main.indexOf('function renderAssessment()'), main.indexOf('const practicalCallSteps'));
  const practical = main.slice(main.indexOf('function renderPracticalAssessment()'), main.indexOf('function renderAssessmentResult()'));
  for (const [name, source, selector, label] of [
    ['aptitude', aptitude, 'data-answer', 'Aptitude answer options'],
    ['practical', practical, 'data-practical-answer', 'Practical call answer options']
  ]) {
    assert.match(source, new RegExp(`role="group" aria-label="${label}"`), `${name} answer group must be named`);
    assert.match(source, new RegExp(`<button type="button" class="answer-option[^>]*${selector}`), `${name} choices must be real buttons`);
    assert.match(source, /aria-pressed="\$\{answer===j\?'true':'false'\}"/, `${name} choice must expose selection state`);
    assert.match(source, /class="assessment-footer"[\s\S]*?aria-live="polite"/, `${name} footer must announce selection guidance`);
    assert.match(source, /data-action="(?:assessment-next|practical-next)"/, `${name} must retain its progression action`);
    assert.match(source, /\$\{answer===undefined\?'disabled':''\}/, `${name} progression must remain gated until an answer is selected`);
  }
});

test('assessment progression keeps answer selection focused and scrolls each new question into view', async () => {
  const main = await read('js/main.js');
  assert.match(main, /function scrollAssessmentToTop\(\)[\s\S]*?scrollIntoView\(\{ block: 'start', behavior: 'auto' \}\)/);
  assert.match(main, /case 'assessment-next':[\s\S]*?if\(state\.assessmentAnswers\[i\]===undefined\)return[\s\S]*?renderView\(\);scrollAssessmentToTop\(\);break/);
  assert.match(main, /case 'practical-next':[\s\S]*?if\(state\.practicalAnswers\[i\]===undefined\)return[\s\S]*?scrollAssessmentToTop\(\);break/);
  assert.match(main, /state\.assessmentAnswers\[i\]=selected;renderView\(\);requestAnimationFrame\(\(\)=>viewRoot\.querySelector\(`\[data-answer=/);
  assert.match(main, /state\.practicalAnswers\[state\.practicalIndex\]=selected;renderView\(\);requestAnimationFrame\(\(\)=>viewRoot\.querySelector\(`\[data-practical-answer=/);
});

test('assessment desktop sticky action and phone dock remain inside the visible viewport', async () => {
  const css = await read('public/calloria-mobile-responsive-v6-10.css');
  const script = await read('public/js/calloria-mobile-ui-guard-v6-10.js');
  assert.match(css, /body\.calloria-assessment-mode \.assessment-card \.assessment-footer\s*\{[\s\S]*?position:\s*sticky[\s\S]*?bottom:\s*0/);
  assert.match(css, /body\.calloria-assessment-mode #calloriaMobileAssessmentDockV611\s*\{[\s\S]*?bottom:\s*calc\(10px \+ env\(safe-area-inset-bottom\)/);
  assert.match(css, /body\.calloria-assessment-mode \.page-heading\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /body\.calloria-assessment-mode \.assessment-card \.answer-option\s*\{[\s\S]*?min-height:\s*60px/);
  assert.match(script, /button\[data-action="assessment-next"\], button\[data-action="practical-next"\]/);
  assert.match(script, /target\.click\(\)/);
  assert.match(script, /Choose one response above to unlock the next question/);
});

test('recruitment still contains seven aptitude questions, three practical call stages and original score/pass controls', async () => {
  const main = await read('js/main.js');
  const questions = main.slice(main.indexOf('const recruitmentQuestions = ['), main.indexOf('const inboundScenarios = ['));
  const practical = main.slice(main.indexOf('const practicalCallSteps = ['), main.indexOf('function renderPracticalAssessment()'));
  assert.equal((questions.match(/category:/g) || []).length, 7);
  assert.equal((practical.match(/\{label:'(?:OPENING THE CALL|LISTENING & PROBING|SETTING EXPECTATIONS)'/g) || []).length, 3);
  assert.match(main, /const passed = correct >= 5 && practicalScore >= 2 && !breached/);
  assert.match(main, /data-action="retake-assessment"/);
  assert.match(main, /data-action="accept-offer"/);
  assert.match(main, /function enter3dFloor\(\)[\s\S]*?classList\.remove\('calloria-assessment-mode'\)/, 'returning to the 3D world must clear the focused assessment layout');
});
