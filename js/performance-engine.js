/**
 * CALLORIA performance and career rules. Pure functions; no DOM, network or storage.
 * All metric scores are normalised 0–100 against an approved role-specific target.
 * Faster handling alone is deliberately a small, quality-gated component.
 */
export const PERFORMANCE_PROFILES = Object.freeze({
  voice_agent: {
    label: 'Voice customer-care agent',
    metrics: [
      ['quality', 'Quality assurance', 25, 80],
      ['compliance', 'Security and policy compliance', 20, 85],
      ['csat', 'Customer satisfaction', 15, 70],
      ['fcr', 'First-contact resolution', 10, null],
      ['adherence', 'Schedule adherence', 10, null],
      ['aht_balance', 'Average handling time target balance (quality-gated)', 5, null],
      ['acw_handling', 'After-contact work completion and accuracy', 5, null],
      ['escalation_management', 'Correct escalation and handover', 5, null],
      ['documentation', 'Disposition and documentation', 5, null]
    ]
  },
  email_agent: {
    label: 'Email and written-support agent',
    metrics: [
      ['quality', 'Response quality and accuracy', 25, 80],
      ['compliance', 'Privacy and policy compliance', 20, 85],
      ['csat', 'Customer satisfaction', 15, 70],
      ['resolution', 'Correct resolution rate', 15, null],
      ['sla', 'Response SLA attainment', 10, null],
      ['adherence', 'Schedule adherence', 10, null],
      ['documentation', 'Case notes and handover quality', 5, null]
    ]
  },
  social_agent: {
    label: 'Social-media and community-support agent',
    metrics: [
      ['quality', 'Response quality and brand accuracy', 20, 80],
      ['compliance', 'Privacy, consent and policy compliance', 20, 85],
      ['csat', 'Customer satisfaction', 15, 70],
      ['resolution', 'Correct resolution rate', 15, null],
      ['sla', 'Response SLA attainment', 10, null],
      ['tone', 'Empathy and brand tone', 10, null],
      ['adherence', 'Schedule adherence', 10, null]
    ]
  },
  sales_advisor: {
    label: 'Sales and service adviser',
    metrics: [
      ['suitability', 'Product suitability and customer need', 20, 85],
      ['compliance', 'Consent and sales compliance', 25, 90],
      ['quality', 'Advice and explanation quality', 15, 80],
      ['csat', 'Customer satisfaction', 15, 70],
      ['conversion', 'Appropriate conversion outcomes', 10, null],
      ['followup', 'Follow-up reliability', 10, null],
      ['adherence', 'Schedule adherence', 5, null]
    ]
  },
  technical_support: {
    label: 'Technical support and IT agent',
    metrics: [
      ['resolution_quality', 'Technical resolution quality', 25, 80],
      ['compliance', 'Security and access-control compliance', 20, 90],
      ['csat', 'Customer satisfaction', 15, 70],
      ['sla', 'Resolution SLA attainment', 15, null],
      ['fcr', 'First-contact resolution', 10, null],
      ['documentation', 'Technical notes and knowledge sharing', 10, null],
      ['adherence', 'Schedule adherence', 5, null]
    ]
  },
  qa_analyst: {
    label: 'Quality assurance analyst',
    metrics: [
      ['calibration', 'Evaluation calibration accuracy', 25, 85],
      ['coverage', 'Risk-based review coverage', 15, null],
      ['coaching', 'Actionable coaching quality', 15, null],
      ['compliance', 'Evaluation and data-handling compliance', 20, 90],
      ['turnaround', 'Review turnaround attainment', 10, null],
      ['consistency', 'Scoring consistency', 15, 85]
    ]
  },
  supervisor: {
    label: 'Customer operations supervisor',
    metrics: [
      ['team_quality', 'Team quality assurance', 20, 80],
      ['team_compliance', 'Team compliance and safeguarding', 20, 90],
      ['team_csat', 'Team customer satisfaction', 10, 70],
      ['coaching', 'Coaching completion and effectiveness', 15, null],
      ['escalation', 'Escalation and complaint control', 10, null],
      ['development', 'Staff development and fair reviews', 10, null],
      ['adherence', 'Team schedule adherence', 5, null],
      ['reporting', 'Accurate operational reporting', 10, null]
    ]
  },
  safeguarding: {
    label: 'Safeguarding and trained human support',
    metrics: [
      ['protocol', 'Safeguarding protocol compliance', 30, 95],
      ['privacy', 'Privacy and confidentiality', 20, 95],
      ['handover', 'Qualified-human handover quality', 20, 90],
      ['documentation', 'Factual and minimal documentation', 15, 90],
      ['timeliness', 'Appropriate response timeliness', 10, null],
      ['training', 'Required training currency', 5, 100]
    ]
  },
  learning_advisor: {
    label: 'Learning and career-development adviser',
    metrics: [
      ['accuracy', 'Course and programme information accuracy', 25, 90],
      ['compliance', 'Privacy and learner-protection compliance', 20, 90],
      ['learner_outcome', 'Learner support outcomes', 15, null],
      ['csat', 'Learner satisfaction', 15, 70],
      ['followup', 'Follow-up and referral reliability', 15, null],
      ['documentation', 'CRM documentation quality', 10, null]
    ]
  },
  back_office: {
    label: 'Back-office and case-resolution specialist',
    metrics: [
      ['accuracy', 'Processing accuracy', 25, 90],
      ['compliance', 'Data protection and policy compliance', 25, 90],
      ['resolution', 'Correct completion rate', 15, null],
      ['sla', 'Service-level attainment', 10, null],
      ['handover', 'Handover quality', 10, null],
      ['documentation', 'Record quality', 10, null],
      ['adherence', 'Schedule adherence', 5, null]
    ]
  }
});

export const QA_RUBRIC = Object.freeze([
  { id: 'privacy', label: 'Privacy, identity and authorised account handling', weight: 20, gate: 85 },
  { id: 'accuracy', label: 'Accuracy, product knowledge and policy', weight: 20, gate: 85 },
  { id: 'needs', label: 'Listening and understanding the customer need', weight: 15 },
  { id: 'resolution', label: 'Resolution, ownership and next steps', weight: 15 },
  { id: 'empathy', label: 'Empathy, clarity and respectful language', weight: 10 },
  { id: 'suitability', label: 'Suitability, consent and fair treatment', weight: 10, gate: 85 },
  { id: 'records', label: 'Accurate records and safe closure', weight: 10 }
]);

export const CAREER_LADDERS = Object.freeze({
  voice_agent: ['customer_service_agent','senior_voice_agent','customer_care_specialist','customer_operations_supervisor'],
  email_agent: ['email_support_agent','senior_email_agent','customer_experience_specialist','customer_operations_supervisor'],
  social_agent: ['social_support_agent','senior_social_agent','community_support_lead','customer_operations_supervisor'],
  sales_advisor: ['sales_service_advisor','senior_sales_advisor','sales_team_lead','sales_operations_manager'],
  technical_support: ['technical_support_agent','senior_technical_support','technical_support_lead','it_operations_manager'],
  qa_analyst: ['qa_analyst','senior_qa_analyst','qa_team_lead','quality_manager'],
  supervisor: ['customer_operations_supervisor','senior_supervisor','operations_manager','head_of_customer_operations'],
  safeguarding: ['safeguarding_advisor','senior_safeguarding_specialist','safeguarding_lead'],
  learning_advisor: ['learning_advisor','senior_learning_advisor','learning_team_lead'],
  back_office: ['case_resolution_specialist','senior_case_specialist','case_resolution_lead','back_office_manager']
});
export const CAREER_PATHWAYS = Object.freeze(Object.fromEntries(Object.entries(CAREER_LADDERS).map(([profile, ladder]) => [profile, ladder.slice(1)])));

export function nextCareerTarget(profileId, currentTitle = '') {
  const ladder = CAREER_LADDERS[profileId] || [];
  const current = currentTitle || ladder[0] || '';
  const index = ladder.indexOf(current);
  return index >= 0 ? ladder[index + 1] || null : null;
}

export function cleanPerformanceText(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function scoreValue(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) throw new RangeError(`${label} must be between 0 and 100.`);
  return Math.round(number * 10) / 10;
}

export function evaluateScorecard(profileId, values = {}, { criticalFail = false } = {}) {
  const profile = PERFORMANCE_PROFILES[profileId];
  if (!profile) throw new TypeError('Select a supported job performance profile.');
  const missing = [];
  const normalized = {};
  let weighted = 0;
  let weightTotal = 0;
  const failedGates = [];

  for (const [id, label, weight, gate] of profile.metrics) {
    const item = values[id];
    if (!item || item.score === '' || item.score === null || item.score === undefined || item.sampleCount === '' || item.sampleCount === undefined || !cleanPerformanceText(item.source, 160)) {
      missing.push(id); continue;
    }
    const score = scoreValue(item.score, label);
    const sampleCount = Number(item.sampleCount);
    if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 1000000) throw new RangeError(`${label}: enter a valid sample count of at least one.`);
    normalized[id] = { score, sampleCount, source: cleanPerformanceText(item.source, 160) };
    weighted += score * weight;
    weightTotal += weight;
    if (gate !== null && score < gate) failedGates.push({ id, label, minimum: gate, actual: score });
  }

  const complete = missing.length === 0 && weightTotal === 100;
  const score = complete ? Math.round(weighted / 100 * 10) / 10 : null;
  const gatePass = complete && !criticalFail && failedGates.length === 0;
  const rating = score === null ? 'incomplete' : score >= 90 ? 'exceptional' : score >= 80 ? 'strong' : score >= 70 ? 'developing' : score >= 60 ? 'below_expectation' : 'improvement_required';
  return { profileId, complete, missing, values: normalized, score, rating, criticalFail: Boolean(criticalFail), failedGates, gatePass, promotionReady: complete && gatePass && score >= 80 };
}

export function evaluateQaReview(values = {}, { criticalFail = false } = {}) {
  const missing = [];
  const normalized = {};
  let weighted = 0;
  const failedGates = [];
  for (const item of QA_RUBRIC) {
    const raw = values[item.id];
    if (raw === '' || raw === null || raw === undefined) { missing.push(item.id); continue; }
    const score = scoreValue(raw, item.label);
    normalized[item.id] = score;
    weighted += score * item.weight;
    if (item.gate !== undefined && score < item.gate) failedGates.push({ id: item.id, minimum: item.gate, actual: score });
  }
  const complete = missing.length === 0;
  const score = complete ? Math.round(weighted / 100 * 10) / 10 : null;
  const passed = complete && !criticalFail && failedGates.length === 0 && score >= 80;
  return { complete, missing, values: normalized, score, criticalFail: Boolean(criticalFail), failedGates, passed, result: !complete ? 'incomplete' : passed ? 'pass' : 'fail' };
}

export function promotionEligibility(scorecards = [], { requiredReviews = 3, minimumAverage = 80 } = {}) {
  const reviewed = (Array.isArray(scorecards) ? scorecards : [])
    .filter(item => item.status === 'reviewed' && Number.isFinite(Number(item.score)))
    .sort((a, b) => String(b.period_start).localeCompare(String(a.period_start)))
    .slice(0, 6);
  const recent = reviewed.slice(0, requiredReviews);
  const average = recent.length ? Math.round(recent.reduce((sum, item) => sum + Number(item.score), 0) / recent.length * 10) / 10 : null;
  const gatesClear = recent.length === requiredReviews && recent.every(item => item.gate_pass === true && item.critical_fail !== true && Number(item.score) >= 80);
  return {
    eligible: recent.length === requiredReviews && gatesClear && average >= minimumAverage,
    reviewedPeriods: recent.length,
    requiredReviews,
    average,
    gatesClear,
    reason: recent.length < requiredReviews ? `Requires ${requiredReviews} reviewed monthly scorecards; ${recent.length} available.` : !gatesClear ? 'One or more recent scorecards do not meet the quality, compliance or critical-incident gates.' : average < minimumAverage ? `Recent average must be at least ${minimumAverage}.` : 'KPI prerequisites met. Promotion still requires a passed exam and management approval.'
  };
}

export function validatePromotionTarget(currentProfile, targetRole, currentTitle = '') {
  const target = cleanPerformanceText(targetRole, 64);
  const next = nextCareerTarget(currentProfile, currentTitle);
  if (!next || target !== next) throw new Error('That role is not the next approved step in this career pathway.');
  return target;
}

export function scoreExam(questionIds = [], answerMap = {}, answerKey = {}) {
  if (!Array.isArray(questionIds) || questionIds.length < 8 || questionIds.length > 20) throw new TypeError('Exam question set is invalid.');
  let correct = 0;
  let answered = 0;
  for (const id of questionIds) {
    const answer = answerMap[id];
    if (typeof answer === 'string' && answer.length) answered += 1;
    if (answer === answerKey[id]) correct += 1;
  }
  const score = Math.round(correct / questionIds.length * 1000) / 10;
  return { score, correct, total: questionIds.length, answered, passed: score >= 80 };
}
