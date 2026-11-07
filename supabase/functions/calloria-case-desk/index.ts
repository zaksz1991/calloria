import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * CALLORIA Phase 6 guest case desk.
 * - Guest-first case creation and reference+token status lookup.
 * - No direct client access to case tables.
 * - Case descriptions, names and contact details are AES-GCM encrypted.
 * - Raw tracking tokens are returned once and never stored.
 * - No message bodies, contact data, tokens or IP addresses are logged.
 */
const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const encryptionSecret = Deno.env.get('CALLORIA_CASE_ENCRYPTION_SECRET') || '';
const rateLimitSalt = Deno.env.get('CALLORIA_CASE_RATE_LIMIT_SALT') || serviceKey;
const rawAgentAccess = Deno.env.get('CALLORIA_CASE_AGENT_ACCESS') || '';
let agentAccessInvalid = false;
let agentAccess: Record<string, { role: 'supervisor' | 'agent'; departments: string[] }> = {};
try {
  const parsed = rawAgentAccess ? JSON.parse(rawAgentAccess) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid access map');
  for (const [userId, value] of Object.entries(parsed)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || !value || typeof value !== 'object') throw new Error('invalid agent record');
    const item = value as any;
    if (!['agent','supervisor'].includes(item.role) || !Array.isArray(item.departments) || item.departments.some((v: unknown) => typeof v !== 'string')) throw new Error('invalid agent role');
    agentAccess[userId] = { role: item.role, departments: item.departments.map((v: string) => clean(v, 120)) };
    if (item.role === 'supervisor' && !agentAccess[userId].departments.includes('*')) throw new Error('supervisors require wildcard department access');
  }
} catch { agentAccessInvalid = true; agentAccess = {}; }
const encoder = new TextEncoder();
const MAX_BODY = 9000;
const MAX_DESCRIPTION = 1800;
const WINDOW_MS = 15 * 60 * 1000;
const PLATFORMS: Record<string, string> = {
  'ruffneck-learn': 'RuffNeck Learn',
  'ruffneck-prospector': 'RuffNeck Prospector',
  'ruffneck-connect': 'RuffNeck Connect',
  'ruffneck-social-hub': 'RuffNeck Social Hub',
  'kano-run': 'Kano Run / Kano Life',
  'kano-keke': 'Kano Keke'
};
const DEPARTMENTS: Record<string, string> = {
  platform_support: 'RuffNeck Products and Platform Support',
  service_enquiry: 'Sales and Service Enquiries',
  complaint: 'Complaints and Service Recovery',
  personal_guidance: 'Personal Development and Wellbeing Information',
  general_customer_care: 'General Customer Care'
};
const HEADERS = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin'
};

function allowed(origin: string | null): boolean { return Boolean(origin && allowedOrigins.includes(origin)); }
function cors(origin: string | null) { return { ...HEADERS, 'Access-Control-Allow-Origin': allowed(origin) ? origin! : 'null' }; }
function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function clean(value: unknown, max = 300): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function redact(value: unknown): { text: string; redacted: boolean } {
  let text = clean(value, MAX_DESCRIPTION);
  const before = text;
  text = text.replace(/(?<!\d)(?:\+?234|0)[\s().-]*[789]\d{2}[\s().-]*\d{3}[\s().-]*\d{4}\b/g, '[REDACTED PHONE NUMBER]');
  text = text.replace(/\b(pin|otp|one[- ]time password|password|passcode|security code|recovery code)\s*[:#= -]?\s*\S+/gi, '$1: [REDACTED CREDENTIAL]');
  text = text.replace(/\b(?:account|acct|card)\s*(?:number|no\.?|#)?\s*[:#= -]?\d{6,19}\b/gi, '[REDACTED ACCOUNT OR CARD NUMBER]');
  text = text.replace(/\b\d{10,19}\b/g, '[REDACTED LONG NUMBER]');
  text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]');
  return { text: text.trim(), redacted: text !== before };
}
function detectIntent(text: string): string {
  if (/\b(life guidance|relationship|marriage|parent|parenting|child|habit|morals?|conduct|philosoph|psycholog|therapeut|therapy|counsel|advice|advise|emotional intelligence|stress|wellbeing|well-being|personal development|career|motivation|confidence|communication|family|self[- ]help|self[- ]care)\b/i.test(text)) return 'personal_guidance';
  if (/\b(refund|complaint|complain|unresolved|escalat|poor service|charged|debit|payment failed|not received|case review|service recovery)\b/i.test(text)) return 'complaint';
  if (/\b(quote|quotation|price|pricing|cost|offer|service|consult|hire|buy|purchase|sales|subscription)\b/i.test(text)) return 'service_enquiry';
  if (/\b(ruffneck|kano run|kano-keke|kano keke|lms|prospector|connect|social hub|platform|course|enrol|enroll|login|sign in|account|app|game|website|site)\b/i.test(text)) return 'platform_support';
  return 'general_customer_care';
}
function routeDepartment(intent: string, text: string): string {
  if (intent === 'complaint') return 'Complaints and Service Recovery';
  if (intent === 'personal_guidance') return 'Personal Development and Wellbeing Information';
  if (intent === 'service_enquiry') return 'Sales and Service Enquiries';
  if (/\b(email|e-mail|inbox|written response|letter)\b/i.test(text)) return 'Email and Written Support';
  if (/\b(social media|instagram|facebook|tiktok|youtube|whatsapp|twitter|\bx\.com|publishing|social post)\b/i.test(text)) return 'Social Media Support';
  if (/\b(technical|bug|error|crash|not loading|integration|api|database|server|website down|login issue|sign-in issue)\b/i.test(text)) return 'Technical Support and IT';
  if (/\b(quality assurance|\bqa\b|call review|quality review|calibration|audit a call|customer experience review)\b/i.test(text)) return 'Quality Assurance and Customer Experience';
  if (/\b(course|learning|learner|enrol|enroll|training|career pathway|professional skills)\b/i.test(text)) return 'Learning and Career Development';
  return DEPARTMENTS[intent] || DEPARTMENTS.general_customer_care;
}
function isCritical(text: string): boolean {
  return /\b(suicid(?:e|al|ality)|self[- ]?harm|kill(?:ing)? myself|hurt(?:ing)? myself|end(?:ing)? my life|i want to die|i do not want to live|i don't want to live|overdos(?:e|ing)|in immediate danger|being attacked right now|being abused|being assaulted|being beaten|domestic violence happening now|sexual assault happening now|someone is hurting me right now|someone is hurting a child|my partner (?:hit|hits|hurts|threatens) me|my child is being hurt)\b/i.test(text);
}
function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function hmacHex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function encryptionKey(): Promise<CryptoKey> {
  if (encoder.encode(encryptionSecret).length < 32) throw new Error('CALLORIA_CASE_ENCRYPTION_SECRET must contain at least 32 bytes.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(encryptionSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('CALLORIA-CASE-DESK-v1'), info: encoder.encode('case-details-at-rest') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptDetails(value: Record<string, unknown>): Promise<{ ciphertext: string; iv: string }> {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(JSON.stringify(value)));
  return { ciphertext: base64Url(new Uint8Array(encrypted)), iv: base64Url(iv) };
}
async function decryptDetails(ciphertext: string, ivValue: string): Promise<Record<string, unknown>> {
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(ivValue) }, key, fromBase64(ciphertext));
  const parsed = JSON.parse(new TextDecoder().decode(clear));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid encrypted case detail payload.');
  return parsed as Record<string, unknown>;
}
async function requireAgent(request: Request, admin: ReturnType<typeof createClient>): Promise<{ id: string; role: 'agent' | 'supervisor'; departments: string[] } | null> {
  if (agentAccessInvalid || !Object.keys(agentAccess).length) throw new Error('CALLORIA_CASE_AGENT_ACCESS is missing or invalid.');
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  const userId = data?.user?.id || '';
  const configured = agentAccess[userId];
  if (error || !userId || !configured) return null;
  return { id: userId, role: configured.role, departments: configured.departments };
}
const AGENT_DEPARTMENTS = new Set([
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
]);
const CASE_STATUSES = new Set(['received','triaged','assigned','in_progress','awaiting_customer','resolved','closed']);
function newToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}
function newReference(): string {
  const d = new Date();
  const date = `${String(d.getUTCFullYear()).slice(-2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `CC-${date}-${Array.from(bytes, b => alphabet[b % alphabet.length]).join('')}`;
}
function validVisitorId(value: unknown): value is string {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}
function clientIp(request: Request): string {
  return clean(request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown', 80);
}
async function consumeLimit(admin: ReturnType<typeof createClient>, subject: string, limit: number): Promise<boolean> {
  const hash = await hmacHex(rateLimitSalt, subject);
  const start = new Date(Math.floor(Date.now() / WINDOW_MS) * WINDOW_MS).toISOString();
  const { data, error } = await admin.rpc('consume_calloria_cc_rate_limit', {
    p_subject_hash: hash, p_window_start: start, p_max_requests: limit
  });
  if (error) throw new Error('Rate-limit service unavailable.');
  return data === true;
}
function validateContact(preference: string, contact: string) {
  if (!['none', 'email', 'phone'].includes(preference)) throw new Error('Choose a valid contact preference.');
  if (preference === 'none' && contact) throw new Error('Remove the contact detail or choose email or phone follow-up.');
  if (preference !== 'none' && !contact) throw new Error('Enter a contact detail for the selected follow-up method.');
  if (preference === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) throw new Error('The email address is not valid.');
  if (preference === 'phone' && !/^\+?[0-9][0-9\s().-]{7,18}$/.test(contact)) throw new Error('The phone number is not valid.');
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (!allowedOrigins.length) return reply(503, { error: 'CALLORIA_ALLOWED_ORIGINS is not configured.' }, origin);
  if (request.method === 'OPTIONS') return allowed(origin) ? new Response('ok', { headers: cors(origin) }) : reply(403, { error: 'Origin not permitted.' }, origin);
  if (request.method !== 'POST') return reply(405, { error: 'Only POST is accepted.' }, origin);
  if (!allowed(origin)) return reply(403, { error: 'Origin not permitted.' }, origin);
  if (!serviceUrl || !serviceKey) return reply(503, { error: 'CALLORIA case storage is not configured.' }, origin);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > MAX_BODY) return reply(413, { error: 'The request is too large.' }, origin);

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'The request is too large.' }, origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'The request must contain valid JSON.' }, origin); }
    const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const action = clean(body?.action, 20);
    const ip = clientIp(request);
    if (['create','agent_list','agent_update'].includes(action) && encoder.encode(encryptionSecret).length < 32) {
      return reply(503, { error: 'CALLORIA_CASE_ENCRYPTION_SECRET is not configured with at least 32 bytes in Supabase Edge Function Secrets.' }, origin);
    }
    const { error: purgeError } = await admin.from('calloria_cc_cases').delete().lt('expires_at', new Date().toISOString());
    if (purgeError) return reply(503, { error: 'The case retention cleanup could not run. Case operations are paused until the database is available.' }, origin);

    if (action === 'create') {
      if (!validVisitorId(body?.visitorId)) return reply(400, { error: 'The guest session is invalid. Refresh and try again.' }, origin);
      if (body?.consent !== true) return reply(400, { error: 'Consent is required before a support case can be stored.' }, origin);
      const originalMessage = clean(body?.description, MAX_DESCRIPTION);
      if (originalMessage.length < 8) return reply(400, { error: 'Describe the issue in at least eight characters.' }, origin);
      if (String(body?.description ?? '').length > MAX_DESCRIPTION) return reply(413, { error: 'The issue description is too long.' }, origin);
      if (isCritical(originalMessage)) return reply(409, {
        error: 'This appears to involve an immediate safety concern. A support ticket is not an emergency response. Contact local emergency services or a qualified safeguarding provider now, and reach a trusted person who can assist in person.'
      }, origin);
      if (!(await consumeLimit(admin, `create-ip:${ip}`, 10)) || !(await consumeLimit(admin, `create-guest:${body.visitorId}`, 4))) {
        return reply(429, { error: 'Too many support cases were submitted recently. Wait before trying again.' }, origin);
      }

      const safe = redact(originalMessage);
      const subject = redact(body?.subject || 'Customer support request').text.slice(0, 120);
      if (subject.length < 4) return reply(400, { error: 'Enter a valid case subject.' }, origin);
      const platformId = clean(body?.platformId, 80);
      if (platformId && !PLATFORMS[platformId]) return reply(400, { error: 'The selected platform is not recognised.' }, origin);
      const intent = detectIntent(`${subject} ${safe.text}`);
      const department = routeDepartment(intent, `${subject} ${safe.text}`);
      const contactPreference = clean(body?.contactPreference || 'none', 12);
      const contact = clean(body?.contact, 180);
      validateContact(contactPreference, contact);
      const customerName = clean(body?.customerName, 100);
      const requestedUrgency = clean(body?.urgency, 12);
      const urgency = requestedUrgency === 'high' || intent === 'complaint' ? 'high' : 'normal';
      const token = newToken();
      const reference = newReference();
      const details = await encryptDetails({
        subject, description: safe.text, customerName, contact, contactPreference,
        issueTextRedacted: safe.redacted, submittedAt: new Date().toISOString()
      });
      const guestFingerprint = await hmacHex(rateLimitSalt, `guest:${body.visitorId}`);
      const accessTokenHash = await sha256Hex(token);
      const now = new Date().toISOString();

      // Expired case data was purged above. Case detail payloads are encrypted.
      const { data: createdData, error } = await admin.rpc('create_calloria_cc_case', {
        p_reference_code: reference,
        p_access_token_hash: accessTokenHash,
        p_guest_fingerprint: guestFingerprint,
        p_intent: intent,
        p_department: department,
        p_platform_id: platformId || null,
        p_urgency: urgency,
        p_contact_preference: contactPreference,
        p_details_ciphertext: details.ciphertext,
        p_details_iv: details.iv,
        p_consented_at: now,
        p_expires_at: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString()
      });
      const inserted = Array.isArray(createdData) ? createdData[0] : createdData;
      if (error || !inserted) return reply(503, { error: 'CALLORIA could not save the case. No tracking reference was issued; please try again.' }, origin);
      return reply(201, {
        caseReference: inserted.reference_code,
        accessToken: token,
        status: inserted.status,
        createdAt: inserted.created_at,
        retentionDays: 180,
        message: 'Save the case reference and access code now. The code is shown once and cannot be recovered if lost.'
      }, origin);
    }

    if (action === 'lookup') {
      const reference = clean(body?.caseReference, 30).toUpperCase();
      const token = clean(body?.accessToken, 60);
      if (!/^CC-\d{6}-[A-Z2-9]{6}$/.test(reference) || !/^[A-Za-z0-9_-]{40,48}$/.test(token)) {
        return reply(400, { error: 'Enter a valid case reference and full access code.' }, origin);
      }
      if (!(await consumeLimit(admin, `lookup-ip:${ip}`, 30))) return reply(429, { error: 'Too many status checks. Wait before trying again.' }, origin);
      const tokenHash = await sha256Hex(token);
      const { data: record, error } = await admin.from('calloria_cc_cases')
        .select('id,reference_code,status,department,platform_id,public_status_message,created_at,updated_at,expires_at')
        .eq('reference_code', reference).eq('access_token_hash', tokenHash).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (error) return reply(503, { error: 'CALLORIA could not retrieve the case status.' }, origin);
      if (!record) return reply(404, { error: 'No active case matched that reference and access code. Check both values and try again.' }, origin);
      const { data: events } = await admin.from('calloria_cc_case_events')
        .select('to_status,public_message,created_at').eq('case_id', record.id)
        .not('public_message', 'is', null).order('created_at', { ascending: true }).limit(15);
      return reply(200, {
        caseReference: record.reference_code,
        status: record.status,
        department: record.department,
        platformName: record.platform_id ? (PLATFORMS[record.platform_id] || '') : '',
        publicMessage: record.public_status_message,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        timeline: (events || []).map((event: any) => ({ status: clean(event.to_status, 40), message: clean(event.public_message, 320), at: event.created_at })),
        expiresAt: record.expires_at
      }, origin);
    }
    if (action === 'agent_list') {
      let actor: { id: string; role: 'agent' | 'supervisor'; departments: string[] } | null;
      try { actor = await requireAgent(request, admin); }
      catch { return reply(503, { error: 'The CALLORIA_CASE_AGENT_ACCESS staff permissions map is not configured correctly.' }, origin); }
      if (!actor) return reply(403, { error: 'An authorised CALLORIA staff account is required.' }, origin);
      const filterStatus = clean(body?.status, 30);
      let query = admin.from('calloria_cc_cases')
        .select('id,reference_code,intent,department,platform_id,urgency,status,contact_preference,details_ciphertext,details_iv,created_at,updated_at,expires_at,assigned_to')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(100);
      if (actor.role !== 'supervisor') {
        if (!actor.departments.length || actor.departments.includes('*')) return reply(403, { error: 'A staff agent must have explicit department access.' }, origin);
        query = query.in('department', actor.departments);
      }
      if (filterStatus && filterStatus !== 'all' && CASE_STATUSES.has(filterStatus)) query = query.eq('status', filterStatus);
      const { data: rows, error } = await query;
      if (error) return reply(503, { error: 'CALLORIA could not load the case queue.' }, origin);
      const caseIds = (rows || []).map((row: any) => row.id);
      const { data: caseEvents } = caseIds.length ? await admin.from('calloria_cc_case_events')
        .select('case_id,to_status,public_message,private_note_ciphertext,private_note_iv,actor_id,created_at').in('case_id', caseIds)
        .not('public_message', 'is', null).order('created_at', { ascending: true }).limit(1500) : { data: [] };
      const timelineByCase = new Map<string, any[]>();
      for (const event of caseEvents || []) {
        const bucket = timelineByCase.get(event.case_id) || [];
        let note = '';
        if (event.private_note_ciphertext && event.private_note_iv) {
          try { const privatePayload = await decryptDetails(event.private_note_ciphertext, event.private_note_iv); note = clean(privatePayload.note, 1200); } catch { note = '[Encrypted internal note could not be decrypted]'; }
        }
        bucket.push({ status: clean(event.to_status, 40), message: clean(event.public_message, 320), internalNote: note, actorId: event.actor_id, at: event.created_at });
        timelineByCase.set(event.case_id, bucket);
      }
      const cases = [];
      for (const row of rows || []) {
        try {
          const details = await decryptDetails(row.details_ciphertext, row.details_iv);
          cases.push({
            caseReference: row.reference_code, intent: row.intent, department: row.department,
            platformName: row.platform_id ? (PLATFORMS[row.platform_id] || '') : '',
            platformId: row.platform_id, urgency: row.urgency, status: row.status,
            contactPreference: row.contact_preference, assignedTo: row.assigned_to,
            subject: clean(details.subject, 120), description: clean(details.description, 1800),
            customerName: clean(details.customerName, 100), contact: clean(details.contact, 180),
            submittedAt: clean(details.submittedAt, 40), createdAt: row.created_at, updatedAt: row.updated_at,
            timeline: (timelineByCase.get(row.id) || []).slice(-15)
          });
        } catch { cases.push({ caseReference: row.reference_code, status: row.status, urgency: row.urgency, department: row.department, decryptionError: true, createdAt: row.created_at }); }
      }
      return reply(200, { cases, count: cases.length, agentUserId: actor.id, agentRole: actor.role, agentDepartments: actor.departments }, origin);
    }

    if (action === 'agent_update') {
      let actor: { id: string; role: 'agent' | 'supervisor'; departments: string[] } | null;
      try { actor = await requireAgent(request, admin); }
      catch { return reply(503, { error: 'The CALLORIA_CASE_AGENT_ACCESS staff permissions map is not configured correctly.' }, origin); }
      if (!actor) return reply(403, { error: 'An authorised CALLORIA staff account is required.' }, origin);
      const caseReference = clean(body?.caseReference, 30).toUpperCase();
      const nextStatus = clean(body?.status, 30);
      const publicMessage = clean(body?.publicMessage, 320);
      const departmentValue = clean(body?.department, 120);
      const assignedToRaw = clean(body?.assignedTo, 50);
      const privateNote = clean(body?.privateNote, 1200);
      if (!/^CC-\d{6}-[A-Z2-9]{6}$/.test(caseReference) || !CASE_STATUSES.has(nextStatus)) return reply(400, { error: 'The case reference or status is invalid.' }, origin);
      if (!AGENT_DEPARTMENTS.has(departmentValue)) return reply(400, { error: 'Choose a recognised CALLORIA department.' }, origin);
      if (actor.role !== 'supervisor') {
        if (!actor.departments.includes(departmentValue)) return reply(403, { error: 'This agent cannot route cases outside their authorised departments.' }, origin);
        const { data: existingCase, error: lookupError } = await admin.from('calloria_cc_cases').select('department').eq('reference_code', caseReference).gt('expires_at', new Date().toISOString()).maybeSingle();
        if (lookupError || !existingCase || !actor.departments.includes(existingCase.department)) return reply(403, { error: 'This agent cannot access the selected case.' }, origin);
      }
      if (publicMessage.length < 5) return reply(400, { error: 'Enter a customer-visible progress update.' }, origin);
      let assignedTo: string | null = null;
      if (assignedToRaw) {
        if (assignedToRaw !== actor.id && actor.role !== 'supervisor') return reply(403, { error: 'Agents may assign cases only to themselves.' }, origin);
        const assignee = agentAccess[assignedToRaw];
        if (assignedToRaw !== actor.id && !assignee) return reply(400, { error: 'The assignee is not an authorised CALLORIA staff member.' }, origin);
        if (assignee && assignee.role === 'agent' && !assignee.departments.includes(departmentValue)) return reply(400, { error: 'The selected assignee does not have access to the chosen department.' }, origin);
        assignedTo = assignedToRaw;
      }
      let encryptedNote: { ciphertext: string; iv: string } | null = null;
      if (privateNote) encryptedNote = await encryptDetails({ note: privateNote, recordedAt: new Date().toISOString() });
      const { data: updated, error } = await admin.rpc('update_calloria_cc_case', {
        p_reference_code: caseReference, p_actor_id: actor.id, p_new_status: nextStatus,
        p_public_message: publicMessage, p_private_note_ciphertext: encryptedNote?.ciphertext || null,
        p_private_note_iv: encryptedNote?.iv || null, p_assigned_department: departmentValue, p_assigned_to: assignedTo
      });
      if (error || !updated) return reply(503, { error: 'CALLORIA could not update the case. Check the case reference and retry.' }, origin);
      return reply(200, { caseReference, status: Array.isArray(updated) ? updated[0]?.status : updated.status, updatedAt: Array.isArray(updated) ? updated[0]?.updated_at : updated.updated_at }, origin);
    }

    return reply(400, { error: 'Unknown case desk action.' }, origin);
  } catch {
    return reply(500, { error: 'CALLORIA Case Desk encountered an unexpected error. No message or contact details were logged.' }, origin);
  }
});
