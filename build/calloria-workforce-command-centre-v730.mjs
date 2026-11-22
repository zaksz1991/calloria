/** CALLORIA v7.30 — workforce intelligence command-centre transform. */
const V729_MARKER = '/* CALLORIA_V729_WORKFORCE_INTELLIGENCE */';
const V730_MARKER = '/* CALLORIA_V730_WORKFORCE_COMMAND_CENTRE */';
const V729_IMPORT = "import { workforceIntelligenceBoard } from './workforce-intelligence-engine-v729.js';";
const V729_PANEL_CALL = '  const workforceIntelligencePanel = renderWorkforceIntelligencePanelV729(state, digitalFollowUpPerformanceForOutcomes, state.digitalFollowUpCoachingPlans, state.digitalCareerReviewPackets, Date.now());';
const V729_TEMPLATE_ANCHOR = '    ${workforceIntelligencePanel}';
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function panelSource() {
  return [
    V730_MARKER,
    'function renderWorkforceCommandCentrePanelV730(stateSnapshot, digitalPerformance, assumptions = {}) {',
    '  const board = workforceCommandCentreBoard(stateSnapshot, digitalPerformance, assumptions);',
    '  window.__CALLORIA_WORKFORCE_COMMAND_BOARD__ = board;',
    '  const fmt = value => value === null || value === undefined ? "—" : String(value);',
    '  const pct = value => value === null || value === undefined ? "—" : `${Math.round(Number(value))}%`;',
    '  const badge = (value, tone = "muted") => `<span class="wcc-badge ${tone}">${escapeHTML(value)}</span>`;',
    '  const s = board.summary;',
    '  const workstreamRows = board.workstreams.rows.map(row => `<tr><td><strong>${escapeHTML(row.label)}</strong><small>${row.id === "voice" ? escapeHTML(row.scope) : row.id === "unmapped" ? "Agent totals with missing channel attribution" : row.available ? "Retained channel cycles" : "No channel-level evidence"}</small></td><td>${fmt(row.completed)}</td><td>${pct(row.responseTargetRate)}</td><td>${fmt(row.open)}</td><td>${fmt(row.overdue)}</td></tr>`).join("");',
    '  const departmentRows = board.departments.rows.map(row => `<tr><td><strong>${escapeHTML(row.department)}</strong><small>${row.agents} mapped agent(s)</small></td><td>${row.completed}</td><td>${pct(row.responseTargetRate)}</td><td>${row.open}</td><td>${row.overdue}</td><td>${row.atRisk}</td></tr>`).join("");',
    '  const departmentTable = departmentRows ? `<div class="wcc-table-wrap"><table class="wcc-table"><thead><tr><th>Department</th><th>Completed</th><th>On target</th><th>Open</th><th>Overdue</th><th>At risk</th></tr></thead><tbody>${departmentRows}</tbody></table></div><small class="wcc-footnote">Department coverage: ${board.departments.coveragePercent}% of identified digital agents. ${board.departments.mappedAgentCount} exact mappings.</small>` : `<div class="wcc-empty"><strong>Department comparison unavailable</strong><span>No explicit department field or exact employee-ID roster mapping was found for digital agents. Add departmentName / departmentId to workforce records to enable this comparison. No departments have been guessed.</span></div>`;',
    '  const riskRows = board.riskAgents.map(row => `<tr><td><strong>${escapeHTML(row.agentId)}</strong></td><td>${row.completed}</td><td>${pct(row.responseTargetRate)}</td><td>${row.open}</td><td>${row.overdue}</td><td>${row.atRisk}</td><td>${badge(row.priority.label, row.priority.severity)}</td><td>${escapeHTML(row.priority.action)}</td></tr>`).join("");',
    '  const riskTable = riskRows ? `<div class="wcc-table-wrap"><table class="wcc-table wcc-risk-table"><thead><tr><th>Agent</th><th>Replies</th><th>On target</th><th>Open</th><th>Overdue</th><th>At risk</th><th>Signal</th><th>Supervisor focus</th></tr></thead><tbody>${riskRows}</tbody></table></div>` : `<div class="wcc-empty"><strong>No recorded digital risk signal</strong><span>There are no overdue, at-risk or sub-80% response-target records in the retained attributed agent data. This is not proof of zero operational risk outside this simulation.</span></div>`;',
    '  const scenarios = board.capacity.scenarios.map(row => `<tr><td><strong>${escapeHTML(row.label)}</strong><small>${Math.round(row.multiplier * 100)}% of current open backlog</small></td><td>${row.projectedBacklog}</td><td>${row.requiredSeats}</td><td>${row.staffingGap === null ? "—" : row.staffingGap > 0 ? `+${row.staffingGap}` : String(row.staffingGap)}</td><td>${escapeHTML(row.status)}</td></tr>`).join("");',
    '  const assumptionsSeats = board.capacity.plannedSeats === null ? "" : String(board.capacity.plannedSeats);',
    '  const digitalWorkstreams = board.workstreams.rows.filter(row => ["email", "live_chat", "social"].includes(row.id));',
    '  const workstreamCoverage = digitalWorkstreams.filter(row => row.available).length;',
    '  const allWorkstreams = 3;',
    '  const career = board.career;',
    '  return `<section class="panel workforce-command-centre-panel"><div class="panel-head"><div><h3>Workforce intelligence command centre</h3><p>Supervisor overview of channel workload, mapped department evidence, risk priorities and staffing scenarios.</p></div><span class="pill blue">v7.30 · READ ONLY</span></div>',
    '  <div class="wcc-kpis"><div><span>Attributed digital agents</span><strong>${s.digitalAgents}</strong><small>Exact responding-agent IDs</small></div><div><span>Completed digital replies</span><strong>${s.completedReplies}</strong><small>${pct(s.responseTargetRate)} response-target rate</small></div><div><span>Open digital work</span><strong>${s.openDigitalWork}</strong><small>${s.overdueDigitalWork} overdue · ${s.atRiskDigitalWork} at risk</small></div><div><span>Agents needing attention</span><strong>${s.agentsNeedingSupervisorAttention}</strong><small>Up to 8 highest-priority records shown</small></div></div>',
    '  <div class="wcc-grid"><section class="wcc-card"><div class="wcc-card-head"><div><h4>Operational workstream comparison</h4><p>Voice is limited to the current local profile. Digital channels use attributed per-agent cycles.</p></div>${badge(`${workstreamCoverage}/${allWorkstreams} digital channels mapped`, workstreamCoverage ? "good" : "muted")}</div><div class="wcc-table-wrap"><table class="wcc-table"><thead><tr><th>Workstream</th><th>Completed</th><th>On target</th><th>Open</th><th>Overdue</th></tr></thead><tbody>${workstreamRows}</tbody></table></div></section>',
    '  <section class="wcc-card"><div class="wcc-card-head"><div><h4>Department comparison</h4><p>Department-level digital scorecards, only where the employee-to-department relationship is explicit.</p></div>${badge(`${board.departments.rows.length} department(s)`, board.departments.available ? "good" : "muted")}</div>${departmentTable}</section></div>',
    '  <section class="wcc-card wcc-risk-card"><div class="wcc-card-head"><div><h4>Supervisor attention queue</h4><p>Prioritised from recorded overdue work, at-risk work and response-target results.</p></div>${badge(`${s.agentsNeedingSupervisorAttention} flagged`, s.agentsNeedingSupervisorAttention ? "warn" : "good")}</div>${riskTable}</section>',
    '  <section class="wcc-card wcc-capacity-card"><div class="wcc-card-head"><div><h4>Workforce capacity scenario planner</h4><p>Stress-tests current open digital backlog against stated staffing assumptions. Does not predict future arrival rates.</p></div>${badge("Planning model", "blue")}</div>',
    '  <form id="workforce-command-centre-form" class="wcc-assumptions"><label>Planned available seats<input type="number" name="plannedSeats" min="0" max="10000" step="1" value="${assumptionsSeats}" placeholder="Enter staffing plan"></label><label>Maximum open items per seat<input type="number" name="maxOpenItemsPerSeat" min="1" max="50" step="1" value="${board.capacity.maxOpenItemsPerSeat}" required></label><button class="btn primary" type="submit">Recalculate scenarios</button></form>',
    '  <div class="wcc-table-wrap"><table class="wcc-table"><thead><tr><th>Scenario</th><th>Modelled backlog</th><th>Seats required</th><th>Gap vs plan</th><th>Interpretation</th></tr></thead><tbody>${scenarios}</tbody></table></div>',
    '  <p class="wcc-footnote">${escapeHTML(board.capacity.method)} The 80%, 100% and 130% multipliers and open-items-per-seat value are planning assumptions, not observed staffing standards. Current backlog: ${board.capacity.backlog}. Enter planned seats to calculate a gap.</p></section>',
    '  <div class="wcc-career-strip"><span>Career evidence signals</span><strong>${career.readyForHumanReview} ready for human review</strong><strong>${career.pendingReviewPackets} pending packets</strong><strong>${career.developmentRequired} requiring development</strong><strong>${career.sustainmentPending} sustainment pending</strong></div>',
    '  <div class="wcc-footer"><span>Generated ${escapeHTML(board.evaluatedAt)} · local retained simulation data</span><button type="button" class="btn secondary" data-workforce-command-export>Export command-centre CSV</button></div>',
    '  <div class="wcc-boundaries">${board.boundaries.map(item => `<span>${escapeHTML(item)}</span>`).join("")}</div></section>`;',
    '}'
  ].join('\n') + '\n';
}

function eventSource() {
  return [
    '',
    '/* CALLORIA v7.30 command-centre session controls: no server/database writes. */',
    'if (typeof window !== "undefined" && !window.__CALLORIA_V730_COMMAND_HANDLERS__) {',
    '  document.addEventListener("submit", event => {',
    '    const form = event.target?.closest?.("#workforce-command-centre-form");',
    '    if (!form) return;',
    '    event.preventDefault();',
    '    const values = new FormData(form);',
    '    const seatsText = String(values.get("plannedSeats") ?? "").trim();',
    '    const targetText = String(values.get("maxOpenItemsPerSeat") ?? "5").trim();',
    '    const seats = seatsText === "" ? null : Number(seatsText);',
    '    const target = Number(targetText);',
    '    if ((seats !== null && (!Number.isFinite(seats) || seats < 0 || seats > 10000)) || !Number.isFinite(target) || target < 1 || target > 50) return;',
    '    window.__CALLORIA_WORKFORCE_CAPACITY_ASSUMPTIONS__ = { plannedSeats: seats, maxOpenItemsPerSeat: target };',
    '    if (typeof renderSupervisor === "function") renderSupervisor();',
    '  });',
    '  document.addEventListener("click", event => {',
    '    const button = event.target?.closest?.("[data-workforce-command-export]");',
    '    if (!button) return;',
    '    const board = window.__CALLORIA_WORKFORCE_COMMAND_BOARD__;',
    '    if (!board) return;',
    '    const csv = workforceCommandCentreCsv(board);',
    '    const blob = new Blob(["\\uFEFF", csv], { type: "text/csv;charset=utf-8" });',
    '    const url = URL.createObjectURL(blob);',
    '    const link = document.createElement("a");',
    '    link.href = url;',
    '    link.download = `calloria-workforce-command-centre-${new Date().toISOString().slice(0,10)}.csv`;',
    '    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);',
    '  });',
    '  window.__CALLORIA_V730_COMMAND_HANDLERS__ = true;',
    '}',
    ''
  ].join('\n');
}

export function calloriaWorkforceCommandCentrePluginV730() {
  return {
    name: 'calloria-workforce-command-centre-v7-30',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V730_MARKER)) return null;
      const checks = [
        [V729_MARKER, 'v7.29 workforce intelligence marker'],
        [V729_IMPORT, 'v7.29 workforce intelligence engine import'],
        [V729_PANEL_CALL, 'v7.29 workforce panel render call'],
        [V729_TEMPLATE_ANCHOR, 'v7.29 supervisor panel template insertion'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.30 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        V729_IMPORT,
        `${V729_IMPORT}\nimport { workforceCommandCentreBoard, workforceCommandCentreCsv } from './workforce-command-centre-engine-v730.js';\nimport '../styles/calloria-workforce-command-centre-v730.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${panelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        V729_PANEL_CALL,
        `${V729_PANEL_CALL}\n  const workforceCommandCentrePanel = renderWorkforceCommandCentrePanelV730(state, digitalFollowUpPerformanceForOutcomes, window.__CALLORIA_WORKFORCE_CAPACITY_ASSUMPTIONS__ || {});`
      );
      code = code.replace(V729_TEMPLATE_ANCHOR, `${V729_TEMPLATE_ANCHOR}\n    \${workforceCommandCentrePanel}`);
      code += eventSource();
      return { code, map: null };
    }
  };
}
