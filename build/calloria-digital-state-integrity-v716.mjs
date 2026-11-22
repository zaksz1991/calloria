export const CALLORIA_DIGITAL_STATE_METRICS_MARKER = '__CALLORIA_DIGITAL_STATE_METRICS_V716__';
export const CALLORIA_DIGITAL_STATE_UI_MARKER = '__CALLORIA_DIGITAL_STATE_UI_V716__';

const ENGINE_SUFFIX = '/js/multichannel-engine.js';
const MAIN_SUFFIX = '/js/main.js';
const ENGINE_METRIC_ANCHOR = 'awaitingCustomer: items.filter(item => item.status === DIGITAL_STATUS.PENDING_CUSTOMER).length,';
const UI_METRIC_ANCHOR = '<div class="data-row"><span>Pending customer response</span><strong>${metrics.awaitingCustomer}</strong></div>';

export function transformDigitalQueueMetricsSource(source) {
  const code = String(source ?? '');
  if (code.includes(CALLORIA_DIGITAL_STATE_METRICS_MARKER)) {
    return { code, changed: false, alreadyPatched: true, reason: null };
  }

  const metricCount = code.split(ENGINE_METRIC_ANCHOR).length - 1;
  if (metricCount !== 1) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: `Digital state metric anchor matched ${metricCount} times; expected exactly once.`
    };
  }

  const importLine = "import { digitalCustomerStateMetrics as calloriaDigitalCustomerStateMetrics } from './digital-customer-state-metrics-v716.js';";
  if (code.includes(importLine) || code.includes('calloriaDigitalCustomerStateMetrics')) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: 'Digital state metrics helper appears partially installed; refusing a duplicate or partial transform.'
    };
  }

  const output = `// ${CALLORIA_DIGITAL_STATE_METRICS_MARKER}\n${importLine}\n${code.replace(ENGINE_METRIC_ANCHOR, '...calloriaDigitalCustomerStateMetrics(items, DIGITAL_STATUS),')}`;
  return { code: output, changed: true, alreadyPatched: false, reason: null };
}

export function transformDigitalQueueUiSource(source) {
  const code = String(source ?? '');
  if (code.includes(CALLORIA_DIGITAL_STATE_UI_MARKER)) {
    return { code, changed: false, alreadyPatched: true, reason: null };
  }

  const anchorCount = code.split(UI_METRIC_ANCHOR).length - 1;
  if (anchorCount !== 1) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: `Digital pending-customer UI anchor matched ${anchorCount} times; expected exactly once.`
    };
  }

  const replacement = `${UI_METRIC_ANCHOR}<div class="data-row"><span>Active threads awaiting customer</span><strong>\u0024{metrics.awaitingCustomer}</strong></div><div class="data-row"><span>CRM cases pending customer</span><strong>\u0024{metrics.pendingCustomerCases}</strong></div><!-- ${CALLORIA_DIGITAL_STATE_UI_MARKER} -->`;
  return { code: code.replace(UI_METRIC_ANCHOR, replacement), changed: true, alreadyPatched: false, reason: null };
}

export function calloriaDigitalStateIntegrityPluginV716() {
  return {
    name: 'calloria-digital-customer-state-integrity-v7-16',
    enforce: 'post',
    transform(source, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (cleanId.endsWith(ENGINE_SUFFIX)) {
        const result = transformDigitalQueueMetricsSource(source);
        if (result.alreadyPatched) return null;
        if (!result.changed) {
          this.warn(`[CALLORIA v7.16] ${cleanId}: ${result.reason} Queue metrics were not modified.`);
          return null;
        }
        return { code: result.code, map: null };
      }
      if (cleanId.endsWith(MAIN_SUFFIX)) {
        const result = transformDigitalQueueUiSource(source);
        if (result.alreadyPatched) return null;
        if (!result.changed) {
          this.warn(`[CALLORIA v7.16] ${cleanId}: ${result.reason} Digital reporting rows were not modified.`);
          return null;
        }
        return { code: result.code, map: null };
      }
      return null;
    }
  };
}
