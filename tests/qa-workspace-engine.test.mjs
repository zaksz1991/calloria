import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_QA_SCORECARD, createScorecard, validateScorecard, createHumanQAReview,
  createQADispute, resolveQADispute, createCalibrationSession, humanQAMetrics
} from '../js/qa-workspace-engine.js';

const interaction = {
  id: 'CIL-TEST-01', issueId: 'failed-transfer', personaId: 'calm', channel: 'Voice', criticalBreaches: [],
  transcript: [
    { speaker: 'agent', text: 'Good morning. I understand your concern and I will review the transfer reference.', at: '2026-11-07T08:00:00.000Z' },
    { speaker: 'customer', text: 'The transfer was made yesterday and has not arrived.', at: '2026-11-07T08:00:10.000Z' },
    { speaker: 'agent', text: 'What date and time did you make the transfer? I will open a traceable case and explain the next step.', at: '2026-11-07T08:00:20.000Z' }
  ]
};
const ratings = DEFAULT_QA_SCORECARD.criteria.map(item => ({ criterionId: item.id, rating: 4 }));
const evidence = DEFAULT_QA_SCORECARD.criteria.map((item, index) => ({ criterionId: item.id, quote: index % 2 ? 'I will open a traceable case' : 'I understand your concern' }));
function reviewFor(reviewer, score = 4) {
  return createHumanQAReview({ interaction, scorecard: DEFAULT_QA_SCORECARD, reviewer, ratings: ratings.map(item => ({ ...item, rating: score })), evidence, notes: 'Reviewed the complete synthetic interaction transcript.' });
}

test('default scorecard has valid 100-point weights', () => {
  const result = validateScorecard(DEFAULT_QA_SCORECARD);
  assert.equal(result.criteria.reduce((sum, item) => sum + item.weight, 0), 100);
});

test('custom scorecards require unique criteria and weights totalling 100', () => {
  const list = [];
  const created = createScorecard(list, { name: 'Digital service standard', criteria: [
    { id: 'ack', label: 'Acknowledgement', weight: 40 },
    { id: 'privacy', label: 'Privacy', weight: 30 },
    { id: 'resolution', label: 'Resolution', weight: 30 }
  ] });
  assert.equal(created.version, 1);
  assert.throws(() => validateScorecard({ name: 'Bad weights', criteria: [{ id: 'a1', label: 'A', weight: 20 }, { id: 'b1', label: 'B', weight: 20 }, { id: 'c1', label: 'C', weight: 20 }] }), /total exactly 100/);
});

test('human review calculates weighted score and stores transcript-linked evidence', () => {
  const review = reviewFor('QA Reviewer');
  assert.equal(review.score, 80);
  assert.equal(review.status, 'pass');
  assert.equal(review.criteria.length, 6);
  assert.equal(review.criteria[0].evidence.transcriptIndex, 0);
});

test('human review rejects evidence not found in the saved transcript', () => {
  assert.throws(() => createHumanQAReview({ interaction, scorecard: DEFAULT_QA_SCORECARD, reviewer: 'QA Reviewer', ratings, evidence: evidence.map((item, index) => index ? item : { ...item, quote: 'fabricated evidence not in call' }) }), /must match the saved interaction transcript/);
});

test('human review rejects missing criterion ratings and evidence', () => {
  assert.throws(() => createHumanQAReview({ interaction, scorecard: DEFAULT_QA_SCORECARD, reviewer: 'QA Reviewer', ratings: ratings.slice(1), evidence }), /Select a rating/);
  assert.throws(() => createHumanQAReview({ interaction, scorecard: DEFAULT_QA_SCORECARD, reviewer: 'QA Reviewer', ratings, evidence: evidence.slice(1) }), /Evidence is required/);
});

test('critical customer practice breaches remain mandatory review regardless of human score', () => {
  const review = createHumanQAReview({ interaction: { ...interaction, criticalBreaches: ['credential_solicitation'] }, scorecard: DEFAULT_QA_SCORECARD, reviewer: 'QA Reviewer', ratings: ratings.map(item => ({ ...item, rating: 5 })), evidence });
  assert.equal(review.score, 100);
  assert.equal(review.status, 'mandatory_review');
});

test('dispute creation requires a substantive reason and prevents duplicate open disputes', () => {
  const review = reviewFor('Reviewer A');
  const disputes = [];
  const dispute = createQADispute(disputes, review, { raisedBy: 'Agent One', reason: 'The reviewer overlooked the exact customer confirmation in the second transcript entry.' });
  assert.equal(dispute.status, 'open');
  assert.throws(() => resolveQADispute(dispute, { reviewer: 'QA Lead', decision: 'adjusted', adjustedScore: null, resolution: 'The score should be changed after a second evidence review.' }), /required for an adjusted decision/);
  assert.throws(() => createQADispute(disputes, review, { raisedBy: 'Agent One', reason: 'I disagree with the score and want it reviewed again.' }), /already exists/);
});

test('dispute resolution supports upheld and adjusted decisions with audit detail', () => {
  const review = reviewFor('Reviewer A');
  const dispute = createQADispute([], review, { raisedBy: 'Agent One', reason: 'The evidence was interpreted without considering the complete response context.' });
  resolveQADispute(dispute, { reviewer: 'QA Lead', decision: 'adjusted', adjustedScore: 88, resolution: 'The evidence supports the disputed criterion; score adjusted after second review.' });
  assert.equal(dispute.status, 'adjusted');
  assert.equal(dispute.resolution.adjustedScore, 88);
  assert.throws(() => resolveQADispute(dispute, { reviewer: 'QA Lead', decision: 'upheld', resolution: 'This dispute has already been resolved by the QA lead.' }), /Only an open/);
});

test('calibration compares reviewers using the same interaction and scorecard', () => {
  const a = reviewFor('Reviewer A', 5);
  const b = reviewFor('Reviewer B', 3);
  const session = createCalibrationSession([a, b], { facilitator: 'QA Manager', notes: 'Discuss interpretation of ownership and next-step evidence.' });
  assert.equal(session.scoreSpread, 40);
  assert.equal(session.requiresDiscussion, true);
  assert.throws(() => createCalibrationSession([a, { ...b, interactionId: 'OTHER' }], { facilitator: 'QA Manager' }), /same interaction/);
});

test('human QA metrics count reviews, average, disputes and calibration sessions', () => {
  const result = humanQAMetrics([reviewFor('Reviewer A', 4), reviewFor('Reviewer B', 3)], [{ status: 'open' }, { status: 'upheld' }], [{}]);
  assert.equal(result.reviews, 2);
  assert.equal(result.averageScore, 70);
  assert.equal(result.openDisputes, 1);
  assert.equal(result.calibrations, 1);
});
