/** CALLORIA v7.25 — evidence-led digital follow-up coaching workflow. */
const V724_MARKER = '/* CALLORIA_V724_DIGITAL_FOLLOWUP_PERFORMANCE */';
const V725_MARKER = '/* CALLORIA_V725_DIGITAL_FOLLOWUP_COACHING */';
const PERFORMANCE_IMPORT = "import { digitalFollowUpPerformanceBoard, digitalFollowUpPerformanceDisplay } from './digital-followup-performance-engine-v724.js';";
const PERFORMANCE_PANEL_CALL = '  const digitalFollowUpPerformancePanel = renderDigitalFollowUpPerformancePanelV724(state.digitalQueue, nowVoice);';
const PERFORMANCE_TEMPLATE_ANCHOR = '    ${digitalFollowUpPerformancePanel}';
const ACTION_ANCHOR = "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;";
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function panelFunctionSource() {
  return [
    V725_MARKER,
    'function renderDigitalFollowUpCoachingPanelV725(queue, plans, now) {',
    '  const performance = digitalFollowUpPerformanceBoard(queue, now);',
    '  const board = digitalFollowUpCoachingBoard(performance, plans, Date.now());',
    '  const recommendations = board.recommendations.slice(0, 6).map(item => {',
    "    const badge = item.priority === 'high' ? 'red' : 'amber';",
    '    return `<article class="digital-followup-coaching-card"><div class="digital-followup-coaching-card-head"><div><strong>${escapeHTML(item.agentId)}</strong><small>${escapeHTML(item.focusLabel)}</small></div><span class="pill ${badge}">${escapeHTML(item.priority.toUpperCase())}</span></div><p>${escapeHTML(item.objective)}</p><small>Evidence: ${item.baseline.overdue} overdue · ${item.baseline.atRisk} at risk · ${item.baseline.completed} completed · ${item.baseline.responseTargetRate === null ? \'no completed rate\' : `${Math.round(item.baseline.responseTargetRate)}% on target`}</small><p class="digital-followup-coaching-practice">Practice: ${escapeHTML(item.practice)}</p><button type="button" class="btn small secondary" data-action="create-digital-followup-coaching" data-agent-id="${escapeHTML(item.agentId)}">Create coaching plan</button></article>`;',
    '  }).join(\'\');',
    '  const plansHtml = board.activePlans.slice(0, 8).map(plan => {',
    "    const statusLabel = plan.status === 'in_progress' ? 'IN PROGRESS' : 'OPEN';",
    "    const due = plan.dueAt ? new Date(plan.dueAt).toLocaleDateString() : 'Not set';",
    "    const action = plan.status === 'open' ? `<button type=\"button\" class=\"btn small outline\" data-action=\"start-digital-followup-coaching\" data-plan-id=\"${escapeHTML(plan.id)}\">Start coaching</button>` : `<button type=\"button\" class=\"btn small secondary\" data-action=\"complete-digital-followup-coaching\" data-plan-id=\"${escapeHTML(plan.id)}\">Mark completed</button>`;",
    '    return `<article class="digital-followup-plan-row"><div><strong>${escapeHTML(plan.agentId)} · ${escapeHTML(plan.focusLabel)}</strong><small>${escapeHTML(plan.objective)}</small><small>Due ${escapeHTML(due)} · ${statusLabel}</small></div><span class="pill ${plan.priority === \'high\' ? \'red\' : \'amber\'}">${escapeHTML(plan.priority.toUpperCase())}</span><div class="digital-followup-plan-actions">${action}</div></article>`;',
    '  }).join(\'\');',
    "  const noRecommendations = '<div class=\"empty-state\"><p>No new coaching signal. Agents with active plans are not given duplicate recommendations.</p></div>';",
    "  const noPlans = '<div class=\"empty-state\"><p>No active digital follow-up coaching plans.</p></div>';",
    '  return `<section class="panel digital-followup-coaching-panel"><div class="panel-head"><div><h3>Digital follow-up coaching</h3><p>Turn response scorecard evidence into a supervised practice plan. This workflow does not make disciplinary or employment decisions.</p></div><span class="pill blue">${board.counts.active} ACTIVE PLANS</span></div><div class="digital-followup-coaching-metrics"><div><span>New signals</span><strong>${board.counts.recommendations}</strong></div><div><span>Active plans</span><strong>${board.counts.active}</strong></div><div><span>Completed plans</span><strong>${board.counts.completed}</strong></div><div><span>Past due plans</span><strong>${board.counts.overduePlans}</strong></div></div><h4 class="digital-followup-subheading">Recommended coaching</h4><div class="digital-followup-coaching-list">${recommendations || noRecommendations}</div><h4 class="digital-followup-subheading">Plan tracker</h4><div class="digital-followup-plan-list">${plansHtml || noPlans}</div><p class="muted-note">Recommendations use the local synthetic follow-up scorecards. A supervisor must review the evidence, create the plan and record progress.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

function actionCasesSource() {
  return [
    "    case 'create-digital-followup-coaching': {",
    '      const now = queueSimulationNowMs();',
    '      const performance = digitalFollowUpPerformanceBoard(state.digitalQueue, now);',
    '      const coaching = digitalFollowUpCoachingBoard(performance, state.digitalFollowUpCoachingPlans, Date.now());',
    '      const recommendation = coaching.recommendations.find(item => item.agentId === String(event.agentId || ""));',
    "      if (!recommendation) { toast('The coaching signal is no longer current or this agent already has an active plan.', 'warning'); break; }",
    '      const createdAt = new Date().toISOString();',
    "      const plan = createDigitalFollowUpCoachingPlan(recommendation, { id: makeCallReference('COACH'), createdAt, createdBy: 'SUPERVISOR' });",
    "      if (!plan) { toast('A valid coaching plan could not be created.', 'warning'); break; }",
    '      state.digitalFollowUpCoachingPlans ||= [];',
    "      if (state.digitalFollowUpCoachingPlans.some(item => item.agentId === plan.agentId && ['open', 'in_progress'].includes(item.status))) { toast('This agent already has an active coaching plan.', 'warning'); break; }",
    '      state.digitalFollowUpCoachingPlans.push(plan);',
    "      pushOperationEvent('supervisor', plan.agentId, 'Digital follow-up coaching plan created.', 'open', { coachingPlanId: plan.id, focus: plan.focus, priority: plan.priority, dueAt: plan.dueAt });",
    "      saveState(); toast('Digital follow-up coaching plan created.', 'success'); renderView(); break;",
    '    }',
    "    case 'start-digital-followup-coaching':",
    "    case 'complete-digital-followup-coaching': {",
    "      const nextStatus = event.action === 'start-digital-followup-coaching' ? 'in_progress' : 'completed';",
    '      const previous = Array.isArray(state.digitalFollowUpCoachingPlans) ? state.digitalFollowUpCoachingPlans : [];',
    '      const updated = transitionDigitalFollowUpCoachingPlan(previous, event.planId, nextStatus, new Date().toISOString());',
    "      if (updated.every((item, index) => item === previous[index])) { toast('The coaching plan is no longer available for this action.', 'warning'); break; }",
    '      state.digitalFollowUpCoachingPlans = updated;',
    '      const plan = updated.find(item => item && item.id === event.planId);',
    "      pushOperationEvent('supervisor', plan?.agentId || 'DIGITAL-COACHING', nextStatus === 'completed' ? 'Digital follow-up coaching plan completed.' : 'Digital follow-up coaching started.', nextStatus, { coachingPlanId: event.planId, focus: plan?.focus || '' });",
    "      saveState(); toast(nextStatus === 'completed' ? 'Coaching plan marked completed.' : 'Coaching plan started.', 'success'); renderView(); break;",
    '    }',
    ACTION_ANCHOR
  ].join('\n');
}

export function calloriaDigitalFollowUpCoachingPluginV725() {
  return {
    name: 'calloria-digital-followup-coaching-v7-25',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX)) return null;
      if (source.includes(V725_MARKER)) return null;
      const checks = [
        [V724_MARKER, 'v7.24 performance marker'],
        [PERFORMANCE_IMPORT, 'v7.24 performance engine import'],
        [PERFORMANCE_PANEL_CALL, 'v7.24 performance panel render call'],
        [PERFORMANCE_TEMPLATE_ANCHOR, 'v7.24 performance panel template insertion'],
        [ACTION_ANCHOR, 'Supervisor action dispatch'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.25 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source.replace(
        PERFORMANCE_IMPORT,
        `${PERFORMANCE_IMPORT}\nimport { digitalFollowUpCoachingBoard, createDigitalFollowUpCoachingPlan, transitionDigitalFollowUpCoachingPlan } from './digital-followup-coaching-engine-v725.js';\nimport '../styles/calloria-digital-followup-coaching-v725.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${panelFunctionSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        PERFORMANCE_PANEL_CALL,
        `${PERFORMANCE_PANEL_CALL}\n  state.digitalFollowUpCoachingPlans ||= [];\n  const digitalFollowUpCoachingPanel = renderDigitalFollowUpCoachingPanelV725(state.digitalQueue, state.digitalFollowUpCoachingPlans, nowVoice);`
      );
      code = code.replace(PERFORMANCE_TEMPLATE_ANCHOR, `    \${digitalFollowUpCoachingPanel}\n${PERFORMANCE_TEMPLATE_ANCHOR}`);
      code = code.replace(ACTION_ANCHOR, actionCasesSource());
      return { code, map: null };
    }
  };
}
