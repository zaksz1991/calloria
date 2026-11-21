const cleanText = value => String(value ?? '').trim();
const finiteNumber = value => Number.isFinite(Number(value)) ? Number(value) : null;

export function buildQAQualityIntelligence({ reviews = [], calibrations = [], disputes = [] } = {}) {
  const reviewRows = Array.isArray(reviews) ? reviews : [];
  const calibrationRows = Array.isArray(calibrations) ? calibrations : [];
  const disputeRows = Array.isArray(disputes) ? disputes : [];
  const seenReviewIds = new Set();
  const criteria = new Map();
  let validReviewCount = 0;
  let observationCount = 0;

  for (const review of reviewRows) {
    if (!review || typeof review !== 'object') continue;
    const reviewId = cleanText(review.id);
    if (!reviewId || seenReviewIds.has(reviewId)) continue;
    seenReviewIds.add(reviewId);
    validReviewCount += 1;

    const scorecardId = cleanText(review.scorecardId) || 'unknown-scorecard';
    const seenCriteria = new Set();
    for (const item of Array.isArray(review.criteria) ? review.criteria : []) {
      const criterionId = cleanText(item?.criterionId);
      const rating = finiteNumber(item?.rating);
      if (!criterionId || !Number.isInteger(rating) || rating < 0 || rating > 5 || seenCriteria.has(criterionId)) continue;
      seenCriteria.add(criterionId);
      const key = `${scorecardId}::${criterionId}`;
      if (!criteria.has(key)) {
        criteria.set(key, {
          key,
          scorecardId,
          criterionId,
          label: cleanText(item?.label) || criterionId,
          observations: 0,
          totalRating: 0,
          lowRatings: 0
        });
      }
      const aggregate = criteria.get(key);
      aggregate.observations += 1;
      aggregate.totalRating += rating;
      if (rating <= 3) aggregate.lowRatings += 1;
      observationCount += 1;
    }
  }

  const criterionInsights = [...criteria.values()].map(item => {
    const averageRating = item.observations ? item.totalRating / item.observations : 0;
    const lowRatingRate = item.observations ? item.lowRatings / item.observations : 0;
    let signal = 'steady';
    if (item.observations < 3) signal = 'early_signal';
    else if (averageRating <= 3 || lowRatingRate >= 0.5) signal = 'priority';
    else if (averageRating <= 3.5 || lowRatingRate >= 0.35) signal = 'watch';
    return {
      ...item,
      averageRating: Math.round(averageRating * 100) / 100,
      lowRatingRate: Math.round(lowRatingRate * 1000) / 10,
      signal
    };
  }).sort((a, b) => {
    const order = { priority: 0, watch: 1, early_signal: 2, steady: 3 };
    return order[a.signal] - order[b.signal] || a.averageRating - b.averageRating || b.observations - a.observations;
  });

  const calibrationInsights = calibrationRows.filter(item => item && typeof item === 'object').map(item => {
    const scoreSpread = finiteNumber(item.scoreSpread) ?? 0;
    const criterionExceptions = (Array.isArray(item.criterionComparisons) ? item.criterionComparisons : [])
      .filter(row => row && (finiteNumber(row.spread) ?? 0) >= 2)
      .map(row => ({ label: cleanText(row.label) || cleanText(row.criterionId) || 'Criterion', spread: finiteNumber(row.spread) ?? 0 }));
    const requiresDiscussion = item.requiresDiscussion === true || scoreSpread >= 10 || criterionExceptions.length > 0;
    return {
      id: cleanText(item.id),
      interactionId: cleanText(item.interactionId) || 'Interaction not recorded',
      reviewers: (Array.isArray(item.reviewers) ? item.reviewers : []).map(cleanText).filter(Boolean).slice(0, 8),
      facilitator: cleanText(item.facilitator),
      scoreSpread,
      criterionExceptions,
      requiresDiscussion,
      createdAt: cleanText(item.createdAt)
    };
  });
  const discussionSessions = calibrationInsights.filter(item => item.requiresDiscussion)
    .sort((a, b) => b.scoreSpread - a.scoreSpread)
    .slice(0, 6);

  const validDisputes = disputeRows.filter(item => item && typeof item === 'object');
  const disputeSummary = {
    open: validDisputes.filter(item => item.status === 'open').length,
    upheld: validDisputes.filter(item => item.status === 'upheld').length,
    adjusted: validDisputes.filter(item => item.status === 'adjusted').length,
    other: validDisputes.filter(item => !['open', 'upheld', 'adjusted'].includes(item.status)).length
  };

  return {
    reviewCount: validReviewCount,
    observationCount,
    criteria: criterionInsights,
    priorityCriteria: criterionInsights.filter(item => item.signal === 'priority').length,
    watchCriteria: criterionInsights.filter(item => item.signal === 'watch').length,
    earlySignalCriteria: criterionInsights.filter(item => item.signal === 'early_signal').length,
    calibrationCount: calibrationInsights.length,
    discussionCount: calibrationInsights.filter(item => item.requiresDiscussion).length,
    discussionSessions,
    disputeSummary
  };
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function signalLabel(signal) {
  return ({ priority: 'PRIORITY COACHING', watch: 'WATCH', early_signal: 'EARLY SIGNAL', steady: 'STEADY' })[signal] || 'UNCLASSIFIED';
}

export function renderQAQualityIntelligence({ reviews = [], calibrations = [], disputes = [] } = {}) {
  const data = buildQAQualityIntelligence({ reviews, calibrations, disputes });
  const metric = (label, value, note, tone = '') => `<div class="qaqi-metric ${tone}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong><small>${escapeHTML(note)}</small></div>`;
  const criterionMarkup = data.criteria.slice(0, 6).map(item => {
    const width = Math.max(0, Math.min(100, item.lowRatingRate));
    const tone = item.signal === 'priority' ? 'priority' : item.signal === 'watch' ? 'watch' : item.signal === 'early_signal' ? 'early' : 'steady';
    const sampleNote = item.observations < 3 ? 'Fewer than 3 observations; treat as an early signal.' : `${item.lowRatings} of ${item.observations} ratings were 3/5 or below.`;
    return `<article class="qaqi-criterion-row"><div class="qaqi-criterion-head"><div><strong>${escapeHTML(item.label)}</strong><small>${escapeHTML(item.scorecardId)} · ${item.observations} observations</small></div><span class="qaqi-signal ${tone}">${signalLabel(item.signal)}</span></div><div class="qaqi-criterion-stats"><b>${item.averageRating.toFixed(2)}/5 average</b><span>${item.lowRatingRate.toFixed(1)}% rated 3/5 or below</span></div><div class="qaqi-track" role="meter" aria-label="Low rating rate for ${escapeHTML(item.label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(width)}"><span style="width:${width}%"></span></div><small class="qaqi-sample-note">${escapeHTML(sampleNote)}</small></article>`;
  }).join('') || '<div class="qaqi-empty">No valid human QA criterion observations are available yet.</div>';

  const calibrationMarkup = data.discussionSessions.map(item => {
    const reviewerLine = item.reviewers.length ? item.reviewers.join(' · ') : 'Reviewer names unavailable';
    const exceptions = item.criterionExceptions.length
      ? `<ul>${item.criterionExceptions.slice(0, 4).map(row => `<li>${escapeHTML(row.label)} · ${row.spread} rating-point spread</li>`).join('')}</ul>`
      : '<small>No criterion-level spread details were retained.</small>';
    return `<article class="qaqi-calibration-row"><div><strong>${escapeHTML(item.interactionId)}</strong><small>${escapeHTML(reviewerLine)}</small></div><span class="qaqi-spread">${item.scoreSpread} pts</span>${exceptions}</article>`;
  }).join('') || '<div class="qaqi-empty">No calibration session currently requires discussion.</div>';

  const hasAnyData = data.reviewCount || data.calibrationCount || data.disputeSummary.open || data.disputeSummary.upheld || data.disputeSummary.adjusted;
  return `<section class="panel qaqi-panel" aria-labelledby="qaqi-title">
    <div class="panel-head"><div><h3 id="qaqi-title">QA consistency &amp; coaching intelligence</h3><p>Recurring evidence themes, reviewer calibration exceptions and dispute outcomes.</p></div><span class="pill ${data.discussionCount || data.priorityCriteria ? 'amber' : 'green'}">${data.discussionCount || data.priorityCriteria ? 'ATTENTION' : 'MONITORING'}</span></div>
    <div class="qaqi-metrics">
      ${metric('HUMAN REVIEWS', data.reviewCount, `${data.observationCount} valid criterion observations`)}
      ${metric('PRIORITY COACHING THEMES', data.priorityCriteria, 'At least 3 observations and repeated low ratings', data.priorityCriteria ? 'alert' : '')}
      ${metric('CALIBRATIONS TO DISCUSS', data.discussionCount, `${data.calibrationCount} total comparison sessions`, data.discussionCount ? 'alert' : '')}
      ${metric('OPEN QA DISPUTES', data.disputeSummary.open, `${data.disputeSummary.adjusted} adjusted · ${data.disputeSummary.upheld} upheld`, data.disputeSummary.open ? 'alert' : '')}
    </div>
    <div class="qaqi-content-grid">
      <section class="qaqi-subpanel"><div class="qaqi-subhead"><h4>Recurring coaching themes</h4><span>${data.criteria.length} tracked</span></div>${criterionMarkup}</section>
      <section class="qaqi-subpanel"><div class="qaqi-subhead"><h4>Calibration exceptions</h4><span>${data.discussionCount} need discussion</span></div>${calibrationMarkup}<div class="qaqi-dispute-summary"><strong>Dispute outcomes</strong><div><span>Open <b>${data.disputeSummary.open}</b></span><span>Upheld <b>${data.disputeSummary.upheld}</b></span><span>Adjusted <b>${data.disputeSummary.adjusted}</b></span></div></div></section>
    </div>
    ${hasAnyData ? '' : '<p class="qaqi-empty qaqi-empty-wide">This report will populate as human QA reviews, calibration sessions and disputes are recorded.</p>'}
    <p class="qaqi-boundary">Interpretation rule: fewer than 3 observations are labelled early signals, not established patterns. This report is advisory only; it does not change QA scores, coaching records, employee status, salary or promotion eligibility.</p>
  </section>`;
}
