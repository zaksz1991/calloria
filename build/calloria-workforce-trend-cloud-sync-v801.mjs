import { WORKFORCE_TREND_CLOUD_SYNC_VERSION } from '../js/workforce-trend-cloud-sync-engine-v801.js';

/** CALLORIA v8.1 — explicit organisation-scoped cloud sync for aggregate workforce history. */
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
    '      <div><strong>Organisation history</strong><small>Explicitly synchronise aggregate snapshots across authorised organisation members and devices.</small></div>',
    '      <div class="wth-cloud-sync-buttons"><button type="button" class="btn secondary" data-workforce-trend-cloud-sync>Save local history to organisation</button><button type="button" class="btn secondary" data-workforce-trend-cloud-load>Load and merge organisation history</button></div>',
    '      <p class="wth-cloud-status" role="status" aria-live="polite">${escapeHTML(window.__CALLORIA_V801_CLOUD_STATUS__ || "Cloud history requires a signed-in organisation workspace with report access.")}</p>',
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
    'function setWorkforceCloudStatusV801(message) {',
    '  window.__CALLORIA_V801_CLOUD_STATUS__ = String(message || "").replace(/[\\u0000-\\u001f\\u007f]/g, " ").slice(0, 260);',
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
    '        const { data, error } = await client.rpc("calloria_save_workforce_trend_snapshots", { p_org_id: organizationId, p_snapshots: snapshots });',
    '        if (error) throw error;',
    '        setWorkforceCloudStatusV801(`${Number(data) || snapshots.length} aggregate snapshot(s) saved to ${organizationName}.`);',
    '      } catch (error) {',
    '        setWorkforceCloudStatusV801(`Cloud sync failed: ${String(error?.message || error).slice(0, 180)}. Confirm migration 202611220001 is applied.`);',
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
    '        const merged = mergeWorkforceTrendCloudHistoryV801(local.snapshots, data || []);',
    '        if (!saveWorkforceTrendHistoryV731(merged)) throw new Error("Merged history could not be saved to this browser.");',
    '        window.__CALLORIA_V731_STORAGE_STATUS__ = `Local history merged with ${cloudTrendRowsToSnapshotsV801(data || []).length} organisation snapshot(s).`;',
    '        setWorkforceCloudStatusV801(`${merged.length} merged snapshot(s) available for ${organizationName} on this device.`);',
    '      } catch (error) {',
    '        setWorkforceCloudStatusV801(`Cloud history could not be loaded: ${String(error?.message || error).slice(0, 180)}. Confirm migration 202611220001 is applied.`);',
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
    version: WORKFORCE_TREND_CLOUD_SYNC_VERSION,
    enforce: 'post',
    transform(source, id) {
      const file = normaliseId(id);
      if (!file.endsWith(MAIN_SUFFIX) || source.includes(V801_MARKER)) return null;
      const missing = [];
      if (count(source, V731_MARKER) !== 1) missing.push('v7.31 workforce trend history marker');
      if (count(source, V731_ENGINE_IMPORT) !== 1) missing.push('v7.31 trend history engine import');
      if (count(source, STATUS_ANCHOR) !== 1) missing.push('v7.31 accessible status anchor');
      if (missing.length) {
        this.warn(`CALLORIA v8.1 skipped safely: ${missing.join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }
      let code = source.replace(
        V731_ENGINE_IMPORT,
        `${V731_ENGINE_IMPORT}\nimport { cloudTrendRowsToSnapshotsV801, mergeWorkforceTrendCloudHistoryV801, prepareWorkforceTrendCloudPayloadV801 } from './workforce-trend-cloud-sync-engine-v801.js';\nimport '../styles/calloria-workforce-trend-cloud-sync-v801.css';`
      );
      code = code.replace(
        STATUS_ANCHOR,
        `${STATUS_ANCHOR}\n${cloudControlsMarkup()}`
      );
      code = code.replace(
        'Compare current aggregate workforce indicators with a manually captured browser-local baseline.',
        'Compare aggregate indicators with a browser-local baseline or an explicitly synchronised organisation history.'
      );
      code = code.replace(
        'History is stored in this browser localStorage on this device. It is not a Supabase write, organisation-wide shared record, or cloud backup.',
        'Local history stays in this browser until explicitly synchronised. Organisation snapshots are stored in Supabase and shared only with members authorised to read organisation reports.'
      );
      code += handlerSource();
      return { code, map: null };
    }
  };
}
