/**
 * CALLORIA v8.2 — single ordered digital/workforce registration group for the digital/workforce suite.
 * Keeps each release plugin independently testable while centralising its order.
 */
import { calloriaDigitalExperienceSuitePluginV722 } from './calloria-digital-experience-suite-v722.mjs';
import { calloriaDigitalFollowUpSupervisorPluginV723 } from './calloria-digital-followup-supervisor-v723.mjs';
import { calloriaDigitalFollowUpPerformancePluginV724 } from './calloria-digital-followup-performance-v724.mjs';
import { calloriaDigitalFollowUpCoachingPluginV725 } from './calloria-digital-followup-coaching-v725.mjs';
import { calloriaDigitalFollowUpCoachingOutcomesPluginV726 } from './calloria-digital-followup-coaching-outcomes-v726.mjs';
import { calloriaDigitalFollowUpCoachingCheckpointsPluginV727 } from './calloria-digital-followup-coaching-checkpoints-v727.mjs';
import { calloriaDigitalCareerEvidencePluginV728 } from './calloria-digital-career-evidence-v728.mjs';
import { calloriaWorkforceIntelligencePluginV729 } from './calloria-workforce-intelligence-v729.mjs';
import { calloriaWorkforceCommandCentrePluginV730 } from './calloria-workforce-command-centre-v730.mjs';
import { calloriaWorkforceTrendHistoryPluginV731 } from './calloria-workforce-trend-history-v731.mjs';
import { calloriaWorkforceTrendCloudSyncPluginV801 } from './calloria-workforce-trend-cloud-sync-v801.mjs';

export const CALLORIA_WORKFORCE_DEVELOPMENT_PLUGIN_ORDER_V8 = Object.freeze([
  'calloria-digital-experience-suite-v7-22',
  'calloria-digital-followup-supervisor-v7-23',
  'calloria-digital-followup-performance-v7-24',
  'calloria-digital-followup-coaching-v7-25',
  'calloria-digital-followup-coaching-outcomes-v7-26',
  'calloria-digital-followup-coaching-checkpoints-v7-27',
  'calloria-digital-career-evidence-v7-28',
  'calloria-workforce-intelligence-v7-29',
  'calloria-workforce-command-centre-v7-30',
  'calloria-workforce-trend-history-v7-31',
  'calloria-workforce-trend-cloud-sync-v8-1'
]);

export function calloriaWorkforceDevelopmentSuitePluginsV8() {
  const plugins = [
    calloriaDigitalExperienceSuitePluginV722(),
    calloriaDigitalFollowUpSupervisorPluginV723(),
    calloriaDigitalFollowUpPerformancePluginV724(),
    calloriaDigitalFollowUpCoachingPluginV725(),
    calloriaDigitalFollowUpCoachingOutcomesPluginV726(),
    calloriaDigitalFollowUpCoachingCheckpointsPluginV727(),
    calloriaDigitalCareerEvidencePluginV728(),
    calloriaWorkforceIntelligencePluginV729(),
    calloriaWorkforceCommandCentrePluginV730(),
    calloriaWorkforceTrendHistoryPluginV731(),
    calloriaWorkforceTrendCloudSyncPluginV801()
  ];
  const names = plugins.map((plugin) => plugin?.name);
  if (names.length !== CALLORIA_WORKFORCE_DEVELOPMENT_PLUGIN_ORDER_V8.length ||
      names.some((name, index) => name !== CALLORIA_WORKFORCE_DEVELOPMENT_PLUGIN_ORDER_V8[index])) {
    throw new Error(
      `CALLORIA v8.2 workforce suite order mismatch. Expected ${CALLORIA_WORKFORCE_DEVELOPMENT_PLUGIN_ORDER_V8.join(' -> ')}; received ${names.join(' -> ')}.`
    );
  }
  return plugins;
}
