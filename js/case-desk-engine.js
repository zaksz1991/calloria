/**
 * Guest-safe client helpers for CALLORIA case creation and tracking.
 * Tracking tokens are intentionally never written to browser storage.
 */
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

const ISSUE_REDACTIONS = [
  { pattern: /(?<!\d)(?:\+?234|0)[\s().-]*[789]\d{2}[\s().-]*\d{3}[\s().-]*\d{4}\b/g, replacement: '[REDACTED PHONE NUMBER]' },
  { pattern: /\b(pin|otp|one[- ]time password|password|passcode|security code|recovery code)\s*[:#= -]?\s*\S+/gi, replacement: '$1: [REDACTED CREDENTIAL]' },
  { pattern: /\b(?:account|acct|card)\s*(?:number|no\.?|#)?\s*[:#= -]?\d{6,19}\b/gi, replacement: '[REDACTED ACCOUNT OR CARD NUMBER]' },
  { pattern: /\b\d{10,19}\b/g, replacement: '[REDACTED LONG NUMBER]' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED EMAIL]' }
];

export const CASE_PLATFORMS = Object.freeze([
  { id: 'ruffneck-learn', name: 'RuffNeck Learn' },
  { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
  { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
  { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
  { id: 'kano-run', name: 'Kano Run / Kano Life' },
  { id: 'kano-keke', name: 'Kano Keke' }
]);

export function redactCaseDescription(value) {
  const original = clean(value);
  if (original.length < 8) throw new TypeError('Describe the issue in at least eight characters.');
  if (original.length > 1800) throw new RangeError('Keep the issue description under 1,800 characters.');
  let text = original;
  for (const rule of ISSUE_REDACTIONS) text = text.replace(rule.pattern, rule.replacement);
  return { text, redacted: text !== original };
}

export function validateCasePayload(input) {
  if (!input || typeof input !== 'object') throw new TypeError('The support request is incomplete.');
  const description = redactCaseDescription(input.description).text;
  const subject = clean(input.subject).slice(0, 120);
  if (subject.length < 4) throw new TypeError('Enter a short subject for the case.');
  const platformId = clean(input.platformId).slice(0, 80);
  if (platformId && !CASE_PLATFORMS.some(item => item.id === platformId)) throw new TypeError('Select a recognised RuffNeck platform.');
  const contactPreference = ['none', 'email', 'phone'].includes(input.contactPreference) ? input.contactPreference : 'none';
  const contact = clean(input.contact).slice(0, 180);
  const customerName = clean(input.customerName).slice(0, 100);
  if (contactPreference === 'none' && contact) throw new TypeError('Remove the contact detail or choose email or phone follow-up.');
  if (contactPreference !== 'none' && !contact) throw new TypeError('Enter the contact detail for your selected follow-up method.');
  if (contactPreference === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new TypeError('Enter a valid email address or choose another follow-up method.');
  if (contactPreference === 'phone' && !/^\+?[0-9][0-9\s().-]{7,18}$/.test(contact)) throw new TypeError('Enter a valid phone number, including its country code where needed.');
  if (input.consent !== true) throw new TypeError('Consent is required before CALLORIA can store a support case.');
  return { subject, description, platformId, contactPreference, contact, customerName, consent: true };
}

export function validateCaseLookup(reference, accessToken) {
  const caseReference = clean(reference).toUpperCase();
  const token = clean(accessToken);
  if (!/^CC-\d{6}-[A-Z2-9]{6}$/.test(caseReference)) throw new TypeError('Enter the case reference in the format CC-YYMMDD-XXXXXX.');
  if (!/^[A-Za-z0-9_-]{40,48}$/.test(token)) throw new TypeError('Enter the full case access code.');
  return { caseReference, accessToken: token };
}

export function validateCaseCreateResponse(value) {
  if (!value || typeof value !== 'object' || !/^CC-\d{6}-[A-Z2-9]{6}$/.test(String(value.caseReference || ''))) {
    throw new TypeError('CALLORIA did not return a valid case reference.');
  }
  const accessToken = String(value.accessToken || '');
  if (!/^[A-Za-z0-9_-]{40,48}$/.test(accessToken)) throw new TypeError('CALLORIA did not return a valid case access code.');
  return { caseReference: value.caseReference, accessToken, status: clean(value.status || 'received') };
}

export function validateCaseStatus(value) {
  if (!value || typeof value !== 'object') throw new TypeError('CALLORIA returned an invalid case status.');
  const statuses = new Set(['received', 'triaged', 'assigned', 'in_progress', 'awaiting_customer', 'resolved', 'closed']);
  const status = statuses.has(value.status) ? value.status : 'received';
  return {
    caseReference: clean(value.caseReference).slice(0, 30),
    status,
    department: clean(value.department).slice(0, 100),
    platformName: clean(value.platformName).slice(0, 100),
    publicMessage: clean(value.publicMessage).slice(0, 320),
    createdAt: clean(value.createdAt).slice(0, 40),
    updatedAt: clean(value.updatedAt).slice(0, 40),
    timeline: (Array.isArray(value.timeline) ? value.timeline : []).slice(0, 15).map(item => ({ status: clean(item?.status).slice(0, 40), message: clean(item?.message).slice(0, 320), at: clean(item?.at).slice(0, 40) }))
  };
}
