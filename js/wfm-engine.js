/**
 * CALLORIA cloud workforce-management rules.
 * Pure functions only: no network, storage or DOM access.
 */
export const WFM_DEPARTMENTS = Object.freeze([
  'RuffNeck Products and Platform Support',
  'Sales and Service Enquiries',
  'Complaints and Service Recovery',
  'Personal Development and Wellbeing Information',
  'General Customer Care',
  'Email and Written Support',
  'Social Media Support',
  'Technical Support and IT',
  'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support',
  'Learning and Career Development'
]);

export const WFM_ACTIVITIES = Object.freeze([
  'customer_work', 'break', 'lunch', 'briefing', 'training', 'coaching',
  'quality_assurance', 'back_office', 'system_admin', 'prayer'
]);

export const ACTIVITY_LABELS = Object.freeze({
  customer_work: 'Customer operations', break: 'Break', lunch: 'Lunch',
  briefing: 'Briefing', training: 'Training', coaching: 'Coaching',
  quality_assurance: 'Quality assurance', back_office: 'Back office',
  system_admin: 'System administration', prayer: 'Prayer break', offline: 'Offline'
});

export function cleanWfmText(value, max = 180) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value ?? ''));
}

function instant(value, label) {
  const milliseconds = new Date(value).getTime();
  if (!Number.isFinite(milliseconds)) throw new TypeError(`${label} must be a valid date and time.`);
  return milliseconds;
}

export function validateShift(input = {}, allowedDepartments = WFM_DEPARTMENTS, now = Date.now()) {
  const staffId = cleanWfmText(input.staffId, 64);
  const department = cleanWfmText(input.department, 120);
  const startAt = new Date(input.startAt).toISOString();
  const endAt = new Date(input.endAt).toISOString();
  const start = instant(startAt, 'Shift start');
  const end = instant(endAt, 'Shift end');
  const duration = end - start;
  if (!isUuid(staffId)) throw new TypeError('Select a valid staff account.');
  if (!WFM_DEPARTMENTS.includes(department) || !(allowedDepartments.includes('*') || allowedDepartments.includes(department))) {
    throw new Error('You do not have permission to schedule this department.');
  }
  if (duration < 4 * 60 * 60 * 1000 || duration > 16 * 60 * 60 * 1000) {
    throw new RangeError('A shift must be at least four hours and no longer than sixteen hours.');
  }
  if (start < now - 24 * 60 * 60 * 1000 || start > now + 120 * 24 * 60 * 60 * 1000) {
    throw new RangeError('Schedule shifts from yesterday through the next 120 days only.');
  }
  return { staffId, department, startAt, endAt };
}

export function validatePlanBlocks(blocks = [], shiftStart, shiftEnd) {
  const start = instant(shiftStart, 'Shift start');
  const end = instant(shiftEnd, 'Shift end');
  if (!Array.isArray(blocks) || blocks.length > 24) throw new TypeError('A shift can contain up to 24 planned activity blocks.');
  const normalized = (blocks.length ? blocks : [{ activity: 'customer_work', startAt: shiftStart, endAt: shiftEnd }])
    .map((block, index) => {
      const activity = cleanWfmText(block.activity, 32);
      const blockStartAt = new Date(block.startAt).toISOString();
      const blockEndAt = new Date(block.endAt).toISOString();
      const blockStart = instant(blockStartAt, `Block ${index + 1} start`);
      const blockEnd = instant(blockEndAt, `Block ${index + 1} end`);
      if (!WFM_ACTIVITIES.includes(activity)) throw new TypeError(`Block ${index + 1} has an unsupported activity.`);
      if (blockStart < start || blockEnd > end || blockEnd - blockStart < 5 * 60 * 1000) {
        throw new RangeError(`Block ${index + 1} must last at least five minutes and remain inside the shift.`);
      }
      return { activity, startAt: blockStartAt, endAt: blockEndAt, start: blockStart, end: blockEnd };
    })
    .sort((a, b) => a.start - b.start);
  for (let index = 1; index < normalized.length; index += 1) {
    if (normalized[index].start < normalized[index - 1].end) throw new Error('Planned activity blocks must not overlap.');
  }
  return normalized.map(({ activity, startAt, endAt }) => ({ activity, startAt, endAt }));
}

export function validateBriefingDate(value) {
  const date = cleanWfmText(value, 10);
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new TypeError('Choose a valid briefing date.');
  }
  return date;
}

function overlapMilliseconds(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

/**
 * Compares logged activity with the elapsed portion of a published plan.
 * This is schedule adherence, not call availability or customer-service quality.
 */
export function calculateScheduleAdherence(plannedBlocks = [], actualBlocks = [], now = Date.now()) {
  const plans = Array.isArray(plannedBlocks) ? plannedBlocks : [];
  const actual = Array.isArray(actualBlocks) ? actualBlocks : [];
  let plannedElapsedMs = 0;
  let matchedMs = 0;
  const cutoff = Number(now);

  for (const plan of plans) {
    const planStart = instant(plan.start_at ?? plan.startAt, 'Planned start');
    const planEnd = Math.min(instant(plan.end_at ?? plan.endAt, 'Planned end'), cutoff);
    if (planEnd <= planStart) continue;
    plannedElapsedMs += planEnd - planStart;
    for (const record of actual) {
      if (record.activity !== plan.activity) continue;
      const actualStart = instant(record.started_at ?? record.startAt, 'Actual start');
      const actualEndRaw = record.ended_at ?? record.endAt;
      const actualEnd = actualEndRaw ? instant(actualEndRaw, 'Actual end') : cutoff;
      matchedMs += overlapMilliseconds(planStart, planEnd, actualStart, Math.min(actualEnd, cutoff));
    }
  }

  // Clamp to total planned minutes so duplicate/overlapping actual records cannot inflate adherence.
  matchedMs = Math.min(matchedMs, plannedElapsedMs);
  const plannedMinutes = Math.floor(plannedElapsedMs / 60000);
  const matchedMinutes = Math.floor(matchedMs / 60000);
  return {
    plannedMinutes,
    matchedMinutes,
    deviationMinutes: Math.max(0, plannedMinutes - matchedMinutes),
    adherence: plannedMinutes ? Math.round((matchedMinutes / plannedMinutes) * 1000) / 10 : null
  };
}

export function currentActivity(actualBlocks = [], now = Date.now()) {
  const time = Number(now);
  return [...(Array.isArray(actualBlocks) ? actualBlocks : [])]
    .filter(block => {
      const start = new Date(block.started_at ?? block.startAt).getTime();
      const end = block.ended_at ?? block.endAt;
      return Number.isFinite(start) && start <= time && (!end || new Date(end).getTime() > time);
    })
    .sort((a, b) => new Date(b.started_at ?? b.startAt) - new Date(a.started_at ?? a.startAt))[0] || null;
}

export function localDateTimeToIso(date, time) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^\d{2}:\d{2}$/.test(String(time))) {
    throw new TypeError('Enter a valid date and time.');
  }
  const value = new Date(`${date}T${time}:00`);
  if (!Number.isFinite(value.getTime())) throw new TypeError('Enter a valid date and time.');
  return value.toISOString();
}
