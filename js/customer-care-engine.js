/**
 * CALLORIA guest-first Customer Care client.
 * The browser never receives Groq or Supabase service-role credentials.
 * Questions are redacted locally; enquiry text is not written to browser storage or the CALLORIA database.
 */

const REDACTION_RULES = [
  { pattern: /(?<!\d)(?:\+?234|0)[\s().-]*[789]\d{2}[\s().-]*\d{3}[\s().-]*\d{4}\b/g, replacement: '[REDACTED PHONE NUMBER]' },
  { pattern: /\b(pin|otp|one[- ]time password|password|passcode|security code|recovery code)\s*[:#= -]?\s*\S+/gi, replacement: '$1: [REDACTED CREDENTIAL]' },
  { pattern: /\b(?:account|acct|card)\s*(?:number|no\.?|#)?\s*[:#= -]?\d{6,19}\b/gi, replacement: '[REDACTED ACCOUNT OR CARD NUMBER]' },
  { pattern: /\b\d{10,19}\b/g, replacement: '[REDACTED LONG NUMBER]' },
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[REDACTED EMAIL]' }
];
const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export const CALLORIA_PLATFORMS = Object.freeze([
  { id: 'ruffneck-learn', name: 'RuffNeck Learn', url: 'https://ruffneck-lms.vercel.app/', description: 'Practical AI, digital skills and professional learning.' },
  { id: 'ruffneck-prospector', name: 'RuffNeck Prospector', url: 'https://ruffneck-prospector.vercel.app/', description: 'Prospecting, lead discovery and pipeline workflows.' },
  { id: 'ruffneck-connect', name: 'RuffNeck Connect', url: 'https://ruffneck-connect.vercel.app/', description: 'Communities, collaboration, needs and offers.' },
  { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub', url: 'https://ruffneck-social-hub.vercel.app/', description: 'Social-media operations for organisations and brands.' },
  { id: 'kano-run', name: 'Kano Run / Kano Life', url: 'https://kano-run.vercel.app/', description: 'Kano driving, routes and life simulation.' },
  { id: 'kano-keke', name: 'Kano Keke', url: 'https://kano-keke.vercel.app/', description: 'Keke driver life simulation and entertainment.' }
]);

export function redactCustomerMessage(message) {
  const original = clean(message);
  if (original.length < 4) throw new TypeError('Enter a question containing at least four characters.');
  if (original.length > 1800) throw new RangeError('Keep each question under 1,800 characters.');
  let text = original;
  for (const rule of REDACTION_RULES) text = text.replace(rule.pattern, rule.replacement);
  return { text, redacted: text !== original };
}

export function getCustomerCareVisitorId(storage = globalThis.localStorage, cryptoApi = globalThis.crypto) {
  const key = 'calloria.customer-care.guest.v1';
  try {
    const existing = storage?.getItem(key);
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing || '')) return existing;
  } catch { /* storage may be blocked; use an in-memory ID */ }
  let id;
  if (cryptoApi?.randomUUID) id = cryptoApi.randomUUID();
  else {
    const bytes = new Uint8Array(16);
    if (!cryptoApi?.getRandomValues) throw new Error('This browser cannot create a secure guest session.');
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
    id = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  }
  try { storage?.setItem(key, id); } catch { /* session remains usable for this page */ }
  return id;
}

export function validateCustomerCareResponse(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('CALLORIA returned an invalid response.');
  const answer = clean(input.answer);
  if (!answer) throw new TypeError('CALLORIA did not return an answer.');
  const allowedDepartments = new Set([
    'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
    'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
    'General Customer Care', 'Safeguarding and Trained Human Support'
  ]);
  const urgency = ['low', 'normal', 'high', 'critical'].includes(input.urgency) ? input.urgency : 'normal';
  const sources = (Array.isArray(input.sources) ? input.sources : []).slice(0, 6).map(source => ({
    id: clean(source?.id).slice(0, 100),
    type: clean(source?.type).slice(0, 30),
    title: clean(source?.title).slice(0, 180),
    url: clean(source?.url).slice(0, 400)
  })).filter(source => source.id && source.title);
  return {
    answer: answer.slice(0, 4200),
    intent: clean(input.intent).slice(0, 60),
    department: allowedDepartments.has(input.department) ? input.department : 'General Customer Care',
    urgency,
    requiresHuman: input.requiresHuman === true || input.humanHandoffRequired === true,
    actions: (Array.isArray(input.actions) ? input.actions : []).map(value => clean(value).slice(0, 220)).filter(Boolean).slice(0, 5),
    followUpQuestions: (Array.isArray(input.followUpQuestions) ? input.followUpQuestions : []).map(value => clean(value).slice(0, 220)).filter(Boolean).slice(0, 2),
    sources,
    crossSellPlatformIds: (Array.isArray(input.crossSellPlatformIds) ? input.crossSellPlatformIds : []).map(value => clean(value).slice(0, 100)).filter(id => CALLORIA_PLATFORMS.some(platform => platform.id === id)).slice(0, 2),
    redacted: input.redacted === true,
    grounded: input.grounded === true,
    model: clean(input.model).slice(0, 80)
  };
}

export async function askCustomerCare(client, { message, visitorId = getCustomerCareVisitorId() } = {}) {
  if (!client?.functions?.invoke) throw new TypeError('CALLORIA Customer Care is not connected to Supabase.');
  const safe = redactCustomerMessage(message);
  const { data, error } = await client.functions.invoke('calloria-customer-care', {
    body: { message: safe.text, visitorId }
  });
  if (error) {
    const context = error.context;
    let serverMessage = '';
    try { serverMessage = clean((await context?.json?.())?.error); } catch { /* use SDK message */ }
    throw new Error(serverMessage || clean(error.message) || 'CALLORIA Customer Care could not be reached.');
  }
  const result = validateCustomerCareResponse(data);
  result.redacted = result.redacted || safe.redacted;
  return result;
}
