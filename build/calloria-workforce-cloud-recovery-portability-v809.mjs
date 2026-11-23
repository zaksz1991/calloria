/** CALLORIA v8.9 — post-transform portability controls for the v8.8 recovery checklist. */
const MAIN_SUFFIX = '/js/main.js';
const V808_MARKER = 'CALLORIA_V808_WORKFORCE_CLOUD_RECOVERY_PROGRESS';
const V809_MARKER = 'CALLORIA_V809_WORKFORCE_CLOUD_RECOVERY_PORTABILITY';
const V810_MARKER = 'CALLORIA_V810_WORKFORCE_CLOUD_RECOVERY_HANDOVER';
const V811_MARKER = 'CALLORIA_V811_WORKFORCE_CLOUD_RECOVERY_HANDOVER_VERIFICATION';
const V812_MARKER = 'CALLORIA_V812_WORKFORCE_CLOUD_RECOVERY_HANDOVER_COMPARISON';

const IMPORTS = [
  "import { createWorkforceTrendRecoveryProgressBackupV809, verifyWorkforceTrendRecoveryProgressBackupV809, mergeWorkforceTrendRecoveryProgressV809, WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_VERSION_V809, WORKFORCE_TREND_CLOUD_RECOVERY_PORTABILITY_MAX_BYTES_V809 } from './workforce-trend-cloud-recovery-portability-engine-v809.js';",
  "import { createWorkforceTrendCloudRecoveryHandoverV810 } from './workforce-trend-cloud-recovery-handover-engine-v810.js';",
  "import { verifyWorkforceTrendCloudRecoveryHandoverV811, WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811 } from './workforce-trend-cloud-recovery-handover-verification-engine-v811.js';",
  "import { compareWorkforceTrendCloudRecoveryHandoversV812 } from './workforce-trend-cloud-recovery-handover-comparison-engine-v812.js';",
  "import '../styles/calloria-workforce-cloud-recovery-portability-v809.css';"
].join('\n');

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}

function handlerSource() {
  return String.raw`
/* ${V809_MARKER} */
/* ${V810_MARKER} */
/* ${V811_MARKER} */
/* ${V812_MARKER} */
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
    const verifyHandoverButton = document.createElement('button');
    verifyHandoverButton.type = 'button';
    verifyHandoverButton.className = 'btn secondary';
    verifyHandoverButton.textContent = 'Verify handover report';
    verifyHandoverButton.dataset.workforceCloudRecoveryHandoverVerify = 'true';
    const verifyHandoverFile = document.createElement('input');
    verifyHandoverFile.type = 'file';
    verifyHandoverFile.accept = 'application/json,.json';
    verifyHandoverFile.hidden = true;
    verifyHandoverFile.dataset.workforceCloudRecoveryHandoverFile = 'true';
    verifyHandoverFile.setAttribute('aria-label', 'Select a CALLORIA recovery handover report to verify');
    const compareHandoverButton = document.createElement('button');
    compareHandoverButton.type = 'button';
    compareHandoverButton.className = 'btn secondary';
    compareHandoverButton.textContent = 'Compare two handover reports';
    compareHandoverButton.dataset.workforceCloudRecoveryHandoverCompare = 'true';
    const compareHandoverFile = document.createElement('input');
    compareHandoverFile.type = 'file';
    compareHandoverFile.accept = 'application/json,.json';
    compareHandoverFile.multiple = true;
    compareHandoverFile.hidden = true;
    compareHandoverFile.dataset.workforceCloudRecoveryHandoverCompareFile = 'true';
    compareHandoverFile.setAttribute('aria-label', 'Select two CALLORIA recovery handover reports to compare');
    const comparisonResults = document.createElement('section');
    comparisonResults.className = 'wth-cloud-handover-comparison-results';
    comparisonResults.dataset.workforceCloudRecoveryHandoverResults = 'true';
    comparisonResults.hidden = true;
    comparisonResults.setAttribute('aria-live', 'polite');
    const handoverButton = document.createElement('button');
    handoverButton.type = 'button';
    handoverButton.className = 'btn secondary';
    handoverButton.textContent = 'Export recovery handover';
    handoverButton.dataset.workforceCloudRecoveryHandover = 'true';
    actions.append(exportButton, importButton, handoverButton, verifyHandoverButton, compareHandoverButton, file, verifyHandoverFile, compareHandoverFile);
    toolbar.append(title, note, actions, comparisonResults);
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

  function renderHandoverComparison(host, comparison) {
    const panel = host?.querySelector('[data-workforce-cloud-recovery-handover-results]');
    if (!panel) return;
    panel.replaceChildren();
    panel.hidden = false;
    panel.dataset.outcome = comparison.outcome;
    const heading = document.createElement('strong');
    heading.textContent = comparison.outcome === 'improved' ? 'Checklist progress improved'
      : comparison.outcome === 'regressed' ? 'Checklist progress regressed'
        : comparison.outcome === 'mixed' ? 'Mixed checklist movement' : 'Checklist progress unchanged';
    const summary = document.createElement('p');
    const sign = comparison.completedStepDelta > 0 ? '+' : '';
    const percentSign = comparison.completionPercentDelta > 0 ? '+' : '';
    summary.textContent = comparison.before.completedSteps + ' / ' + comparison.before.totalSteps +
      ' (' + comparison.before.completionPercent + '%) → ' + comparison.after.completedSteps +
      ' / ' + comparison.after.totalSteps + ' (' + comparison.after.completionPercent + '%); ' +
      sign + comparison.completedStepDelta + ' completed steps; ' + percentSign + comparison.completionPercentDelta + ' percentage points.';
    const detail = document.createElement('p');
    detail.textContent = comparison.improvedAreas + ' area(s) improved, ' + comparison.regressedAreas +
      ' regressed, ' + comparison.unchangedAreas + ' unchanged.';
    const list = document.createElement('ul');
    for (const item of comparison.items) {
      const row = document.createElement('li');
      const delta = item.delta > 0 ? '+' + item.delta : String(item.delta);
      row.textContent = item.label + ': ' + item.beforeCompletedSteps + ' → ' + item.afterCompletedSteps +
        ' / ' + item.totalSteps + ' (' + delta + ', ' + item.direction + ')';
      list.append(row);
    }
    const chronology = document.createElement('p');
    chronology.textContent = comparison.sameTimestamp
      ? 'Both reports have the same export timestamp; the selected file order was used.'
      : 'Reports are ordered by their export timestamps.';
    const limitation = document.createElement('p');
    limitation.className = 'wth-cloud-handover-comparison-limitation';
    limitation.textContent = comparison.limitation;
    panel.append(heading, summary, detail, list, chronology, limitation);
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
    const compareButton = event.target?.closest?.('[data-workforce-cloud-recovery-handover-compare]');
    if (compareButton) {
      const host = document.querySelector(hostSelector);
      host?.querySelector('[data-workforce-cloud-recovery-handover-compare-file]')?.click();
      return;
    }
    const verifyHandoverButton = event.target?.closest?.('[data-workforce-cloud-recovery-handover-verify]');
    if (verifyHandoverButton) {
      const host = document.querySelector(hostSelector);
      host?.querySelector('[data-workforce-cloud-recovery-handover-file]')?.click();
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
    const compareInput = event.target?.closest?.('[data-workforce-cloud-recovery-handover-compare-file]');
    if (compareInput) {
      const files = Array.from(compareInput.files || []);
      const host = document.querySelector(hostSelector);
      compareInput.disabled = true;
      try {
        if (files.length !== 2) throw new Error('Select exactly two JSON handover reports.');
        if (files.some(file => file.size > WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811)) {
          throw new Error('Each handover report must be no larger than 256 KiB.');
        }
        const comparison = await compareWorkforceTrendCloudRecoveryHandoversV812(
          await files[0].text(), await files[1].text(), { cryptoObject: window.crypto }
        );
        renderHandoverComparison(host, comparison);
        setStatus(
          'Both handover checksums passed. Checklist progress ' + comparison.outcome + ': ' +
          (comparison.completedStepDelta > 0 ? '+' : '') + comparison.completedStepDelta +
          ' completed step(s). Confirm both reports belong to the same organisation. No data was imported, uploaded or changed.',
          comparison.outcome === 'regressed' || comparison.outcome === 'mixed' ? 'warning' : 'success'
        );
      } catch (error) {
        const panel = host?.querySelector('[data-workforce-cloud-recovery-handover-results]');
        if (panel) { panel.replaceChildren(); panel.hidden = true; }
        setStatus('Handover comparison failed: ' + safeStatusError(error) + ' No data was imported or changed.', 'error');
      } finally {
        compareInput.value = '';
        compareInput.disabled = false;
      }
      return;
    }
    const handoverFileInput = event.target?.closest?.('[data-workforce-cloud-recovery-handover-file]');
    const handoverFile = handoverFileInput?.files?.[0];
    if (handoverFile) {
      handoverFileInput.disabled = true;
      try {
        if (handoverFile.size > WORKFORCE_TREND_CLOUD_HANDOVER_VERIFICATION_MAX_BYTES_V811) {
          throw new Error('The selected handover report exceeds the 256 KiB verification limit.');
        }
        const verified = await verifyWorkforceTrendCloudRecoveryHandoverV811(await handoverFile.text(), { cryptoObject: window.crypto });
        setStatus(
          'Handover report integrity verified: ' + verified.completedSteps + ' of ' + verified.totalSteps +
          ' checklist steps (' + verified.completionPercent + '%) were marked complete when exported. ' +
          'This does not prove authorship or successful repairs. No data was imported, uploaded or changed.',
          'success'
        );
      } catch (error) {
        setStatus('Handover report verification failed: ' + safeStatusError(error) + ' No data was imported or changed.', 'error');
      } finally {
        handoverFileInput.value = '';
        handoverFileInput.disabled = false;
      }
      return;
    }
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
    name: 'calloria-workforce-cloud-recovery-portability-v8-12',
    enforce: 'post',
    transform(code, id) {
      if (!normaliseId(id).endsWith(MAIN_SUFFIX)) return null;
      if (!String(code).includes(V808_MARKER)) return null;
      if (String(code).includes(V809_MARKER) || String(code).includes(V810_MARKER) || String(code).includes(V811_MARKER) || String(code).includes(V812_MARKER)) return null;
      return `${IMPORTS}\n${code}\n${handlerSource()}`;
    }
  };
}
