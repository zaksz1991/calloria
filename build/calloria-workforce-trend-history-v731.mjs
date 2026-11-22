/** CALLORIA v7.31 — privacy-minimised workforce trend history transform. */
const V730_MARKER = '/* CALLORIA_V730_WORKFORCE_COMMAND_CENTRE */';
const V731_MARKER = '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */';
const V730_IMPORT = "import { workforceCommandCentreBoard, workforceCommandCentreCsv } from './workforce-command-centre-engine-v730.js';";
const V730_PANEL_CALL = '  const workforceCommandCentrePanel = renderWorkforceCommandCentrePanelV730(state, digitalFollowUpPerformanceForOutcomes, window.__CALLORIA_WORKFORCE_CAPACITY_ASSUMPTIONS__ || {});';
const V730_TEMPLATE_ANCHOR = '    ${workforceCommandCentrePanel}';
const RENDER_ANCHOR = 'function renderSupervisor(){';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) { return String(id || '').split('?')[0].replace(/\\/g, '/'); }
function count(source, value) { return source.split(value).length - 1; }

function panelSource() {
  return [
    V731_MARKER,
    'function renderWorkforceTrendHistoryPanelV731(board) {',
    '  if (!board) return "";',
    '  const stored = readWorkforceTrendHistoryV731();',
    '  const history = stored.snapshots;',
    '  const current = createWorkforceTrendSnapshot(board, Date.now());',
    '  const previous = history.length ? history[history.length - 1] : null;',
    '  const comparison = previous && current ? compareWorkforceTrendSnapshots(previous, current) : null;',
    '  const fmt = value => value === null || value === undefined ? "—" : String(value);',
    '  const pct = value => value === null || value === undefined ? "—" : `${Math.round(Number(value) * 10) / 10}%`;',
    '  const deltaText = metric => metric.delta === null ? "—" : `${metric.delta > 0 ? "+" : ""}${metric.delta}${metric.suffix || ""}`;',
    '  const tone = value => value === "improved" ? "good" : value === "worsened" ? "warn" : "muted";',
    '  const badge = (value, style = "muted") => `<span class="wth-badge ${style}">${escapeHTML(value)}</span>`;',
    '  const summaryRows = comparison ? comparison.summaryMetrics.map(metric => { const valueText = value => metric.key === "responseTargetRate" ? pct(value) : fmt(value); return `<tr><td><strong>${escapeHTML(metric.label)}</strong></td><td>${valueText(metric.previous)}</td><td>${valueText(metric.current)}</td><td>${deltaText(metric)}</td><td>${badge(metric.trend, tone(metric.trend))}</td></tr>`; }).join("") : "";',
    '  const channelRows = comparison ? comparison.workstreams.filter(row => ["email", "live_chat", "social", "voice"].includes(row.id)).map(row => { const metrics = Object.fromEntries(row.metrics.map(metric => [metric.key, metric])); const completed = metrics.completed; const open = metrics.open; const overdue = metrics.overdue; const target = metrics.responseTargetRate; return `<tr><td><strong>${escapeHTML(row.label)}</strong></td><td>${completed ? deltaText(completed) : "—"}</td><td>${open ? deltaText(open) : "—"}</td><td>${overdue ? deltaText(overdue) : "—"}</td><td>${target ? deltaText(target) : "—"}</td><td>${badge(row.status, row.status === "continuing" ? "good" : "muted")}</td></tr>`; }).join("") : "";',
    '  const departmentRows = comparison ? comparison.departments.map(row => { const metrics = Object.fromEntries(row.metrics.map(metric => [metric.key, metric])); return `<tr><td><strong>${escapeHTML(row.department)}</strong></td><td>${metrics.completed ? deltaText(metrics.completed) : "—"}</td><td>${metrics.open ? deltaText(metrics.open) : "—"}</td><td>${metrics.overdue ? deltaText(metrics.overdue) : "—"}</td><td>${metrics.atRisk ? deltaText(metrics.atRisk) : "—"}</td><td>${metrics.responseTargetRate ? deltaText(metrics.responseTargetRate) : "—"}</td><td>${badge(row.status, row.status === "continuing" ? "good" : "muted")}</td></tr>`; }).join("") : "";',
    '  const historyRows = history.slice(-10).reverse().map(snapshot => `<tr><td>${escapeHTML(new Date(snapshot.capturedAt).toLocaleString())}</td><td>${snapshot.summary.digitalAgents}</td><td>${snapshot.summary.completedReplies}</td><td>${snapshot.summary.openDigitalWork}</td><td>${snapshot.summary.overdueDigitalWork}</td><td>${pct(snapshot.summary.responseTargetRate)}</td></tr>`).join("");',
    '  const statusText = window.__CALLORIA_V731_STORAGE_STATUS__ || (!stored.available ? "Browser storage is unavailable or saved history could not be read. Trend history remains disabled until storage is available." : history.length ? "Aggregate snapshots are stored in this browser only; they are not uploaded or synchronised." : "No saved baseline exists yet. Capture a snapshot to start a local trend history.");',
    '  const summaryTable = summaryRows ? `<div class="wth-table-wrap"><table class="wth-table"><thead><tr><th>Measure</th><th>Previous</th><th>Current</th><th>Change</th><th>Signal</th></tr></thead><tbody>${summaryRows}</tbody></table></div>` : `<div class="wth-empty"><strong>No comparison baseline yet</strong><span>Capture the current aggregate workforce position. A later visit can compare current retained metrics with that saved baseline.</span></div>`;',
    '  const channelTable = channelRows ? `<div class="wth-table-wrap"><table class="wth-table"><thead><tr><th>Workstream</th><th>Completed</th><th>Open</th><th>Overdue</th><th>On target</th><th>Coverage</th></tr></thead><tbody>${channelRows}</tbody></table></div>` : "";',
    '  const departmentTable = departmentRows ? `<div class="wth-table-wrap"><table class="wth-table"><thead><tr><th>Department</th><th>Completed</th><th>Open</th><th>Overdue</th><th>At risk</th><th>On target</th><th>Coverage</th></tr></thead><tbody>${departmentRows}</tbody></table></div>` : `<div class="wth-empty"><strong>Department trend comparison unavailable</strong><span>Capture a baseline after exact department mapping is available. Unmapped employees are not assigned to departments.</span></div>`;',
    '  const removedDepartmentNote = comparison?.previousOnlyDepartments?.length ? `<p class="wth-footnote">Previously mapped but absent from current data: ${comparison.previousOnlyDepartments.map(escapeHTML).join(", ")}. This is a coverage difference, not proof that a department closed.</p>` : "";',
    '  return `<section class="panel workforce-trend-history-panel"><div class="panel-head"><div><h3>Workforce trend and evidence history</h3><p>Compare current aggregate workforce indicators with a manually captured browser-local baseline.</p></div><span class="pill blue">v7.31 · AGGREGATE HISTORY</span></div>',
    '    <div class="wth-summary"><div><span>Saved snapshots</span><strong>${history.length}</strong><small>Maximum 90 retained</small></div><div><span>Last baseline</span><strong>${previous ? escapeHTML(new Date(previous.capturedAt).toLocaleDateString()) : "Not set"}</strong><small>${previous ? escapeHTML(new Date(previous.capturedAt).toLocaleTimeString()) : "Capture a first snapshot"}</small></div><div><span>Compared dimensions</span><strong>${comparison ? comparison.summaryMetrics.filter(metric => metric.delta !== null).length : 0}/5</strong><small>Summary measures with both values present</small></div><div><span>Department coverage</span><strong>${pct(board.departments?.coveragePercent)}</strong><small>${fmt(board.departments?.mappedAgentCount)} mapped of ${fmt(board.departments?.identifiedAgentCount)} digital agents</small></div></div>',
    '    <div class="wth-actions"><button type="button" class="btn primary" data-workforce-trend-capture>Capture current snapshot</button><button type="button" class="btn secondary" data-workforce-trend-export ${history.length ? "" : "disabled"}>Export trend history CSV</button><button type="button" class="btn secondary" data-workforce-trend-clear ${history.length ? "" : "disabled"}>Clear local history</button></div>',
    '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>',
    '    <section class="wth-section"><div class="wth-section-head"><div><h4>Overall change since last snapshot</h4><p>Positive and negative directions are based on the metric type; no causation is inferred.</p></div>${comparison ? badge(new Date(comparison.from).toLocaleString() + " → now", "blue") : badge("Baseline required")}</div>${summaryTable}</section>',
    '    ${channelTable ? `<section class="wth-section"><div class="wth-section-head"><div><h4>Workstream changes</h4><p>Change is measured against the last saved snapshot for each workstream with a matching baseline.</p></div></div>${channelTable}</section>` : ""}',
    '    <section class="wth-section"><div class="wth-section-head"><div><h4>Department changes</h4><p>Only exact, mapped department groups are compared. Newly mapped departments are marked new.</p></div></div>${departmentTable}${removedDepartmentNote}</section>',
    '    <section class="wth-section"><div class="wth-section-head"><div><h4>Recent snapshot history</h4><p>Last 10 saved aggregate snapshots, newest first.</p></div></div>${historyRows ? `<div class="wth-table-wrap"><table class="wth-table"><thead><tr><th>Captured</th><th>Agents</th><th>Completed</th><th>Open</th><th>Overdue</th><th>On target</th></tr></thead><tbody>${historyRows}</tbody></table></div>` : `<div class="wth-empty"><strong>History is empty</strong><span>No snapshot has been captured in this browser yet.</span></div>`}</section>',
    '    <div class="wth-boundaries"><span>Snapshots contain aggregate counts, rates, channel labels and explicitly mapped department names only. Individual employee IDs, customer details, case references and transcripts are excluded.</span><span>History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup. Anyone with access to this same browser profile may also access its saved history. Use the CSV export when a separate retained copy is required.</span><span>Snapshot comparisons show change between two captured states; they do not prove cause, represent continuous monitoring, or replace a formal workforce report.</span></div></section>`;',
    '}'
  ].join('\n') + '\n';
}

function eventSource() {
  return [
    '',
    '/* CALLORIA v7.31 browser-local aggregate history controls. */',
    'function readWorkforceTrendHistoryV731() {',
    '  try {',
    '    const raw = window.localStorage.getItem("calloria.workforce.trend-history.v731");',
    '    const parsed = raw ? JSON.parse(raw) : [];',
    '    return { snapshots: normaliseWorkforceTrendHistory(parsed, WORKFORCE_TREND_HISTORY_LIMIT), available: true };',
    '  } catch { return { snapshots: [], available: false }; }',
    '}',
    'function saveWorkforceTrendHistoryV731(snapshots) {',
    '  try { window.localStorage.setItem("calloria.workforce.trend-history.v731", JSON.stringify(snapshots)); return true; }',
    '  catch { return false; }',
    '}',
    'if (typeof window !== "undefined" && !window.__CALLORIA_V731_TREND_HANDLERS__) {',
    '  document.addEventListener("click", event => {',
    '    const capture = event.target?.closest?.("[data-workforce-trend-capture]");',
    '    if (capture) {',
    '      const board = window.__CALLORIA_WORKFORCE_COMMAND_BOARD__;',
    '      const snapshot = board ? createWorkforceTrendSnapshot(board, Date.now()) : null;',
    '      const stored = readWorkforceTrendHistoryV731();',
    '      if (!snapshot) window.__CALLORIA_V731_STORAGE_STATUS__ = "No current command-centre data is available to capture.";',
    '      else if (!saveWorkforceTrendHistoryV731(appendWorkforceTrendSnapshot(stored.snapshots, snapshot, WORKFORCE_TREND_HISTORY_LIMIT))) window.__CALLORIA_V731_STORAGE_STATUS__ = "Snapshot could not be saved. Browser storage may be unavailable or full.";',
    '      else window.__CALLORIA_V731_STORAGE_STATUS__ = "Snapshot captured successfully in this browser. It contains aggregate workforce measures only.";',
    '      if (typeof renderSupervisor === "function") renderSupervisor();',
    '      return;',
    '    }',
    '    const exportButton = event.target?.closest?.("[data-workforce-trend-export]");',
    '    if (exportButton) {',
    '      const stored = readWorkforceTrendHistoryV731();',
    '      if (!stored.available || !stored.snapshots.length) return;',
    '      const csv = workforceTrendHistoryCsv(stored.snapshots);',
    '      const blob = new Blob(["\\uFEFF", csv], { type: "text/csv;charset=utf-8" });',
    '      const url = URL.createObjectURL(blob);',
    '      const link = document.createElement("a"); link.href = url;',
    '      link.download = `calloria-workforce-trend-history-${new Date().toISOString().slice(0,10)}.csv`;',
    '      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);',
    '      return;',
    '    }',
    '    const clearButton = event.target?.closest?.("[data-workforce-trend-clear]");',
    '    if (clearButton) {',
    '      if (!window.confirm("Clear all CALLORIA workforce trend snapshots saved in this browser? This cannot be undone.")) return;',
    '      try { window.localStorage.removeItem("calloria.workforce.trend-history.v731"); window.__CALLORIA_V731_STORAGE_STATUS__ = "Local trend history cleared from this browser."; }',
    '      catch { window.__CALLORIA_V731_STORAGE_STATUS__ = "Local history could not be cleared because browser storage is unavailable."; }',
    '      if (typeof renderSupervisor === "function") renderSupervisor();',
    '    }',
    '  });',
    '  window.__CALLORIA_V731_TREND_HANDLERS__ = true;',
    '}',
    ''
  ].join('\n');
}

export function calloriaWorkforceTrendHistoryPluginV731() {
  return {
    name: 'calloria-workforce-trend-history-v7-31',
    enforce: 'post',
    transform(source, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX) || source.includes(V731_MARKER)) return null;
      const checks = [
        [V730_MARKER, 'v7.30 workforce command-centre marker'],
        [V730_IMPORT, 'v7.30 workforce command-centre engine import'],
        [V730_PANEL_CALL, 'v7.30 command-centre panel render call'],
        [V730_TEMPLATE_ANCHOR, 'v7.30 command-centre template insertion'],
        [RENDER_ANCHOR, 'Supervisor render function']
      ];
      const missing = checks.filter(([anchor]) => count(source, anchor) !== 1).map(([, label]) => label);
      if (missing.length) {
        this.warn(`CALLORIA v7.31 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        V730_IMPORT,
        `${V730_IMPORT}\nimport { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';\nimport '../styles/calloria-workforce-trend-history-v731.css';`
      );
      code = code.replace(RENDER_ANCHOR, `${panelSource()}\n${RENDER_ANCHOR}`);
      code = code.replace(
        V730_PANEL_CALL,
        `${V730_PANEL_CALL}\n  const workforceTrendHistoryPanel = renderWorkforceTrendHistoryPanelV731(window.__CALLORIA_WORKFORCE_COMMAND_BOARD__);`
      );
      code = code.replace(V730_TEMPLATE_ANCHOR, `${V730_TEMPLATE_ANCHOR}\n    \${workforceTrendHistoryPanel}`);
      code += eventSource();
      return { code, map: null };
    }
  };
}
