/**
 * CALLORIA v7.22 — unified activation of digital workflow and response-cycle features.
 * Runs v7.20 (v7.15–v7.18 + disposition evidence) before v7.21 follow-up response SLAs.
 */
import { calloriaDigitalWorkflowSuitePluginV720 } from './calloria-digital-workflow-suite-v720.mjs';
import { calloriaDigitalResponseCyclePluginV721 } from './calloria-digital-response-cycle-v721.mjs';

const V720_MARKER = '/* CALLORIA_V720_DIGITAL_DISPOSITION_INTEGRITY */';
const V721_MARKER = '/* CALLORIA_V721_DIGITAL_RESPONSE_CYCLE */';
const MAIN_SUFFIX = '/js/main.js';

function normaliseId(id) {
  return String(id || '').split('?')[0].replace(/\\/g, '/');
}

/**
 * One registration point for the digital suite. The v7.20 workflow is applied
 * first; only after its disposition marker is present is the v7.21 response
 * cycle applied. Other v7.20 targets, such as multichannel-engine.js, continue
 * to receive their own transforms.
 */
export function calloriaDigitalExperienceSuitePluginV722() {
  const workflow = calloriaDigitalWorkflowSuitePluginV720();
  const responseCycle = calloriaDigitalResponseCyclePluginV721();

  return {
    name: 'calloria-digital-experience-suite-v7-22',
    enforce: 'post',
    transform(source, id) {
      const cleanId = normaliseId(id);
      let code = String(source ?? '');
      let changed = false;

      const workflowResult = workflow.transform.call(this, code, id);
      if (workflowResult && typeof workflowResult.code === 'string') {
        code = workflowResult.code;
        changed = true;
      }

      if (cleanId.endsWith(MAIN_SUFFIX)) {
        // Do not allow the v7.21 panel to activate against an unpatched or
        // partially transformed digital workflow.
        if (!code.includes(V720_MARKER)) {
          this.warn('[calloria-digital-experience-suite-v7-22] v7.21 response-cycle integration was not applied because the v7.20 digital workflow marker is absent. The v7.20 source-drift warning above identifies the failed anchor.');
          return changed ? { code, map: null } : null;
        }

        const responseResult = responseCycle.transform.call(this, code, id);
        if (responseResult && typeof responseResult.code === 'string') {
          code = responseResult.code;
          changed = true;
        } else if (!code.includes(V721_MARKER)) {
          // Keep a successfully applied v7.20 suite intact; report the v7.21
          // source mismatch without attempting any speculative edits.
          this.warn('[calloria-digital-experience-suite-v7-22] v7.20 digital workflow is active, but v7.21 response-cycle UI was skipped safely because its source anchors did not match.');
        }
      }

      return changed ? { code, map: null } : null;
    }
  };
}

export const CALLORIA_DIGITAL_EXPERIENCE_ORDER_V722 = Object.freeze([
  'v7.15 digital response quality coach',
  'v7.16 digital customer-state integrity',
  'v7.17 specialist handoff',
  'v7.18 SLA-aware queue triage',
  'v7.20 digital disposition evidence',
  'v7.21 multi-turn follow-up response SLA'
]);
