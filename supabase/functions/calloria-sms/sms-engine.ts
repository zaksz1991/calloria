/** Pure, deterministic CALLORIA SMS rules. No provider credentials or network calls. */
export const SMS_DEPARTMENTS = Object.freeze({
  platform_support: { department: 'RuffNeck Products and Platform Support', skill: 'platform_support', priority: 'normal', intent: 'platform_support' },
  account_access: { department: 'RuffNeck Products and Platform Support', skill: 'account_access', priority: 'normal', intent: 'account_access' },
  technical_support: { department: 'Technical Support and IT', skill: 'technical_support', priority: 'normal', intent: 'technical_support' },
  sales_enquiry: { department: 'Sales and Service Enquiries', skill: 'sales', priority: 'normal', intent: 'sales_enquiry' },
  complaint: { department: 'Complaints and Service Recovery', skill: 'complaints', priority: 'high', intent: 'complaint' },
  personal_guidance: { department: 'Personal Development and Wellbeing Information', skill: 'personal_guidance', priority: 'normal', intent: 'personal_guidance' },
  safeguarding: { department: 'Safeguarding and Trained Human Support', skill: 'safeguarding', priority: 'urgent', intent: 'safeguarding' },
  learning_career: { department: 'Learning and Career Development', skill: 'learning_advice', priority: 'normal', intent: 'learning_career' },
  social_media: { department: 'Social Media Support', skill: 'social_support', priority: 'normal', intent: 'social_media' },
  general: { department: 'General Customer Care', skill: 'general_customer_care', priority: 'normal', intent: 'general' }
});

const DEPT_FOR_PLATFORM = Object.freeze({
  'ruffneck-learn': 'learning_career',
  'ruffneck-prospector': 'platform_support',
  'ruffneck-connect': 'platform_support',
  'ruffneck-social-hub': 'social_media',
  'kano-run': 'platform_support',
  'kano-keke': 'platform_support'
});
const PLATFORM_PATTERNS: Array<[RegExp, string]> = [
  [/\b(ruffneck\s*learn|lms|course|enrol|enroll|student|lesson|certificate)\b/i, 'ruffneck-learn'],
  [/\b(prospector|lead generation|lead scoring|prospecting)\b/i, 'ruffneck-prospector'],
  [/\b(ruffneck\s*connect|community|communities|collaborat)\b/i, 'ruffneck-connect'],
  [/\b(social hub|social media management|social inbox|publishing workspace)\b/i, 'ruffneck-social-hub'],
  [/\b(kano\s*run|kano\s*life)\b/i, 'kano-run'],
  [/\b(kano\s*keke|keke simulator)\b/i, 'kano-keke']
];
const RESTRICTED: Array<[RegExp, string]> = [
  [/\b(password|passcode|pass phrase|otp|one[- ]time password|pin(?: number)?|cvv|cvc|security code)\s*(?:(?:is|equals|[:#=-])\s*)?[a-z0-9-]{3,24}\b/gi, '$1: [REDACTED]'],
  [/\b(api[_ -]?key|access[_ -]?token|bearer)\s*[:#= -]?\s*[a-z0-9._~+/-]{10,}\b/gi, '$1: [REDACTED]'],
  [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL REDACTED]'],
  [/(?:\+?234|0)[ -]?[789](?:[ -]?\d){9}\b/g, '[PHONE REDACTED]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[FINANCIAL NUMBER REDACTED]'],
  [/\b(account|acct|bank account)\s*(number)?\s*[:#= -]?\d{6,19}\b/gi, '$1 number: [REDACTED]']
];

export function cleanSmsText(value, max = 600) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
export function redactSmsText(value, max = 600) {
  let text = cleanSmsText(value, max);
  for (const [pattern, replacement] of RESTRICTED) text = text.replace(pattern, replacement);
  return text.slice(0, max);
}
export function normalizeNigeriaSmsNumber(value) {
  let digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`;
  if (digits.startsWith('2340')) digits = `234${digits.slice(4)}`;
  if (!/^234[789]\d{9}$/.test(digits)) throw new Error('A valid Nigerian mobile number is required (for example, +2348012345678).');
  return digits;
}
export function maskSmsNumber(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length < 10 ? '••••••' : `+${digits.slice(0, 3)} •••• ${digits.slice(-4)}`;
}
export function parseSmsCommand(value) {
  const text = cleanSmsText(value, 100).toUpperCase();
  if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT)(\s+.*)?$/.test(text)) return 'STOP';
  if (/^(START|UNSTOP|SUBSCRIBE)(\s+.*)?$/.test(text)) return 'START';
  if (/^HELP(\s+.*)?$/.test(text)) return 'HELP';
  return null;
}
export function detectSmsLanguage(value) {
  const text = cleanSmsText(value, 600).toLowerCase();
  if (/\b(sannu|na gode|don Allah|ina kwana|lafiya|yaya|ina bukata)\b/.test(text)) return 'ha';
  if (/[ẹọṣ]|\b(ẹ ká|e ka|jọwọ|ẹ ṣe|báwo|ẹ jọ̀ọ́)\b/.test(text)) return 'yo';
  if (/[ịọụṅ]|\b(biko|daalụ|kedu|nnoo|ọ dị)\b/.test(text)) return 'ig';
  if (/\b(abeg|wetin|una|na wa|how far|no wahala|i wan|make una)\b/.test(text)) return 'pcm';
  return 'en';
}
export function detectSmsPlatform(value) {
  const text = cleanSmsText(value, 600);
  for (const [pattern, platformId] of PLATFORM_PATTERNS) if (pattern.test(text)) return platformId;
  return null;
}
export function classifySmsIntent(value) {
  const text = cleanSmsText(value, 600).toLowerCase();
  let intent = 'general';
  if (/\b(suicid|kill myself|self[- ]?harm|hurt myself|abuse|threat|violence|unsafe|in immediate danger|rape|assault)\b/.test(text)) intent = 'safeguarding';
  else if (/\b(complain|complaint|refund|unfair|bad service|terrible|fraud|scam|charged twice|not resolved)\b/.test(text)) intent = 'complaint';
  else if (/\b(price|pricing|cost|quote|quotation|buy|purchase|subscribe|subscription|plan|service|offer|how much|payment)\b/.test(text)) intent = 'sales_enquiry';
  else if (/\b(login|log in|sign in|password reset|account access|locked out|cannot access|can't access)\b/.test(text)) intent = 'account_access';
  else if (/\b(error|bug|crash|not working|does not work|cannot open|can't open|technical|failed to load|loading forever)\b/.test(text)) intent = 'technical_support';
  else if (/\b(relationship|marriage|parenting|parent|habit|emotional intelligence|career development|personal development|life advice|psychology|wellbeing|well-being)\b/.test(text)) intent = 'personal_guidance';
  else if (/\b(course|learning|certificate|career|training|skill development|enrol|enroll|student)\b/.test(text)) intent = 'learning_career';
  else if (/\b(instagram|facebook|social media|post|publishing|scheduled post|social hub)\b/.test(text)) intent = 'social_media';
  const platformId = detectSmsPlatform(text);
  if (platformId && intent === 'general') intent = DEPT_FOR_PLATFORM[platformId];
  const selected = SMS_DEPARTMENTS[intent] || SMS_DEPARTMENTS.general;
  return { ...selected, platformId, language: detectSmsLanguage(text) };
}
export function normalizeTermiiDeliveryStatus(value) {
  const status = String(value ?? '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  if (status === 'delivered') return 'delivered';
  if (status === 'message sent' || status === 'sent' || status === 'queued') return 'sent';
  if (status.includes('dnd')) return 'dnd_blocked';
  if (status === 'rejected') return 'rejected';
  if (status === 'expired') return 'expired';
  if (status === 'message failed' || status === 'failed' || status === 'error') return 'failed';
  return 'unknown';
}
const GSM7_BASIC = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà';
const GSM7_EXTENDED = '^{}\\[~]|€';
export function estimateSmsSegments(value) {
  const text = String(value ?? '');
  if (!text.length) return { encoding: 'GSM-7', units: 0, segments: 0, remaining: 160, limit: 480 };
  let septets = 0;
  let gsm7 = true;
  for (const character of text) {
    if (GSM7_BASIC.includes(character)) septets += 1;
    else if (GSM7_EXTENDED.includes(character)) septets += 2;
    else { gsm7 = false; break; }
  }
  if (gsm7) {
    const segments = septets <= 160 ? 1 : Math.ceil(septets / 153);
    const segmentLimit = segments <= 1 ? 160 : 153;
    return { encoding: 'GSM-7', units: septets, segments, remaining: Math.max(0, segmentLimit - (segments === 1 ? septets : septets % 153 || 153)), limit: 480 };
  }
  const units = text.length; // SMS Unicode capacity is measured in UTF-16 code units.
  const segments = units <= 70 ? 1 : Math.ceil(units / 67);
  const segmentLimit = segments <= 1 ? 70 : 67;
  return { encoding: 'UCS-2', units, segments, remaining: Math.max(0, segmentLimit - (segments === 1 ? units : units % 67 || 67)), limit: 480 };
}

export function validateSmsSupportReply(value) {
  const text = cleanSmsText(value, 600);
  if (text.length < 2) throw new Error('Enter a customer-support reply.');
  if (text.length > 480) throw new Error('Keep the SMS reply at 480 characters or fewer.');
  if (/\b(password|passcode|otp|one[- ]time password|pin|cvv|cvc|api[_ -]?key|access[_ -]?token)\b/i.test(text)) throw new Error('Do not send passwords, OTPs, PINs, card security details or API secrets by SMS.');
  if (/\b(bulk|broadcast|mass message|limited time offer|buy now|act now|flash sale|unsubscribe to stop|earn money fast|guaranteed returns)\b/i.test(text)) throw new Error('This SMS channel is restricted to one-to-one customer support and service updates, not promotional campaigns.');
  return text;
}
export function isValidTermiiBaseUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && url.username === '' && url.password === '' && !url.search && !url.hash && /^([a-z0-9-]+\.)*termii\.com$/i.test(url.hostname) && (url.pathname === '/' || url.pathname === '');
  } catch { return false; }
}
export function buildTermiiSmsPayload({ apiKey, to, from, sms }) {
  const recipient = normalizeNigeriaSmsNumber(to);
  const sender = cleanSmsText(from, 11);
  if (sender.length < 3 || !/^[A-Za-z0-9]+$/.test(sender)) throw new Error('Use an approved alphanumeric Termii Sender ID of 3–11 letters or digits.');
  const message = validateSmsSupportReply(sms);
  if (!apiKey || String(apiKey).length < 16) throw new Error('Termii API key is not configured.');
  // The DND route is reserved for customer-initiated support responses and service notices.
  // Marketing and bulk traffic are deliberately not implemented in CALLORIA SMS.
  return { api_key: String(apiKey), to: recipient, from: sender, sms: message, type: 'plain', channel: 'dnd' };
}
export function buildTermiiWebhookEvent(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('A valid Termii webhook object is required.');
  const type = cleanSmsText(payload.type, 40).toLowerCase();
  if (type === 'incoming_sms' || type === 'sms_received' || type === 'received') {
    const from = normalizeNigeriaSmsNumber(payload.from ?? payload.sender ?? payload.msisdn);
    const message = cleanSmsText(payload.message ?? payload.sms ?? payload.text, 1000);
    if (message.length < 1) throw new Error('Incoming SMS body is missing.');
    return { kind: 'incoming', from, message, providerEventId: cleanSmsText(payload.message_id ?? payload.id ?? '', 160), receivedAt: payload.timestamp ?? payload.received_at ?? null };
  }
  const status = normalizeTermiiDeliveryStatus(payload.status);
  const providerMessageId = cleanSmsText(payload.message_id ?? payload.message_id_str ?? payload.id ?? '', 160);
  if (!providerMessageId) throw new Error('Termii delivery event is missing its message ID.');
  return { kind: 'delivery', providerMessageId, status, providerEventId: cleanSmsText(payload.id ?? '', 160) };
}
export async function verifyTermiiWebhookSignature(rawBody, signature, secret) {
  if (!secret || new TextEncoder().encode(secret).length < 16 || !signature) return false;
  const supplied = String(signature).trim().replace(/^sha512=/i, '').toLowerCase();
  if (!/^[a-f0-9]{128}$/.test(supplied)) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(String(rawBody))));
  const expected = [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== supplied.length) return false;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ supplied.charCodeAt(index);
  return mismatch === 0;
}
