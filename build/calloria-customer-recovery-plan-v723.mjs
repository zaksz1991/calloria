/** CALLORIA v7.23 — inject a compact recovery plan into every Customer 360 panel. */
const PLUGIN_NAME = 'calloria-customer-recovery-plan-v7-23';
const MARKER = '/* CALLORIA_V723_CUSTOMER_RECOVERY_PLAN */';
const MAIN_SUFFIX = '/js/main.js';
const IMPORT_ANCHOR = "import { createCustomerContinuityState, normalizeCustomerContinuityState, recordCustomerInteraction, getCustomerContinuityContext, customerContinuityMetrics } from './customer-continuity-engine.js';";
const PANEL_ANCHOR = 'function renderCustomerContinuityPanel(customer, channel, identity = {}) {';
const CONTEXT_ANCHOR = '  const context = getCustomerContinuityContext(state.customerContinuity, { customer, customerRef: identity.customerRef || identity.customerId });';
const FOOTNOTE_ANCHOR = '<p class="muted-note">Match basis: ${escapeHTML(matchLabel)}.';
function count(source, needle) { return source.split(needle).length - 1; }
// Build the helper as a source string without relying on runtime HTML helpers outside main.js.
function recoveryHelperSource() {
  return `${MARKER}
function renderCustomerRecoveryPlanPanelV723(plan) {
  if (!plan || !plan.customerFound) return '';
  const tone = plan.level === 'urgent' ? 'urgent' : plan.level === 'priority' ? 'priority' : plan.level === 'watch' ? 'watch' : 'standard';
  const reasons = plan.reasons.map(item => '<li>' + escapeHTML(item) + '</li>').join('');
  const actions = plan.actions.map((item, index) => '<li><strong>' + (index + 1) + '.</strong> ' + escapeHTML(item) + '</li>').join('');
  const metrics = '<span>' + plan.interactionCount + ' recorded contacts</span><span>' + plan.recentRepeatCount + ' recent repeats</span><span>' + plan.openFollowUpCount + ' open follow-ups</span>';
  const reasonBlock = reasons ? '<h5>RECOVERY SIGNALS</h5><ul>' + reasons + '</ul>' : '';
  return '<details class="customer-recovery-plan-v723 ' + tone + '"><summary><span><strong>CUSTOMER RECOVERY PLAN</strong><small>' + escapeHTML(plan.label) + ' · ' + plan.interactionCount + ' contacts · ' + plan.openFollowUpCount + ' open follow-ups</small></span><span class="customer-recovery-chevron" aria-hidden="true">＋</span></summary><div class="customer-recovery-plan-body"><div class="customer-recovery-metrics">' + metrics + '</div>' + reasonBlock + '<h5>NEXT BEST ACTIONS</h5><ol>' + actions + '</ol><p>Guidance only · based on synthetic Customer 360 history. It does not change case ownership or close customer work.</p></div></details>';
}
`;
}

export function transformCustomerRecoveryPlanV723(source) {
  const original = String(source ?? '');
  if (original.includes(MARKER)) return { code: original, changed: false, alreadyPatched: true, reason: null };
  const anchors = [
    ['customer continuity engine import', IMPORT_ANCHOR],
    ['Customer 360 panel function', PANEL_ANCHOR],
    ['Customer 360 context declaration', CONTEXT_ANCHOR],
    ['Customer 360 footer insertion point', FOOTNOTE_ANCHOR]
  ];
  const mismatches = anchors.filter(([, needle]) => count(original, needle) !== 1);
  if (mismatches.length) {
    return { code: original, changed: false, alreadyPatched: false, reason: `Expected exactly one anchor for: ${mismatches.map(([label]) => label).join(', ')}.` };
  }
  let code = original.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport { assessCustomerRecoveryPlan } from './customer-recovery-plan-engine-v723.js';\nimport '../styles/customer-recovery-plan-v723.css';`);
  code = code.replace(PANEL_ANCHOR, `${recoveryHelperSource()}\n${PANEL_ANCHOR}`);
  code = code.replace(CONTEXT_ANCHOR, `${CONTEXT_ANCHOR}\n  const recoveryPlan = assessCustomerRecoveryPlan(context, { channel, now: queueSimulationNowMs() });\n  const recoveryPlanHtml = renderCustomerRecoveryPlanPanelV723(recoveryPlan);`);
  code = code.replace(FOOTNOTE_ANCHOR, '${recoveryPlanHtml}<p class="muted-note">Match basis: ${escapeHTML(matchLabel)}.');
  return { code, changed: true, alreadyPatched: false, reason: null };
}

export function calloriaCustomerRecoveryPlanPluginV723() {
  return {
    name: PLUGIN_NAME,
    enforce: 'post',
    transform(source, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith(MAIN_SUFFIX)) return null;
      const result = transformCustomerRecoveryPlanV723(source);
      if (result.alreadyPatched) return null;
      if (!result.changed) {
        this.warn(`[${PLUGIN_NAME}] skipped safely: ${result.reason} No partial transform was applied.`);
        return null;
      }
      return { code: result.code, map: null };
    }
  };
}
