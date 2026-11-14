/**
 * CALLORIA v6.49 — Promotion Readiness Dossier.
 * Mirrors the current Workforce promotion KPI snapshot and eligibility policy
 * inside the Career profile. It explains gaps and exam limits; it never awards
 * a promotion, records an examination, or changes employment data.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_PROMOTION_READINESS_DOSSIER_V649__';
const PREREQUISITE = '__CALLORIA_CAREER_COMPETENCY_PASSPORT_V648__';
const CAREER_RENDER_ANCHOR = 'function renderCareer() {';
const CAREER_INSERTION_ANCHOR = 'calloriaRenderCareerCompetencyPassportV648()}</div>';

const METRIC_GUIDANCE_V649 = Object.freeze({
  kpi: {
    label: 'Operational productivity',
    action: 'Complete customer contacts accurately, follow the correct disposition and use available queue time effectively.'
  },
  qa: {
    label: 'Quality assurance',
    action: 'Review human QA feedback, complete open coaching actions and demonstrate the corrected behaviour in a follow-up review.'
  },
  csat: {
    label: 'Customer satisfaction',
    action: 'Acknowledge the customer’s concern, explain the next step clearly and confirm the outcome before closing the interaction.'
  },
  knowledge: {
    label: 'Product and process knowledge',
    action: 'Study the approved knowledge base and use current product, service and policy information during customer contacts.'
  },
  compliance: {
    label: 'Security and compliance',
    action: 'Follow identity-verification boundaries, never request customer secrets and use the approved escalation route.'
  },
  leadership: {
    label: 'Leadership and reliability',
    action: 'Attend scheduled briefings, follow shift and break controls, and demonstrate reliable support for the team.'
  }
});

const PROMOTION_WEIGHTS_V649 = Object.freeze({
  kpi: 30,
  qa: 20,
  csat: 15,
  knowledge: 15,
  compliance: 10,
  leadership: 10
});

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

/** Pure counterpart of the Workforce screen's current metric calculation. */
export function calloriaBuildPromotionReadinessV649(input = {}) {
  const state = input.state && typeof input.state === 'object' ? input.state : {};
  const attempts = Array.isArray(state.promotionAttempts) ? state.promotionAttempts.filter(Boolean) : [];
  const policyThreshold = finiteNumber(input.minimumScore, 75);
  const minimumScore = Math.max(0, Math.min(100, policyThreshold));
  const yearValue = Number(input.year);
  const year = Number.isFinite(yearValue) ? Math.trunc(yearValue) : new Date().getFullYear();

  // These formulas intentionally match renderWorkforce() in js/main.js.
  const callsHandled = Math.max(0, finiteNumber(state.callsHandled));
  const outboundCalls = Math.max(0, finiteNumber(state.outboundCalls));
  const qaCount = Math.max(0, finiteNumber(state.qaCount));
  const csatCount = Math.max(0, finiteNumber(state.csatCount));
  const incidents = Math.max(0, finiteNumber(state.incidents));
  const experience = Math.max(0, finiteNumber(state.experience));
  const level = Math.max(0, finiteNumber(state.level, 1));
  const totalQA = finiteNumber(state.totalQA);
  const totalCSAT = finiteNumber(state.totalCSAT);

  const metrics = {
    kpi: Math.min(100, Math.round((callsHandled + outboundCalls) * 5)),
    qa: qaCount ? Math.round(totalQA / qaCount) : 75,
    csat: csatCount ? Math.round(totalCSAT / csatCount) : 75,
    knowledge: Math.min(100, 70 + experience),
    compliance: incidents ? Math.max(0, 100 - incidents * 12) : 95,
    leadership: Math.min(100, 60 + Math.floor(level * 5))
  };

  const scoreTotal = Object.entries(PROMOTION_WEIGHTS_V649).reduce((sum, [key, weight]) => {
    const value = Math.max(0, Math.min(100, Number(metrics[key] ?? 0)));
    return sum + value * weight / 100;
  }, 0);
  const score = Math.round(scoreTotal * 10) / 10;
  const attemptsThisYear = attempts.filter(item => Number(item.year) === year).length;
  const totalAttempts = attempts.length;
  const attemptsRemaining = Math.max(0, 3 - totalAttempts);
  const eligible = totalAttempts < 3 && attemptsThisYear < 1 && score >= minimumScore;

  let status = 'DEVELOPMENT REQUIRED';
  let reason = `Your weighted promotion score is ${score.toFixed(1)}%, below the organisation threshold of ${minimumScore}%.`;
  if (totalAttempts >= 3) {
    status = 'ATTEMPTS EXHAUSTED';
    reason = 'All three permitted career examination attempts have been used.';
  } else if (attemptsThisYear >= 1) {
    status = 'NEXT ANNUAL CYCLE';
    reason = `An examination attempt is already recorded for ${year}. The next attempt can only be considered in a later annual cycle.`;
  } else if (eligible) {
    status = 'ELIGIBLE FOR ANNUAL EXAM';
    reason = `Your weighted score meets the ${minimumScore}% organisation threshold. You may sit the annual examination through Workforce.`;
  }

  const priorities = Object.entries(metrics)
    .map(([key, value]) => ({ key, value, ...METRIC_GUIDANCE_V649[key] }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  const orderedAttempts = attempts.slice().sort((a, b) => {
    const time = item => Date.parse(item?.recordedAt || '') || Number(item?.year || 0) * 1000;
    return time(b) - time(a);
  });

  return {
    year,
    metrics,
    weights: { ...PROMOTION_WEIGHTS_V649 },
    score,
    minimumScore,
    eligible,
    status,
    reason,
    attemptsThisYear,
    totalAttempts,
    attemptsRemaining,
    examPassMark: 70,
    latestAttempt: orderedAttempts[0] || null,
    attemptHistory: orderedAttempts,
    priorities
  };
}

const HELPER_SOURCE = `
${finiteNumber.toString()}
const METRIC_GUIDANCE_V649 = ${JSON.stringify(METRIC_GUIDANCE_V649)};
const PROMOTION_WEIGHTS_V649 = ${JSON.stringify(PROMOTION_WEIGHTS_V649)};
${calloriaBuildPromotionReadinessV649.toString()}
function calloriaEnsurePromotionReadinessStylesV649(){
  if(document.getElementById('calloriaPromotionReadinessStylesV649'))return;
  const style=document.createElement('style');style.id='calloriaPromotionReadinessStylesV649';
  style.textContent='.calloria-promotion-dossier{margin-top:14px}.calloria-promotion-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}.calloria-promotion-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:12px 0}.calloria-promotion-summary>div{padding:11px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.055)}.calloria-promotion-summary strong{display:block;font-size:21px}.calloria-promotion-summary small{font-size:10px;color:var(--muted,#94a3b8)}.calloria-promotion-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.calloria-promotion-metric{min-width:0}.calloria-promotion-metric .data-row{font-size:12px}.calloria-promotion-track{height:7px;border-radius:99px;background:rgba(148,163,184,.18);overflow:hidden}.calloria-promotion-track span{display:block;height:100%;border-radius:99px;background:var(--success,#22c55e)}.calloria-promotion-priorities{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:12px}.calloria-promotion-priority{padding:11px;border:1px solid rgba(148,163,184,.18);border-radius:10px;background:rgba(148,163,184,.045);min-width:0}.calloria-promotion-priority strong{display:block;font-size:12px}.calloria-promotion-priority p{font-size:11px;color:var(--muted,#94a3b8);line-height:1.45;margin:7px 0 0}.calloria-promotion-reason{padding:12px;border-radius:10px;background:rgba(148,163,184,.07);font-size:12px;line-height:1.5;margin:12px 0}.calloria-promotion-history{margin-top:12px}.calloria-promotion-history .data-row{gap:8px;flex-wrap:wrap;font-size:11px}.calloria-promotion-note{margin-top:12px;font-size:11px;color:var(--muted,#94a3b8);line-height:1.5}@media(max-width:640px){.calloria-promotion-summary{grid-template-columns:1fr 1fr}.calloria-promotion-metrics{grid-template-columns:1fr}.calloria-promotion-priorities{grid-template-columns:1fr}.calloria-promotion-head{flex-direction:column}}';
  document.head.append(style);
}
function calloriaRenderPromotionReadinessV649(){
  calloriaEnsurePromotionReadinessStylesV649();
  const policy=typeof getActiveOrganization==='function'?getActiveOrganization(state.organizationWorkspace)?.policy:null;
  const model=calloriaBuildPromotionReadinessV649({state,minimumScore:policy?.promotionThreshold??75});
  const metricCards=Object.entries(model.metrics).map(([key,value])=>{
    const label=METRIC_GUIDANCE_V649[key]?.label||key.toUpperCase();
    return '<div class="calloria-promotion-metric"><div class="data-row"><span>'+escapeHTML(label)+'</span><strong>'+value+'/100</strong></div><div class="calloria-promotion-track"><span style="width:'+Math.max(0,Math.min(100,value))+'%"></span></div><small class="muted-note">Weight '+model.weights[key]+'%</small></div>';
  }).join('');
  const priorityCards=model.priorities.map((item,index)=>'<article class="calloria-promotion-priority"><span class="subtle-label">PRIORITY '+(index+1)+' · '+item.value+'/100</span><strong>'+escapeHTML(item.label)+'</strong><p>'+escapeHTML(item.action)+'</p></article>').join('');
  const history=model.attemptHistory.slice(0,4).map(item=>'<div class="data-row"><span>'+escapeHTML(String(item.year||'—'))+' · '+escapeHTML(String(item.examScore??'—'))+'% exam</span><strong>'+escapeHTML(String(item.status||'recorded').replaceAll('_',' ').toUpperCase())+'</strong></div>').join('')||'<p class="muted-note">No annual promotion examination attempts recorded.</p>';
  const latest=model.latestAttempt?'<div class="muted-note">Latest attempt: '+escapeHTML(String(model.latestAttempt.year||'—'))+' · '+escapeHTML(String(model.latestAttempt.examScore??'—'))+'% · '+escapeHTML(String(model.latestAttempt.status||'recorded').replaceAll('_',' '))+'</div>':'';
  const pill=model.eligible?'green':'amber';
  return '<section class="panel calloria-promotion-dossier"><div class="calloria-promotion-head"><div><span class="subtle-label">CAREER DEVELOPMENT · '+model.year+'</span><h3>Promotion readiness dossier</h3><p class="muted-note">A live summary of the same KPI formula, threshold and annual examination limits used by Workforce.</p></div><span class="pill '+pill+'">'+escapeHTML(model.status)+'</span></div><div class="calloria-promotion-summary"><div><strong>'+model.score.toFixed(1)+'%</strong><small>Weighted promotion score</small></div><div><strong>'+model.minimumScore+'%</strong><small>Organisation threshold</small></div><div><strong>'+model.attemptsRemaining+'/3</strong><small>Examination attempts remaining</small></div></div><div class="calloria-promotion-reason">'+escapeHTML(model.reason)+'</div><h4>Current promotion dimensions</h4><div class="calloria-promotion-metrics">'+metricCards+'</div><h4 style="margin-top:18px">Development priorities</h4><p class="muted-note">These are the three lowest current dimensions. They are coaching priorities, not separate pass/fail gates.</p><div class="calloria-promotion-priorities">'+priorityCards+'</div><div class="calloria-promotion-history"><h4>Annual examination history</h4>'+history+latest+'</div><p class="calloria-promotion-note">One examination attempt is permitted per calendar year, up to three total attempts. The examination pass mark remains 70%. Human-reviewed coaching evidence is shown separately in the Career competency passport; it does not alter the official KPI formula or automatically grant a promotion. Submit an examination through Workforce when eligible.</p></section>';
}
`;

function count(source, anchor) {
  return source.split(anchor).length - 1;
}

function replaceOnce(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.49 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;
  if (!original.includes(PREREQUISITE)) {
    context.warn('CALLORIA v6.49 skipped safely: v6.48 Career competency passport is missing. Install the cumulative v6.49 overlay.');
    return null;
  }
  const anchors = [
    [CAREER_RENDER_ANCHOR, 'Career renderer'],
    [CAREER_INSERTION_ANCHOR, 'v6.48 Career profile insertion point']
  ];
  const missing = anchors.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.49 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match. No partial transform was applied.`);
    return null;
  }

  let code = original;
  code = replaceOnce(context, code, CAREER_RENDER_ANCHOR, `${HELPER_SOURCE}\n${CAREER_RENDER_ANCHOR}`, 'promotion dossier helper insertion');
  if (code === null) return null;
  code = replaceOnce(context, code, CAREER_INSERTION_ANCHOR,
    'calloriaRenderCareerCompetencyPassportV648()}${calloriaRenderPromotionReadinessV649()}</div>',
    'Career profile panel insertion');
  if (code === null) return null;
  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaPromotionReadinessDossierPlugin() {
  return {
    name: 'calloria-promotion-readiness-dossier-v6-49',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __calloriaV649Test = {
  transformMain,
  buildReadiness: calloriaBuildPromotionReadinessV649,
  weights: PROMOTION_WEIGHTS_V649,
  guidance: METRIC_GUIDANCE_V649,
  MARKER,
  PREREQUISITE,
  CAREER_INSERTION_ANCHOR
};
