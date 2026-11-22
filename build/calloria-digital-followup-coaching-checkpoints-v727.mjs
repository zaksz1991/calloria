/** CALLORIA v7.27 — scheduled coaching sustainment checkpoints. */
const V726_MARKER = '/* CALLORIA_V726_DIGITAL_FOLLOWUP_COACHING_OUTCOMES */';
const V727_MARKER = '/* CALLORIA_V727_DIGITAL_FOLLOWUP_COACHING_CHECKPOINTS */';
const CHECKPOINT_IMPORT = "import { digitalFollowUpCoachingOutcomeBoard, recordDigitalFollowUpCoachingOutcome } from './digital-followup-coaching-outcomes-engine-v726.js';";
const OUTCOME_PANEL_CALL = '  const digitalFollowUpCoachingOutcomePanel = renderDigitalFollowUpCoachingOutcomePanelV726(state.digitalFollowUpCoachingPlans, digitalFollowUpPerformanceForOutcomes);';
const OUTCOME_TEMPLATE_ANCHOR = '    ${digitalFollowUpCoachingOutcomePanel}';
const OUTCOME_ACTION_ANCHOR = '      const outcome = plan?.outcomeReview;';
const ACTION_ANCHOR = "    case 'request-digital-supervisor':requestDigitalSupervisor(event.contactId);break;";
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';
function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function checkpointPanelSource() {
  return [
    V727_MARKER,
    'function renderDigitalFollowUpCoachingCheckpointPanelV727(plans, performance, now) {',
    '  const board = digitalFollowUpCoachingCheckpointBoard(plans, performance, now);',
    '  const unscheduled = board.unscheduledPlans.slice(0, 6).map(row => `<article class="digital-followup-checkpoint-row"><div class="digital-followup-checkpoint-main"><strong>${escapeHTML(row.agentId)} · ${escapeHTML(row.focusLabel)}</strong><small>Outcome reviewed; schedule the follow-through checks.</small></div><div class="digital-followup-checkpoint-actions"><button type="button" class="btn small secondary" data-action="schedule-digital-followup-coaching-checkpoints" data-plan-id="${escapeHTML(row.planId)}">Schedule 7- and 30-day checks</button></div></article>`).join(\'\');',
    '  const rows = board.rows.slice(0, 12).map(row => {',
    "    const status = row.status === 'due' ? ((Date.parse(row.dueAt) || 0) < now ? 'overdue' : 'due') : row.status;",
    "    const badge = ['target_maintained', 'target_reached'].includes(row.review?.status) ? 'green' : row.review?.status === 'improved' ? 'blue' : row.review?.status === 'regressed' ? 'amber' : status === 'overdue' ? 'amber' : status === 'due' ? 'blue' : 'muted';",
    "    const label = row.review?.label || (status === 'overdue' ? 'Checkpoint is overdue' : status === 'due' ? 'Checkpoint is ready to record' : 'Scheduled for future review');",
    "    const action = row.ready ? `<button type=\"button\" class=\"btn small secondary\" data-action=\"record-digital-followup-coaching-checkpoint\" data-plan-id=\"${escapeHTML(row.planId)}\" data-checkpoint-id=\"${escapeHTML(row.checkpointId)}\">Record checkpoint</button>` : (status === 'due' ? '<small>Waiting for agent scorecard</small>' : '');",
    '    const result = row.review ? `<small>Reference ${row.review.reference ?? "—"} · current ${row.review.current ?? "—"} · ${escapeHTML(row.review.recordedAt ? new Date(row.review.recordedAt).toLocaleDateString() : "recorded")}</small>` : `<small>Due ${escapeHTML(row.dueAt ? new Date(row.dueAt).toLocaleDateString() : "date unavailable")}</small>`;',
    '    return `<article class="digital-followup-checkpoint-row"><div class="digital-followup-checkpoint-main"><strong>${escapeHTML(row.agentId)} · ${escapeHTML(row.checkpointLabel)}</strong><small>${escapeHTML(row.focusLabel)} · ${escapeHTML(label)}</small>${result}</div><span class="pill ${badge}">${escapeHTML(status.replaceAll("_", " ").toUpperCase())}</span><div class="digital-followup-checkpoint-actions">${action}</div></article>`;',
    '  }).join(\'\');',
    "  const empty = '<div class=\"empty-state\"><p>Outcome-reviewed coaching plans will generate 7-day and 30-day sustainment checks.</p></div>';",
    '  return `<section class="panel digital-followup-checkpoint-panel"><div class="panel-head"><div><h3>Coaching sustainment checkpoints</h3><p>Recheck follow-up performance 7 and 30 days after the initial outcome review.</p></div><span class="pill blue">${board.due} DUE</span></div><div class="digital-followup-checkpoint-metrics"><div><span>Due now</span><strong>${board.due}</strong></div><div><span>Overdue</span><strong>${board.overdue}</strong></div><div><span>Recorded</span><strong>${board.recorded}</strong></div><div><span>Scheduled</span><strong>${board.scheduled}</strong></div></div><div class="digital-followup-checkpoint-list">${unscheduled}${rows || (unscheduled ? "" : empty)}</div><p class="muted-note">Checkpoint comparisons use retained cumulative synthetic scorecards against the initial outcome-review snapshot. A result is operational evidence, not proof that coaching caused the change. Response-rate checks require at least three new completed follow-ups; other checks require at least one.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

function actionCasesSource() {
  return [
    "    case 'schedule-digital-followup-coaching-checkpoints': {",
    '      const previous = Array.isArray(state.digitalFollowUpCoachingPlans) ? state.digitalFollowUpCoachingPlans : [];',
    '      const updated = scheduleDigitalFollowUpCoachingCheckpoints(previous, event.planId);',
    '      if (updated.every((item, index) => item === previous[index])) { toast(\'This plan is not eligible or its checkpoints are already scheduled.\', \'warning\'); break; }',
    '      state.digitalFollowUpCoachingPlans = updated;',
    '      const plan = updated.find(item => item && item.id === event.planId);',
    "      pushOperationEvent('supervisor', plan?.agentId || 'DIGITAL-COACHING', 'Digital coaching sustainment checkpoints scheduled.', 'scheduled', { coachingPlanId: event.planId, checkpointCount: plan?.followUpCheckpoints?.length || 0 });",
    "      saveState(); toast('7-day and 30-day coaching checks scheduled.', 'success'); renderView(); break;",
    '    }',
    "    case 'record-digital-followup-coaching-checkpoint': {",
    '      const previous = Array.isArray(state.digitalFollowUpCoachingPlans) ? state.digitalFollowUpCoachingPlans : [];',
    '      const performance = digitalFollowUpPerformanceBoard(state.digitalQueue, queueSimulationNowMs());',
    '      const recordedAt = new Date().toISOString();',
    '      const updated = recordDigitalFollowUpCoachingCheckpoint(previous, event.planId, event.checkpointId, performance, { recordedAt, now: recordedAt, recordedBy: \'SUPERVISOR\' });',
    '      if (updated.every((item, index) => item === previous[index])) { toast(\'This checkpoint is not due, has already been recorded, or lacks valid evidence.\', \'warning\'); break; }',
    '      state.digitalFollowUpCoachingPlans = updated;',
    '      const plan = updated.find(item => item && item.id === event.planId);',
    '      const checkpoint = plan?.followUpCheckpoints?.find(item => item && item.id === event.checkpointId);',
    '      const result = checkpoint?.review;',
    "      pushOperationEvent('supervisor', plan?.agentId || 'DIGITAL-COACHING', 'Digital coaching sustainment checkpoint recorded.', result?.status || 'recorded', { coachingPlanId: event.planId, checkpointId: event.checkpointId, outcome: result?.status || 'unknown', metric: result?.metric || '', reference: result?.reference, current: result?.current, target: result?.target });",
    "      saveState(); toast(result?.label || 'Coaching checkpoint recorded.', 'success'); renderView(); break;",
    '    }',
    ACTION_ANCHOR
  ].join('\n');
}

export function calloriaDigitalFollowUpCoachingCheckpointsPluginV727() {
  return {
    name: 'calloria-digital-followup-coaching-checkpoints-v7-27',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V727_MARKER)) return null;
      const checks = [
        [V726_MARKER, 'v7.26 outcome-review marker'],
        [CHECKPOINT_IMPORT, 'v7.26 outcome engine import'],
        [OUTCOME_PANEL_CALL, 'v7.26 outcome panel render call'],
        [OUTCOME_TEMPLATE_ANCHOR, 'v7.26 outcome panel template insertion'],
        [OUTCOME_ACTION_ANCHOR, 'v7.26 outcome review action'],
        [ACTION_ANCHOR, 'Supervisor action dispatch'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.27 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        CHECKPOINT_IMPORT,
        `${CHECKPOINT_IMPORT}\nimport { digitalFollowUpCoachingCheckpointBoard, scheduleDigitalFollowUpCoachingCheckpoints, recordDigitalFollowUpCoachingCheckpoint } from './digital-followup-coaching-checkpoints-engine-v727.js';\nimport '../styles/calloria-digital-followup-coaching-checkpoints-v727.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${checkpointPanelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        OUTCOME_PANEL_CALL,
        `${OUTCOME_PANEL_CALL}\n  const digitalFollowUpCoachingCheckpointPanel = renderDigitalFollowUpCoachingCheckpointPanelV727(state.digitalFollowUpCoachingPlans, digitalFollowUpPerformanceForOutcomes, Date.now());`
      );
      code = code.replace(OUTCOME_TEMPLATE_ANCHOR, `${OUTCOME_TEMPLATE_ANCHOR}\n    \${digitalFollowUpCoachingCheckpointPanel}`);
      code = code.replace(
        OUTCOME_ACTION_ANCHOR,
        `${OUTCOME_ACTION_ANCHOR}\n      state.digitalFollowUpCoachingPlans = scheduleDigitalFollowUpCoachingCheckpoints(state.digitalFollowUpCoachingPlans, event.planId, { scheduledAt: outcome?.reviewedAt });`
      );
      code = code.replace(ACTION_ANCHOR, actionCasesSource());
      return { code, map: null };
    }
  };
}
