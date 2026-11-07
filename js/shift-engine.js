export const AGENT_STATES = Object.freeze(['available', 'busy', 'wrap-up', 'break', 'offline']);

export const DEFAULT_SHIFT_PLAN = Object.freeze({
  startMinute: 8 * 60,
  endMinute: 17 * 60,
  breaks: Object.freeze([
    Object.freeze({ id: 'morning-break', label: 'Morning break', startMinute: 10 * 60, endMinute: 10 * 60 + 15 }),
    Object.freeze({ id: 'lunch-break', label: 'Lunch break', startMinute: 12 * 60 + 30, endMinute: 13 * 60 }),
    Object.freeze({ id: 'afternoon-break', label: 'Afternoon break', startMinute: 15 * 60, endMinute: 15 * 60 + 15 })
  ])
});

function validPlan(plan = DEFAULT_SHIFT_PLAN) {
  const startMinute = Number(plan.startMinute);
  const endMinute = Number(plan.endMinute);
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || startMinute < 0 || endMinute > 1440 || endMinute <= startMinute) {
    throw new TypeError('Shift plan must contain a valid start and end time.');
  }
  const breaks = Array.isArray(plan.breaks) ? plan.breaks.map(item => ({
    id: String(item.id || ''), label: String(item.label || ''), startMinute: Number(item.startMinute), endMinute: Number(item.endMinute)
  })).sort((a, b) => a.startMinute - b.startMinute) : [];
  let previousEnd = startMinute;
  for (const item of breaks) {
    if (!item.id || !item.label || !Number.isFinite(item.startMinute) || !Number.isFinite(item.endMinute) || item.startMinute < startMinute || item.endMinute > endMinute || item.endMinute <= item.startMinute || item.startMinute < previousEnd) {
      throw new TypeError(`Invalid scheduled break: ${item.id}`);
    }
    previousEnd = item.endMinute;
  }
  return { startMinute, endMinute, breaks };
}

export function createShiftRecord({ day = 1, startedAt = Date.now(), plan = DEFAULT_SHIFT_PLAN } = {}) {
  const normalized = validPlan(plan);
  return {
    id: `SHIFT-${new Date(startedAt).toISOString().slice(0, 10)}-${day}`,
    day: Math.max(1, Math.floor(Number(day) || 1)),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: null,
    status: 'active',
    plan: normalized,
    events: [{ status: 'available', elapsedMinute: 0, at: new Date(startedAt).toISOString(), reason: 'Shift started' }]
  };
}

export function recordAgentState(shift, status, elapsedMinute, reason = '') {
  if (!shift || shift.status !== 'active') throw new Error('An active shift is required.');
  if (!AGENT_STATES.includes(status)) throw new TypeError('Unknown agent state.');
  const minute = Math.max(0, Number(elapsedMinute) || 0);
  shift.events = Array.isArray(shift.events) ? shift.events : [];
  const last = shift.events.at(-1);
  if (last && minute < last.elapsedMinute) throw new RangeError('Agent-state time cannot move backwards.');
  if (last?.status === status) return last;
  const event = { status, elapsedMinute: minute, at: new Date().toISOString(), reason: String(reason).slice(0, 180) };
  shift.events.push(event);
  return event;
}

export function expectedShiftMode(shift, elapsedMinute) {
  if (!shift?.plan) return 'off-duty';
  const absoluteMinute = shift.plan.startMinute + Math.max(0, Number(elapsedMinute) || 0);
  if (absoluteMinute >= shift.plan.endMinute) return 'off-duty';
  const scheduledBreak = shift.plan.breaks.find(item => absoluteMinute >= item.startMinute && absoluteMinute < item.endMinute);
  return scheduledBreak ? 'break' : 'working';
}

export function calculateShiftAdherence(shift, elapsedMinute) {
  if (!shift?.plan) return { adherence: 0, workingMinutes: 0, breakMinutes: 0, matchedMinutes: 0, deviations: 0 };
  const total = Math.max(0, Math.min(1440, Math.floor(Number(elapsedMinute) || 0)));
  const events = [...(shift.events || [])].sort((a, b) => a.elapsedMinute - b.elapsedMinute);
  let eventIndex = 0;
  let actual = events[0]?.status || 'offline';
  let matchedMinutes = 0, workingMinutes = 0, breakMinutes = 0, deviations = 0;
  for (let minute = 0; minute < total; minute++) {
    while (eventIndex + 1 < events.length && events[eventIndex + 1].elapsedMinute <= minute) {
      eventIndex++;
      actual = events[eventIndex].status;
    }
    const expected = expectedShiftMode(shift, minute);
    if (expected === 'working') {
      workingMinutes++;
      const onDuty = ['available', 'busy', 'wrap-up'].includes(actual);
      if (onDuty) matchedMinutes++; else deviations++;
    } else if (expected === 'break') {
      breakMinutes++;
      if (actual === 'break') matchedMinutes++; else deviations++;
    }
  }
  const plannedMinutes = workingMinutes + breakMinutes;
  return {
    adherence: plannedMinutes ? Math.round((matchedMinutes / plannedMinutes) * 1000) / 10 : 100,
    workingMinutes, breakMinutes, matchedMinutes, deviations
  };
}

export function nextScheduledBreak(shift, elapsedMinute) {
  if (!shift?.plan) return null;
  const now = shift.plan.startMinute + Math.max(0, Number(elapsedMinute) || 0);
  const active = shift.plan.breaks.find(item => now >= item.startMinute && now < item.endMinute);
  const next = active || shift.plan.breaks.find(item => item.startMinute > now);
  if (!next) return null;
  const toClock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { ...next, active: !!active, startsInMinutes: Math.max(0, next.startMinute - now), startLabel: toClock(next.startMinute), endLabel: toClock(next.endMinute) };
}

export function closeShift(shift, endedAt = Date.now(), elapsedMinute = 0) {
  if (!shift || shift.status !== 'active') throw new Error('Shift is not active.');
  const last = shift.events?.at(-1);
  if (last?.status === 'busy' || last?.status === 'wrap-up') throw new Error('Complete the customer interaction before ending the shift.');
  shift.endedAt = new Date(endedAt).toISOString();
  shift.status = 'completed';
  shift.elapsedMinutes = Math.max(0, Number(elapsedMinute) || 0);
  shift.adherence = calculateShiftAdherence(shift, shift.elapsedMinutes);
  return shift;
}

export function createCoachingRecord(records, input, now = Date.now()) {
  const coach = String(input?.coach || '').trim();
  const topic = String(input?.topic || '').trim();
  const actionPlan = String(input?.actionPlan || '').trim();
  if (!coach || !topic || !actionPlan) throw new TypeError('Coach, coaching topic and action plan are required.');
  const score = Math.max(1, Math.min(5, Number(input.score) || 3));
  const item = {
    id: `COACH-${now}-${(records?.length || 0) + 1}`,
    coach: coach.slice(0, 80),
    topic: topic.slice(0, 120),
    feedback: String(input.feedback || '').trim().slice(0, 600),
    actionPlan: actionPlan.slice(0, 600),
    score,
    followUpDate: input.followUpDate || null,
    recordedAt: new Date(now).toISOString(),
    status: 'action_plan_open'
  };
  (Array.isArray(records) ? records : []).push(item);
  return item;
}
