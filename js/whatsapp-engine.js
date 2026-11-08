export const WHATSAPP_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const SUPPORTED_LANGUAGES = Object.freeze(['en', 'ha', 'yo', 'ig', 'pcm']);

export function cleanText(value, maxLength = 4096) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

export function normalizeWhatsAppId(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 16) return null;
  return digits;
}

export function maskWhatsAppId(value) {
  const normalized = normalizeWhatsAppId(value);
  if (!normalized) return 'Unknown contact';
  return `+${'*'.repeat(Math.max(4, normalized.length - 4))}${normalized.slice(-4)}`;
}

export function getServiceWindow(lastInboundAt, now = Date.now()) {
  const timestamp = typeof lastInboundAt === 'number' ? lastInboundAt : Date.parse(lastInboundAt ?? '');
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return { open: false, expiresAt: null, remainingMs: 0, label: 'No customer-initiated service window' };
  }
  const expires = timestamp + WHATSAPP_SERVICE_WINDOW_MS;
  const remainingMs = Math.max(0, expires - now);
  return {
    open: remainingMs > 0,
    expiresAt: new Date(expires).toISOString(),
    remainingMs,
    label: remainingMs > 0 ? '24-hour service window open' : 'Service window closed — approved template required'
  };
}


export function detectMessageLanguage(text) {
  const value = ` ${cleanText(text, 1200).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')} `;
  const vocabularies = {
    ha: [' sannu ', ' yaya ', ' lafiya ', ' taimako ', ' matsala ', ' ina bukata ', ' don Allah ', ' na gode ', ' me ya faru ', ' barka '],
    yo: [' e kaaro ', ' e kaasan ', ' bawo ni ', ' e jowo ', ' mo fe ', ' mo nife ', ' e se ', ' se daadaa ', ' iranlọwọ '],
    ig: [' kedu ', ' biko ', ' daalu ', ' achoro ', ' enyemaka ', ' o di ', ' kedu ka ', ' imela ', ' ndo '],
    pcm: [' abeg ', ' how far ', ' wetin ', ' una ', ' dey ', ' wahala ', ' no vex ', ' e don ', ' make una ', ' na so ']
  };
  const scores = Object.entries(vocabularies).map(([language, terms]) => ({ language, score: terms.filter(term => value.includes(term)).length }));
  scores.sort((a,b) => b.score - a.score);
  return scores[0]?.score >= 2 ? scores[0].language : 'en';
}

export function classifyWhatsAppMessage(text) {
  const value = cleanText(text, 4096).toLowerCase();
  const language = detectMessageLanguage(value);
  const platform = [
    [['ruffneck learn', 'learn portal', 'course', 'lesson', 'lms'], 'ruffneck-learn'],
    [['prospector', 'lead list', 'lead scoring', 'prospecting'], 'ruffneck-prospector'],
    [['ruffneck connect', 'community', 'communities', 'collaboration'], 'ruffneck-connect'],
    [['social hub', 'social media management', 'schedule post', 'social post'], 'ruffneck-social-hub'],
    [['kano run', 'kano life', 'keke run'], 'kano-run'],
    [['kano keke', 'keke simulator'], 'kano-keke']
  ].find(([terms]) => terms.some(term => value.includes(term)))?.[1] ?? null;

  // A customer mentioning immediate danger or self-harm is sent to trained
  // safeguarding staff. Fraud/unauthorised access is a complaint/security issue,
  // not automatically classified as a mental-health crisis.
  if (/\b(suicid(?:e|al)|kill myself|end my life|hurt myself|self[- ]harm|being abused|in immediate danger)\b/.test(value)) {
    return { intent: 'safeguarding', priority: 'urgent', department: 'Safeguarding and Trained Human Support', skill: 'safeguarding', platformId: platform, language };
  }
  if (/\b(fraud|scam|hacked|unauthori[sz]ed|stolen|money missing|security breach|account compromised)\b/.test(value)) {
    return { intent: 'complaint', priority: 'high', department: 'Complaints and Service Recovery', skill: 'complaints', platformId: platform, language };
  }
  if (/\b(complaint|complain|angry|disappointed|refund|unacceptable|poor service)\b/.test(value)) {
    return { intent: 'complaint', priority: 'high', department: 'Complaints and Service Recovery', skill: 'complaints', platformId: platform, language };
  }
  if (/\b(price|pricing|cost|how much|subscribe|subscription|buy|purchase|quotation|quote)\b/.test(value)) {
    return { intent: 'sales_enquiry', priority: 'normal', department: 'Sales and Service Enquiries', skill: 'sales', platformId: platform, language };
  }
  if (/\b(relationship|marriage|parenting|parenthood|emotional intelligence|personal development|career advice)\b/.test(value)) {
    return { intent: 'personal_guidance', priority: 'normal', department: 'Personal Development and Wellbeing Information', skill: 'personal_guidance', platformId: null, language };
  }
  if (platform) {
    return { intent: 'platform_support', priority: 'normal', department: 'RuffNeck Products and Platform Support', skill: 'platform_support', platformId: platform, language };
  }
  return { intent: 'general', priority: 'normal', department: 'General Customer Care', skill: 'general_customer_care', platformId: null, language };
}

export function redactWhatsAppSummary(value) {
  return cleanText(value, 5000)
    .replace(/\b(password|passcode|pin|otp|one[- ]time password|security code)\s*(?:is\s*)?[:#= -]?\s*[a-z0-9-]{3,20}\b/gi, '$1: [REDACTED]')
    .replace(/\b(api[_ -]?key|access[_ -]?token|authorization|bearer)\s*[:#= -]?\s*[A-Za-z0-9._~+\/-]{12,}\b/gi, '$1: [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/\b(account|acct|bank account|card)\s*(?:number|no\.?)?\s*[:#= -]?\s*\d{6,19}\b/gi, '$1 number: [REDACTED]')
    .replace(/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g, '[REDACTED PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED FINANCIAL NUMBER]');
}

export function getMetaInboundMessages(payload) {
  const messages = [];
  const statuses = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      if (change?.field !== 'messages') continue;
      const value = change?.value ?? {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const contact = contacts.find(item => String(item?.wa_id ?? '') === String(message?.from ?? '')) ?? contacts[0] ?? {};
        const type = cleanText(message?.type, 32).toLowerCase() || 'unknown';
        let body = '';
        if (type === 'text') body = cleanText(message?.text?.body, 4096);
        else if (type === 'button') body = cleanText(message?.button?.text || message?.button?.payload, 4096);
        else if (type === 'interactive') body = cleanText(message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title, 4096);
        else body = `[Customer sent ${type} media. Open the provider inbox to inspect the attachment.]`;
        messages.push({
          providerMessageId: cleanText(message?.id, 180),
          from: normalizeWhatsAppId(message?.from),
          timestamp: Number(message?.timestamp) * 1000,
          type,
          body: body || `[Customer sent a ${type} message without text.]`,
          displayName: cleanText(contact?.profile?.name, 120)
        });
      }
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        statuses.push({
          providerMessageId: cleanText(status?.id, 180),
          status: cleanText(status?.status, 32).toLowerCase(),
          timestamp: Number(status?.timestamp) * 1000,
          errorCode: cleanText(status?.errors?.[0]?.code, 40)
        });
      }
    }
  }
  return { messages: messages.filter(item => item.providerMessageId && item.from && Number.isFinite(item.timestamp)), statuses: statuses.filter(item => item.providerMessageId && Number.isFinite(item.timestamp)) };
}

export function validateOutboundText(value) {
  const raw = String(value ?? '');
  if (raw.length > 4096) return { valid: false, error: 'WhatsApp text replies cannot exceed 4,096 characters.' };
  const body = cleanText(raw, 4096);
  if (body.length < 1) return { valid: false, error: 'Enter a reply before sending.' };
  const asksForSecret = /\b(send|share|tell me|provide|reply with|enter|confirm|type|give us|give me|read out)\b.{0,32}\b(password|passcode|otp|pin|cvv|security code|api key)\b/i.test(body);
  const warnsAgainstSharing = /\b(never|don['’]?t|do not|must not|should not)\b.{0,32}\b(send|share|tell me|provide|reply with|enter|confirm|type|give us|give me|read out)\b/i.test(body);
  if (asksForSecret && !warnsAgainstSharing) {
    return { valid: false, error: 'The reply appears to request a password, PIN, OTP, CVV or API key. Remove that request.' };
  }
  return { valid: true, body };
}

export function statusRank(status) {
  return ({ accepted: 1, sent: 2, delivered: 3, read: 4, failed: 5 })[String(status ?? '').toLowerCase()] ?? 0;
}
