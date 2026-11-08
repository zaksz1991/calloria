import { createClient } from 'npm:@supabase/supabase-js@2';
import { classifyChatIntent, cleanChatText, redactChatText, validatePublicChatInput } from './web-chat-engine.ts';

const env = (name: string) => Deno.env.get(name) || '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ANON_ORIGINS = env('CALLORIA_WEB_CHAT_ALLOWED_ORIGINS').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
const STAFF_ORIGINS = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
const DATA_SECRET = env('CALLORIA_WEB_CHAT_DATA_KEY');
const LOOKUP_SECRET = env('CALLORIA_WEB_CHAT_LOOKUP_SECRET');
const AGENT_DESK_SECRET = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const ACCESS_RAW = env('CALLORIA_ROUTING_ACCESS');
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-f0-9]{64}$/;
const PRODUCTS: Record<string, { id: string; name: string }> = {
  'https://ruffneck-lms.vercel.app': { id: 'ruffneck-learn', name: 'RuffNeck Learn' },
  'https://ruffneck-prospector.vercel.app': { id: 'ruffneck-prospector', name: 'RuffNeck Prospector' },
  'https://ruffneck-connect.vercel.app': { id: 'ruffneck-connect', name: 'RuffNeck Connect' },
  'https://ruffneck-social-hub.vercel.app': { id: 'ruffneck-social-hub', name: 'RuffNeck Social Hub' },
  'https://kano-run.vercel.app': { id: 'kano-run', name: 'Kano Run / Kano Life' },
  'https://kano-keke.vercel.app': { id: 'kano-keke', name: 'Kano Keke' }
};
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries', 'Complaints and Service Recovery',
  'Personal Development and Wellbeing Information', 'General Customer Care', 'Email and Written Support',
  'Social Media Support', 'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];
const ALLOWED_SKILLS = ['platform_support', 'account_access', 'technical_support', 'sales', 'complaints', 'personal_guidance', 'safeguarding', 'learning_advice', 'social_support', 'general_customer_care'];
const ALLOWED_CHANNELS = ['voice', 'email', 'live_chat', 'social', 'whatsapp', 'website', 'portal', 'game', 'back_office'];
const ALLOWED_LANGUAGES = ['en', 'ha', 'yo', 'ig', 'pcm'];
type Grant = { role: 'agent' | 'supervisor' | 'people_admin'; departments: string[]; skills: string[]; channels: string[]; languages: string[]; maxConcurrency: number };
const accessMap: Record<string, Grant> = {};
let accessInvalid = false;
try {
  const parsed = ACCESS_RAW ? JSON.parse(ACCESS_RAW) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!UUID.test(userId) || !row || !['agent', 'supervisor', 'people_admin'].includes(row.role)) throw new Error('Invalid staff grant.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.skills) || !row.skills.length || !Array.isArray(row.channels) || !row.channels.length || !Array.isArray(row.languages) || !row.languages.length) throw new Error('Incomplete staff grant.');
    const departments = row.departments.map((value: unknown) => cleanChatText(value, 120));
    const skills = row.skills.map((value: unknown) => cleanChatText(value, 40));
    const channels = row.channels.map((value: unknown) => cleanChatText(value, 24));
    const languages = row.languages.map((value: unknown) => cleanChatText(value, 8));
    if (departments.some((value: string) => value !== '*' && !DEPARTMENTS.includes(value))) throw new Error('Unknown department.');
    if (skills.some((value: string) => !ALLOWED_SKILLS.includes(value)) || channels.some((value: string) => !ALLOWED_CHANNELS.includes(value)) || languages.some((value: string) => !ALLOWED_LANGUAGES.includes(value))) throw new Error('Unknown skill, channel or language.');
    if (!skills.includes('general_customer_care')) throw new Error('The general customer care foundation skill is required.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Agents require explicit department scopes.');
    accessMap[userId] = { role: row.role, departments, skills, channels, languages, maxConcurrency: Math.max(1, Math.min(10, Number(row.maxConcurrency) || 1)) };
  }
} catch { accessInvalid = true; }

function json(status: number, body: Record<string, unknown>, origin: string | null = null) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin && (ANON_ORIGINS.includes(origin) || STAFF_ORIGINS.includes(origin))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function toHex(bytes: Uint8Array) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''); }
function fromBase64(value: string) { const raw = atob(value); return Uint8Array.from(raw, char => char.charCodeAt(0)); }
function toBase64(bytes: Uint8Array) { let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte); return btoa(raw); }
function randomHex(bytes = 32) { return toHex(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256(value: string) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function hmacHex(secret: string, value: string) {
  if (encoder.encode(secret).length < 32) throw new Error('CALLORIA_WEB_CHAT_LOOKUP_SECRET must contain at least 32 bytes.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function deriveAesKey(secret: string, salt: string, info: string) {
  if (encoder.encode(secret).length < 32) throw new Error('A required web chat encryption secret is missing or too short.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode(salt), info: encoder.encode(info) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptData(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await deriveAesKey(DATA_SECRET, 'CALLORIA-WEB-CHAT-DATA-v1', 'web-chat-message'), encoder.encode(value));
  return { ciphertext: toBase64(new Uint8Array(cipher)), iv: toBase64(iv) };
}
async function decryptData(ciphertext: string, iv: string) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv) }, await deriveAesKey(DATA_SECRET, 'CALLORIA-WEB-CHAT-DATA-v1', 'web-chat-message'), fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
async function encryptAgentSummary(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  if (encoder.encode(AGENT_DESK_SECRET).length < 32) throw new Error('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET is missing or too short.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(AGENT_DESK_SECRET), 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('CALLORIA-AGENT-DESK-v1'), info: encoder.encode('interaction-summary-encryption') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
  return { ciphertext: toBase64(new Uint8Array(cipher)), iv: toBase64(iv) };
}
function routeRef() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = crypto.getRandomValues(new Uint8Array(6)); return `CR-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`; }
function conversationRef() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const bytes = crypto.getRandomValues(new Uint8Array(6)); return `WC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Array.from(bytes, byte => alphabet[byte % alphabet.length]).join('')}`; }
function hasDepartment(grant: Grant, department: string) { return grant.departments.includes('*') || grant.departments.includes(department); }
function productForOrigin(origin: string | null) { return origin ? PRODUCTS[origin] || null : null; }
function cleanToken(value: unknown) { const token = cleanChatText(value, 64).toLowerCase(); return TOKEN.test(token) ? token : ''; }
function cleanId(value: unknown) { const id = cleanChatText(value, 64); return UUID.test(id) ? id : ''; }
function publicStatus(routeStatus: string) {
  if (routeStatus === 'queued') return 'waiting';
  if (routeStatus === 'assigned') return 'agent_connected';
  if (routeStatus === 'completed') return 'completed';
  if (routeStatus === 'cancelled' || routeStatus === 'abandoned') return 'closed';
  return 'waiting';
}
async function consumeLimit(admin: any, fingerprint: string, limit: number, intervalSeconds: number) {
  const interval = intervalSeconds * 1000;
  const bucketStart = new Date(Math.floor(Date.now() / interval) * interval).toISOString();
  const { data, error } = await admin.rpc('calloria_webchat_consume_limit', { p_fingerprint_hash: fingerprint, p_bucket_start: bucketStart, p_limit: limit });
  if (error) throw new Error('Web chat request protection is temporarily unavailable.');
  return data === true;
}
async function publicFingerprint(request: Request, origin: string) {
  const forwarded = (request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || '').split(',')[0].trim();
  const userAgent = cleanChatText(request.headers.get('user-agent') || '', 180);
  return hmacHex(LOOKUP_SECRET, `public|${origin}|${forwarded}|${userAgent}`);
}
async function authenticate(request: Request, admin: any) {
  if (accessInvalid || !Object.keys(accessMap).length) return { error: 'CALLORIA_ROUTING_ACCESS is not configured correctly.', status: 503 };
  const authorization = request.headers.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return { error: 'Staff sign-in is required.', status: 401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error: 'Staff session is invalid or expired.', status: 401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error: 'This account is not on the CALLORIA staff access map.', status: 403 };
  if (grant.role === 'people_admin') return { error: 'People administrators do not have access to customer chat content.', status: 403 };
  if (!grant.channels.includes('live_chat')) return { error: 'Live Chat is not included in this staff permission scope.', status: 403 };
  return { user: data.user, grant };
}
async function getPermittedConversation(admin: any, conversationId: string, user: any, grant: Grant) {
  if (!UUID.test(conversationId)) return { error: 'Select a valid live chat conversation.', status: 400 };
  const { data: conversation, error } = await admin.from('calloria_webchat_conversations').select('*').eq('id', conversationId).maybeSingle();
  if (error) throw new Error('The live chat conversation could not be loaded.');
  if (!conversation) return { error: 'The live chat conversation was not found.', status: 404 };
  const { data: route, error: routeError } = await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,channel,platform_id,language,required_skills').eq('route_ref', conversation.route_ref).maybeSingle();
  if (routeError || !route || route.channel !== 'live_chat') return { error: 'This conversation has no valid Live Chat routing work item.', status: 409 };
  if (!hasDepartment(grant, route.department)) return { error: 'This conversation is outside your permitted department scope.', status: 403 };
  if (grant.role === 'agent' && route.assigned_to !== user.id) return { error: 'Claim this conversation through Routing Control before opening it.', status: 403 };
  if (grant.role === 'agent' && (route.required_skills || []).some((skill: string) => !grant.skills.includes(skill))) return { error: 'Your specialist skill scope does not cover this conversation.', status: 403 };
  return { conversation, route };
}
async function startChat(admin: any, request: Request, origin: string, body: any) {
  const product = productForOrigin(origin);
  if (!product || !ANON_ORIGINS.includes(origin)) return json(403, { error: 'This website is not enabled for CALLORIA Live Chat.' }, origin);
  if (!DATA_SECRET || !LOOKUP_SECRET || !AGENT_DESK_SECRET) return json(503, { error: 'Live Chat is temporarily unavailable. The service protection keys are not configured.' }, origin);
  let input: ReturnType<typeof validatePublicChatInput>;
  try { input = validatePublicChatInput({ ...body, platformId: product.id }); }
  catch (error) { return json(400, { error: error instanceof Error ? cleanChatText(error.message, 220) : 'The chat details are invalid.' }, origin); }
  const fingerprint = await publicFingerprint(request, origin);
  if (!await consumeLimit(admin, fingerprint, 5, 10 * 60)) return json(429, { error: 'Too many new chats from this connection. Please wait before starting another.' }, origin);
  const classification = classifyChatIntent(input.intent, input.message);
  const customerToken = randomHex(32);
  const tokenHash = await sha256(customerToken);
  const route = routeRef();
  const ref = conversationRef();
  const subject = `Website live chat · ${product.name} · ${classification.intent.replaceAll('_', ' ')}`.slice(0, 140);
  const agentSummaryText = [
    'CALLORIA WEBSITE LIVE CHAT',
    `Platform: ${product.name}`,
    `Language: ${input.language}`,
    `Topic: ${classification.intent}`,
    `Safeguarding signal detected: ${classification.safeguardingEscalation ? 'yes — urgent trained human review' : 'no automatic signal detected'}`,
    `Initial customer message: ${input.message}`
  ].join('\n');
  const agentSummary = await encryptAgentSummary(agentSummaryText);
  const messageCipher = await encryptData(input.message);
  const { error: purgeError } = await admin.rpc('calloria_route_purge_closed');
  if (purgeError) throw new Error('Support retention maintenance is temporarily unavailable. Please try again.');
  const { data, error } = await admin.rpc('calloria_webchat_create_conversation', {
    p_conversation_ref: ref,
    p_route_ref: route,
    p_department: classification.department,
    p_platform_id: product.id,
    p_intent: classification.intent,
    p_language: input.language,
    p_required_skills: [classification.requiredSkill],
    p_priority: classification.priority,
    p_subject: subject,
    p_agent_summary_ciphertext: agentSummary.ciphertext,
    p_agent_summary_iv: agentSummary.iv,
    p_access_token_hash: tokenHash,
    p_origin: origin,
    p_visitor_token_hash: tokenHash,
    p_initial_message_ciphertext: messageCipher.ciphertext,
    p_initial_message_iv: messageCipher.iv
  });
  if (error || !data) throw new Error('The live chat could not be queued. No conversation reference was issued; check before retrying.');
  return json(200, { conversationId: data, conversationRef: ref, visitorToken: customerToken, status: 'waiting', platform: product.name, message: 'Your message is in the support queue. Keep this browser tab open to receive replies.' }, origin);
}
async function loadPublicConversation(admin: any, origin: string, body: any) {
  const product = productForOrigin(origin);
  if (!product || !ANON_ORIGINS.includes(origin)) return { error: 'This website is not enabled for CALLORIA Live Chat.', status: 403 };
  const id = cleanId(body.conversationId), token = cleanToken(body.visitorToken);
  if (!id || !token) return { error: 'The private chat session is invalid or has expired.', status: 400 };
  const { data: conversation, error } = await admin.from('calloria_webchat_conversations').select('id,conversation_ref,route_ref,platform_id,origin,visitor_token_hash,status,created_at').eq('id', id).maybeSingle();
  if (error) throw new Error('The chat session could not be checked.');
  if (!conversation || conversation.origin !== origin || conversation.platform_id !== product.id || !safeEqual(conversation.visitor_token_hash, await sha256(token))) return { error: 'The private chat session was not found. Start a new support chat.', status: 404 };
  const { data: route, error: routeError } = await admin.from('calloria_route_requests').select('status,priority,department,language').eq('route_ref', conversation.route_ref).maybeSingle();
  if (routeError || !route) return { error: 'The support route is no longer available.', status: 404 };
  if (!['queued', 'assigned'].includes(route.status) && conversation.status === 'open') {
    const { error: closeError } = await admin.from('calloria_webchat_conversations').update({ status: 'closed', visitor_closed_at: new Date().toISOString() }).eq('id', conversation.id);
    if (closeError) throw new Error('The completed chat could not be closed cleanly.');
  }
  return { conversation: { ...conversation, status: ['queued', 'assigned'].includes(route.status) ? conversation.status : 'closed' }, route };
}
async function publicHistory(admin: any, origin: string, body: any) {
  const permission = await loadPublicConversation(admin, origin, body);
  if ('error' in permission) return json(permission.status, { error: permission.error }, origin);
  const token = cleanToken(body.visitorToken);
  const fingerprint = await hmacHex(LOOKUP_SECRET, `visitor-history|${await sha256(token)}`);
  if (!await consumeLimit(admin, fingerprint, 30, 60)) return json(429, { error: 'Please pause briefly before refreshing this chat again.' }, origin);
  const { data: rows, error } = await admin.from('calloria_webchat_messages').select('id,direction,body_ciphertext,body_iv,created_at').eq('conversation_id', permission.conversation.id).order('created_at', { ascending: true }).limit(300);
  if (error) throw new Error('Chat messages could not be loaded.');
  const messages = [];
  for (const row of rows || []) messages.push({ id: row.id, direction: row.direction, text: await decryptData(row.body_ciphertext, row.body_iv), createdAt: row.created_at });
  return json(200, {
    conversation: { id: permission.conversation.id, reference: permission.conversation.conversation_ref, status: publicStatus(permission.route.status) },
    messages
  }, origin);
}
async function publicSend(admin: any, origin: string, body: any) {
  const permission = await loadPublicConversation(admin, origin, body);
  if ('error' in permission) return json(permission.status, { error: permission.error }, origin);
  if (!['queued', 'assigned'].includes(permission.route.status)) return json(409, { error: 'This support conversation is closed. Start a new chat for another request.' }, origin);
  const text = redactChatText(body.message);
  if (text.length < 1) return json(400, { error: 'Enter a message before sending.' }, origin);
  const tokenHash = await sha256(cleanToken(body.visitorToken));
  const fingerprint = await hmacHex(LOOKUP_SECRET, `visitor-message|${tokenHash}`);
  if (!await consumeLimit(admin, fingerprint, 15, 60)) return json(429, { error: 'You are sending messages too quickly. Wait a moment and try again.' }, origin);
  const encrypted = await encryptData(text);
  const rawClientMessageId = cleanChatText(body.clientMessageId, 64);
  const clientMessageId = UUID.test(rawClientMessageId) ? rawClientMessageId : null;
  const { error } = await admin.rpc('calloria_webchat_add_message', {
    p_conversation_id: permission.conversation.id,
    p_direction: 'customer',
    p_body_ciphertext: encrypted.ciphertext,
    p_body_iv: encrypted.iv,
    p_sender_id: null,
    p_client_message_id: clientMessageId,
    p_require_sender_assignment: false
  });
  if (error) {
    if (error.code === '23505') return json(200, { sent: true, duplicate: true }, origin);
    const detail = String(error.message || '').toLowerCase();
    if (detail.includes('closed') || detail.includes('no longer open') || detail.includes('message limit')) {
      return json(409, { error: 'This support conversation is no longer available. Start a new chat if you still need help.' }, origin);
    }
    throw new Error('Your message could not be stored. Please try again.');
  }
  return json(200, { sent: true }, origin);
}
async function inbox(admin: any, user: any, grant: Grant) {
  const { data: conversations, error } = await admin.from('calloria_webchat_conversations').select('id,conversation_ref,route_ref,platform_id,language,last_message_at,created_at,status').eq('status', 'open').order('last_message_at', { ascending: false }).limit(100);
  if (error) throw new Error('Live chat inbox could not be loaded.');
  const refs = (conversations || []).map((row: any) => row.route_ref);
  const { data: routes, error: routeError } = refs.length ? await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,channel,required_skills,created_at').in('route_ref', refs) : { data: [], error: null };
  if (routeError) throw new Error('Live chat routing scope could not be checked.');
  const routeMap = new Map<string, any>((routes || []).map((row: any) => [row.route_ref, row]));
  const rows = [];
  for (const conversation of conversations || []) {
    const route = routeMap.get(conversation.route_ref);
    if (!route || route.channel !== 'live_chat' || !['queued', 'assigned'].includes(route.status) || !hasDepartment(grant, route.department)) continue;
    if (grant.role === 'agent' && route.assigned_to !== user.id) continue;
    if (grant.role === 'agent' && (route.required_skills || []).some((skill: string) => !grant.skills.includes(skill))) continue;
    const { data: latest, error: latestError } = await admin.from('calloria_webchat_messages').select('body_ciphertext,body_iv,direction,created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (latestError) throw new Error('The latest chat message could not be loaded.');
    const preview = latest ? await decryptData(latest.body_ciphertext, latest.body_iv) : '';
    rows.push({ id: conversation.id, conversationRef: conversation.conversation_ref, routeRef: conversation.route_ref, platformId: conversation.platform_id, department: route.department, routeStatus: route.status, priority: route.priority, language: conversation.language, lastDirection: latest?.direction || 'customer', lastMessage: preview.slice(0, 180), lastMessageAt: latest?.created_at || conversation.created_at });
  }
  return rows;
}
async function staffConversation(admin: any, user: any, grant: Grant, conversationId: string) {
  const permission = await getPermittedConversation(admin, conversationId, user, grant);
  if ('error' in permission) return permission;
  const { data: rows, error } = await admin.from('calloria_webchat_messages').select('id,direction,body_ciphertext,body_iv,created_at,sender_id').eq('conversation_id', permission.conversation.id).order('created_at', { ascending: true }).limit(300);
  if (error) throw new Error('Conversation messages could not be loaded.');
  const messages = [];
  for (const row of rows || []) messages.push({ id: row.id, direction: row.direction, text: await decryptData(row.body_ciphertext, row.body_iv), createdAt: row.created_at, sender: row.direction === 'agent' ? (row.sender_id === user.id ? 'You' : 'CALLORIA staff') : 'Customer' });
  return { data: { conversation: { id: permission.conversation.id, reference: permission.conversation.conversation_ref, routeRef: permission.route.route_ref, platformId: permission.route.platform_id, department: permission.route.department, routeStatus: permission.route.status, assignedTo: permission.route.assigned_to, priority: permission.route.priority, language: permission.route.language }, messages } };
}
async function staffReply(admin: any, user: any, grant: Grant, body: any) {
  const permission = await getPermittedConversation(admin, cleanId(body.conversationId), user, grant);
  if ('error' in permission) return permission;
  if (permission.route.status !== 'assigned') return { status: 409, error: 'Claim this live chat through Routing Control before replying.' };
  const text = redactChatText(body.message);
  if (text.length < 1) return { status: 400, error: 'Enter a customer-service response.' };
  const fingerprint = await hmacHex(LOOKUP_SECRET, `staff-reply|${user.id}`);
  if (!await consumeLimit(admin, fingerprint, 30, 60)) return { status: 429, error: 'The staff reply limit has been reached. Wait a moment before sending again.' };
  const encrypted = await encryptData(text);
  const rawClientMessageId = cleanChatText(body.clientMessageId, 64);
  const clientMessageId = UUID.test(rawClientMessageId) ? rawClientMessageId : null;
  const { error } = await admin.rpc('calloria_webchat_add_message', {
    p_conversation_id: permission.conversation.id,
    p_direction: 'agent',
    p_body_ciphertext: encrypted.ciphertext,
    p_body_iv: encrypted.iv,
    p_sender_id: user.id,
    p_client_message_id: clientMessageId,
    p_require_sender_assignment: grant.role === 'agent'
  });
  if (error) {
    if (error.code === '23505' && clientMessageId) return { status: 200, data: { sent: true, duplicate: true } };
    const detail = String(error.message || '').toLowerCase();
    if (detail.includes('closed') || detail.includes('no longer open') || detail.includes('assigned') || detail.includes('message limit')) {
      return { status: 409, error: 'This live chat changed status or ownership. Refresh the inbox before replying.' };
    }
    throw new Error('The reply could not be stored.');
  }
  return { status: 200, data: { sent: true } };
}

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  const originAllowed = !!origin && (ANON_ORIGINS.includes(origin) || STAFF_ORIGINS.includes(origin));
  if (request.method === 'OPTIONS') return originAllowed ? new Response('ok', { headers: { 'Access-Control-Allow-Origin': origin!, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } }) : json(403, { error: 'Origin not permitted.' });
  if (request.method !== 'POST') return json(405, { error: 'Only POST is accepted.' }, origin);
  if (!originAllowed) return json(403, { error: 'Origin not permitted.' });
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503, { error: 'CALLORIA web chat storage is not configured.' }, origin);
  if (Number(request.headers.get('content-length') || 0) > 12000) return json(413, { error: 'Request is too large.' }, origin);
  try {
    const raw = await request.text();
    if (raw.length > 12000) return json(413, { error: 'Request is too large.' }, origin);
    let body: any;
    try { body = JSON.parse(raw); } catch { return json(400, { error: 'A valid JSON request is required.' }, origin); }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const action = cleanChatText(body?.action, 32);
    const isPublicOrigin = ANON_ORIGINS.includes(origin!);
    if (isPublicOrigin && !productForOrigin(origin)) return json(403, { error: 'This website is not enabled for CALLORIA Live Chat.' }, origin);
    if (['start_chat', 'send_message', 'history'].includes(action)) {
      if (!isPublicOrigin) return json(403, { error: 'Customer chat actions are available only from approved RuffNeck product websites.' }, origin);
      if (action === 'start_chat') return await startChat(admin, request, origin!, body);
      if (!DATA_SECRET || !LOOKUP_SECRET) return json(503, { error: 'Live Chat is temporarily unavailable. Data protection is not configured.' }, origin);
      if (action === 'send_message') return await publicSend(admin, origin!, body);
      return await publicHistory(admin, origin!, body);
    }
    if (!STAFF_ORIGINS.includes(origin!)) return json(403, { error: 'Staff operations must be called from the CALLORIA application.' }, origin);
    if (!DATA_SECRET || !LOOKUP_SECRET || !AGENT_DESK_SECRET) return json(503, { error: 'Live Chat data protection is not configured.' }, origin);
    const auth = await authenticate(request, admin);
    if ('error' in auth) return json(auth.status, { error: auth.error }, origin);
    const user = auth.user, grant = auth.grant as Grant;
    if (action === 'whoami') return json(200, { access: { role: grant.role, departments: grant.departments, channels: grant.channels }, configuration: { encryptedStorage: !!(DATA_SECRET && LOOKUP_SECRET && AGENT_DESK_SECRET), publicOriginsConfigured: ANON_ORIGINS.filter(value => !!PRODUCTS[value]).length } }, origin);
    if (action === 'inbox') return json(200, { conversations: await inbox(admin, user, grant) }, origin);
    if (action === 'conversation') {
      const result = await staffConversation(admin, user, grant, cleanId(body.conversationId));
      if (!('data' in result)) return json(result.status || 403, { error: result.error || 'Conversation access is not permitted.' }, origin);
      return json(200, result.data as Record<string, unknown>, origin);
    }
    if (action === 'reply') {
      const result = await staffReply(admin, user, grant, body);
      if ('data' in result) return json(result.status, result.data as Record<string, unknown>, origin);
      return json(result.status, { error: result.error }, origin);
    }
    return json(400, { error: 'Unsupported CALLORIA web chat action.' }, origin);
  } catch (error) {
    const message = error instanceof Error ? cleanChatText(error.message, 220) : 'CALLORIA web chat operation failed.';
    return json(500, { error: message }, origin);
  }
});
