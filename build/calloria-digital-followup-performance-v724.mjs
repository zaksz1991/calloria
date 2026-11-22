/** CALLORIA v7.24 — agent-level digital follow-up SLA performance panel. */
const V723_MARKER = '/* CALLORIA_V723_DIGITAL_FOLLOWUP_SUPERVISOR */';
const V724_MARKER = '/* CALLORIA_V724_DIGITAL_FOLLOWUP_PERFORMANCE */';
const IMPORT_ANCHOR = "import { digitalFollowUpSupervisorBoard, findDigitalFollowUpSupervisorAlert } from './digital-followup-supervisor-engine-v723.js';";
const SUPERVISOR_PANEL_ANCHOR = '  const digitalFollowUpSupervisorPanel = renderDigitalFollowUpSupervisorPanelV723(state.digitalQueue, state.supervisorRequests, nowVoice);';
const TEMPLATE_PANEL_ANCHOR = '    ${digitalFollowUpSupervisorPanel}';
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}
function count(source, value) {
  return source.split(value).length - 1;
}
function panelFunctionSource() {
  return [
    V724_MARKER,
    'function renderDigitalFollowUpPerformancePanelV724(queue, now) {',
    '  const board = digitalFollowUpPerformanceBoard(queue, now);',
    '  const rate = digitalFollowUpPerformanceDisplay(board.responseTargetRate);',
    '  const average = board.averageResponseMinutes === null ? \'—\' : `${board.averageResponseMinutes}m`;',
    '  const channels = [["email", "Email"], ["live_chat", "Live chat"], ["social", "Social"]].map(([key, label]) => {',
    '    const metric = board.byChannel[key];',
    '    const channelRate = digitalFollowUpPerformanceDisplay(metric.responseTargetRate);',
    '    return `<article class="digital-followup-channel-card"><strong>${label}</strong><div><span>Target met</span><b>${channelRate}</b></div><div><span>Completed</span><b>${metric.completed}</b></div><div><span>Late</span><b>${metric.late}</b></div><div><span>Open overdue</span><b>${metric.overdue}</b></div></article>`;',
    "  }).join('');",
    '  const rows = board.agents.slice(0, 8).map(agent => {',
    "    const label = agent.agentId === 'UNASSIGNED' ? 'Unassigned / legacy' : agent.agentId;",
    "    const due = agent.overdue + agent.atRisk;",
    '    const agentRate = digitalFollowUpPerformanceDisplay(agent.responseTargetRate);',
    '    const agentAverage = agent.averageResponseMinutes === null ? \'—\' : `${agent.averageResponseMinutes}m`;',
    '    return `<article class="digital-followup-agent-card"><div class="digital-followup-agent-heading"><strong>${escapeHTML(label)}</strong><span class="pill ${agent.overdue ? \'red\' : agent.atRisk ? \'amber\' : \'green\'}">${agent.overdue ? `${agent.overdue} OVERDUE` : agent.atRisk ? `${agent.atRisk} AT RISK` : \'NO OPEN BREACH\'}</span></div><div class="digital-followup-agent-stats"><div><span>On target</span><strong>${agentRate}</strong></div><div><span>Completed</span><strong>${agent.completed}</strong></div><div><span>Late</span><strong>${agent.late}</strong></div><div><span>Open follow-ups</span><strong>${agent.open}</strong></div><div><span>Due / overdue</span><strong>${due}</strong></div><div><span>Avg. response</span><strong>${agentAverage}</strong></div></div></article>`;',
    '  }).join(\'\');',
    "  const empty = '<div class=\"empty-state\"><p>No completed or open follow-up response cycles have been recorded yet.</p></div>';",
    '  return `<section class="panel digital-followup-performance-panel"><div class="panel-head"><div><h3>Digital follow-up performance</h3><p>Response-time accountability by recorded agent. Completed replies use the responding agent ID; open work uses its current owner.</p></div><span class="pill blue">${board.totalCycles} CYCLES</span></div><div class="digital-followup-performance-summary"><div><span>Target met</span><strong>${rate}</strong></div><div><span>Completed</span><strong>${board.completed}</strong></div><div><span>Late replies</span><strong>${board.late}</strong></div><div><span>Open overdue</span><strong>${board.overdue}</strong></div><div><span>Average response</span><strong>${average}</strong></div></div><h4 class="digital-followup-subheading">Channel performance</h4><div class="digital-followup-channel-grid">${channels}</div><h4 class="digital-followup-subheading">Agent scorecards</h4><div class="digital-followup-agent-list">${rows || empty}</div><p class="muted-note">Metrics cover synthetic follow-up cycles in the retained local game history. They exclude first-response SLA and do not represent live customer-service performance.</p></section>`;',
    '}'
  ].join('\n') + '\n';
}

export function calloriaDigitalFollowUpPerformancePluginV724() {
  return {
    name: 'calloria-digital-followup-performance-v7-24',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX)) return null;
      if (source.includes(V724_MARKER)) return null;
      const checks = [
        [V723_MARKER, 'v7.23 follow-up supervisor marker'],
        [IMPORT_ANCHOR, 'v7.23 supervisor engine import'],
        [SUPERVISOR_PANEL_ANCHOR, 'v7.23 supervisor panel render call'],
        [TEMPLATE_PANEL_ANCHOR, 'v7.23 supervisor panel template insertion'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.24 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source.replace(
        IMPORT_ANCHOR,
        `${IMPORT_ANCHOR}\nimport { digitalFollowUpPerformanceBoard, digitalFollowUpPerformanceDisplay } from './digital-followup-performance-engine-v724.js';\nimport '../styles/calloria-digital-followup-performance-v724.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${panelFunctionSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        SUPERVISOR_PANEL_ANCHOR,
        `${SUPERVISOR_PANEL_ANCHOR}\n  const digitalFollowUpPerformancePanel = renderDigitalFollowUpPerformancePanelV724(state.digitalQueue, nowVoice);`
      );
      code = code.replace(TEMPLATE_PANEL_ANCHOR, `    \${digitalFollowUpPerformancePanel}\n${TEMPLATE_PANEL_ANCHOR}`);
      return { code, map: null };
    }
  };
}
