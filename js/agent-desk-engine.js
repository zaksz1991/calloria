/** Pure domain rules for the CALLORIA Omnichannel Agent Desk. */
export const CHANNELS = Object.freeze(['voice', 'email', 'live_chat', 'social', 'whatsapp', 'sms', 'website', 'portal', 'game', 'back_office']);
export const DIRECTIONS = Object.freeze(['inbound', 'outbound', 'internal']);
export const PRIORITIES = Object.freeze(['low', 'normal', 'high', 'urgent']);
export const STATUSES = Object.freeze(['pending', 'claimed', 'active', 'on_hold', 'after_contact_work', 'resolved', 'escalated', 'cancelled']);
export const DEPARTMENTS = Object.freeze([
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
]);
export const PLATFORMS = Object.freeze(['ruffneck-learn', 'ruffneck-prospector', 'ruffneck-connect', 'ruffneck-social-hub', 'kano-run', 'kano-keke']);
export const DISPOSITIONS = Object.freeze([
  'information_provided', 'self_service_guided', 'technical_resolution', 'case_created',
  'referred_to_specialist', 'complaint_escalated', 'sales_enquiry_recorded',
  'customer_requested_follow_up', 'no_response', 'resolved_without_action'
]);
const TRANSITIONS = Object.freeze({
  pending: ['claimed', 'cancelled'],
  claimed: ['active', 'pending', 'cancelled'],
  active: ['on_hold', 'after_contact_work', 'escalated'],
  on_hold: ['active', 'escalated'],
  after_contact_work: ['resolved', 'escalated'],
  escalated: ['claimed', 'cancelled'],
  resolved: [], cancelled: []
});

export function cleanText(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validateWorkItem(input = {}, allowedDepartments = DEPARTMENTS) {
  const department = cleanText(input.department, 120);
  const channel = cleanText(input.channel, 24);
  const direction = cleanText(input.direction || 'inbound', 12);
  const priority = cleanText(input.priority || 'normal', 12);
  const subject = cleanText(input.subject, 140);
  const summary = cleanText(input.summary, 600);
  const platformId = cleanText(input.platformId, 40);
  const crmCustomerId = cleanText(input.crmCustomerId, 64);
  const caseReference = cleanText(input.caseReference, 24).toUpperCase();
  if (!DEPARTMENTS.includes(department) || !(allowedDepartments.includes('*') || allowedDepartments.includes(department))) throw new Error('You do not have access to the selected department.');
  if (!CHANNELS.includes(channel)) throw new Error('Select a supported interaction channel.');
  if (!DIRECTIONS.includes(direction)) throw new Error('Select a supported direction.');
  if (!PRIORITIES.includes(priority)) throw new Error('Select a supported priority.');
  if (subject.length < 3) throw new Error('Enter a short interaction subject.');
  if (summary.length < 8) throw new Error('Enter a non-sensitive summary of at least eight characters.');
  if (platformId && !PLATFORMS.includes(platformId)) throw new Error('Select a supported RuffNeck product or game.');
  if (caseReference && !/^CC-[0-9]{6}-[A-Z2-9]{6}$/.test(caseReference)) throw new Error('Enter a valid CALLORIA case reference or leave it blank.');
  if (crmCustomerId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(crmCustomerId)) throw new Error('Customer CRM reference must be a valid record ID.');
  if (/(password|passcode|one[ -]?time password|\botp\b|pin code|cvv|card number|api key|access token)/i.test(`${subject} ${summary}`) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(`${subject} ${summary}`) || /(?:\+?\d[\d ()-]{7,}\d)/.test(`${subject} ${summary}`)) throw new Error('Do not store credentials, payment details or authentication secrets in interaction summaries.');
  return { department, channel, direction, priority, subject, summary, platformId: platformId || null, crmCustomerId: crmCustomerId || null, caseReference: caseReference || null };
}

export function allowedTransitions(status, { supervisor = false } = {}) {
  if (!STATUSES.includes(status)) return [];
  if (status === 'escalated' && supervisor) return ['claimed', 'cancelled'];
  return [...TRANSITIONS[status]];
}

export function validateTransition(currentStatus, nextStatus, { supervisor = false, assignedToCurrentAgent = false } = {}) {
  if (!STATUSES.includes(nextStatus)) throw new Error('Unsupported work-item status.');
  if (!supervisor && !assignedToCurrentAgent) throw new Error('Only the assigned agent or a supervisor can change this interaction.');
  if (!allowedTransitions(currentStatus, { supervisor }).includes(nextStatus)) throw new Error(`Invalid status change: ${currentStatus} → ${nextStatus}.`);
  return nextStatus;
}

export function validateWrapUp(input = {}) {
  const disposition = cleanText(input.disposition, 48);
  const summary = cleanText(input.summary, 600);
  if (!DISPOSITIONS.includes(disposition)) throw new Error('Choose a valid wrap-up disposition.');
  if (summary.length < 8) throw new Error('Enter a brief, non-sensitive wrap-up summary.');
  if (/(password|passcode|one[ -]?time password|\botp\b|pin code|cvv|card number|api key|access token)/i.test(summary) || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(summary) || /(?:\+?\d[\d ()-]{7,}\d)/.test(summary)) throw new Error('Do not record credentials or payment details in wrap-up notes.');
  return { disposition, summary };
}

export function queueCounts(items = []) {
  const result = Object.fromEntries(STATUSES.map(status => [status, 0]));
  for (const item of items) if (Object.hasOwn(result, item.status)) result[item.status] += 1;
  return result;
}

export function dueState(dueAt, now = Date.now()) {
  if (!dueAt) return 'untracked';
  const due = new Date(dueAt).getTime();
  if (!Number.isFinite(due)) return 'untracked';
  const remaining = due - now;
  if (remaining < 0) return 'overdue';
  if (remaining <= 15 * 60 * 1000) return 'due_soon';
  return 'on_track';
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}
