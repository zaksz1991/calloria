/**
 * CALLORIA v7.18 Vite transform.
 * Replaces the digital screen's priority-only queue sort with SLA-aware,
 * ageing-protected triage and annotates the two existing queue views.
 */
const MARKER = '/* CALLORIA_V718_DIGITAL_SLA_TRIAGE */';
const MAIN_ID = /[\\/]js[\\/]main\.js$/;

function occurrences(source, needle) {
  if (!needle) return 0;
  return source.split(needle).length - 1;
}

function replaceOnce(source, needle, replacement) {
  if (occurrences(source, needle) !== 1) return null;
  return source.replace(needle, replacement);
}

export function calloriaDigitalSlaTriagePluginV718() {
  return {
    name: 'calloria-digital-sla-triage-v7-18',
    enforce: 'post',
    transform(source, id) {
      if (!MAIN_ID.test(String(id).split('?')[0])) return null;
      if (source.includes(MARKER)) return null;

      const importAnchor = "import { assessDigitalSla, digitalSlaDisplay, advanceDigitalSlaMonitor, digitalSlaMetrics } from './digital-sla-engine.js';";
      const quickQueueAnchor = "const quickQueue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow }).slice(0, 5);";
      const fullQueueAnchor = "const queue = sortDigitalQueue(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow });";
      const slaBadgeAnchor = '<span class="digital-sla-pill ${assessDigitalSla(item, digitalNow).status}">${escapeHTML(digitalSlaDisplay(assessDigitalSla(item, digitalNow)))}</span>';

      const requirements = [
        [importAnchor, 'digital SLA import'],
        [quickQueueAnchor, 'active-thread quick queue'],
        [fullQueueAnchor, 'main digital queue'],
        [slaBadgeAnchor, 'digital SLA queue badge']
      ];
      const mismatches = requirements.filter(([needle, label]) => occurrences(source, needle) !== (label === 'digital SLA queue badge' ? 2 : 1));
      if (mismatches.length) {
        this.warn(`CALLORIA v7.18 skipped safely: ${mismatches.map(([, label]) => label).join(', ')} did not match exactly once. No partial transform was applied.`);
        return null;
      }

      let code = source;
      code = replaceOnce(code, importAnchor, `${importAnchor}\nimport { sortDigitalQueueBySla } from './digital-triage-engine-v718.js';`);
      code = replaceOnce(code, quickQueueAnchor,
        "const quickQueue = sortDigitalQueueBySla(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow, baseSorter: sortDigitalQueue, slaAssessor: assessDigitalSla }).slice(0, 5);");
      code = replaceOnce(code, fullQueueAnchor,
        "const queue = sortDigitalQueueBySla(state.digitalQueue, { channel: state.digitalChannelFilter || 'all', now: digitalNow, baseSorter: sortDigitalQueue, slaAssessor: assessDigitalSla });");

      const badgeReplacement = `${slaBadgeAnchor}<span class="pill \${item.triageStatus === 'breached' ? 'red' : item.triageStatus === 'at_risk' ? 'amber' : ''}" title="\${escapeHTML(item.triageReason)}">\${escapeHTML(item.triageReason)}</span>`;
      code = code.split(slaBadgeAnchor).join(badgeReplacement);
      if (!code) {
        this.warn('CALLORIA v7.18 skipped safely: a queue insertion could not be applied. No partial transform was returned.');
        return null;
      }
      return { code: `${MARKER}\n${code}`, map: null };
    }
  };
}

export { MARKER as CALLORIA_V718_MARKER };
