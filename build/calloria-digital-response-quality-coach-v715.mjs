export const CALLORIA_DIGITAL_COACH_MARKER = '__CALLORIA_DIGITAL_RESPONSE_QUALITY_V715__';
const TARGET_SUFFIX = '/js/main.js';
const MULTICHANNEL_IMPORT = "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';";
const COMPOSER_ANCHOR = '        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class="digital-template-row">';

export function transformCalloriaDigitalMainSource(source) {
  const code = String(source ?? '');
  if (code.includes(CALLORIA_DIGITAL_COACH_MARKER)) {
    return { code, changed: false, alreadyPatched: true };
  }
  const importCount = code.split(MULTICHANNEL_IMPORT).length - 1;
  const composerCount = code.split(COMPOSER_ANCHOR).length - 1;
  if (importCount !== 1 || composerCount !== 1) {
    return {
      code,
      changed: false,
      alreadyPatched: false,
      reason: `Digital reply source anchors did not match exactly once (multichannel import: ${importCount}; composer: ${composerCount}).`
    };
  }

  let output = code.replace(
    MULTICHANNEL_IMPORT,
    `${MULTICHANNEL_IMPORT}\nimport { renderDigitalResponseCoach } from './digital-response-quality-coach-v715.js';\nimport '../styles/calloria-digital-response-quality-v715.css'; // ${CALLORIA_DIGITAL_COACH_MARKER}`
  );
  output = output.replace(COMPOSER_ANCHOR, `        \${renderDigitalResponseCoach(active)}\n${COMPOSER_ANCHOR}`);
  return { code: output, changed: true, alreadyPatched: false, reason: null };
}

export function calloriaDigitalResponseQualityCoachPluginV715() {
  return {
    name: 'calloria-digital-response-quality-coach-v7-15',
    enforce: 'post',
    transform(source, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (!cleanId.endsWith(TARGET_SUFFIX)) return null;
      const result = transformCalloriaDigitalMainSource(source);
      if (result.alreadyPatched) return null;
      if (!result.changed) {
        this.warn(`[CALLORIA v7.15] ${cleanId}: ${result.reason} Digital response coach was not injected.`);
        return null;
      }
      return { code: result.code, map: null };
    }
  };
}
