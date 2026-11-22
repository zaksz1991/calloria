/**
 * CALLORIA v7.20 — one ordered Vite entry for the digital workflow upgrades.
 * Internally composes the v7.15–v7.18 transforms and the v7.20-compatible
 * disposition evidence transform. This prevents repeated manual Vite edits
 * and keeps the transform order deterministic.
 */
import { calloriaDigitalResponseQualityCoachPluginV715 } from './calloria-digital-response-quality-coach-v715.mjs';
import { calloriaDigitalStateIntegrityPluginV716 } from './calloria-digital-state-integrity-v716.mjs';
import { calloriaDigitalSpecialistHandoffPluginV717 } from './calloria-digital-specialist-handoff-v717.mjs';
import { calloriaDigitalSlaTriagePluginV718 } from './calloria-digital-sla-triage-v718.mjs';
import { calloriaDigitalDispositionIntegrityPluginV720 } from './calloria-digital-disposition-integrity-v720.mjs';

const ORDERED_TRANSFORMS = Object.freeze([
  calloriaDigitalResponseQualityCoachPluginV715(),
  calloriaDigitalStateIntegrityPluginV716(),
  calloriaDigitalSpecialistHandoffPluginV717(),
  calloriaDigitalSlaTriagePluginV718(),
  calloriaDigitalDispositionIntegrityPluginV720()
]);

export function calloriaDigitalWorkflowSuitePluginV720() {
  return {
    name: 'calloria-digital-workflow-suite-v7-20',
    enforce: 'post',
    transform(source, id) {
      let code = String(source ?? '');
      let changed = false;
      for (const plugin of ORDERED_TRANSFORMS) {
        if (typeof plugin.transform !== 'function') continue;
        const result = plugin.transform.call(this, code, id);
        if (result && typeof result === 'object' && typeof result.code === 'string') {
          code = result.code;
          changed = true;
        }
      }
      return changed ? { code, map: null } : null;
    }
  };
}

export const CALLORIA_DIGITAL_WORKFLOW_TRANSFORM_ORDER_V720 = Object.freeze([
  'v7.15 digital response coach',
  'v7.16 digital customer-state metrics',
  'v7.17 specialist handoff',
  'v7.18 SLA-aware queue triage',
  'v7.20 disposition evidence integrity (v7.19 anchor compatibility repair)'
]);
