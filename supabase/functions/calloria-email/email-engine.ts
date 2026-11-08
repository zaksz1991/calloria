export const EMAIL_MAX_BODY_LENGTH = 20000;
export const EMAIL_MAX_SUBJECT_LENGTH = 180;
export const EMAIL_SUPPORTED_LANGUAGES = Object.freeze(['en', 'ha', 'yo', 'ig', 'pcm']);

export function cleanEmailText(value, maxLength = EMAIL_MAX_BODY_LENGTH) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ').replace(/\r\n?/g, '\n').trim().slice(0, maxLength);
}

export function normalizeEmailAddress(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw || raw.length > 254 || /[\r\n\s<>]/.test(raw)) return null;
  const at = raw.lastIndexOf('@');
  if (at < 1 || at === raw.length - 1) return null;
  const local = raw.slice(0, at), domain = raw.slice(at + 1);
  if (local.length > 64 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return null;
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain)) return null;
  return raw;
}

export function parseMailbox(value) {
  const raw = cleanEmailText(value, 320);
  const bracket = raw.match(/^(.*?)\s*<\s*([^<>]+)\s*>$/);
  const address = normalizeEmailAddress(bracket ? bracket[2] : raw);
  if (!address) return null;
  return { address, displayName: cleanEmailText(bracket?.[1]?.replace(/^\"|\"$/g, '') ?? '', 120).replace(/[<>\r\n]/g, '').trim() };
}

export function maskEmailAddress(value) {
  const address = normalizeEmailAddress(value);
  if (!address) return 'Unknown email';
  const [local, domain] = address.split('@');
  const visible = local.length <= 2 ? `${local[0] ?? '*'}*` : `${local[0]}${'*'.repeat(Math.min(8, local.length - 2))}${local.at(-1)}`;
  return `${visible}@${domain}`;
}

export function normalizeEmailSubject(value) {
  return cleanEmailText(value, EMAIL_MAX_SUBJECT_LENGTH).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function safeMessageId(value) {
  const raw = cleanEmailText(value, 260).replace(/[\r\n]/g, '').trim();
  if (!raw || raw.length > 250 || !/^<?[^<>\s]+@[^<>\s]+>?$/.test(raw)) return null;
  return raw.startsWith('<') ? raw : `<${raw}>`;
}

export function extractMessageReferences(headers: Record<string, unknown> | Array<{name?: unknown; value?: unknown}> = {}) {
  const normalised: Record<string, string> = {};
  if (Array.isArray(headers)) {
    for (const row of headers) { const name = String(row?.name ?? '').toLowerCase(); if (name) normalised[name] = String(row?.value ?? ''); }
  } else if (headers && typeof headers === 'object') {
    for (const [name, value] of Object.entries(headers)) normalised[name.toLowerCase()] = String(value ?? '');
  }
  const collect = (value: unknown): string[] => (String(value ?? '').match(/<[^<>\s]+@[^<>\s]+>/g) ?? []).slice(0, 20).map(safeMessageId).filter(Boolean);
  return { references: [...new Set(collect(normalised.references))], inReplyTo: collect(normalised['in-reply-to'])[0] ?? null, messageId: safeMessageId(normalised['message-id'] ?? '') };
}

export function chooseThreadRoot(messageIds: {references?: string[]; inReplyTo?: string|null; messageId?: string|null}, fallbackId: unknown) {
  return messageIds.references?.[0] ?? messageIds.inReplyTo ?? messageIds.messageId ?? `resend:${cleanEmailText(fallbackId, 180)}`;
}

export function htmlEmailToText(html) {
  return cleanEmailText(String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|iframe|head)[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6]|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Math.min(0x10ffff, Number(number))))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Math.min(0x10ffff, Number.parseInt(hex, 16))))
    .replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n'), EMAIL_MAX_BODY_LENGTH);
}

export function getPlainEmailBody(email: any) {
  const text = cleanEmailText(email?.text, EMAIL_MAX_BODY_LENGTH);
  return text || htmlEmailToText(email?.html);
}

export function detectEmailLanguage(text) {
  const value = ` ${cleanEmailText(text, 2400).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  const words: Record<string, string[]> = {
    ha: [' sannu ', ' yaya ', ' lafiya ', ' taimako ', ' matsala ', ' ina bukata ', ' don Allah ', ' na gode ', ' me ya faru ', ' barka '],
    yo: [' e kaaro ', ' e kaasan ', ' bawo ni ', ' e jowo ', ' mo fe ', ' mo nife ', ' e se ', ' se daadaa '],
    ig: [' kedu ', ' biko ', ' daalu ', ' achoro ', ' enyemaka ', ' o di ', ' kedu ka ', ' imela ', ' ndo '],
    pcm: [' abeg ', ' how far ', ' wetin ', ' una ', ' dey ', ' wahala ', ' no vex ', ' e don ', ' make una ', ' na so ']
  };
  const scores = Object.entries(words).map(([language, list]) => ({ language, score: list.filter(term => value.includes(term)).length })).sort((a,b) => b.score-a.score);
  return scores[0]?.score >= 2 ? scores[0].language : 'en';
}

export function classifyEmailMessage(subject: unknown, body: unknown, recipient: unknown = '') {
  const value = `${cleanEmailText(subject, 180)}\n${cleanEmailText(body, 5000)}`.toLowerCase();
  const language = detectEmailLanguage(value);
  const platformRows: Array<[string[], string]> = [
    [['ruffneck learn', 'learn portal', 'course', 'lesson', 'lms'], 'ruffneck-learn'],
    [['prospector', 'lead list', 'lead scoring', 'prospecting'], 'ruffneck-prospector'],
    [['ruffneck connect', 'community', 'communities', 'collaboration'], 'ruffneck-connect'],
    [['social hub', 'social media management', 'schedule post', 'social post'], 'ruffneck-social-hub'],
    [['kano run', 'kano life', 'keke run'], 'kano-run'],
    [['kano keke', 'keke simulator'], 'kano-keke']
  ];
  const platformId = platformRows.find(([terms]) => terms.some(term => value.includes(term)))?.[1] ?? null;
  if (/\b(suicid(?:e|al)|kill myself|end my life|hurt myself|self[- ]harm|being abused|in immediate danger)\b/i.test(value)) return { intent:'safeguarding', priority:'urgent', department:'Safeguarding and Trained Human Support', skill:'safeguarding', platformId, language };
  if (/\b(fraud|scam|hacked|unauthori[sz]ed|stolen|money missing|security breach|account compromised)\b/i.test(value)) return { intent:'complaint', priority:'high', department:'Complaints and Service Recovery', skill:'complaints', platformId, language };
  if (/\b(complaint|complain|angry|disappointed|refund|unacceptable|poor service)\b/i.test(value)) return { intent:'complaint', priority:'high', department:'Complaints and Service Recovery', skill:'complaints', platformId, language };
  if (/\b(price|pricing|cost|how much|subscribe|subscription|buy|purchase|quotation|quote)\b/i.test(value)) return { intent:'sales_enquiry', priority:'normal', department:'Sales and Service Enquiries', skill:'sales', platformId, language };
  if (/\b(relationship|marriage|parenting|parenthood|emotional intelligence|personal development|career advice|psychology|habits|morals|conduct)\b/i.test(value)) return { intent:'personal_guidance', priority:'normal', department:'Personal Development and Wellbeing Information', skill:'personal_guidance', platformId:null, language };
  if (platformId) return { intent:'platform_support', priority:'normal', department:'RuffNeck Products and Platform Support', skill:'platform_support', platformId, language };
  const alias = String(recipient ?? '').split('@')[0].toLowerCase();
  if (alias.includes('sales') || alias.includes('billing') || alias.includes('enquir')) return { intent:'sales_enquiry', priority:'normal', department:'Sales and Service Enquiries', skill:'sales', platformId:null, language };
  if (alias.includes('complaint') || alias.includes('escalat')) return { intent:'complaint', priority:'high', department:'Complaints and Service Recovery', skill:'complaints', platformId:null, language };
  if (alias.includes('wellbeing') || alias.includes('guidance') || alias.includes('life')) return { intent:'personal_guidance', priority:'normal', department:'Personal Development and Wellbeing Information', skill:'personal_guidance', platformId:null, language };
  return { intent:'general', priority:'normal', department:'General Customer Care', skill:'general_customer_care', platformId:null, language };
}

export function redactEmailSummary(value) {
  return cleanEmailText(value, 6000)
    .replace(/\b(password|passcode|pin|otp|one[- ]time password|security code)\s*(?:is\s*)?[:#= -]?\s*[a-z0-9-]{3,20}\b/gi, '$1: [REDACTED]')
    .replace(/\b(api[_ -]?key|access[_ -]?token|authorization|bearer)\s*[:#= -]?\s*[A-Za-z0-9._~+\/-]{12,}\b/gi, '$1: [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/\b(account|acct|bank account|card)\s*(?:number|no\.?)?\s*[:#= -]?\s*\d{6,19}\b/gi, '$1 number: [REDACTED]')
    .replace(/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g, '[REDACTED PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED FINANCIAL NUMBER]');
}

export function validateOutboundEmail(subject: unknown, body: unknown) {
  const cleanSubject = cleanEmailText(subject, EMAIL_MAX_SUBJECT_LENGTH).replace(/[\r\n]+/g, ' ').trim();
  const cleanBody = cleanEmailText(body, EMAIL_MAX_BODY_LENGTH);
  if (!cleanSubject || !cleanBody) return { valid:false, error:'Enter both an email subject and response.' };
  if (String(subject ?? '').length > EMAIL_MAX_SUBJECT_LENGTH || String(body ?? '').length > EMAIL_MAX_BODY_LENGTH) return { valid:false, error:'The subject or response exceeds the permitted length.' };
  if (/<\s*(script|iframe|object|embed)\b/i.test(String(body ?? ''))) return { valid:false, error:'Active HTML is not permitted. Send a plain-text response.' };
  const asksForSecret = /\b(send|share|tell me|provide|reply with|enter|confirm|type|give us|give me|read out)\b.{0,48}\b(password|passcode|otp|pin|cvv|security code|api key|access token)\b/i.test(cleanBody);
  const warnsAgainstSharing = /\b(never|don't|do not|must not|should not)\b.{0,48}\b(send|share|tell me|provide|reply with|enter|confirm|type|give us|give me|read out)\b/i.test(cleanBody);
  if (asksForSecret && !warnsAgainstSharing) return { valid:false, error:'The reply appears to request a password, PIN, OTP, CVV or API key. Remove that request.' };
  return { valid:true, subject:cleanSubject, body:cleanBody };
}

function base64Bytes(value) { const binary = atob(value); return Uint8Array.from(binary, character => character.charCodeAt(0)); }
function toBase64(value) { let binary=''; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary); }
function constantTimeEqual(a,b) { if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0; }

export function decodeSvixSecret(secret) {
  const raw = String(secret ?? '').trim(); const encoded = raw.startsWith('whsec_') ? raw.slice(6) : raw;
  if (!encoded || encoded.length > 512) return null;
  try { const bytes = base64Bytes(encoded); return bytes.length >= 16 ? bytes : null; } catch { return null; }
}

export async function verifySvixSignature({ secret, id, timestamp, signature, payload, now = Date.now(), toleranceSeconds = 300 }) {
  const keyBytes = decodeSvixSecret(secret);
  if (!keyBytes || !id || !timestamp || !signature || !/^[\w.=:-]{1,200}$/.test(id) || !/^\d{10}$/.test(String(timestamp))) return false;
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Math.floor(now / 1000) - sentAt) > toleranceSeconds) return false;
  const key = await crypto.subtle.importKey('raw', keyBytes, { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${payload}`);
  const expected = toBase64(new Uint8Array(await crypto.subtle.sign('HMAC', key, signed)));
  const candidates = String(signature).trim().split(/\s+/).filter(Boolean);
  return candidates.some(token => { const parts = token.split(',', 2); return parts[0] === 'v1' && !!parts[1] && constantTimeEqual(expected, parts[1]); });
}
