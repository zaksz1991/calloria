import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * CALLORIA Customer 360 — staff-only, server-encrypted CRM and consent ledger.
 * No raw PII or personal-guidance narratives are logged. The service-role key
 * remains server-side and direct client table access is revoked by migration 008.
 */
const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
const serviceUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const encryptionSecret = Deno.env.get('CALLORIA_CRM_ENCRYPTION_SECRET') || '';
const identitySecret = Deno.env.get('CALLORIA_CRM_IDENTITY_HMAC_SECRET') || '';
const rawAccess = Deno.env.get('CALLORIA_CRM_AGENT_ACCESS') || '';
const encoder = new TextEncoder();
const MAX_BODY = 7000;
const PLATFORM_NAMES: Record<string, string> = {
  'ruffneck-learn': 'RuffNeck Learn',
  'ruffneck-prospector': 'RuffNeck Prospector',
  'ruffneck-connect': 'RuffNeck Connect',
  'ruffneck-social-hub': 'RuffNeck Social Hub',
  'kano-run': 'Kano Run / Kano Life',
  'kano-keke': 'Kano Keke'
};
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];
const PRODUCTS = [
  { id: 'ruffneck-learn', name: 'RuffNeck Learn', url: 'https://ruffneck-lms.vercel.app/', summary: 'Practical learning for AI, digital systems, professional skills and structured courses.', boundary: 'Confirm current course availability, pricing, access periods and terms on the platform.', needs: ['learning','training','skills','career','professional_development','ai_literacy'] },
  { id: 'ruffneck-prospector', name: 'RuffNeck Prospector', url: 'https://ruffneck-prospector.vercel.app/', summary: 'Prospecting and lead-workflow support for finding, organising and working with potential customers.', boundary: 'Do not promise lead volumes, data freshness or conversion outcomes.', needs: ['lead_generation','prospecting','sales','pipeline','business_growth','customer_acquisition'] },
  { id: 'ruffneck-connect', name: 'RuffNeck Connect', url: 'https://ruffneck-connect.vercel.app/', summary: 'Communities and collaboration around shared interests, needs, offers and purposeful connections.', boundary: 'Do not promise membership approval, employment, funding or a specific match.', needs: ['community','collaboration','networking','partnership','belonging'] },
  { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub', url: 'https://ruffneck-social-hub.vercel.app/', summary: 'A workspace for social-media operations, content workflows and connected brand activity.', boundary: 'Confirm which channels, APIs and publishing features are currently enabled.', needs: ['social_media','content_management','brand_management','publishing','marketing_operations'] },
  { id: 'kano-run', name: 'Kano Run / Kano Life', url: 'https://kano-run.vercel.app/', summary: 'Kano-themed driving and life simulation with local routes and passenger operations.', boundary: 'Do not promise frame rate, multiplayer, compatibility or reward availability.', needs: ['games','entertainment','driving_game','simulation','kano','casual_play'] },
  { id: 'kano-keke', name: 'Kano Keke', url: 'https://kano-keke.vercel.app/', summary: 'A Kano keke-driving life-simulation and digital entertainment experience.', boundary: 'Confirm device support, cloud saves, online features and reward rules in the current game.', needs: ['games','entertainment','driving_game','keke','simulation','kano','casual_play'] }
];

interface AgentAccess { role: 'agent' | 'supervisor'; departments: string[] }
let agentAccess: Record<string, AgentAccess> = {};
let accessInvalid = false;
try {
  const parsed = rawAccess ? JSON.parse(rawAccess) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid access map');
  for (const [userId, itemRaw] of Object.entries(parsed)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new Error('invalid staff id');
    const item = itemRaw as any;
    if (!item || !['agent','supervisor'].includes(item.role) || !Array.isArray(item.departments) || item.departments.some((d: unknown) => typeof d !== 'string')) throw new Error('invalid staff permissions');
    const departments = item.departments.map((d: string) => clean(d, 120));
    if (departments.some((d: string) => d !== '*' && !DEPARTMENTS.includes(d))) throw new Error('unknown staff department');
    if (item.role === 'supervisor' && !departments.includes('*')) throw new Error('supervisors require wildcard department access');
    if (item.role === 'agent' && (!departments.length || departments.includes('*'))) throw new Error('agents require explicit department access');
    agentAccess[userId] = { role: item.role, departments };
  }
} catch { accessInvalid = true; agentAccess = {}; }

class InputError extends Error {}

function clean(value: unknown, max = 300): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function allowed(origin: string | null): boolean { return Boolean(origin && allowedOrigins.includes(origin)); }
function cors(origin: string | null) {
  return { 'Access-Control-Allow-Origin': allowed(origin) ? origin! : 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}
function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Pragma': 'no-cache' } });
}
function fromB64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function toB64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function deriveKey(secret: string, purpose: string): Promise<CryptoKey> {
  if (encoder.encode(secret).length < 32) throw new Error(`${purpose} secret is not configured with at least 32 bytes.`);
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('CALLORIA-CUSTOMER-360-v1'), info: encoder.encode(purpose) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
}
async function encrypt(value: unknown): Promise<{ ciphertext: string; iv: string }> {
  const key = await deriveKey(encryptionSecret, 'customer-record-encryption');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = encoder.encode(JSON.stringify(value));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload);
  return { ciphertext: toB64(new Uint8Array(cipher)), iv: toB64(iv) };
}
async function decrypt(ciphertext: string, iv: string): Promise<any> {
  const key = await deriveKey(encryptionSecret, 'customer-record-encryption');
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ciphertext));
  return JSON.parse(new TextDecoder().decode(clear));
}
async function hmac(value: string): Promise<string> {
  if (encoder.encode(identitySecret).length < 32) throw new Error('CALLORIA_CRM_IDENTITY_HMAC_SECRET is not configured with at least 32 bytes.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(identitySecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2,'0')).join('');
}
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return '';
  return `${name.slice(0,1)}${name.length > 2 ? '•••' : '•'}@${domain}`;
}
function maskPhone(phone: string): string { const prefix = phone.startsWith('+') ? phone.slice(0,4) : phone.slice(0,3); return phone.length >= 7 ? `${prefix}••••${phone.slice(-3)}` : ''; }
function tokeniseName(name: string): string[] {
  return [...new Set(clean(name, 100).toLocaleLowerCase('en').split(/[^\p{L}\p{N}]+/u).filter(token => token.length >= 2))].slice(0, 8);
}
function normalEmail(value: unknown): string {
  const email = clean(value, 180).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new InputError('Enter a valid email address.');
  return email;
}
function normalPhone(value: unknown): string {
  const phone = clean(value, 40).replace(/[\s().-]/g, '');
  if (phone && !/^\+?[0-9]{8,16}$/.test(phone)) throw new InputError('Enter a valid phone number.');
  return phone;
}
async function requireStaff(request: Request, admin: ReturnType<typeof createClient>): Promise<{ id: string; role: 'agent' | 'supervisor'; departments: string[] } | null> {
  if (accessInvalid || !Object.keys(agentAccess).length) throw new Error('CALLORIA_CRM_AGENT_ACCESS is missing or invalid. Staff access is closed.');
  const token = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const config = agentAccess[data.user.id];
  if (!config) return null;
  return { id: data.user.id, role: config.role, departments: config.departments };
}
function canAccessDepartment(staff: { departments: string[] }, department: string): boolean {
  return staff.departments.includes('*') || staff.departments.includes(department);
}
function scopedDepartments(staff: { departments: string[] }): string[] { return staff.departments.includes('*') ? DEPARTMENTS : staff.departments; }
async function audit(admin: ReturnType<typeof createClient>, actorId: string, contactId: string | null, action: string, metadata: Record<string, unknown> = {}) {
  const safeMetadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (['channel','direction','interaction_type','purpose','status','department','identity_type','request_ref_hash','mode'].includes(key)) safeMetadata[key] = clean(value, 80);
    else if (typeof value === 'number' || typeof value === 'boolean') safeMetadata[key] = value;
  }
  const { error } = await admin.from('calloria_crm_audit').insert({ actor_id: actorId, contact_id: contactId, action, metadata: safeMetadata });
  if (error) throw new Error('The customer audit record could not be written; the operation was not completed.');
}
async function getContactRow(admin: ReturnType<typeof createClient>, id: string, staff: { departments: string[] }) {
  const { data, error } = await admin.from('calloria_crm_contacts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Customer record could not be loaded.');
  if (!data || !canAccessDepartment(staff, data.owner_department)) return null;
  return data;
}
async function latestConsents(admin: ReturnType<typeof createClient>, contactId: string) {
  const { data, error } = await admin.from('calloria_crm_consents').select('purpose,status,capture_channel,policy_version,created_at').eq('contact_id', contactId).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error('Consent history could not be loaded.');
  const current: Record<string, any> = {};
  for (const row of (data || [])) if (!current[row.purpose]) current[row.purpose] = row;
  return { current, history: data || [] };
}
async function loadContact(admin: ReturnType<typeof createClient>, row: any) {
  const details = await decrypt(row.contact_data_ciphertext, row.contact_data_iv);
  const { data: interactionRows, error: interactionError } = await admin.from('calloria_crm_interactions').select('*').eq('contact_id', row.id).order('occurred_at', { ascending: false }).limit(50);
  if (interactionError) throw new Error('Customer timeline could not be loaded.');
  const interactions = [];
  for (const item of interactionRows || []) {
    const summary = await decrypt(item.summary_ciphertext, item.summary_iv);
    interactions.push({ id: item.id, channel: item.channel, direction: item.direction, type: item.interaction_type, platformId: item.platform_id, platformName: item.platform_id ? (PLATFORM_NAMES[item.platform_id] || '') : '', summary: clean(summary?.summary, 520), caseReference: item.case_reference || null, occurredAt: item.occurred_at });
  }
  const consentData = await latestConsents(admin, row.id);
  const email = clean(details?.email, 180);
  const phone = clean(details?.phone, 40);
  return {
    id: row.id, name: clean(details?.name, 100), maskedEmail: email ? maskEmail(email) : '', maskedPhone: phone ? maskPhone(phone) : '',
    preferredChannel: row.preferred_channel, department: row.owner_department, createdAt: row.created_at, lastInteractionAt: row.last_interaction_at,
    consents: consentData.current, consentHistory: consentData.history, interactions
  };
}
async function getConsent(admin: ReturnType<typeof createClient>, contactId: string, purpose: string) {
  const { data, error } = await admin.from('calloria_crm_consents').select('status').eq('contact_id', contactId).eq('purpose', purpose).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw new Error('Customer consent could not be verified.');
  return data?.status || 'not_recorded';
}
function maskIdentity(type: string, value: string): string {
  if (type === 'email') return maskEmail(value.toLowerCase());
  if (type === 'phone') return maskPhone(value);
  return value.length > 8 ? `${value.slice(0,3)}••••${value.slice(-3)}` : `${value.slice(0,1)}•••`;
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (!allowedOrigins.length) return reply(503, { error: 'CALLORIA_ALLOWED_ORIGINS is not configured.' }, origin);
  if (request.method === 'OPTIONS') return allowed(origin) ? new Response('ok', { headers: cors(origin) }) : reply(403, { error: 'Origin not permitted.' }, origin);
  if (request.method !== 'POST') return reply(405, { error: 'Only POST is accepted.' }, origin);
  if (!allowed(origin)) return reply(403, { error: 'Origin not permitted.' }, origin);
  if (!serviceUrl || !serviceKey) return reply(503, { error: 'Customer 360 storage is not configured.' }, origin);
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY) return reply(413, { error: 'The request is too large.' }, origin);
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: 'The request is too large.' }, origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: 'The request must contain valid JSON.' }, origin); }
    const admin = createClient(serviceUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const staff = await requireStaff(request, admin);
    if (!staff) return reply(401, { error: 'Sign in with an authorised CALLORIA staff account.' }, origin);
    const action = clean(body?.action, 32);
    if (['create_contact','get_contact','search','record_interaction','set_consent','link_identity','verify_identity','recommendations','erase_contact'].includes(action)) {
      if (encoder.encode(encryptionSecret).length < 32 || encoder.encode(identitySecret).length < 32) return reply(503, { error: 'CALLORIA Customer 360 encryption and identity-index secrets are not configured in Supabase Edge Function Secrets.' }, origin);
    }

    if (action === 'whoami') return reply(200, { access: { role: staff.role, departments: staff.departments } }, origin);

    if (action === 'search') {
      const query = clean(body?.query, 180);
      if (query.length < 2) return reply(400, { error: 'Enter at least two characters to search.' }, origin);
      const departments = scopedDepartments(staff);
      let rows: any[] = [];
      const email = normalEmail(query.includes('@') ? query : '');
      const phone = normalPhone(/^\+?[0-9\s().-]+$/.test(query) ? query : '');
      if (email || phone) {
        const hashes: string[] = [];
        if (email) hashes.push(await hmac(`email:${email}`));
        if (phone) hashes.push(await hmac(`phone:${phone}`));
        const queries = await Promise.all(hashes.map(async hash => {
          const column = email && hash === hashes[0] ? 'email_hash' : 'phone_hash';
          return admin.from('calloria_crm_contacts').select('id,owner_department,contact_data_ciphertext,contact_data_iv,email_hash,phone_hash,name_token_hashes,created_at').eq(column, hash).in('owner_department', departments).limit(10);
        }));
        for (const result of queries) {
          if (result.error) throw new Error('Customer search is unavailable.');
          rows.push(...(result.data || []));
        }
        const identityType = email ? 'email' : 'phone';
        const identityHash = hashes[0];
        const { data: linkedIdentities, error: identitySearchError } = await admin.from('calloria_crm_identities').select('contact_id').eq('identity_type', identityType).eq('value_hash', identityHash).limit(10);
        if (identitySearchError) throw new Error('Linked identity search is unavailable.');
        const linkedIds = [...new Set((linkedIdentities || []).map((item: any) => item.contact_id))];
        if (linkedIds.length) {
          const { data: linkedRows, error: linkedRowsError } = await admin.from('calloria_crm_contacts').select('id,owner_department,contact_data_ciphertext,contact_data_iv,email_hash,phone_hash,name_token_hashes,created_at').in('id', linkedIds).in('owner_department', departments);
          if (linkedRowsError) throw new Error('Linked customer search is unavailable.');
          rows.push(...(linkedRows || []));
        }
      } else {
        const tokens = tokeniseName(query);
        if (!tokens.length) return reply(400, { error: 'Search using a longer name token, a complete email or a phone number.' }, origin);
        const hashes = await Promise.all(tokens.map(token => hmac(`name:${token}`)));
        const { data, error } = await admin.from('calloria_crm_contacts').select('id,owner_department,contact_data_ciphertext,contact_data_iv,email_hash,phone_hash,name_token_hashes,created_at').overlaps('name_token_hashes', hashes).in('owner_department', departments).order('updated_at', { ascending: false }).limit(20);
        if (error) throw new Error('Customer search is unavailable.');
        rows = (data || []).filter((row: any) => hashes.every(hash => (row.name_token_hashes || []).includes(hash)));
      }
      const unique = [...new Map(rows.map(row => [row.id, row])).values()].slice(0, 20);
      const results = [];
      for (const row of unique) {
        const details = await decrypt(row.contact_data_ciphertext, row.contact_data_iv);
        results.push({ id: row.id, name: clean(details?.name, 100) || 'Customer (name not supplied)', maskedEmail: details?.email ? maskEmail(clean(details.email, 180)) : '', maskedPhone: details?.phone ? maskPhone(clean(details.phone, 40)) : '', department: row.owner_department });
      }
      await audit(admin, staff.id, null, 'customer_search', { result_count: results.length });
      return reply(200, { results }, origin);
    }

    if (action === 'create_contact') {
      const name = clean(body?.name, 100);
      const email = normalEmail(body?.email);
      const phone = normalPhone(body?.phone);
      const preferred = clean(body?.preferredChannel || 'none', 20);
      const ownerDepartment = clean(body?.department || (staff.departments.includes('*') ? 'General Customer Care' : staff.departments[0]), 120);
      if (!email && !phone) return reply(400, { error: 'At least one email or phone contact method is required.' }, origin);
      if (!['none','email','phone','whatsapp'].includes(preferred) || (preferred === 'email' && !email) || (['phone','whatsapp'].includes(preferred) && !phone)) return reply(400, { error: 'The preferred contact method does not match the contact details.' }, origin);
      if (body?.serviceConsent !== true || typeof body?.marketingConsent !== 'boolean' || typeof body?.personalizationConsent !== 'boolean') return reply(400, { error: 'Service-contact consent and explicit yes/no values for marketing and personalisation are required.' }, origin);
      if (!canAccessDepartment(staff, ownerDepartment)) return reply(403, { error: 'You do not have access to create customer records for that department.' }, origin);
      if (email) {
        const hash = await hmac(`email:${email}`);
        const { data, error } = await admin.from('calloria_crm_contacts').select('id').eq('email_hash', hash).limit(1).maybeSingle();
        if (error) throw new Error('Duplicate check failed; no record was created.');
        if (data) return reply(409, { error: 'A customer record already uses this email. Search and review it; do not create a duplicate.' }, origin);
      }
      if (phone) {
        const hash = await hmac(`phone:${phone}`);
        const { data, error } = await admin.from('calloria_crm_contacts').select('id').eq('phone_hash', hash).limit(1).maybeSingle();
        if (error) throw new Error('Duplicate check failed; no record was created.');
        if (data) return reply(409, { error: 'A customer record already uses this phone number. Search and review it; do not create a duplicate.' }, origin);
      }
      const contactPayload = { name, email, phone };
      const encrypted = await encrypt(contactPayload);
      const encryptedName = name ? await encrypt({ name }) : null;
      const tokenHashes = await Promise.all(tokeniseName(name).map(token => hmac(`name:${token}`)));
      const emailHash = email ? await hmac(`email:${email}`) : null;
      const phoneHash = phone ? await hmac(`phone:${phone}`) : null;
      const { data, error } = await admin.from('calloria_crm_contacts').insert({
        owner_department: ownerDepartment, display_name_ciphertext: encryptedName?.ciphertext || null,
        display_name_iv: encryptedName?.iv || null, contact_data_ciphertext: encrypted.ciphertext, contact_data_iv: encrypted.iv,
        email_hash: emailHash, phone_hash: phoneHash, name_token_hashes: tokenHashes, preferred_channel: preferred,
        source: clean(body?.source || 'customer_care', 30), created_by: staff.id
      }).select('id').single();
      if (error || !data) throw new Error('Customer record could not be created.');
      const consentRows = [
        { contact_id: data.id, purpose: 'service_contact', status: 'granted', capture_channel: clean(body?.captureChannel || 'staff_recorded', 30), captured_by: staff.id },
        { contact_id: data.id, purpose: 'marketing', status: body.marketingConsent ? 'granted' : 'not_granted', capture_channel: clean(body?.captureChannel || 'staff_recorded', 30), captured_by: staff.id },
        { contact_id: data.id, purpose: 'ai_personalization', status: body.personalizationConsent ? 'granted' : 'not_granted', capture_channel: clean(body?.captureChannel || 'staff_recorded', 30), captured_by: staff.id }
      ];
      const { error: consentError } = await admin.from('calloria_crm_consents').insert(consentRows);
      if (consentError) {
        await admin.from('calloria_crm_contacts').delete().eq('id', data.id);
        throw new Error('Customer consent history could not be saved; the record was rolled back.');
      }
      const identityRows = [];
      if (email && emailHash) identityRows.push({ contact_id: data.id, identity_type: 'email', value_hash: emailHash, masked_value: maskEmail(email), verification_status: 'unverified', created_by: staff.id });
      if (phone && phoneHash) identityRows.push({ contact_id: data.id, identity_type: 'phone', value_hash: phoneHash, masked_value: maskPhone(phone), verification_status: 'unverified', created_by: staff.id });
      const { error: identityError } = await admin.from('calloria_crm_identities').insert(identityRows);
      if (identityError) {
        await admin.from('calloria_crm_contacts').delete().eq('id', data.id);
        throw new InputError('This contact identity is already linked to another customer record. Search and review the existing record instead of creating a duplicate.');
      }
      await audit(admin, staff.id, data.id, 'contact_created', { department: ownerDepartment });
      return reply(201, { contactId: data.id, message: 'Customer record created. Contact identities remain unverified until the approved verification procedure is completed.' }, origin);
    }

    if (action === 'get_contact') {
      const id = clean(body?.contactId, 60);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return reply(400, { error: 'A valid customer record ID is required.' }, origin);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found in your permitted departments.' }, origin);
      const contact = await loadContact(admin, row);
      await audit(admin, staff.id, id, 'contact_viewed', { department: row.owner_department });
      const { data: identities, error } = await admin.from('calloria_crm_identities').select('id,identity_type,masked_value,verification_status,verified_at,created_at').eq('contact_id', id).order('created_at', { ascending: false }).limit(20);
      if (error) throw new Error('Customer identity associations could not be loaded.');
      return reply(200, { contact, identities: identities || [] }, origin);
    }

    if (action === 'record_interaction') {
      const id = clean(body?.contactId, 60);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found in your permitted departments.' }, origin);
      if (await getConsent(admin, id, 'service_contact') !== 'granted') return reply(409, { error: 'The customer record has no active service-contact consent. Do not add another interaction; follow the approved erasure or record-review process.' }, origin);
      const channel = clean(body?.channel, 20);
      const direction = clean(body?.direction, 12);
      const type = clean(body?.type, 32);
      const platformId = clean(body?.platformId, 40);
      if (!['voice','email','live_chat','social','whatsapp','website','portal','in_person','game'].includes(channel)) return reply(400, { error: 'Choose a valid channel.' }, origin);
      if (!['inbound','outbound','internal'].includes(direction)) return reply(400, { error: 'Choose a valid interaction direction.' }, origin);
      if (!['platform_support','service_enquiry','sales_enquiry','complaint','personal_guidance','general_customer_care'].includes(type)) return reply(400, { error: 'Choose a valid interaction category.' }, origin);
      if (platformId && !PLATFORM_NAMES[platformId]) return reply(400, { error: 'The selected RuffNeck platform is not recognised.' }, origin);
      const caseReference = clean(body?.caseReference, 24).toUpperCase();
      if (caseReference && !/^CC-[0-9]{6}-[A-Z2-9]{6}$/.test(caseReference)) return reply(400, { error: 'Enter a valid CALLORIA case reference or leave it blank.' }, origin);
      const summary = type === 'personal_guidance'
        ? 'General personal-guidance interaction recorded. Sensitive personal details are intentionally not retained in the customer profile.'
        : clean(body?.summary, 500);
      if (type !== 'personal_guidance' && summary.length < 8) return reply(400, { error: 'Enter a short factual summary of at least eight characters.' }, origin);
      const encrypted = await encrypt({ summary });
      const { error } = await admin.from('calloria_crm_interactions').insert({ contact_id: id, channel, direction, interaction_type: type, platform_id: platformId || null, summary_ciphertext: encrypted.ciphertext, summary_iv: encrypted.iv, case_reference: caseReference || null, agent_id: staff.id });
      if (error) throw new Error('The interaction could not be saved.');
      const { error: updateError } = await admin.from('calloria_crm_contacts').update({ last_interaction_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
      if (updateError) throw new Error('Interaction saved, but the profile activity timestamp could not be updated.');
      await audit(admin, staff.id, id, 'interaction_recorded', { channel, direction, interaction_type: type });
      return reply(201, { saved: true }, origin);
    }

    if (action === 'set_consent') {
      const id = clean(body?.contactId, 60);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found in your permitted departments.' }, origin);
      const purpose = clean(body?.purpose, 30);
      const status = clean(body?.status, 12);
      const captureChannel = clean(body?.captureChannel || 'staff_recorded', 30);
      if (!['service_contact','marketing','ai_personalization'].includes(purpose) || !['granted','revoked'].includes(status)) return reply(400, { error: 'The consent purpose or status is invalid.' }, origin);
      if (!['voice','email','live_chat','social','whatsapp','website','portal','in_person','staff_recorded'].includes(captureChannel)) return reply(400, { error: 'The consent capture channel is invalid.' }, origin);
      if (body?.customerExplicitlyConfirmed !== true) return reply(400, { error: 'Record a consent change only after the customer explicitly confirms it.' }, origin);
      if (purpose === 'service_contact' && status === 'revoked') {
        // Revocation is recorded; it does not erase an active case or statutory records.
      }
      const { error } = await admin.from('calloria_crm_consents').insert({ contact_id: id, purpose, status, capture_channel: captureChannel, captured_by: staff.id });
      if (error) throw new Error('The consent change could not be saved.');
      await audit(admin, staff.id, id, 'consent_changed', { purpose, status });
      return reply(201, { saved: true, purpose, status }, origin);
    }

    if (action === 'link_identity') {
      if (staff.role !== 'supervisor') return reply(403, { error: 'Only a CRM supervisor may link a new customer identity.' }, origin);
      const id = clean(body?.contactId, 60);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found.' }, origin);
      const type = clean(body?.identityType, 30);
      let value = clean(body?.value, 200);
      if (!['email','phone','platform_account','guest_profile'].includes(type)) return reply(400, { error: 'Choose a supported identity type.' }, origin);
      if (type === 'email') value = normalEmail(value);
      if (type === 'phone') value = normalPhone(value);
      if (value.length < 5) return reply(400, { error: 'Enter a valid identity reference.' }, origin);
      const valueHash = await hmac(`${type}:${value.toLowerCase()}`);
      const masked = maskIdentity(type, value);
      const { data, error } = await admin.from('calloria_crm_identities').insert({ contact_id: id, identity_type: type, value_hash: valueHash, masked_value: masked, verification_status: 'unverified', created_by: staff.id }).select('id').single();
      if (error || !data) return reply(409, { error: 'This identity is already linked, or it could not be saved.' }, origin);
      await audit(admin, staff.id, id, 'identity_linked', { identity_type: type });
      return reply(201, { identityId: data.id, verificationStatus: 'unverified' }, origin);
    }

    if (action === 'verify_identity') {
      if (staff.role !== 'supervisor') return reply(403, { error: 'Only a CRM supervisor may verify or reject an identity.' }, origin);
      const identityId = clean(body?.identityId, 60);
      const decision = clean(body?.decision, 12);
      const evidence = clean(body?.verificationEvidenceReference, 180);
      if (!['verified','rejected'].includes(decision)) return reply(400, { error: 'Choose verified or rejected.' }, origin);
      if (decision === 'verified' && evidence.length < 10) return reply(400, { error: 'A non-sensitive reference to the independently completed verification process is required.' }, origin);
      const { data: identity, error: identityError } = await admin.from('calloria_crm_identities').select('id,contact_id').eq('id', identityId).maybeSingle();
      if (identityError || !identity) return reply(404, { error: 'Identity association not found.' }, origin);
      const contact = await getContactRow(admin, identity.contact_id, staff);
      if (!contact) return reply(404, { error: 'Identity association not found in your permitted departments.' }, origin);
      const evidenceHash = evidence ? await hmac(`verification-evidence:${evidence}`) : null;
      const { error } = await admin.from('calloria_crm_identities').update({ verification_status: decision, verification_evidence_hash: evidenceHash, verified_by: staff.id, verified_at: new Date().toISOString() }).eq('id', identityId);
      if (error) throw new Error('The identity decision could not be saved.');
      await audit(admin, staff.id, identity.contact_id, decision === 'verified' ? 'identity_verified' : 'identity_rejected', {});
      return reply(200, { saved: true, verificationStatus: decision }, origin);
    }

    if (action === 'erase_contact') {
      if (staff.role !== 'supervisor') return reply(403, { error: 'Only a CRM supervisor may erase a customer record.' }, origin);
      const id = clean(body?.contactId, 60);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found.' }, origin);
      const reference = clean(body?.erasureRequestReference, 120);
      if (body?.customerRequestedErasure !== true || reference.length < 8) return reply(400, { error: 'A documented customer erasure request and non-sensitive request reference are required.' }, origin);
      const requestHash = await hmac(`crm-erasure-request:${reference}`);
      await audit(admin, staff.id, id, 'contact_erased', { department: row.owner_department, request_ref_hash: requestHash });
      const { error } = await admin.from('calloria_crm_contacts').delete().eq('id', id);
      if (error) throw new Error('Customer CRM record could not be erased. The audit entry remains for follow-up.');
      return reply(200, { erased: true, message: 'CRM contact data, interactions, identities and CRM consent rows were deleted. Separate case-desk records follow their own retention rules.' }, origin);
    }

    if (action === 'recommendations') {
      const id = clean(body?.contactId, 60);
      const row = await getContactRow(admin, id, staff);
      if (!row) return reply(404, { error: 'Customer record not found in your permitted departments.' }, origin);
      const mode = clean(body?.mode || 'requested', 20);
      if (!['requested','proactive'].includes(mode)) return reply(400, { error: 'Choose requested or proactive recommendation mode.' }, origin);
      const marketingConsent = await getConsent(admin, id, 'marketing') === 'granted';
      const { data: recent, error } = await admin.from('calloria_crm_interactions').select('interaction_type,occurred_at').eq('contact_id', id).gte('occurred_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('occurred_at', { ascending: false }).limit(100);
      if (error) throw new Error('Customer interaction history could not be checked.');
      const recentPersonalGuidance = (recent || []).some((item: any) => item.interaction_type === 'personal_guidance');
      if (mode === 'proactive' && (!marketingConsent || recentPersonalGuidance)) {
        return reply(200, { recommendations: [], message: !marketingConsent ? 'Proactive cross-selling is disabled because explicit marketing consent is not recorded.' : 'Proactive cross-selling is suppressed following a recent personal-guidance interaction.' }, origin);
      }
      const requestedNeed = clean(body?.need, 60).toLowerCase();
      await audit(admin, staff.id, id, 'recommendations_viewed', { mode });
      const recommendations = PRODUCTS.filter(product => !requestedNeed || product.needs.includes(requestedNeed)).map(product => ({ id: product.id, name: product.name, url: product.url, summary: product.summary, boundary: product.boundary }));
      return reply(200, { recommendations, message: mode === 'proactive' ? 'Recommendations are allowed by the recorded marketing consent. Confirm relevance with the customer before any follow-up.' : 'Requested portfolio information. This is a response to the customer’s enquiry, not marketing opt-in.' }, origin);
    }

    return reply(400, { error: 'Unknown Customer 360 action.' }, origin);
  } catch (error) {
    // Never log request bodies, customer values, encrypted payloads or secrets.
    if (error instanceof InputError) return reply(400, { error: clean(error.message, 260) }, origin);
    return reply(500, { error: 'Customer 360 could not complete the request. Check the Edge Function and database logs without logging customer information.' }, origin);
  }
});
