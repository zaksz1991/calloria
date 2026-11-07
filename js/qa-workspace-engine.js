/**
 * CALLORIA Human QA Workspace Engine.
 * Deterministic manual reviews, evidence-linked coaching, calibration and disputes.
 * Records are synthetic training data; this module does not confer real staff permissions.
 */

export const DEFAULT_QA_SCORECARD = Object.freeze({
  id: 'qa-standard-v1',
  name: 'Customer interaction standard',
  version: 1,
  active: true,
  criteria: Object.freeze([
    Object.freeze({ id: 'opening', label: 'Opening and identity-safe introduction', weight: 10, guidance: 'Professional opening; no unnecessary personal data.' }),
    Object.freeze({ id: 'listening', label: 'Listening and acknowledgement', weight: 15, guidance: 'Recognises the customer concern and responds to the actual issue.' }),
    Object.freeze({ id: 'probing', label: 'Focused probing and verification', weight: 15, guidance: 'Asks relevant questions and follows approved authentication boundaries.' }),
    Object.freeze({ id: 'accuracy', label: 'Accuracy and policy alignment', weight: 20, guidance: 'Provides accurate information and avoids unsupported guarantees.' }),
    Object.freeze({ id: 'ownership', label: 'Ownership and resolution action', weight: 20, guidance: 'Takes responsibility and records a traceable action.' }),
    Object.freeze({ id: 'closing', label: 'Expectation setting and closing', weight: 20, guidance: 'Explains the next step, timeframe and contact route.' })
  ])
});

const clone = value => JSON.parse(JSON.stringify(value));
const clean = value => String(value ?? '').trim();

export function validateScorecard({ name, criteria } = {}) {
  const title = clean(name);
  if (title.length < 3 || title.length > 80) throw new RangeError('Scorecard name must contain 3 to 80 characters.');
  if (!Array.isArray(criteria) || criteria.length < 3 || criteria.length > 12) throw new RangeError('A scorecard must contain 3 to 12 criteria.');
  const ids = new Set();
  const normalised = criteria.map((item, index) => {
    const label = clean(item?.label);
    const id = clean(item?.id) || `criterion-${index + 1}`;
    const weight = Number(item?.weight);
    if (!label || label.length > 100) throw new TypeError(`Criterion ${index + 1} needs a label of 1 to 100 characters.`);
    if (!/^[a-z0-9][a-z0-9_-]{1,39}$/i.test(id) || ids.has(id)) throw new TypeError(`Criterion ${index + 1} has an invalid or duplicate identifier.`);
    if (!Number.isInteger(weight) || weight < 1 || weight > 100) throw new RangeError(`Criterion ${label} must have an integer weight from 1 to 100.`);
    ids.add(id);
    return { id, label, weight, guidance: clean(item?.guidance).slice(0, 240) };
  });
  const total = normalised.reduce((sum, item) => sum + item.weight, 0);
  if (total !== 100) throw new RangeError(`Scorecard weights must total exactly 100. Current total: ${total}.`);
  return { name: title, criteria: normalised };
}

export function createScorecard(existing = [], input = {}) {
  if (!Array.isArray(existing)) throw new TypeError('Existing scorecards must be an array.');
  const valid = validateScorecard(input);
  const baseName = valid.name.toLowerCase();
  if (existing.some(item => item.name.toLowerCase() === baseName && item.active !== false)) throw new Error('An active scorecard with this name already exists.');
  const sameName = existing.filter(item => item.name.toLowerCase() === baseName);
  const version = sameName.reduce((max, item) => Math.max(max, Number(item.version) || 0), 0) + 1;
  const record = { id: `QSC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`, ...valid, version, active: true, createdAt: new Date().toISOString() };
  existing.forEach(item => { if (item.name.toLowerCase() === baseName) item.active = false; });
  existing.push(record);
  return record;
}

function transcriptText(transcript) {
  if (!Array.isArray(transcript)) return [];
  return transcript.map((line, index) => ({
    index,
    speaker: clean(line?.speaker || 'unknown'),
    text: clean(line?.text),
    at: line?.at || null
  })).filter(line => line.text);
}

export function createHumanQAReview({ interaction, scorecard, ratings, evidence, reviewer, notes = '', coachingAction = '' } = {}) {
  if (!interaction?.id) throw new TypeError('A completed interaction is required.');
  if (!scorecard?.id || !Array.isArray(scorecard.criteria)) throw new TypeError('A valid scorecard is required.');
  const reviewerName = clean(reviewer);
  if (reviewerName.length < 2 || reviewerName.length > 80) throw new RangeError('Reviewer name must contain 2 to 80 characters.');
  const lines = transcriptText(interaction.transcript);
  if (!lines.length) throw new Error('This interaction has no reviewable transcript evidence.');
  if (!Array.isArray(ratings) || !Array.isArray(evidence)) throw new TypeError('Ratings and evidence are required.');
  const ratingMap = new Map(ratings.map(item => [item.criterionId, Number(item.rating)]));
  const evidenceMap = new Map(evidence.map(item => [item.criterionId, item]));
  const results = scorecard.criteria.map(criterion => {
    const rating = ratingMap.get(criterion.id);
    if (!Number.isInteger(rating) || rating < 0 || rating > 5) throw new RangeError(`Select a rating from 0 to 5 for ${criterion.label}.`);
    const proof = evidenceMap.get(criterion.id);
    const quote = clean(proof?.quote);
    if (!quote || quote.length < 5) throw new Error(`Evidence is required for ${criterion.label}.`);
    const matchedLine = lines.find(line => line.text.toLocaleLowerCase().includes(quote.toLocaleLowerCase()));
    if (!matchedLine) throw new Error(`Evidence for ${criterion.label} must match the saved interaction transcript.`);
    return { criterionId: criterion.id, label: criterion.label, weight: criterion.weight, rating, weightedPoints: Math.round(criterion.weight * rating / 5 * 100) / 100, evidence: { quote, transcriptIndex: matchedLine.index, speaker: matchedLine.speaker, at: matchedLine.at } };
  });
  const score = Math.round(results.reduce((sum, item) => sum + item.weightedPoints, 0));
  const criticalBreaches = Array.isArray(interaction.criticalBreaches) ? [...new Set(interaction.criticalBreaches)] : [];
  const status = criticalBreaches.length ? 'mandatory_review' : score >= 80 ? 'pass' : score >= 60 ? 'coaching' : 'fail';
  const lowRatings = results.filter(item => item.rating <= 3);
  const review = {
    id: `HQA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    interactionId: interaction.id,
    issueId: interaction.issueId || '',
    personaId: interaction.personaId || '',
    channel: interaction.channel || 'Unknown',
    reviewer: reviewerName,
    scorecardId: scorecard.id,
    scorecardName: scorecard.name,
    scorecardVersion: scorecard.version || 1,
    criteria: results,
    score,
    status,
    criticalBreaches,
    notes: clean(notes).slice(0, 2000),
    coaching: lowRatings.map(item => ({ criterionId: item.criterionId, criterion: item.label, rating: item.rating, evidence: item.evidence.quote, action: clean(coachingAction).slice(0, 500) || `Review the evidence and practise ${item.label.toLowerCase()} using the approved procedure.` })),
    createdAt: new Date().toISOString(),
    disputeIds: []
  };
  return review;
}

export function createQADispute(disputes = [], review, { raisedBy, reason } = {}) {
  if (!Array.isArray(disputes)) throw new TypeError('Disputes must be an array.');
  if (!review?.id) throw new TypeError('A completed human QA review is required.');
  if (disputes.some(item => item.reviewId === review.id && item.status === 'open')) throw new Error('An open dispute already exists for this review.');
  const raiser = clean(raisedBy);
  const explanation = clean(reason);
  if (raiser.length < 2) throw new RangeError('Enter the name of the person raising the dispute.');
  if (explanation.length < 20 || explanation.length > 2000) throw new RangeError('Dispute reason must contain 20 to 2,000 characters.');
  const item = { id: `QDP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`, reviewId: review.id, interactionId: review.interactionId, raisedBy: raiser, reason: explanation, status: 'open', createdAt: new Date().toISOString(), resolution: null };
  disputes.push(item);
  review.disputeIds = Array.isArray(review.disputeIds) ? review.disputeIds : [];
  review.disputeIds.push(item.id);
  return item;
}

export function resolveQADispute(dispute, { reviewer, decision, resolution, adjustedScore = null } = {}) {
  if (!dispute || dispute.status !== 'open') throw new Error('Only an open QA dispute can be resolved.');
  const resolver = clean(reviewer);
  const explanation = clean(resolution);
  if (resolver.length < 2) throw new RangeError('Enter the resolving reviewer name.');
  if (!['upheld', 'adjusted'].includes(decision)) throw new TypeError('Decision must be upheld or adjusted.');
  if (explanation.length < 20 || explanation.length > 2000) throw new RangeError('Resolution must contain 20 to 2,000 characters.');
  let score = null;
  if (decision === 'adjusted') {
    if (adjustedScore === null || adjustedScore === undefined || adjustedScore === '') throw new RangeError('An adjusted score from 0 to 100 is required for an adjusted decision.');
    score = Number(adjustedScore);
    if (!Number.isInteger(score) || score < 0 || score > 100) throw new RangeError('Adjusted score must be an integer from 0 to 100.');
  }
  dispute.status = decision;
  dispute.resolution = { reviewer: resolver, decision, explanation, adjustedScore: score, resolvedAt: new Date().toISOString() };
  return dispute;
}

export function createCalibrationSession(reviews = [], { facilitator, notes = '' } = {}) {
  const eligible = Array.isArray(reviews) ? reviews : [];
  if (eligible.length < 2) throw new RangeError('At least two reviews are required for calibration.');
  const [first, ...rest] = eligible;
  if (rest.some(item => item.interactionId !== first.interactionId || item.scorecardId !== first.scorecardId)) throw new Error('Calibration reviews must use the same interaction and scorecard.');
  const facilitatorName = clean(facilitator);
  if (facilitatorName.length < 2) throw new RangeError('Enter the calibration facilitator name.');
  const criterionComparisons = first.criteria.map(base => {
    const values = eligible.map(review => review.criteria.find(item => item.criterionId === base.criterionId)?.rating).filter(Number.isInteger);
    if (values.length !== eligible.length) throw new Error(`All reviewers must score ${base.label}.`);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return { criterionId: base.criterionId, label: base.label, ratings: values, spread: Math.max(...values) - Math.min(...values), mean: Math.round(mean * 100) / 100 };
  });
  const scores = eligible.map(item => item.score);
  return {
    id: `QCA-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
    interactionId: first.interactionId, scorecardId: first.scorecardId,
    reviewers: eligible.map(item => item.reviewer), reviewIds: eligible.map(item => item.id),
    scoreSpread: Math.max(...scores) - Math.min(...scores), criterionComparisons,
    requiresDiscussion: criterionComparisons.some(item => item.spread >= 2) || Math.max(...scores) - Math.min(...scores) >= 10,
    facilitator: facilitatorName, notes: clean(notes).slice(0, 2000), createdAt: new Date().toISOString()
  };
}

export function humanQAMetrics(reviews = [], disputes = [], calibrations = []) {
  const rows = Array.isArray(reviews) ? reviews : [];
  const scores = rows.map(item => Number(item.score)).filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
  return {
    reviews: rows.length,
    averageScore: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
    openDisputes: (Array.isArray(disputes) ? disputes : []).filter(item => item.status === 'open').length,
    calibrations: Array.isArray(calibrations) ? calibrations.length : 0,
    mandatoryReviews: rows.filter(item => item.status === 'mandatory_review').length
  };
}

export function createDefaultScorecard() { return clone(DEFAULT_QA_SCORECARD); }
