/**
 * CALLORIA v8.12 — offline comparison of two independently verified recovery handovers.
 * This reports checklist movement only. It cannot authenticate a report author,
 * identify the originating organisation, or establish that a repair succeeded.
 */
import { verifyWorkforceTrendCloudRecoveryHandoverV811 } from './workforce-trend-cloud-recovery-handover-verification-engine-v811.js';

export const WORKFORCE_TREND_CLOUD_HANDOVER_COMPARISON_VERSION_V812 = '8.12.0';

function safeDate(value) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error('A verified handover report has an invalid timestamp.');
  return time;
}

/**
 * Verify both v8.10 handovers and compare their checklist progress locally.
 * No report data is imported, persisted, uploaded or sent to a network service.
 */
export async function compareWorkforceTrendCloudRecoveryHandoversV812(
  firstInput,
  secondInput,
  { cryptoObject = globalThis.crypto } = {}
) {
  const [first, second] = await Promise.all([
    verifyWorkforceTrendCloudRecoveryHandoverV811(firstInput, { cryptoObject }),
    verifyWorkforceTrendCloudRecoveryHandoverV811(secondInput, { cryptoObject })
  ]);

  const firstTime = safeDate(first.generatedAt);
  const secondTime = safeDate(second.generatedAt);
  const sameTimestamp = firstTime === secondTime;
  const [before, after] = firstTime <= secondTime ? [first, second] : [second, first];

  const beforeItems = new Map(before.items.map(item => [item.id, item]));
  const afterItems = new Map(after.items.map(item => [item.id, item]));
  if (beforeItems.size !== afterItems.size) {
    throw new Error('The reports cover different recovery areas and cannot be compared.');
  }

  for (const [id, earlier] of beforeItems) {
    const later = afterItems.get(id);
    if (!later || earlier.label !== later.label || earlier.totalSteps !== later.totalSteps) {
      throw new Error('The reports cover different recovery checklists and cannot be compared.');
    }
  }

  const items = [...beforeItems.values()].map(earlier => {
    const later = afterItems.get(earlier.id);
    const delta = later.completedSteps - earlier.completedSteps;
    return Object.freeze({
      id: earlier.id,
      label: earlier.label,
      beforeCompletedSteps: earlier.completedSteps,
      afterCompletedSteps: later.completedSteps,
      totalSteps: earlier.totalSteps,
      delta,
      direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'unchanged'
    });
  });

  const completedStepDelta = after.completedSteps - before.completedSteps;
  const completionPercentDelta = after.completionPercent - before.completionPercent;
  const improvedAreas = items.filter(item => item.direction === 'improved').length;
  const regressedAreas = items.filter(item => item.direction === 'regressed').length;
  const outcome = improvedAreas && regressedAreas ? 'mixed'
    : improvedAreas ? 'improved' : regressedAreas ? 'regressed' : 'unchanged';

  return Object.freeze({
    version: WORKFORCE_TREND_CLOUD_HANDOVER_COMPARISON_VERSION_V812,
    integrity: 'both_verified',
    outcome,
    sameTimestamp,
    before: Object.freeze({
      generatedAt: before.generatedAt,
      completedSteps: before.completedSteps,
      totalSteps: before.totalSteps,
      completionPercent: before.completionPercent
    }),
    after: Object.freeze({
      generatedAt: after.generatedAt,
      completedSteps: after.completedSteps,
      totalSteps: after.totalSteps,
      completionPercent: after.completionPercent
    }),
    completedStepDelta,
    completionPercentDelta,
    improvedAreas,
    regressedAreas,
    unchangedAreas: items.length - improvedAreas - regressedAreas,
    items: Object.freeze(items),
    limitation: 'Both checksums passed. The reports are not authenticated and do not identify an organisation. Confirm both files belong to the same organisation. Checklist movement does not prove that repairs succeeded.'
  });
}

export default compareWorkforceTrendCloudRecoveryHandoversV812;
