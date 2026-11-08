export const SOCIAL_PROVIDERS = Object.freeze(['messenger', 'instagram']);
export const SOCIAL_LANGUAGES = Object.freeze(['en', 'ha', 'yo', 'ig', 'pcm']);

const SAFEGUARDING = /\b(?:suicid(?:e|al)|self[ -]?harm|kill myself|hurt myself|end my life|want to die|i wan kill myself|i wan harm myself|zan kashe kaina|mo fe pa ara mi|achoro m igbu onwe m|ana duka na|i am in danger|not safe|being threatened|rape|sexual assault|violence at home)\b/i;
const COMPLAINT = /\b(?:complain(?:t)?|refund|scam(?:med)?|fraud|bad service|disappointed|unacceptable|charged twice|money missing|not delivered|wrong charge|unfair treatment)\b/i;
const TECHNICAL = /\b(?:bug|error|crash|cannot log in|can't log in|not working|doesn't load|does not load|doesn't open|does not open|login issue|technical|broken|stuck|failed to load)\b/i;
const SALES = /\b(?:price|pricing|how much|cost|subscribe|subscription|buy|purchase|offer|service plan|quotation|quote|enrol|enroll)\b/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE = /(?:\+?234[\s().-]?)?(?:0?\d[\s().-]?){9,11}\b/g;
const SECRET = /\b(password|passcode|otp|one[ -]?time code|pin|cvv|cvc|api[ _-]?key|access token|recovery code)\s*(?::|=|\bis\b)?\s*[^\s,;]+/gi;
const LONG_NUMBER = /\b(?:\d[ -]?){13,19}\b/g;

export function cleanSocialText(value, maximum = 2000) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maximum);
}

export function redactSocialText(value) {
  return cleanSocialText(value, 2000)
    .replace(SECRET, '$1: [removed for your safety]')
    .replace(EMAIL, '[email removed]')
    .replace(PHONE, '[phone removed]')
    .replace(LONG_NUMBER, '[long number removed]');
}

export function classifySocialMessage(value) {
  const text = cleanSocialText(value, 2000);
  if (SAFEGUARDING.test(text)) {
    return Object.freeze({ intent: 'safeguarding', department: 'Safeguarding and Trained Human Support', requiredSkills: ['safeguarding'], priority: 'urgent', language: detectLanguage(text) });
  }
  if (COMPLAINT.test(text)) {
    return Object.freeze({ intent: 'complaint', department: 'Complaints and Service Recovery', requiredSkills: ['complaints'], priority: 'high', language: detectLanguage(text) });
  }
  if (TECHNICAL.test(text)) {
    return Object.freeze({ intent: 'technical_support', department: 'Technical Support and IT', requiredSkills: ['technical_support'], priority: 'normal', language: detectLanguage(text) });
  }
  if (SALES.test(text)) {
    return Object.freeze({ intent: 'sales_enquiry', department: 'Sales and Service Enquiries', requiredSkills: ['sales'], priority: 'normal', language: detectLanguage(text) });
  }
  return Object.freeze({ intent: 'social_media', department: 'Social Media Support', requiredSkills: ['social_support'], priority: 'normal', language: detectLanguage(text) });
}

function detectLanguage(text) {
  const normalized = text.toLowerCase();
  if (/\b(ina kwana|sannu|yaya kake|na gode|don Allah|lafiya|nagode)\b/.test(normalized)) return 'ha';
  if (/\b(ẹ n lẹ|e n le|bawo ni|se daadaa|mo dupe|jọwọ|jowo)\b/.test(normalized)) return 'yo';
  if (/\b(kedu|ndewo|daalu|biko|imela|ọ dị mma|odi mma)\b/.test(normalized)) return 'ig';
  if (/\b(abeg|how far|wetin|wahala|no wahala|na wa|dey|make una)\b/.test(normalized)) return 'pcm';
  return 'en';
}

export function normalizeWebhookMessage(provider, entry, event) {
  if (!SOCIAL_PROVIDERS.includes(provider) || !event || !event.message || event.message.is_echo === true) return null;
  const message = event.message;
  const senderId = cleanSocialText(event.sender?.id, 100);
  const recipientId = cleanSocialText(event.recipient?.id, 100);
  const providerMessageId = cleanSocialText(message.mid, 200);
  if (!senderId || !recipientId || !providerMessageId) return null;
  const rawText = cleanSocialText(message.text, 2000);
  const attachmentOnly = !rawText && Array.isArray(message.attachments) && message.attachments.length > 0;
  if (!rawText && !attachmentOnly) return null;
  const text = redactSocialText(rawText || '[Customer sent an attachment. Review it in Meta Business Suite; CALLORIA does not download attachments.]');
  const timestamp = Number(event.timestamp);
  const receivedAt = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(Math.min(timestamp, Date.now() + 60_000)).toISOString()
    : new Date().toISOString();
  return Object.freeze({
    provider,
    accountId: cleanSocialText(entry?.id, 100) || recipientId,
    senderId,
    recipientId,
    providerMessageId,
    text,
    receivedAt,
    attachmentOnly
  });
}

export function validateSocialReply(value) {
  const text = redactSocialText(value);
  if (text.length < 1) throw new Error('Enter a reply before sending.');
  if (text.length > 1000) throw new Error('Social replies are limited to 1,000 characters.');
  if (/\b(?:we guarantee|guaranteed result|definitely approved|your account is fixed)\b/i.test(text)) {
    throw new Error('Remove an unverified guarantee or outcome claim before sending.');
  }
  return text;
}
