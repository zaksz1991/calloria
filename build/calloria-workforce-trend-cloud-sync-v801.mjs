import { WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802 } from '../js/workforce-trend-cloud-sync-engine-v802.js';

/** CALLORIA v8.3 — organisation-scoped workforce history with non-destructive conflict reporting. */
const V731_MARKER = '/* CALLORIA_V731_WORKFORCE_TREND_HISTORY */';
const V801_MARKER = '/* CALLORIA_V801_WORKFORCE_TREND_CLOUD_SYNC */';
const V731_ENGINE_IMPORT = "import { createWorkforceTrendSnapshot, normaliseWorkforceTrendHistory, appendWorkforceTrendSnapshot, compareWorkforceTrendSnapshots, workforceTrendHistoryCsv, WORKFORCE_TREND_HISTORY_LIMIT } from './workforce-trend-history-engine-v731.js';";
const STATUS_ANCHOR = '    <p class="wth-status" role="status" aria-live="polite">${escapeHTML(statusText)}</p>';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}
function count(source, value) {
  return String(source).split(value).length - 1;
}
function cloudControlsMarkup() {
  return [
    '    <section class="wth-cloud-sync" aria-label="Organisation trend history">',
    '      <div><strong>Organisation history</strong><small>Synchronise aggregate snapshots across authorised organisation members and devices. Conflicting capture times are reported and never overwritten.</small></div>',
    '      <div class="wth-cloud-sync-buttons"><button type="button" class="btn secondary" data-workforce-trend-cloud-sync>Save local history to organisation</button><button type="button" class="btn secondary" data-workforce-trend-cloud-load>Load and compare organisation history</button></div>',
    '      <p class="wth-cloud-status" data-state="${escapeHTML(window.__CALLORIA_V801_CLOUD_STATE__ || "info")}" role="status" aria-live="polite">${escapeHTML(window.__CALLORIA_V801_CLOUD_STATUS__ || "Cloud history requires a signed-in organisation workspace with report access.")}</p>',
    '    </section>'
  ].join('\n');
}
function handlerSource() {
  return [
    '',
    V801_MARKER,
    'function calloriaWorkforceCloudContextV801() {',
    '  const context = typeof getCloudPlatformState === "function" ? getCloudPlatformState() : null;',
    '  if (!context?.ready || !context?.activeOrganization?.id) throw new Error("Sign in and enter a CALLORIA organisation workspace before synchronising history.");',
    '  if (typeof canCloudRole !== "function" || !canCloudRole(context.membership?.role, "reports:read")) throw new Error("Your organisation role does not have workforce report access.");',
    '  return getCloudSupabaseClient().then(client => ({ client, organizationId: context.activeOrganization.id, organizationName: context.activeOrganization.name || "organisation" }));',
    '}',
    'function setWorkforceCloudStatusV801(message, state = "info") {',
    '  window.__CALLORIA_V801_CLOUD_STATUS__ = String(message || "").replace(/[\\u0000-\\u001f\\u007f]/g, " ").slice(0, 420);',
    '  window.__CALLORIA_V801_CLOUD_STATE__ = ["info", "success", "warning", "error"].includes(state) ? state : "info";',
    '  if (typeof renderSupervisor === "function") renderSupervisor();',
    '}',
    'if (typeof window !== "undefined" && !window.__CALLORIA_V801_CLOUD_HANDLERS__) {',
    '  document.addEventListener("click", async event => {',
    '    const syncButton = event.target?.closest?.("[data-workforce-trend-cloud-sync]");',
    '    if (syncButton) {',
    '      syncButton.disabled = true;',
    '      try {',
    '        const { client, organizationId, organizationName } = await calloriaWorkforceCloudContextV801();',
    '        const local = readWorkforceTrendHistoryV731();',
    '        if (!local.available) throw new Error("Browser-local trend history is unavailable.");',
    '        const snapshots = prepareWorkforceTrendCloudPayloadV801(local.snapshots);',
    '        if (!snapshots.length) throw new Error("There are no valid local snapshots to synchronise.");',
    '        const { data, error } = await client.rpc("calloria_sync_workforce_trend_snapshots_v802", { p_org_id: organizationId, p_snapshots: snapshots });',
    '        if (error) throw error;',
    '        const result = parseWorkforceTrendCloudSyncResultV802(data);',
    '        if (result.conflicts > 0) {',
    '          setWorkforceCloudStatusV801(`${result.inserted} new and ${result.unchanged} unchanged snapshot(s) saved. ${result.conflicts} capture-time conflict(s) were not overwritten. The organisation copy remains unchanged; keep/export this browser copy before clearing local storage.`, "warning");',
    '        } else {',
    '          setWorkforceCloudStatusV801(`${result.inserted} new and ${result.unchanged} unchanged aggregate snapshot(s) are synchronised with ${organizationName}.`, "success");',
    '        }',
    '      } catch (error) {',
    '        setWorkforceCloudStatusV801(`Cloud sync failed: ${String(error?.message || error).slice(0, 180)}. Confirm migration 202611220002 is applied.`, "error");',
    '      } finally { syncButton.disabled = false; }',
    '      return;',
    '    }',
    '    const loadButton = event.target?.closest?.("[data-workforce-trend-cloud-load]");',
    '    if (loadButton) {',
    '      loadButton.disabled = true;',
    '      try {',
    '        const { client, organizationId, organizationName } = await calloriaWorkforceCloudContextV801();',
    '        const { data, error } = await client.from("calloria_workforce_trend_snapshots").select("snapshot,captured_at").eq("organization_id", organizationId).order("captured_at", { ascending: false }).limit(90);',
    '        if (error) throw error;',
    '        const local = readWorkforceTrendHistoryV731();',
    '        if (!local.available) throw new Error("Browser-local storage is unavailable; cloud history cannot be merged safely.");',
    '        const comparison = inspectWorkforceTrendCloudConflictsV802(local.snapshots, data || []);',
    '        const merged = mergeWorkforceTrendCloudHistoryV802(local.snapshots, data || []);',
    '        if (!saveWorkforceTrendHistoryV731(merged)) throw new Error("Merged history could not be saved to this browser.");',
    '        window.__CALLORIA_V731_STORAGE_STATUS__ = `Local history merged with ${comparison.cloudCount} organisation snapshot(s).`;',
    '        if (comparison.conflictCount > 0) {',
    '          setWorkforceCloudStatusV801(`${merged.length} snapshots are available on this device for ${organizationName}. ${comparison.conflictCount} timestamp conflict(s): the local version remains on this device and the organisation version remains in cloud history. Export the local CSV before clearing browser storage.`, "warning");',
    '        } else {',
    '          setWorkforceCloudStatusV801(`${merged.length} merged snapshot(s) available on this device for ${organizationName}; ${comparison.identicalCount} were identical.`, "success");',
    '        }',
    '      } catch (error) {',
    '        setWorkforceCloudStatusV801(`Cloud history could not be loaded: ${String(error?.message || error).slice(0, 180)}. Confirm migration 202611220001 is applied.`, "error");',
    '      } finally { loadButton.disabled = false; }',
    '      return;',
    '    }',
    '  });',
    '  window.__CALLORIA_V801_CLOUD_HANDLERS__ = true;',
    '}',
    ''
  ].join('\n');
}

export function calloriaWorkforceTrendCloudSyncPluginV801() {
  return {
    name: 'calloria-workforce-trend-cloud-sync-v8-1',
    version: WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802,
    enforce: 'post',
    transform(source, id) {
      const file = normaliseId(id);
      if (!file.endsWith(MAIN_SUFFIX) || source.includes(V801_MARKER)) return null;
      const missing = [];
      if (count(source, V731_MARKER) !== 1) missing.push('v7.31 workforce trend history marker');
      if (count(source, V731_ENGINE_IMPORT) !== 1) missing.push('v7.31 trend history engine import');
      if (count(source, STATUS_ANCHOR) !== 1) missing.push('v7.31 accessible status anchor');
      if (missing.length) {
        this.warn(`CALLORIA v8.3 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        V731_ENGINE_IMPORT,
        `${V731_ENGINE_IMPORT}\nimport { inspectWorkforceTrendCloudConflictsV802, mergeWorkforceTrendCloudHistoryV802, parseWorkforceTrendCloudSyncResultV802 } from './workforce-trend-cloud-sync-engine-v802.js';\nimport { prepareWorkforceTrendCloudPayloadV801 } from './workforce-trend-cloud-sync-engine-v801.js';\nimport '../styles/calloria-workforce-trend-cloud-sync-v801.css';`
      );
      code = code.replace(STATUS_ANCHOR, `${STATUS_ANCHOR}\n${cloudControlsMarkup()}`);
      code = code.replace(
        'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
        'Compare aggregate indicators with a browser-local baseline or explicitly synchronised organisation history; conflicting capture times are reported without overwriting either copy.'
      );
      code = code.replace(
        'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.',
        'Local history remains in this browser until synchronised. Organisation history is stored in Supabase; differing snapshots with the same capture time are preserved as a reported conflict, not overwritten.'
      );
      code += handlerSource();
      return { code, map: null };
    }
  };
}
