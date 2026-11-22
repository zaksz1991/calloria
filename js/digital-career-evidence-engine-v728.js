/**
 * CALLORIA v7.28 — workforce career evidence bridge.
 *
 * Combines digital follow-up scorecards, completed coaching and sustainment
 * checkpoints into a human-review readiness dossier. It never promotes staff,
 * changes employment status, grants pay, or bypasses the annual promotion exam.
 */
export const DIGITAL_CAREER_EVIDENCE_VERSION = '7.28.0';

const MIN_COMPLETED_CYCLES = 10;
const MIN_RESPONSE_TARGET_RATE = 85;
const MAX_AT_RISK = 1;
const ACTIVE_PLAN_STATUSES = new Set(['open', 'in_progress']);
const POSITIVE_CHECKPOINTS = new Set(['target_maintained', 'target_reached', 'improved']);
const DECISIONS = Object.freeze({
  refer_to_formal_exam: 'Refer for formal promotion-exam eligibility review',
  defer: 'Defer and continue development',
  not_recommended: 'Not recommended at this review'
});

function safeText(value, fallback = '', max = 180) {
  const text = String(value ?? fallback).trim();
  return text.slice(0, max);
}

function finite(value, fallback = null) {
  if (value === null || value === undefined || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function validTime(value, fallback = Date.now()) {
  const parsed = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
}

function planFacts(plans, agentId) {
  const matching = (Array.isArray(plans) ? plans : []).filter(plan =>
    plan && safeText(plan.agentId) === agentId
  );
  const active = matching.filter(plan => ACTIVE_PLAN_STATUSES.has(String(plan.status ?? '').toLowerCase()));
  const completed = matching.filter(plan => String(plan.status ?? '').toLowerCase() === 'completed');
  const pendingOutcome = completed.filter(plan => !plan.outcomeReview || typeof plan.outcomeReview !== 'object');
  const reviewed = completed.filter(plan => plan.outcomeReview && typeof plan.outcomeReview === 'object');
  const checkpointRows = reviewed.flatMap(plan =>
    (Array.isArray(plan.followUpCheckpoints) ? plan.followUpCheckpoints : []).map(checkpoint => ({ plan, checkpoint }))
  );
  const regressions = checkpointRows.filter(row => row.checkpoint?.review?.status === 'regressed').length;
  const day30 = reviewed.map(plan => (Array.isArray(plan.followUpCheckpoints) ? plan.followUpCheckpoints : [])
    .find(checkpoint => checkpoint?.key === 'day_30') || null);
  const sustainmentPending = pendingOutcome.length + day30.filter(checkpoint => !checkpoint?.review).length;
  const sustainmentFailed = day30.filter(checkpoint => checkpoint?.review && !POSITIVE_CHECKPOINTS.has(String(checkpoint.review.status))).length;
  const outcomeConcerns = reviewed.filter(plan => !['achieved', 'improving'].includes(String(plan.outcomeReview.status))).length;
  const sustainmentPassed = reviewed.length === 0 || (
    pendingOutcome.length === 0 &&
    day30.length === reviewed.length &&
    day30.every(checkpoint => checkpoint?.review && POSITIVE_CHECKPOINTS.has(String(checkpoint.review.status)))
  );
  return {
    matching,
    activeCount: active.length,
    completedCount: completed.length,
    pendingOutcomeCount: pendingOutcome.length,
    reviewedCount: reviewed.length,
    checkpointCount: checkpointRows.length,
    day30Recorded: day30.filter(checkpoint => Boolean(checkpoint?.review)).length,
    sustainmentPending,
    sustainmentFailed,
    regressions,
    outcomeConcerns,
    sustainmentPassed
  };
}

function scoreReadiness({ completed, responseTargetRate, overdue, atRisk, activePlans, sustainmentPassed }) {
  const sample = completed >= MIN_COMPLETED_CYCLES ? 20 : Math.round(20 * completed / MIN_COMPLETED_CYCLES);
  const sla = responseTargetRate === null ? 0 : Math.min(35, Math.max(0, Math.round(35 * responseTargetRate / MIN_RESPONSE_TARGET_RATE)));
  const overduePoints = overdue === 0 ? 15 : 0;
  const riskPoints = atRisk !== null && atRisk <= MAX_AT_RISK ? 10 : 0;
  const coachingPoints = activePlans === 0 ? 10 : 0;
  const sustainmentPoints = sustainmentPassed ? 10 : 0;
  return Math.max(0, Math.min(100, sample + sla + overduePoints + riskPoints + coachingPoints + sustainmentPoints));
}

function readinessFor(agent, facts) {
  const completed = finite(agent.completed, 0);
  const responseTargetRate = finite(agent.responseTargetRate);
  const overdue = finite(agent.overdue, 0);
  const atRisk = finite(agent.atRisk, 0);
  const blocks = [];

  if (completed < MIN_COMPLETED_CYCLES) blocks.push(`At least ${MIN_COMPLETED_CYCLES} completed digital follow-up responses are required; ${completed} are recorded.`);
  if (responseTargetRate === null) blocks.push('Response-target evidence is not yet available.');
  else if (responseTargetRate < MIN_RESPONSE_TARGET_RATE) blocks.push(`Response-target rate is ${Math.round(responseTargetRate)}%; the review threshold is ${MIN_RESPONSE_TARGET_RATE}%.`);
  if (overdue > 0) blocks.push(`${overdue} overdue follow-up(s) remain open.`);
  if (atRisk > MAX_AT_RISK) blocks.push(`${atRisk} follow-up(s) remain at risk; the review threshold is ${MAX_AT_RISK}.`);
  if (facts.activeCount > 0) blocks.push(`${facts.activeCount} active coaching plan(s) must be completed first.`);
  if (facts.outcomeConcerns > 0) blocks.push(`${facts.outcomeConcerns} completed coaching outcome review(s) still need a positive development result.`);
  if (facts.regressions > 0) blocks.push(`${facts.regressions} sustainment checkpoint(s) record regression and require supervisor attention.`);
  if (facts.sustainmentPending > 0) blocks.push(`${facts.sustainmentPending} coaching outcome/checkpoint review(s) remain outstanding.`);
  if (facts.sustainmentFailed > 0) blocks.push(`${facts.sustainmentFailed} 30-day checkpoint(s) do not yet show a sustained positive result.`);

  let status = 'ready_for_review';
  if (completed < MIN_COMPLETED_CYCLES || responseTargetRate === null) status = 'insufficient_evidence';
  else if (facts.sustainmentPending > 0 && overdue === 0 && atRisk <= MAX_AT_RISK && responseTargetRate >= MIN_RESPONSE_TARGET_RATE && facts.activeCount === 0) status = 'sustainment_pending';
  else if (blocks.length) status = 'development_required';

  const labels = {
    insufficient_evidence: 'Insufficient evidence',
    development_required: 'Development action required',
    sustainment_pending: 'Coaching sustainment pending',
    ready_for_review: 'Eligible for human career review'
  };
  return { status, label: labels[status], blocks, score: scoreReadiness({ completed, responseTargetRate, overdue, atRisk, activePlans: facts.activeCount, sustainmentPassed: facts.sustainmentPassed }) };
}

/**
 * Create a career evidence board using only observed agent response activity and
 * explicit coaching records. This is a review signal, not a promotion decision.
 */
export function digitalCareerEvidenceBoard(performanceBoard, coachingPlans = [], packets = [], now = Date.now()) {
  const sourceAgents = Array.isArray(performanceBoard?.agents) ? performanceBoard.agents : [];
  const sourcePackets = Array.isArray(packets) ? packets : [];
  const nowMs = Math.max(0, validTime(now));
  const agents = sourceAgents
    .filter(agent => agent && typeof agent === 'object' && !['', 'UNASSIGNED', 'ALL_AGENTS'].includes(safeText(agent.agentId)))
    .map(agent => {
      const agentId = safeText(agent.agentId);
      const completed = Math.max(0, Math.floor(finite(agent.completed, 0)));
      const responseTargetRate = finite(agent.responseTargetRate);
      const overdue = Math.max(0, Math.floor(finite(agent.overdue, 0)));
      const atRisk = Math.max(0, Math.floor(finite(agent.atRisk, 0)));
      const facts = planFacts(coachingPlans, agentId);
      const readiness = readinessFor({ ...agent, completed, responseTargetRate, overdue, atRisk }, facts);
      const agentPackets = sourcePackets.filter(packet => packet && safeText(packet.agentId) === agentId)
        .sort((a, b) => validTime(b.createdAt, 0) - validTime(a.createdAt, 0));
      const latestPacket = agentPackets[0] || null;
      return {
        agentId,
        readinessStatus: readiness.status,
        readinessLabel: readiness.label,
        readinessScore: readiness.score,
        reviewReady: readiness.status === 'ready_for_review',
        blocks: readiness.blocks,
        completedCycles: completed,
        responseTargetRate,
        overdue,
        atRisk,
        late: Math.max(0, Math.floor(finite(agent.late, 0))),
        open: Math.max(0, Math.floor(finite(agent.open, 0))),
        coaching: facts,
        latestPacket,
        canPreparePacket: readiness.status === 'ready_for_review' && latestPacket?.status !== 'pending_review',
        evaluatedAt: new Date(nowMs).toISOString()
      };
    })
    .sort((a, b) => {
      const rank = { ready_for_review: 0, sustainment_pending: 1, development_required: 2, insufficient_evidence: 3 };
      return rank[a.readinessStatus] - rank[b.readinessStatus]
        || b.readinessScore - a.readinessScore
        || a.agentId.localeCompare(b.agentId);
    });

  return {
    version: DIGITAL_CAREER_EVIDENCE_VERSION,
    totalAgents: agents.length,
    readyForReview: agents.filter(agent => agent.readinessStatus === 'ready_for_review').length,
    developmentRequired: agents.filter(agent => agent.readinessStatus === 'development_required').length,
    sustainmentPending: agents.filter(agent => agent.readinessStatus === 'sustainment_pending').length,
    insufficientEvidence: agents.filter(agent => agent.readinessStatus === 'insufficient_evidence').length,
    pendingPackets: sourcePackets.filter(packet => packet?.status === 'pending_review').length,
    decisions: {
      referred: sourcePackets.filter(packet => packet?.status === 'referred_to_exam_review').length,
      deferred: sourcePackets.filter(packet => packet?.status === 'deferred').length,
      notRecommended: sourcePackets.filter(packet => packet?.status === 'not_recommended').length
    },
    agents
  };
}

/** Save a read-only evidence snapshot for one eligible agent. */
export function createDigitalCareerReviewPacket(packets, evidence, options = {}) {
  const rows = Array.isArray(packets) ? packets : [];
  if (!evidence || evidence.readinessStatus !== 'ready_for_review' || !evidence.agentId) return rows.slice();
  if (rows.some(packet => packet && safeText(packet.agentId) === safeText(evidence.agentId) && packet.status === 'pending_review')) return rows.slice();
  const nowMs = Math.max(0, validTime(options.now));
  const packet = {
    id: safeText(options.id, `CAREER-REVIEW-${nowMs}-${safeText(evidence.agentId, '', 60)}`, 180),
    agentId: safeText(evidence.agentId),
    status: 'pending_review',
    createdAt: new Date(nowMs).toISOString(),
    createdBy: safeText(options.createdBy, 'SUPERVISOR', 80),
    evidenceSnapshot: {
      readinessScore: finite(evidence.readinessScore, 0),
      completedCycles: Math.max(0, Math.floor(finite(evidence.completedCycles, 0))),
      responseTargetRate: finite(evidence.responseTargetRate),
      overdue: Math.max(0, Math.floor(finite(evidence.overdue, 0))),
      atRisk: Math.max(0, Math.floor(finite(evidence.atRisk, 0))),
      coachingPlansCompleted: Math.max(0, Math.floor(finite(evidence.coaching?.completedCount, 0))),
      day30SustainmentRecorded: Math.max(0, Math.floor(finite(evidence.coaching?.day30Recorded, 0))),
      regressionCount: Math.max(0, Math.floor(finite(evidence.coaching?.regressions, 0)))
    },
    review: null
  };
  return [...rows, packet];
}

/**
 * Record one supervisor decision against the captured evidence. A referral only
 * permits the separate existing promotion eligibility and exam workflow.
 */
export function reviewDigitalCareerReviewPacket(packets, packetId, input = {}, options = {}) {
  const rows = Array.isArray(packets) ? packets : [];
  const id = safeText(packetId);
  const index = rows.findIndex(packet => packet && safeText(packet.id) === id && packet.status === 'pending_review');
  if (index < 0) throw new Error('A pending career review packet was not found.');
  const decision = String(input.decision ?? '').trim();
  if (!Object.hasOwn(DECISIONS, decision)) throw new Error('Select a valid supervisor career-review decision.');
  const reviewer = safeText(input.reviewer, '', 80);
  if (reviewer.length < 2) throw new Error('Enter the reviewing supervisor name.');
  const reason = safeText(input.reason, '', 500);
  if (reason.length < 20) throw new Error('Record at least 20 characters of evidence-based review notes.');
  const nowMs = Math.max(0, validTime(options.now));
  const next = rows.slice();
  next[index] = {
    ...rows[index],
    status: decision === 'refer_to_formal_exam' ? 'referred_to_exam_review' : decision === 'defer' ? 'deferred' : 'not_recommended',
    review: {
      decision,
      label: DECISIONS[decision],
      reviewer,
      reason,
      reviewedAt: new Date(nowMs).toISOString(),
      boundary: decision === 'refer_to_formal_exam'
        ? 'Referral only. The existing formal promotion eligibility rules, annual examination process and three-attempt limit remain mandatory.'
        : 'This decision does not change employment status, salary, role or promotion attempts.'
    }
  };
  return next;
}
