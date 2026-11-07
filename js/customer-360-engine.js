/** Pure CALLORIA Customer 360 domain rules. No secrets, network, DOM or storage. */
export const CHANNELS = Object.freeze(['voice', 'email', 'live_chat', 'social', 'whatsapp', 'website', 'portal', 'in_person', 'game']);
export const DIRECTIONS = Object.freeze(['inbound', 'outbound', 'internal']);
export const INTERACTION_TYPES = Object.freeze(['platform_support', 'service_enquiry', 'sales_enquiry', 'complaint', 'personal_guidance', 'general_customer_care']);
export const CONSENT_PURPOSES = Object.freeze(['service_contact', 'marketing', 'ai_personalization']);
export const PLATFORM_IDS = Object.freeze(['ruffneck-learn', 'ruffneck-prospector', 'ruffneck-connect', 'ruffneck-social-hub', 'kano-run', 'kano-keke']);

export function cleanText(value, max = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function normalizeEmail(value) {
  const email = cleanText(value, 180).toLowerCase();
  if (!email) return '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Enter a valid email address.');
  return email;
}

export function normalizePhone(value) {
  const phone = cleanText(value, 40).replace(/[\s().-]/g, '');
  if (!phone) return '';
  if (!/^\+?[0-9]{8,16}$/.test(phone)) throw new Error('Enter a valid phone number with country code where possible.');
  return phone;
}

export function normalizeNameTokens(value) {
  const name = cleanText(value, 100).toLocaleLowerCase('en');
  return [...new Set(name.split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 2))].slice(0, 8);
}

export function validateNewContact(input = {}) {
  const name = cleanText(input.name, 100);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const preferredChannel = cleanText(input.preferredChannel || 'none', 20);
  if (!email && !phone) throw new Error('Enter at least one contact method: email or phone.');
  if (!['none', 'email', 'phone', 'whatsapp'].includes(preferredChannel)) throw new Error('Choose a supported preferred contact method.');
  if (preferredChannel === 'email' && !email) throw new Error('An email address is required for the selected preference.');
  if (['phone', 'whatsapp'].includes(preferredChannel) && !phone) throw new Error('A phone number is required for the selected preference.');
  if (input.serviceConsent !== true) throw new Error('Explicit service-contact consent is required before creating a customer record.');
  if (typeof input.marketingConsent !== 'boolean') throw new Error('Marketing consent must be explicitly yes or no.');
  if (typeof input.personalizationConsent !== 'boolean') throw new Error('AI-personalisation consent must be explicitly yes or no.');
  return { name, email, phone, preferredChannel, serviceConsent: true, marketingConsent: input.marketingConsent, personalizationConsent: input.personalizationConsent };
}

export function validateInteraction(input = {}) {
  const channel = cleanText(input.channel, 20);
  const direction = cleanText(input.direction, 12);
  const type = cleanText(input.type, 32);
  const platformId = cleanText(input.platformId, 40);
  const caseReference = cleanText(input.caseReference, 24).toUpperCase();
  if (!CHANNELS.includes(channel)) throw new Error('Choose a valid interaction channel.');
  if (!DIRECTIONS.includes(direction)) throw new Error('Choose a valid interaction direction.');
  if (!INTERACTION_TYPES.includes(type)) throw new Error('Choose a valid interaction category.');
  if (platformId && !PLATFORM_IDS.includes(platformId)) throw new Error('The selected platform is not recognised.');
  if (caseReference && !/^CC-[0-9]{6}-[A-Z2-9]{6}$/.test(caseReference)) throw new Error('Enter a valid CALLORIA case reference or leave it blank.');
  const summary = type === 'personal_guidance'
    ? 'General personal-guidance interaction recorded. Sensitive personal details are intentionally not retained in the customer profile.'
    : cleanText(input.summary, 500);
  if (type !== 'personal_guidance' && summary.length < 8) throw new Error('Enter a brief interaction summary of at least eight characters.');
  return { channel, direction, type, platformId: platformId || null, caseReference: caseReference || null, summary };
}

export function canShowRecommendation({ mode = 'requested', marketingConsent = false, recentPersonalGuidance = false } = {}) {
  if (mode === 'requested') return true;
  if (mode !== 'proactive') return false;
  return marketingConsent === true && recentPersonalGuidance !== true;
}

export function maskEmail(value) {
  const email = cleanText(value, 180);
  const [local, domain] = email.split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}${local.length > 2 ? '•••' : '•'}@${domain}`;
}

export function maskPhone(value) {
  const phone = cleanText(value, 40).replace(/\s/g, '');
  const prefix = phone.startsWith('+') ? phone.slice(0, 4) : phone.slice(0, 3);
  return phone.length < 7 ? '' : `${prefix}••••${phone.slice(-3)}`;
}

export function statusLabel(consent) {
  return consent === 'granted' ? 'Granted' : consent === 'revoked' ? 'Revoked' : consent === 'not_granted' ? 'Not granted' : 'Not recorded';
}
