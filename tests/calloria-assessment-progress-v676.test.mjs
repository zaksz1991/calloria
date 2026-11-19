import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  nextAssessmentStep,
  previousAssessmentStep,
  jumpToAssessmentResponse,
  buildAssessmentReview,
  applyAssessmentProgress,
  readAssessmentProgress
} from '../js/assessment-flow-engine.js';

const counts = { aptitudeCount: 7, practicalCount: 3 };
const emptyProgress = () => ({
  phase: 'aptitude', aptitudeIndex: 0, practicalIndex: 0,
  aptitudeAnswers: Array(7).fill(undefined),
  practicalAnswers: Array(3).fill(undefined), returnToReview: false
});

const aptitudeQuestions = Array.from({ length: 7 }, (_, index) => ({
  category: `Category ${index + 1}`,
  question: `Aptitude question ${index + 1}`,
  options: [
    { label: 'Safe response', points: 1 },
    { label: 'Unsafe response', points: 0, breach: true },
    { label: 'Alternative response', points: 0 }
  ]
}));
const practicalSteps = Array.from({ length: 3 }, (_, index) => ({
  label: `Practical stage ${index + 1}`,
  prompt: `Practical prompt ${index + 1}`,
  options: [
    { label: 'Appropriate handling', points: 1 },
    { label: 'Credential request', points: 0, breach: true },
    { label: 'Poor handling', points: 0 }
  ]
}));

function answerAll(progress) {
  progress.aptitudeAnswers = Array(7).fill(0);
  progress.practicalAnswers = Array(3).fill(0);
  return progress;
}

test('forward navigation is locked until the currently visible item has a selected response', () => {
  const progress = emptyProgress();
  const result = nextAssessmentStep(progress, counts);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'answer-required');
  progress.aptitudeAnswers[0] = 0;
  const next = nextAssessmentStep(progress, counts);
  assert.equal(next.ok, true);
  assert.equal(next.progress.aptitudeIndex, 1);
  assert.equal(next.progress.phase, 'aptitude');
});

test('last aptitude response advances to practical call; last practical response advances to review, not immediate scoring', () => {
  const progress = answerAll(emptyProgress());
  progress.aptitudeIndex = 6;
  const toPractical = nextAssessmentStep(progress, counts);
  assert.equal(toPractical.ok, true);
  assert.equal(toPractical.progress.phase, 'practical');
  assert.equal(toPractical.progress.practicalIndex, 0);
  toPractical.progress.practicalIndex = 2;
  const toReview = nextAssessmentStep(toPractical.progress, counts);
  assert.equal(toReview.ok, true);
  assert.equal(toReview.progress.phase, 'review');
});

test('back navigation crosses the aptitude/practical boundary without discarding answers', () => {
  const progress = answerAll(emptyProgress());
  progress.phase = 'practical';
  progress.practicalIndex = 0;
  const previous = previousAssessmentStep(progress, counts);
  assert.equal(previous.ok, true);
  assert.equal(previous.progress.phase, 'aptitude');
  assert.equal(previous.progress.aptitudeIndex, 6);
  assert.deepEqual(previous.progress.aptitudeAnswers, progress.aptitudeAnswers);
  assert.deepEqual(previous.progress.practicalAnswers, progress.practicalAnswers);
});

test('review edits return to the review page after saving one response', () => {
  const progress = answerAll(emptyProgress());
  progress.phase = 'review';
  const edit = jumpToAssessmentResponse(progress, { section: 'aptitude', index: 3 }, counts);
  assert.equal(edit.ok, true);
  assert.equal(edit.progress.phase, 'aptitude');
  assert.equal(edit.progress.aptitudeIndex, 3);
  assert.equal(edit.progress.returnToReview, true);
  const saved = nextAssessmentStep(edit.progress, counts);
  assert.equal(saved.ok, true);
  assert.equal(saved.progress.phase, 'review');
  assert.equal(saved.progress.returnToReview, false);
});

test('review model blocks missing or out-of-range responses and identifies critical breach selections', () => {
  const missing = buildAssessmentReview({ aptitudeQuestions, practicalSteps, aptitudeAnswers: Array(7).fill(0), practicalAnswers: [0, undefined, 0] });
  assert.equal(missing.complete, false);
  assert.equal(missing.answeredCount, 9);
  const breach = buildAssessmentReview({ aptitudeQuestions, practicalSteps, aptitudeAnswers: [0, 0, 0, 0, 0, 0, 0], practicalAnswers: [0, 1, 0] });
  assert.equal(breach.complete, true);
  assert.equal(breach.criticalBreaches.length, 1);
  assert.equal(breach.criticalBreaches[0].section, 'practical');
  const invalid = buildAssessmentReview({ aptitudeQuestions, practicalSteps, aptitudeAnswers: [0, 0, 0, 0, 0, 0, 99], practicalAnswers: [0, 0, 0] });
  assert.equal(invalid.complete, false);
  assert.equal(invalid.unanswered[0].index, 6);
});

test('state bridge persists the review phase and review-edit destination', () => {
  const state = { assessmentPhase: 'aptitude', assessmentIndex: 2, practicalIndex: 0, assessmentAnswers: [0, 1], practicalAnswers: [], assessmentReturnToReview: false };
  const progress = readAssessmentProgress(state);
  progress.phase = 'practical';
  progress.practicalIndex = 1;
  progress.returnToReview = true;
  applyAssessmentProgress(state, progress);
  assert.equal(state.assessmentPhase, 'practical');
  assert.equal(state.practicalIndex, 1);
  assert.equal(state.assessmentReturnToReview, true);
  assert.deepEqual(state.assessmentAnswers, [0, 1]);
});

test('application wires the response review and the mobile dock to the final submit action', async () => {
  const root = resolve(new URL('..', import.meta.url).pathname);
  const [main, guard, css] = await Promise.all([
    readFile(resolve(root, 'js/main.js'), 'utf8'),
    readFile(resolve(root, 'public/js/calloria-mobile-ui-guard-v6-10.js'), 'utf8'),
    readFile(resolve(root, 'public/calloria-mobile-responsive-v6-10.css'), 'utf8')
  ]);
  assert.match(main, /function renderAssessmentReview\(\)/);
  assert.match(main, /data-action="assessment-review-jump"/);
  assert.match(main, /data-action="assessment-submit"/);
  assert.match(main, /buildAssessmentReview\([\s\S]*?review\.complete/);
  assert.match(main, /case 'assessment-back':/);
  assert.match(main, /case 'assessment-review-jump':/);
  assert.match(main, /function recordAssessmentResponse\(section, selected\)[\s\S]*?state\.assessmentSavedAt = new Date\(\)\.toISOString\(\);[\s\S]*?saveState\(\);[\s\S]*?renderView\(\)/);
  assert.match(guard, /button\[data-action="assessment-submit"\]/);
  assert.match(css, /assessment-review-item/);
  assert.match(css, /assessment-head-actions/);
});
