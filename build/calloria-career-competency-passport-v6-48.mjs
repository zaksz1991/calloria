/**
 * CALLORIA v6.48 — Career Competency Passport.
 * Carries evidence-linked human QA coaching outcomes into the employee career
 * profile. Guided practice is displayed as practice activity only; it never
 * becomes verified competence or modifies promotion, salary, XP or KPIs.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_CAREER_COMPETENCY_PASSPORT_V648__';
const PREREQUISITE = '__CALLORIA_GUIDED_COACHING_PRACTICE_V647__';
const RENDER_ANCHOR = 'function renderCareer() {';
const CAREER_END_ANCHOR = 'data-action="reset-simulation">Reset local simulation data</button></section></div>';

const COMPETENCY_GROUPS = Object.freeze([
  { id: 'security', label: 'Security & privacy', description: 'Authentication boundaries, customer confidentiality, credential handling and safe escalation.', patterns: /compliance|credential|security|privacy|otp|pin|password|authentication|sensitive data/i },
  { id: 'communication', label: 'Customer communication', description: 'Empathy, listening, clear explanations and respectful customer handling.', patterns: /empathy|listening|listen|communication|customer tone|acknowledg|interpersonal/i },
  { id: 'ownership', label: 'Ownership & resolution', description: 'Case ownership, investigation, complaints, follow-up and accurate expectation setting.', patterns: /ownership|follow.?up|resolution|complaint|investigat|case handling|escalation/i },
  { id: 'crm', label: 'CRM & documentation', description: 'Factual notes, interaction logging, case records and traceable next steps.', patterns: /crm|documentation|logging|record keeping|case note|interaction record|ticket/i },
  { id: 'knowledge', label: 'Product & policy knowledge', description: 'Approved knowledge sources, product accuracy, policy compliance and avoiding unsupported promises.', patterns: /accuracy|knowledge|product|policy|procedure|information quality/i },
  { id: 'sales', label: 'Ethical sales & cross-selling', description: 'Customer-led recommendations, consent, suitability and respecting refusal.', patterns: /sales|cross.?sell|offer|conversion|retention|campaign/i },
  { id: 'service', label: 'Service quality foundations', description: 'General service standards and other human-reviewed customer-care behaviours.', patterns: /.*/ }
]);

export function calloriaCompetencyBucketV648(record = {}) {
  const criterion = String(record.criterionId || '').toLowerCase();
  const text = [record.topic, record.feedback, record.actionPlan].map(value => String(value || '')).join(' ').toLowerCase();
  const matches = value => {
    for (const group of COMPETENCY_GROUPS.slice(0, -1)) {
      const pattern = group.patterns instanceof RegExp ? group.patterns : new RegExp(String(group.patterns || ''), 'i');
      if (pattern.test(value)) return group.id;
    }
    return '';
  };
  return matches(criterion) || matches(text) || 'service';
}

export function calloriaBuildCompetencyPassportV648(records = []) {
  const sourceRecords = Array.isArray(records)
    ? records.filter(item => item && item.source === 'qa-human-review-v646')
    : [];
  return COMPETENCY_GROUPS.map(group => {
    const plans = sourceRecords.filter(item => calloriaCompetencyBucketV648(item) === group.id);
    const verifiedPlans = plans.filter(item => item.status === 'verified' && item.followUp?.outcome === 'improved');
    const activePlans = plans.filter(item => ['action_plan_open', 'reopened', 'delivered'].includes(item.status));
    const practiceAttempts = plans.reduce((sum, item) => sum + (Array.isArray(item.practiceAttempts) ? item.practiceAttempts.length : 0), 0);
    const archivedOrReview = Math.max(0, plans.length - verifiedPlans.length - activePlans.length);
    const percent = plans.length ? Math.round((verifiedPlans.length / plans.length) * 100) : 0;
    const status = !plans.length ? 'NOT YET EVIDENCED'
      : activePlans.length ? (verifiedPlans.length ? 'PARTIALLY VERIFIED' : 'IN DEVELOPMENT')
      : verifiedPlans.length ? 'VERIFIED'
      : 'REVIEW REQUIRED';
    const latest = plans.slice().sort((a, b) => {
      const date = item => Date.parse(item?.followUp?.recordedAt || item?.deliveredAt || item?.recordedAt || item?.createdAt || 0) || 0;
      return date(b) - date(a);
    })[0] || null;
    return {
      id: group.id, label: group.label, description: group.description,
      plans: plans.length, verified: verifiedPlans.length, active: activePlans.length,
      practiceAttempts, archivedOrReview, percent, status, latest
    };
  });
}

const SERIAL_COMPETENCY_GROUPS = COMPETENCY_GROUPS.map(group => ({ ...group, patterns: group.patterns.source }));
const HELPER_SOURCE = `
const COMPETENCY_GROUPS = ${JSON.stringify(SERIAL_COMPETENCY_GROUPS)};
${calloriaCompetencyBucketV648.toString()}
${calloriaBuildCompetencyPassportV648.toString()}
function calloriaEnsureCareerCompetencyStylesV648(){
  if(document.getElementById('calloriaCareerCompetencyStylesV648'))return;
  const style=document.createElement('style');style.id='calloriaCareerCompetencyStylesV648';
  style.textContent='.calloria-career-competency{margin-top:14px}.calloria-career-competency-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.calloria-career-competency-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.calloria-career-competency-summary>div{padding:10px;border-radius:9px;background:rgba(148,163,184,.07)}.calloria-career-competency-summary strong{display:block;font-size:20px}.calloria-career-competency-summary small{font-size:10px;color:var(--muted,#94a3b8)}.calloria-career-competency-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.calloria-career-competency-card{min-width:0;padding:12px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(148,163,184,.045)}.calloria-career-competency-card header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.calloria-career-competency-card header strong{font-size:13px}.calloria-career-competency-card p{font-size:11px;color:var(--muted,#94a3b8);margin:7px 0}.calloria-career-competency-track{height:6px;border-radius:99px;background:rgba(148,163,184,.18);overflow:hidden}.calloria-career-competency-track span{display:block;height:100%;background:var(--success,#22c55e);border-radius:99px}.calloria-career-competency-stats{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;font-size:10px;color:var(--muted,#94a3b8)}.calloria-career-competency-evidence{margin-top:8px;padding-top:7px;border-top:1px solid rgba(148,163,184,.15);font-size:10px;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-career-competency-note{margin-top:11px;font-size:11px;color:var(--muted,#94a3b8)}@media(max-width:640px){.calloria-career-competency-summary{grid-template-columns:1fr 1fr}.calloria-career-competency-grid{grid-template-columns:1fr}.calloria-career-competency-head{flex-direction:column}}';
  document.head.append(style);
}
function calloriaRenderCareerCompetencyPassportV648(){
  calloriaEnsureCareerCompetencyStylesV648();
  const records=typeof calloriaEnsureQACoachingStateV646==='function'?calloriaEnsureQACoachingStateV646().filter(item=>item?.source==='qa-human-review-v646'):[];
  const model=calloriaBuildCompetencyPassportV648(records);
  const totalVerified=model.reduce((sum,item)=>sum+item.verified,0);
  const totalActive=model.reduce((sum,item)=>sum+item.active,0);
  const totalPractice=model.reduce((sum,item)=>sum+item.practiceAttempts,0);
  const cards=model.map(item=>{
    const pill=item.status==='VERIFIED'?'green':item.status==='NOT YET EVIDENCED'?'':'amber';
    const latest=item.latest;
    const evidence=latest?'<div class="calloria-career-competency-evidence">Latest review: '+escapeHTML(latest.sourceReviewId||'—')+' · Interaction: '+escapeHTML(latest.sourceInteractionId||'—')+(latest.followUp?.reviewer?' · Reviewer: '+escapeHTML(latest.followUp.reviewer):'')+(latest.followUp?.recordedAt?' · '+escapeHTML(new Date(latest.followUp.recordedAt).toLocaleDateString()):'')+'</div>':'';
    return '<article class="calloria-career-competency-card"><header><strong>'+escapeHTML(item.label)+'</strong><span class="pill '+pill+'">'+escapeHTML(item.status)+'</span></header><p>'+escapeHTML(item.description)+'</p><div class="calloria-career-competency-track"><span style="width:'+item.percent+'%"></span></div><div class="calloria-career-competency-stats"><span>'+item.verified+' verified</span><span>'+item.active+' active</span><span>'+item.practiceAttempts+' practice attempts</span></div>'+evidence+'</article>';
  }).join('');
  return '<section class="panel calloria-career-competency"><div class="calloria-career-competency-head"><div><span class="subtle-label">EVIDENCE-BASED DEVELOPMENT</span><h3>Career competency passport</h3><p class="muted-note">Human-reviewed QA coaching evidence, carried into your career profile.</p></div><span class="pill '+(totalVerified?'green':'')+'">'+totalVerified+' VERIFIED ACTIONS</span></div><div class="calloria-career-competency-summary"><div><strong>'+totalVerified+'</strong><small>Supervisor-verified actions</small></div><div><strong>'+totalActive+'</strong><small>Open or delivered plans</small></div><div><strong>'+totalPractice+'</strong><small>Guided practice attempts</small></div></div><div class="calloria-career-competency-grid">'+cards+'</div><p class="calloria-career-competency-note">Only a documented human follow-up marked “Improvement demonstrated” counts as verified. Guided practice is shown separately and does not count as a qualification. This passport does not change XP, salary, performance KPIs or promotion eligibility; the existing promotion policy and annual examination remain in force.</p></section>';
}
`;

function count(source, anchor) { return source.split(anchor).length - 1; }
function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.48 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;
  if (!original.includes(PREREQUISITE)) {
    context.warn('CALLORIA v6.48 skipped safely: v6.47 guided coaching practice is missing. Install the cumulative v6.48 overlay with its required chain.');
    return null;
  }
  const anchors = [
    [RENDER_ANCHOR, 'career profile renderer'],
    [CAREER_END_ANCHOR, 'career profile insertion point'],
    ['function calloriaEnsureQACoachingStateV646(){', 'human-QA coaching state helper']
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.48 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }
  let code = original;
  code = replaceOnce(context, code, RENDER_ANCHOR, `${HELPER_SOURCE}\n${RENDER_ANCHOR}`, 'career helper insertion');
  if (code === null) return null;
  code = replaceOnce(context, code, CAREER_END_ANCHOR,
    'data-action="reset-simulation">Reset local simulation data</button></section>${calloriaRenderCareerCompetencyPassportV648()}</div>',
    'career profile insertion point');
  if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaCareerCompetencyPassportPlugin() {
  return {
    name: 'calloria-career-competency-passport-v6-48',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __calloriaV648Test = {
  transformMain,
  classify: calloriaCompetencyBucketV648,
  buildPassport: calloriaBuildCompetencyPassportV648,
  MARKER,
  PREREQUISITE
};
