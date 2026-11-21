import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildQAQualityIntelligence, renderQAQualityIntelligence } from '../js/qa-quality-intelligence-v698.js';
import { calloriaQAQualityIntelligencePluginV698 } from '../build/calloria-qa-quality-intelligence-v6-98.mjs';

const review = (id, ratings, extra = {}) => ({
  id,
  interactionId: 'INT-001',
  scorecardId: 'qa-v1',
  criteria: ratings.map(([criterionId, label, rating]) => ({ criterionId, label, rating })),
  ...extra
});

test('aggregates criterion ratings and low-score frequency', () => {
  const data = buildQAQualityIntelligence({ reviews: [
    review('r1', [['accuracy', 'Accuracy', 2], ['opening', 'Opening', 4]]),
    review('r2', [['accuracy', 'Accuracy', 3], ['opening', 'Opening', 4]]),
    review('r3', [['accuracy', 'Accuracy', 2], ['opening', 'Opening', 5]])
  ] });
  const accuracy = data.criteria.find(item => item.criterionId === 'accuracy');
  assert.equal(data.reviewCount, 3);
  assert.equal(data.observationCount, 6);
  assert.equal(accuracy.averageRating, 2.33);
  assert.equal(accuracy.lowRatingRate, 100);
  assert.equal(accuracy.signal, 'priority');
});

test('labels fewer than three observations as an early signal, not a priority', () => {
  const data = buildQAQualityIntelligence({ reviews: [
    review('r1', [['ownership', 'Ownership', 1]]),
    review('r2', [['ownership', 'Ownership', 1]])
  ] });
  assert.equal(data.criteria[0].signal, 'early_signal');
  assert.equal(data.priorityCriteria, 0);
  assert.equal(data.earlySignalCriteria, 1);
});

test('separates criteria by scorecard to avoid mixing incompatible scales', () => {
  const data = buildQAQualityIntelligence({ reviews: [
    review('r1', [['accuracy', 'Accuracy v1', 2]], { scorecardId: 'one' }),
    review('r2', [['accuracy', 'Accuracy v2', 5]], { scorecardId: 'two' })
  ] });
  assert.equal(data.criteria.length, 2);
  assert.notEqual(data.criteria[0].scorecardId, data.criteria[1].scorecardId);
});

test('deduplicates repeated review IDs and duplicate criteria within one review', () => {
  const one = review('same', [['accuracy', 'Accuracy', 1], ['accuracy', 'Accuracy', 5]]);
  const data = buildQAQualityIntelligence({ reviews: [one, one] });
  assert.equal(data.reviewCount, 1);
  assert.equal(data.observationCount, 1);
  assert.equal(data.criteria[0].averageRating, 1);
});

test('flags score and criterion calibration spreads for discussion', () => {
  const data = buildQAQualityIntelligence({ calibrations: [
    { id: 'cal-1', interactionId: 'INT-1', scoreSpread: 12, requiresDiscussion: true, reviewers: ['A', 'B'], criterionComparisons: [{ label: 'Accuracy', spread: 2 }] },
    { id: 'cal-2', interactionId: 'INT-2', scoreSpread: 2, requiresDiscussion: false, criterionComparisons: [{ label: 'Opening', spread: 2 }] },
    { id: 'cal-3', interactionId: 'INT-3', scoreSpread: 1, requiresDiscussion: false, criterionComparisons: [{ label: 'Listening', spread: 1 }] }
  ] });
  assert.equal(data.calibrationCount, 3);
  assert.equal(data.discussionCount, 2);
  assert.equal(data.discussionSessions[0].id, 'cal-1');
});

test('summarises open and resolved QA disputes without mutation', () => {
  const disputes = [{ status: 'open' }, { status: 'upheld' }, { status: 'adjusted' }];
  const before = structuredClone(disputes);
  const data = buildQAQualityIntelligence({ disputes });
  assert.deepEqual(data.disputeSummary, { open: 1, upheld: 1, adjusted: 1, other: 0 });
  assert.deepEqual(disputes, before);
});

test('ignores malformed ratings and non-record entries', () => {
  const data = buildQAQualityIntelligence({
    reviews: [null, {}, review('ok', [['valid', 'Valid', 4], ['bad', 'Bad', 7], ['nan', 'NaN', 'x']])],
    calibrations: [null, { scoreSpread: 'not-a-number' }],
    disputes: [null, { status: 'unknown' }]
  });
  assert.equal(data.observationCount, 1);
  assert.equal(data.disputeSummary.other, 1);
});

test('renders an explicit early-sample warning and advisory boundary', () => {
  const html = renderQAQualityIntelligence({ reviews: [review('r1', [['accuracy', 'Accuracy', 2]])] });
  assert.match(html, /EARLY SIGNAL/);
  assert.match(html, /fewer than 3 observations/i);
  assert.match(html, /does not change QA scores/);
});

test('escapes dynamic criterion, scorecard and calibration labels', () => {
  const html = renderQAQualityIntelligence({
    reviews: [review('r1', [['<img>', '<script>alert(1)</script>', 2]], { scorecardId: '<card>' })],
    calibrations: [{ id: 'c', interactionId: '<svg>', reviewers: ['<img>'], scoreSpread: 15, requiresDiscussion: true }]
  });
  assert.doesNotMatch(html, /<script>alert/);
  assert.doesNotMatch(html, /<svg>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;svg&gt;/);
});

test('does not mutate input reviews or calibrations', () => {
  const reviews = [review('r1', [['accuracy', 'Accuracy', 2]])];
  const calibrations = [{ id: 'c1', scoreSpread: 10, requiresDiscussion: true, reviewers: ['A', 'B'] }];
  const beforeReviews = structuredClone(reviews);
  const beforeCalibrations = structuredClone(calibrations);
  buildQAQualityIntelligence({ reviews, calibrations });
  assert.deepEqual(reviews, beforeReviews);
  assert.deepEqual(calibrations, beforeCalibrations);
});

test('injects the QA intelligence module and panel into the supported main.js anchors', async () => {
  const fixture = await readFile(new URL('./fixtures/qa-workspace-before-v698.js', import.meta.url), 'utf8');
  const plugin = calloriaQAQualityIntelligencePluginV698();
  const warnings = [];
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, fixture, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.equal(warnings.length, 0);
  assert.match(result.code, /qa-quality-intelligence-v698\.js/);
  assert.match(result.code, /qa-quality-intelligence-v698\.css/);
  assert.match(result.code, /renderQAQualityIntelligence\(\{ reviews, calibrations, disputes \}\)/);
  assert.match(result.code, /\$\{qaQualityIntelligenceMarkup\}/);
});

test('is idempotent after one successful transform', async () => {
  const fixture = await readFile(new URL('./fixtures/qa-workspace-before-v698.js', import.meta.url), 'utf8');
  const plugin = calloriaQAQualityIntelligencePluginV698();
  const first = plugin.transform.call({ warn() {} }, fixture, '/repo/js/main.js');
  const second = plugin.transform.call({ warn() {} }, first.code, '/repo/js/main.js');
  assert.equal(second, null);
  assert.equal((first.code.match(/CALLORIA_V6_98_QA_QUALITY_INTELLIGENCE_PANEL/g) || []).length, 1);
});

test('skips mismatched source safely without failing Vite or applying partial edits', async () => {
  const fixture = await readFile(new URL('./fixtures/qa-workspace-before-v698.js', import.meta.url), 'utf8');
  const plugin = calloriaQAQualityIntelligencePluginV698();
  const warnings = [];
  const incomplete = fixture.replace('const calibratable =', 'const reviewerGroups =');
  const result = plugin.transform.call({ warn: message => warnings.push(message) }, incomplete, '/repo/js/main.js');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /skipped safely/);
  assert.doesNotMatch(incomplete, /qa-quality-intelligence-v698\.js/);
});

test('ignores all non-main.js modules', () => {
  const plugin = calloriaQAQualityIntelligencePluginV698();
  assert.equal(plugin.transform.call({ warn() {} }, 'export const x = 1;', '/repo/js/other.js'), null);
});
