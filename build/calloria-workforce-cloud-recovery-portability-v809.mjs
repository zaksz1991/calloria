/** CALLORIA v8.9 — post-transform portability controls for the v8.8 recovery checklist. */
const MAIN_SUFFIX = '/js/main.js';
const V808_MARKER = 'CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS';
const V809_MARKER = 'CALLORIA_V809_WORKFORCE_CLOUD_RECOVERY_PORTABILITY';
const V810_MARKER = 'CALLORIA_V810_WORKFORCE_CLOUD_RECOVERY_HANDOVER';

const IMPORTS = [
  "import { createWorkforceTrendRecoveryProgressBackupV809, verifyWorkforceTrendRecoveryProgressBackupV809, mergeWorkforceTrendRecoveryProgressV809, WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809, WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809 } from './workforce-trend-cloud-recovery-portability-engine-v809.js';",
  "import { createWorkforceTrendCloudRecoveryHandoverV810 } from './workforce-trend-cloud-recovery-handover-engine-v810.js';",
  "import '../styles/calloria-workforce-cloud-recovery-portability-v809.css';"
].join('\n');

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}

function handlerSource() {
  return String.raw`
/* ${V809_MARKER} */
/* ${V810_MARKER} */
;(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.__CALLORIA_V809_RECOVERY_PORTABILITY_READY__) return;

  const hostSelector = '[data-workforce-cloud-remediation]';
  const getPlan = () => Array.isArray(window.__CALLORIA_V807_CLOUD_REMEDIATIONS__) ? window.__CALLORIA_V807_CLOUD_REMEDIATIONS__ : [];
  const getScope = () => typeof window.__CALLORIA_V808_CLOUD_RECOVERY_STORAGE_KEY__ === 'string' ? window.__CALLORIA_V808_CLOUD_RECOVERY_STORAGE_KEY__ : '';
  const setStatus = (message, tone = 'info') => {
    if (typeof setWorkforceCloudStatusV801 === 'function') setWorkforceCloudStatusV801(message, tone);
  };
  const safeStatusError = error => String(error?.message || error).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 200);

  function ensurePortabilityControls() {
    const host = document.querySelector(hostSelector);
    const plan = getPlan();
    if (!host || !plan.length || host.querySelector('[data-workforce-cloud-progress-portability]')) return;

    const toolbar = document.createElement('section');
    toolbar.className = 'wth-cloud-progress-portability';
    toolbar.dataset.workforceCloudProgressPortability = 'true';
    toolbar.dataset.engineVersion = WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809;
    toolbar.setAttribute('aria-label', 'Recovery checklist backup and restore');

    const title = document.createElement('strong');
    title.textContent = 'Checklist portability';
    const note = document.createElement('p');
    note.textContent = 'Export or import only the recovery checklist ticks. The file is organisation-scoped and SHA-256 checked; it does not contain workforce history or account data.';

    const actions = document.createElement('div');
    actions.className = 'wth-cloud-progress-portability-actions';
    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'btn secondary';
    exportButton.textContent = 'Export checklist backup';
    exportButton.dataset.workforceCloudProgressExport = 'true';
    const importButton = document.createElement('button');
    importButton.type = 'button';
    importButton.className = 'btn secondary';
    importButton.textContent = 'Import checklist backup';
    importButton.dataset.workforceCloudProgressImport = 'true';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    file.dataset.workforceCloudProgressFile = 'true';
    file.setAttribute('aria-label', 'Select a CALLORIA recovery checklist backup');
    const handoverButton = document.createElement('button');
    handoverButton.type = 'button';
    handoverButton.className = 'btn secondary';
    handoverButton.textContent = 'Export recovery handover';
    handoverButton.dataset.workforceCloudRecoveryHandover = 'true';
    actions.append(exportButton, importButton, handoverButton, file);
    toolbar.append(title, note, actions);
    host.prepend(toolbar);
  }

  function downloadFile(fileName, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  document.addEventListener('click', async event => {
    const handoverButton = event.target?.closest?.('[data-workforce-cloud-recovery-handover]');
    if (handoverButton) {
      if (handoverButton.disabled) return;
      handoverButton.disabled = true;
      try {
        const handover = await createWorkforceTrendCloudRecoveryHandoverV810({
          organisationScopeKey: getScope(),
          plan: getPlan(),
          progress: window.__CALLORIA_V808_CLOUD_RECOVERY_PROGRESS__ || {},
          cryptoObject: window.crypto
        });
        downloadFile(handover.jsonFileName, handover.json, 'application/json;charset=utf-8');
        downloadFile(handover.textFileName, handover.text, 'text/plain;charset=utf-8');
        setStatus('Recovery handover exported: ' + handover.completedSteps + ' of ' + handover.totalSteps + ' checklist steps marked complete. This is progress evidence only, not proof that repairs succeeded.', 'success');
      } catch (error) {
        setStatus('Recovery handover export failed: ' + safeStatusError(error), 'error');
      } finally {
        handoverButton.disabled = false;
      }
      return;
    }
    const exportButton = event.target?.closest?.('[data-workforce-cloud-progress-export]');
    if (exportButton) {
      if (exportButton.disabled) return;
      exportButton.disabled = true;
      try {
        const plan = getPlan();
        const scopeKey = getScope();
        if (!scopeKey || !plan.length) throw new Error('Run the read-only cloud health check in an organisation workspace before exporting checklist progress.');
        const backup = await createWorkforceTrendRecoveryProgressBackupV809({
          organisationScopeKey: scopeKey,
          plan,
          progress: window.__CALLORIA_V808_CLOUD_RECOVERY_PROGRESS__ || {},
          cryptoObject: window.crypto
        });
        downloadFile(backup.fileName, backup.json, 'application/json;charset=utf-8');
        setStatus('Verified checklist backup exported: ' + backup.completedSteps + ' of ' + backup.totalSteps + ' steps marked complete. Keep the JSON file somewhere secure.', 'success');
      } catch (error) {
        setStatus('Checklist export failed: ' + safeStatusError(error), 'error');
      } finally {
        exportButton.disabled = false;
      }
      return;
    }

    const importButton = event.target?.closest?.('[data-workforce-cloud-progress-import]');
    if (importButton) {
      const host = document.querySelector(hostSelector);
      host?.querySelector('[data-workforce-cloud-progress-file]')?.click();
    }
  });

  document.addEventListener('change', async event => {
    const fileInput = event.target?.closest?.('[data-workforce-cloud-progress-file]');
    const file = fileInput?.files?.[0];
    if (!file) return;
    fileInput.disabled = true;
    try {
      if (file.size > WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809) {
        throw new Error('The selected recovery checklist backup exceeds the 256 KiB file limit.');
      }
      const plan = getPlan();
      const scopeKey = getScope();
      if (!scopeKey || !plan.length) throw new Error('Run the read-only cloud health check in the intended organisation workspace before importing checklist progress.');
      const verified = await verifyWorkforceTrendRecoveryProgressBackupV809(await file.text(), {
        expectedOrganisationScopeKey: scopeKey,
        plan,
        cryptoObject: window.crypto
      });
      const approved = window.confirm(
        'Verified CALLORIA recovery checklist backup.\nExported: ' + new Date(verified.exportedAt).toLocaleString() +
        '.\nSteps marked complete in file: ' + verified.completedSteps + ' of ' + verified.totalSteps +
        '.\n\nMerge these checklist ticks with the progress already saved on this browser for the active organisation? Existing progress is retained. No Supabase or workforce history records will be changed.'
      );
      if (!approved) {
        setStatus('Checklist backup verified. Import cancelled; no progress was changed.', 'info');
        return;
      }
      const current = window.__CALLORIA_V808_CLOUD_RECOVERY_PROGRESS__ || {};
      const merged = mergeWorkforceTrendRecoveryProgressV809(current, verified.progress, plan);
      const saved = saveWorkforceTrendRecoveryProgressV808(window.localStorage, scopeKey, merged, plan);
      if (!saved) throw new Error('The verified checklist could not be saved in this browser. Existing checklist progress was not replaced.');
      window.__CALLORIA_V808_CLOUD_RECOVERY_PROGRESS__ = merged;
      const report = window.__CALLORIA_V806_CLOUD_HEALTH_REPORT__;
      if (report && typeof renderWorkforceTrendCloudRemediationV807 === 'function') renderWorkforceTrendCloudRemediationV807(report);
      setStatus('Checklist progress imported and merged: ' + verified.completedSteps + ' file step(s) checked. Rerun the read-only health check to verify any repairs. No cloud history was changed.', 'success');
    } catch (error) {
      setStatus('Checklist import failed: ' + safeStatusError(error) + ' No checklist or cloud history was changed.', 'error');
    } finally {
      fileInput.value = '';
      fileInput.disabled = false;
    }
  });

  const ready = () => ensurePortabilityControls();
  const observeHost = () => {
    const host = document.querySelector(hostSelector);
    if (!host || host.dataset.workforceCloudProgressObserved === 'true') return;
    host.dataset.workforceCloudProgressObserved = 'true';
    const observer = new MutationObserver(ready);
    observer.observe(host, { childList: true });
    ready();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observeHost, { once: true });
  else observeHost();
  const bodyObserver = new MutationObserver(observeHost);
  bodyObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.__CALLORIA_V809_RECOVERY_PORTABILITY_READY__ = true;
})();
`;
}

export function calloriaWorkforceCloudRecoveryPortabilityPluginV809() {
  return {
    name: 'calloria-workforce-cloud-recovery-portability-v8-10',
    enforce: 'post',
    transform(code, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX)) return null;
      if (!String(code).includes(V808_MARKER)) return null;
      if (String(code).includes(V809_MARKER) || String(code).includes(V810_MARKER)) return null;
      return `${IMPORTS}\n${code}\n${handlerSource()}`;
    }
  };
}
