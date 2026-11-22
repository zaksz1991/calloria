/** CALLORIA v7.26 — coaching outcome review integration. */
const V725_MARKER = '/* CALLORIA_V725_DIGITAL_FOLLOWUP_COACHING */';
const V726_MARKER = '/* CALLORIA_V726_DIGITAL_FOLLOWUP_COACHING_OUTCOMES */';
const COACHING_IMPORT = "import { digitalFollowUpCoachingBoard, createDigitalFollowUpCoachingPlan, transitionDigitalFollowUpCoachingPlan } from './digital-followup-coaching-engine-v725.js';";
const PANEL_CALL = '  const digitalFollowUpCoachingPanel = renderDigitalFollowUpCoachingPanelV725(state.digitalQueue, state.digitalFollowUpCoachingPlans, nowVoice);';
const TEMPLATE_ANCHOR = '    ${digitalFollowUpCoachingPanel}';
const ACTION_ANCHOR = "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;";
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';
function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function outcomePanelSource() {
  return [
    V726_MARKER,
    'function renderDigitalFollowUpCoachingOutcomePanelV726(plans, performance) {',
    '  const board = digitalFollowUpCoachingOutcomeBoard(plans, performance);',
    '  const rows = board.rows.slice(0, 8).map(row => {',
    '    const review = row.outcomeReview || row.preview;',
    "    const label = review?.label || (row.currentEvidenceAvailable ? 'Evidence is not yet sufficient' : 'Waiting for current agent evidence');",
    "    const status = row.outcomeReview?.status || (row.preview?.status === 'insufficient_data' ? 'insufficient_data' : 'awaiting_review');",
    "    const badge = status === 'achieved' ? 'green' : status === 'improving' ? 'blue' : status === 'not_improved' ? 'amber' : 'muted';",
    "    const value = review ? (review.current === null ? '—' : `${review.current}${review.unit === '%' ? '%' : ''}`) : '—';",
    "    const target = review ? (review.target === null ? '—' : `${review.target}${review.unit === '%' ? '%' : ''}`) : '—';",
    "    const action = !row.reviewed && row.preview && row.preview.status !== 'insufficient_data' ? `<button type=\"button\" class=\"btn small secondary\" data-action=\"review-digital-followup-coaching-outcome\" data-plan-id=\"${escapeHTML(row.planId)}\">Record outcome review</button>` : '';",
    '    return `<article class="digital-followup-outcome-row"><div class="digital-followup-outcome-main"><strong>${escapeHTML(row.agentId)} · ${escapeHTML(row.focusLabel)}</strong><small>${escapeHTML(label)}</small><small>Current ${escapeHTML(value)} · target ${escapeHTML(target)}${row.outcomeReview?.reviewedAt ? ` · reviewed ${escapeHTML(new Date(row.outcomeReview.reviewedAt).toLocaleDateString())}` : ""}</small></div><span class="pill ${badge}">${escapeHTML(status.replaceAll("_", " ").toUpperCase())}</span><div class="digital-followup-outcome-actions">${action}</div></article>`;',
    '  }).join(\'\');',
    "  const empty = '<div class=\"empty-state\"><p>Completed coaching plans will appear here for evidence-based outcome review.</p></div>';",
    '  return `<section class="panel digital-followup-outcome-panel"><div class="panel-head"><div><h3>Coaching outcome reviews</h3><p>Compare current follow-up evidence with the baseline and target recorded when coaching began.</p></div><span class="pill blue">${board.awaitingReview} TO REVIEW</span></div><div class="digital-followup-outcome-metrics"><div><span>Reviewed</span><strong>${board.reviewed}</strong></div><div><span>Targets achieved</span><strong>${board.achieved}</strong></div><div><span>Improving</span><strong>${board.improving}</strong></div><div><span>No improvement</span><strong>${board.notImproved}</strong></div></div><div class="digital-followup-outcome-list">${rows || empty}</div><p class="muted-note">Outcome reviews compare the retained scorecard at review time; they do not isolate only post-coaching contacts or prove causation. They do not automatically trigger disciplinary, compensation or employment decisions.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

function actionCasesSource() {
  return [
    "    case 'review-digital-followup-coaching-outcome': {",
    '      const previous = Array.isArray(state.digitalFollowUpCoachingPlans) ? state.digitalFollowUpCoachingPlans : [];',
    '      const performance = digitalFollowUpPerformanceBoard(state.digitalQueue, queueSimulationNowMs());',
    "      const updated = recordDigitalFollowUpCoachingOutcome(previous, event.planId, performance, { reviewedAt: new Date().toISOString(), reviewedBy: 'SUPERVISOR' });",
    "      if (updated.every((item, index) => item === previous[index])) { toast('This completed plan is not ready for review or has already been reviewed.', 'warning'); break; }",
    '      state.digitalFollowUpCoachingPlans = updated;',
    '      const plan = updated.find(item => item && item.id === event.planId);',
    '      const outcome = plan?.outcomeReview;',
    "      pushOperationEvent('supervisor', plan?.agentId || 'DIGITAL-COACHING', 'Digital follow-up coaching outcome reviewed.', outcome?.status || 'reviewed', { coachingPlanId: event.planId, outcome: outcome?.status || 'unknown', metric: outcome?.metric || '', before: outcome?.before, current: outcome?.current, target: outcome?.target });",
    "      saveState(); toast('Coaching outcome review recorded.', 'success'); renderView(); break;",
    '    }',
    ACTION_ANCHOR
  ].join('\n');
}

export function calloriaDigitalFollowUpCoachingOutcomesPluginV726() {
  return {
    name: 'calloria-digital-followup-coaching-outcomes-v7-26',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V726_MARKER)) return null;
      const checks = [
        [V725_MARKER, 'v7.25 coaching marker'],
        [COACHING_IMPORT, 'v7.25 coaching engine import'],
        [PANEL_CALL, 'v7.25 coaching panel render call'],
        [TEMPLATE_ANCHOR, 'v7.25 coaching panel template insertion'],
        [ACTION_ANCHOR, 'Supervisor action dispatch'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.26 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        COACHING_IMPORT,
        `${COACHING_IMPORT}\nimport { digitalFollowUpCoachingOutcomeBoard, recordDigitalFollowUpCoachingOutcome } from './digital-followup-coaching-outcomes-engine-v726.js';\nimport '../styles/calloria-digital-followup-coaching-outcomes-v726.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${outcomePanelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        PANEL_CALL,
        `${PANEL_CALL}\n  const digitalFollowUpPerformanceForOutcomes = digitalFollowUpPerformanceBoard(state.digitalQueue, nowVoice);\n  const digitalFollowUpCoachingOutcomePanel = renderDigitalFollowUpCoachingOutcomePanelV726(state.digitalFollowUpCoachingPlans, digitalFollowUpPerformanceForOutcomes);`
      );
      code = code.replace(TEMPLATE_ANCHOR, `    \${digitalFollowUpCoachingOutcomePanel}\n${TEMPLATE_ANCHOR}`);
      code = code.replace(ACTION_ANCHOR, actionCasesSource());
      return { code, map: null };
    }
  };
}
