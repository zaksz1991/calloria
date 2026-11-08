export const SUPERVISOR_PHASES = Object.freeze({
  WALKING: 'walking',
  ASSISTING: 'assisting',
  RETURNING: 'returning'
});

export function createSupervisorQueue() {
  return { pending: [], active: null, disposed: false, completed: new Set() };
}

export function enqueueSupervisorEscalation(queue, detail = {}) {
  if (!queue || queue.disposed) return { accepted: false, reason: 'disposed' };
  const scenarioId = typeof detail.scenarioId === 'string' ? detail.scenarioId.trim() : '';
  if (!scenarioId) return { accepted: false, reason: 'missing-scenario-id' };
  if (queue.completed.has(scenarioId)) return { accepted: false, reason: 'already-completed' };
  if (queue.active?.scenarioId === scenarioId || queue.pending.some((item) => item.scenarioId === scenarioId)) {
    return { accepted: false, reason: 'duplicate' };
  }
  const item = {
    scenarioId,
    customerAssetId: typeof detail.assetId === 'string' ? detail.assetId : null,
    emotion: typeof detail.emotion === 'string' ? detail.emotion : 'angry',
    turn: Number.isFinite(Number(detail.turn)) ? Number(detail.turn) : 0,
    patience: detail.patience ?? null,
    phase: SUPERVISOR_PHASES.WALKING,
    queuedAt: Date.now()
  };
  queue.pending.push(item);
  return { accepted: true, item, queued: queue.pending.length, shouldStart: !queue.active };
}

export function beginNextSupervisorIntervention(queue) {
  if (!queue || queue.disposed || queue.active || !queue.pending.length) return null;
  queue.active = queue.pending.shift();
  queue.active.phase = SUPERVISOR_PHASES.WALKING;
  return queue.active;
}

export function setSupervisorPhase(queue, scenarioId, phase) {
  if (!queue || queue.disposed || !queue.active || queue.active.scenarioId !== scenarioId) return false;
  if (!Object.values(SUPERVISOR_PHASES).includes(phase)) return false;
  queue.active.phase = phase;
  return true;
}

export function finishSupervisorIntervention(queue, scenarioId, { markCompleted = true } = {}) {
  if (!queue || !queue.active || queue.active.scenarioId !== scenarioId) return null;
  const finished = queue.active;
  if (markCompleted) queue.completed.add(scenarioId);
  queue.active = null;
  return finished;
}

export function disposeSupervisorQueue(queue) {
  if (!queue || queue.disposed) return;
  queue.disposed = true;
  queue.pending.length = 0;
  queue.active = null;
}
