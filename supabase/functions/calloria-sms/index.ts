import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildTermiiWebhookEvent, classifySmsIntent, cleanSmsText, maskSmsNumber,
  normalizeNigeriaSmsNumber, parseSmsCommand, redactSmsText, validateSmsSupportReply,
  verifyTermiiWebhookSignature, isValidTermiiBaseUrl
} from './sms-engine.ts';

const env = (name: string) => Deno.env.get(name) || '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ORIGINS = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v => v.trim()).filter(Boolean);
const TERMII_API_KEY = env('TERMII_API_KEY');
const TERMII_BASE_URL = env('TERMII_BASE_URL').replace(/\/$/, '');
const TERMII_SENDER_ID = env('TERMII_SENDER_ID');
const TERMII_WEBHOOK_SECRET = env('TERMII_WEBHOOK_SECRET');
const TERMII_DND_ROUTE_ENABLED = env('TERMII_DND_ROUTE_ENABLED').toLowerCase() === 'true';
const DATA_SECRET = env('CALLORIA_SMS_DATA_KEY');
const LOOKUP_SECRET = env('CALLORIA_SMS_LOOKUP_SECRET');
const AGENT_DESK_SECRET = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const ACCESS_RAW = env('CALLORIA_ROUTING_ACCESS');
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const STAFF_CHANNELS = ['voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'];
const STAFF_SKILLS = ['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
type Grant = { role: 'agent'|'supervisor'|'people_admin'; departments: string[]; skills: string[]; channels: string[]; languages: string[]; maxConcurrency: number };
const accessMap: Record<string, Grant> = {};
let accessInvalid = false;
try {
  const parsed = ACCESS_RAW ? JSON.parse(ACCESS_RAW) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid routing access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!UUID.test(userId) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid routing staff entry.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.channels) || !row.channels.length || !Array.isArray(row.skills) || !row.skills.length || !Array.isArray(row.languages) || !row.languages.length) throw new Error('Incomplete routing staff scope.');
    const departments = row.departments.map((v: unknown) => cleanSmsText(v, 120));
    const channels = row.channels.map((v: unknown) => cleanSmsText(v, 24));
    const skills = row.skills.map((v: unknown) => cleanSmsText(v, 40));
    const languages = row.languages.map((v: unknown) => cleanSmsText(v, 8));
    if (departments.some((v: string) => v !== '*' && !DEPARTMENTS.includes(v))) throw new Error('Unknown department in routing access map.');
    if (channels.some((v: string) => !STAFF_CHANNELS.includes(v)) || skills.some((v: string) => !STAFF_SKILLS.includes(v)) || languages.some((v: string) => !['en','ha','yo','ig','pcm'].includes(v))) throw new Error('Unknown channel, skill or language in routing access map.');
    if (!skills.includes('general_customer_care')) throw new Error('Every customer-facing employee must hold general_customer_care.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Agents require explicit department grants.');
    accessMap[userId] = { role: row.role, departments, skills, channels, languages, maxConcurrency: Math.max(1, Math.min(10, Number(row.maxConcurrency) || 1)) };
  }
} catch { accessInvalid = true; }

function json(status: number, body: Record<string, unknown>, origin: string | null = null) {
  const headers: Record<string,string> = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };
  if (origin && ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function text(status: number, body: string) { return new Response(body, { status, headers: { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' } }); }
function base64(bytes: Uint8Array) { let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte); return btoa(raw); }
function fromBase64(value: string) { const raw = atob(value); return Uint8Array.from(raw, char => char.charCodeAt(0)); }
function hex(bytes: Uint8Array) { return [...bytes].map(value => value.toString(16).padStart(2,'0')).join(''); }
function randomHex(size = 32) { return hex(crypto.getRandomValues(new Uint8Array(size))); }
async function sha256(value: string) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function hmac(secret: string, value: string) {
  if (encoder.encode(secret).length < 32) throw new Error('A CALLORIA SMS lookup secret is missing or too short.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function deriveKey(secret: string, salt: string, info: string) {
  if (encoder.encode(secret).length < 32) throw new Error('A CALLORIA SMS encryption secret is missing or too short.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt:encoder.encode(salt), info:encoder.encode(info) }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encryptWith(secret: string, salt: string, info: string, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await deriveKey(secret, salt, info), encoder.encode(value));
  return { ciphertext:base64(new Uint8Array(encrypted)), iv:base64(iv) };
}
async function decryptWith(secret: string, salt: string, info: string, ciphertext: string, iv: string) {
  const clear = await crypto.subtle.decrypt({ name:'AES-GCM', iv:fromBase64(iv) }, await deriveKey(secret, salt, info), fromBase64(ciphertext));
  return new TextDecoder().decode(clear);
}
const encryptData = (value: string) => encryptWith(DATA_SECRET, 'CALLORIA-SMS-DATA-v1', 'sms-contact-and-message', value);
const decryptData = (ciphertext: string, iv: string) => decryptWith(DATA_SECRET, 'CALLORIA-SMS-DATA-v1', 'sms-contact-and-message', ciphertext, iv);
const encryptAgentSummary = (value: string) => encryptWith(AGENT_DESK_SECRET, 'CALLORIA-AGENT-DESK-v1', 'interaction-summary-encryption', value);
const randomTokenHash = async () => sha256(randomHex(32));
function routeRef() { const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b=crypto.getRandomValues(new Uint8Array(6)); return `CR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${[...b].map(v=>alphabet[v%alphabet.length]).join('')}`; }
function threadRef() { const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b=crypto.getRandomValues(new Uint8Array(6)); return `SM-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${[...b].map(v=>alphabet[v%alphabet.length]).join('')}`; }
function allowedDepartments(grant: Grant) { return grant.departments.includes('*') ? DEPARTMENTS : grant.departments; }
function hasDepartment(grant: Grant, department: string) { return grant.departments.includes('*') || grant.departments.includes(department); }
async function authenticate(request: Request, admin: any) {
  if (accessInvalid || !Object.keys(accessMap).length) return { error:'CALLORIA_ROUTING_ACCESS is missing or invalid.', status:503 };
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return { error:'Staff sign-in is required.', status:401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error:'Staff session is invalid or expired.', status:401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error:'This account is not on the CALLORIA Routing staff access map.', status:403 };
  if (grant.role === 'people_admin') return { error:'People administrators cannot access customer message content.', status:403 };
  if (!grant.channels.includes('sms')) return { error:'SMS is not included in this employee’s channel permissions.', status:403 };
  return { user:data.user, grant };
}
function providerState() {
  const dataProtectionReady = encoder.encode(DATA_SECRET).length >= 32 && encoder.encode(LOOKUP_SECRET).length >= 32 && encoder.encode(AGENT_DESK_SECRET).length >= 32;
  const inboundReady = Boolean(TERMII_WEBHOOK_SECRET && encoder.encode(TERMII_WEBHOOK_SECRET).length >= 16 && dataProtectionReady);
  const outboundReady = Boolean(TERMII_API_KEY && isValidTermiiBaseUrl(TERMII_BASE_URL) && /^[A-Za-z0-9]{3,11}$/.test(TERMII_SENDER_ID) && TERMII_DND_ROUTE_ENABLED && dataProtectionReady);
  return { inboundReady, webhookReady:inboundReady, outboundReady, dndRouteConfirmed:TERMII_DND_ROUTE_ENABLED, dataProtectionReady, senderId:outboundReady ? TERMII_SENDER_ID : null };
}
function eventDate(value: unknown) { const date = value ? new Date(String(value)) : new Date(); return Number.isFinite(date.getTime()) && date.getTime() < Date.now() + 5*60*1000 ? date.toISOString() : new Date().toISOString(); }

async function handleProviderWebhook(request: Request, raw: string, admin: any) {
  if (!TERMII_WEBHOOK_SECRET || !(await verifyTermiiWebhookSignature(raw, request.headers.get('X-Termii-Signature') || '', TERMII_WEBHOOK_SECRET))) return text(401, 'Invalid Termii signature.');
  let payload: any; try { payload = JSON.parse(raw); } catch { return text(400, 'Invalid JSON payload.'); }
  let event: any; try { event = buildTermiiWebhookEvent(payload); } catch { return text(400, 'Invalid Termii webhook event.'); }

  if (event.kind === 'delivery') {
    const eventKey = await sha256(`dlr|${event.providerEventId || event.providerMessageId}|${event.status}|${raw}`);
    const { error } = await admin.rpc('calloria_sms_record_delivery', {
      p_event_key:eventKey, p_provider_message_id:event.providerMessageId, p_status:event.status, p_error_code:event.status === 'failed' ? 'termii_delivery_failed' : ''
    });
    if (error) return text(500, 'Delivery report could not be recorded.');
    return text(200, 'OK');
  }

  const phoneHash = await hmac(LOOKUP_SECRET, event.from);
  const eventKey = await sha256(`inbound|${event.providerEventId || `${event.from}|${event.receivedAt || ''}|${event.message}`}|${raw}`);
  const command = parseSmsCommand(event.message);
  if (command === 'STOP' || command === 'START') {
    const result = await admin.rpc('calloria_sms_process_inbound', {
      p_event_key:eventKey,p_command:command,p_phone_hash:phoneHash,
      p_phone_ciphertext:'',p_phone_iv:'',p_phone_masked:maskSmsNumber(event.from),p_body_ciphertext:'',p_body_iv:'',
      p_provider_message_id:event.providerEventId,p_thread_ref:'',p_route_ref:'',p_department:'',p_platform_id:'',p_intent:'',
      p_language:'en',p_required_skills:[],p_priority:'normal',p_subject:'',p_summary_ciphertext:'',p_summary_iv:'',p_access_token_hash:'',p_received_at:eventDate(event.receivedAt)
    });
    if (result.error) return text(500, 'SMS preference update could not be recorded.');
    return text(200, 'OK');
  }

  const classification = command === 'HELP'
    ? { department:'General Customer Care',skill:'general_customer_care',priority:'normal',intent:'general',platformId:null,language:'en' }
    : classifySmsIntent(event.message);
  const safeBody = command === 'HELP' ? 'Customer requested SMS help. A support representative should provide the official support instructions.' : redactSmsText(event.message, 600);
  const subject = command === 'HELP' ? 'SMS customer requested help' : `SMS · ${classification.intent.replaceAll('_',' ')}`;
  const phoneEncrypted = await encryptData(event.from);
  const bodyEncrypted = await encryptData(safeBody);
  const summaryEncrypted = await encryptAgentSummary(safeBody);
  const { error } = await admin.rpc('calloria_sms_process_inbound', {
    p_event_key:eventKey,p_command:'MESSAGE',p_phone_hash:phoneHash,
    p_phone_ciphertext:phoneEncrypted.ciphertext,p_phone_iv:phoneEncrypted.iv,p_phone_masked:maskSmsNumber(event.from),
    p_body_ciphertext:bodyEncrypted.ciphertext,p_body_iv:bodyEncrypted.iv,p_provider_message_id:event.providerEventId,
    p_thread_ref:threadRef(),p_route_ref:routeRef(),p_department:classification.department,p_platform_id:classification.platformId,
    p_intent:classification.intent,p_language:classification.language,p_required_skills:[classification.skill],p_priority:classification.priority,
    p_subject:cleanSmsText(subject,140),p_summary_ciphertext:summaryEncrypted.ciphertext,p_summary_iv:summaryEncrypted.iv,
    p_access_token_hash:await randomTokenHash(),p_received_at:eventDate(event.receivedAt)
  });
  if (error) return text(500, 'Incoming SMS could not be added to the support queue.');
  return text(200, 'OK');
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') {
    const origin = request.headers.get('Origin');
    if (!origin || !ORIGINS.includes(origin)) return json(403,{error:'Origin is not permitted.'},origin);
    return new Response('ok',{status:200,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'}});
  }
  if (request.method !== 'POST') return json(405,{error:'Only POST is accepted.'},request.headers.get('Origin'));
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > 12000) return json(413,{error:'Request is too large.'},request.headers.get('Origin'));
  let raw = '';
  try { raw = await request.text(); } catch { return json(400,{error:'Request body could not be read.'},request.headers.get('Origin')); }
  if (raw.length > 12000) return json(413,{error:'Request is too large.'},request.headers.get('Origin'));
  if (!SUPABASE_URL || !SERVICE_KEY) return json(503,{error:'SMS storage is not configured.'},request.headers.get('Origin'));
  const admin = createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const origin = request.headers.get('Origin');
  const authorization = request.headers.get('Authorization') || '';

  // Termii posts signed JSON without browser CORS headers or a user bearer token.
  if (!authorization.startsWith('Bearer ')) return handleProviderWebhook(request,raw,admin);
  if (!origin || !ORIGINS.includes(origin)) return json(403,{error:'Origin is not permitted.'},origin);
  let body: any; try { body = JSON.parse(raw); } catch { return json(400,{error:'A valid JSON request is required.'},origin); }
  const auth = await authenticate(request,admin);
  if ('error' in auth) return json(auth.status,{error:auth.error},origin);
  const user = auth.user!; const grant = auth.grant as Grant; const action = cleanSmsText(body.action,40);
  try {
    if (action === 'whoami') return json(200,{access:{role:grant.role,departments:grant.departments,skills:grant.skills,languages:grant.languages},provider:providerState()},origin);

    if (action === 'inbox') {
      const { error: staleSendError } = await admin.rpc('calloria_sms_reconcile_stale_sends');
      if (staleSendError) throw new Error('SMS send reconciliation is unavailable. The inbox is temporarily blocked to avoid unsafe retries.');
      const query = admin.from('calloria_route_requests')
        .select('route_ref,department,platform_id,intent,language,priority,status,assigned_to,created_at')
        .eq('channel','sms').in('department',allowedDepartments(grant)).in('status',['queued','assigned'])
        .order('created_at',{ascending:false}).limit(120);
      if (grant.role === 'agent') query.eq('assigned_to',user.id);
      const {data:routes,error:routeError} = await query;
      if (routeError) throw new Error('SMS routing queue could not be loaded.');
      const routeRows = routes || []; const refs = routeRows.map((row:any)=>row.route_ref);
      if (!refs.length) return json(200,{threads:[]},origin);
      const {data:threadRows,error:threadError} = await admin.from('calloria_sms_threads').select('id,thread_ref,route_ref,phone_masked,status,last_inbound_at,last_outbound_at,last_message_at')
        .in('route_ref',refs).order('last_message_at',{ascending:false}).limit(120);
      if (threadError) throw new Error('SMS conversation list could not be loaded.');
      const threads = threadRows || []; const ids = threads.map((row:any)=>row.id);
      const latestByThread = new Map<string,any>();
      if (ids.length) {
        const {data:messages,error:messageError} = await admin.from('calloria_sms_messages').select('thread_id,body_ciphertext,body_iv,direction,status,created_at')
          .in('thread_id',ids).order('created_at',{ascending:false}).limit(Math.min(500,ids.length*8));
        if (messageError) throw new Error('SMS message previews could not be loaded.');
        for (const message of messages || []) if (!latestByThread.has(message.thread_id)) latestByThread.set(message.thread_id,message);
      }
      const byRoute = new Map(routeRows.map((row:any)=>[row.route_ref,row]));
      const visible = [];
      for (const row of threads) {
        const route:any = byRoute.get(row.route_ref); if (!route) continue;
        const latest = latestByThread.get(row.id); let preview = '';
        if (latest) { try { preview = await decryptData(latest.body_ciphertext,latest.body_iv); } catch { preview='Message preview unavailable'; } }
        const {data:suppression} = await admin.from('calloria_sms_suppressions').select('phone_hash').eq('phone_hash',await hmac(LOOKUP_SECRET, await decryptData(row.phone_ciphertext,row.phone_iv))).maybeSingle();
        visible.push({id:row.id,threadRef:row.thread_ref,routeRef:row.route_ref,phoneMasked:row.phone_masked,department:route.department,
          platformId:route.platform_id,intent:route.intent,language:route.language,priority:route.priority,routeStatus:route.status,
          lastInboundAt:row.last_inbound_at,lastOutboundAt:row.last_outbound_at,lastMessageAt:row.last_message_at,
          lastDirection:latest?.direction||null,lastPreview:preview.slice(0,100),suppressed:Boolean(suppression),canReply:route.status==='assigned'&&route.assigned_to===user.id&&latest?.direction==='inbound'});
      }
      return json(200,{threads:visible},origin);
    }

    if (action === 'conversation') {
      const threadId = cleanSmsText(body.threadId,64);
      if (!UUID.test(threadId)) return json(400,{error:'Select a valid SMS thread.'},origin);
      const {data:thread,error:threadError} = await admin.from('calloria_sms_threads').select('*').eq('id',threadId).maybeSingle();
      if (threadError || !thread) return json(404,{error:'SMS thread was not found.'},origin);
      const {data:route,error:routeError} = await admin.from('calloria_route_requests').select('route_ref,department,platform_id,intent,language,priority,status,assigned_to,channel').eq('route_ref',thread.route_ref).maybeSingle();
      if (routeError || !route || route.channel!=='sms') return json(404,{error:'SMS routing request was not found.'},origin);
      if (!hasDepartment(grant,route.department)) return json(403,{error:'This SMS thread is outside your department permission.'},origin);
      if (grant.role==='agent' && route.assigned_to!==user.id) return json(403,{error:'Claim this SMS request through Routing Control before opening the conversation.'},origin);
      const {data:messages,error:messageError} = await admin.from('calloria_sms_messages').select('id,direction,body_ciphertext,body_iv,status,created_at,sent_by,provider_message_id').eq('thread_id',threadId).order('created_at',{ascending:true}).limit(100);
      if (messageError) throw new Error('SMS conversation messages could not be loaded.');
      const clearMessages=[];
      for (const message of messages||[]) {
        let bodyText=''; try { bodyText=await decryptData(message.body_ciphertext,message.body_iv); } catch { bodyText='[Message could not be decrypted]'; }
        clearMessages.push({id:message.id,direction:message.direction,body:bodyText,status:message.status,createdAt:message.created_at,sentBy:message.sent_by===user.id?'You':'CALLORIA staff'});
      }
      const {data:suppression} = await admin.from('calloria_sms_suppressions').select('phone_hash').eq('phone_hash',await hmac(LOOKUP_SECRET,await decryptData(thread.phone_ciphertext,thread.phone_iv))).maybeSingle();
      const latest=clearMessages[clearMessages.length-1];
      return json(200,{thread:{id:thread.id,threadRef:thread.thread_ref,routeRef:thread.route_ref,phoneMasked:thread.phone_masked,
        department:route.department,platformId:route.platform_id,intent:route.intent,language:route.language,priority:route.priority,
        routeStatus:route.status,lastInboundAt:thread.last_inbound_at,lastOutboundAt:thread.last_outbound_at,suppressed:Boolean(suppression),
        canReply:route.status==='assigned'&&route.assigned_to===user.id&&latest?.direction==='inbound'},messages:clearMessages},origin);
    }

    if (action === 'send_reply') {
      if (!providerState().outboundReady) return json(503,{error:'Termii outbound configuration is incomplete. Check the API key, account base URL, approved sender ID and SMS encryption secrets.'},origin);
      const threadId = cleanSmsText(body.threadId,64); const idempotencyKey = cleanSmsText(body.idempotencyKey,64);
      if (!UUID.test(threadId) || !UUID.test(idempotencyKey)) return json(400,{error:'A valid SMS thread and unique idempotency key are required.'},origin);
      if (body.purpose !== 'customer_support_response') return json(400,{error:'SMS is limited to customer-support responses and service updates.'},origin);
      let message:string; try { message=validateSmsSupportReply(body.message); } catch(error) { return json(400,{error:error instanceof Error?error.message:'Invalid SMS reply.'},origin); }
      const {data:thread,error:threadError} = await admin.from('calloria_sms_threads').select('*').eq('id',threadId).maybeSingle();
      if (threadError || !thread) return json(404,{error:'SMS thread was not found.'},origin);
      const {data:route,error:routeError} = await admin.from('calloria_route_requests').select('department,status,assigned_to,channel').eq('route_ref',thread.route_ref).maybeSingle();
      if (routeError || !route || route.channel!=='sms') return json(404,{error:'SMS route was not found.'},origin);
      if (!hasDepartment(grant,route.department) || route.status!=='assigned' || route.assigned_to!==user.id) return json(403,{error:'Claim this SMS request through Routing Control before replying.'},origin);
      const phone = normalizeNigeriaSmsNumber(await decryptData(thread.phone_ciphertext,thread.phone_iv));
      const phoneHash = await hmac(LOOKUP_SECRET,phone);
      const {data:suppression,error:suppressionError} = await admin.from('calloria_sms_suppressions').select('phone_hash').eq('phone_hash',phoneHash).maybeSingle();
      if (suppressionError) throw new Error('SMS opt-out status could not be checked. Reply blocked.');
      if (suppression) return json(409,{error:'This customer sent STOP. Outbound SMS is blocked until the customer sends START.'},origin);
      const bucket = new Date(Math.floor(Date.now()/60000)*60000).toISOString();
      const {data:allowed,error:limitError} = await admin.rpc('calloria_sms_consume_send_limit',{p_staff_user_id:user.id,p_bucket_start:bucket,p_limit:20});
      if (limitError) throw new Error('SMS send-rate protection is unavailable.');
      if (allowed!==true) return json(429,{error:'This staff account has reached the limit of 20 SMS replies per minute.'},origin);
      const encrypted = await encryptData(message);
      const {data:reservation,error:reserveError} = await admin.rpc('calloria_sms_reserve_send',{
        p_thread_id:threadId,p_staff_user_id:user.id,p_idempotency_key:idempotencyKey,p_body_ciphertext:encrypted.ciphertext,p_body_iv:encrypted.iv
      });
      if (reserveError || !reservation) throw new Error(reserveError?.message?.includes('new customer SMS')?'A new customer SMS is required before the next support reply.':'SMS send could not be reserved safely.');
      const messageId = reservation.messageId;
      if (reservation.duplicate) return json(200,{status:reservation.status,duplicate:true},origin);
      const recipient = normalizeNigeriaSmsNumber(await decryptData(reservation.phoneCiphertext,thread.phone_iv));
      let providerResponse:Response;
      try {
        providerResponse = await fetch(`${TERMII_BASE_URL}/api/sms/send`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({api_key:TERMII_API_KEY,to:recipient,from:TERMII_SENDER_ID,sms:message,type:'plain',channel:'dnd'}),
          signal:AbortSignal.timeout(15000)
        });
      } catch {
        await admin.rpc('calloria_sms_finalize_send',{p_message_id:messageId,p_status:'unknown',p_provider_message_id:'',p_error_code:'provider_timeout_or_network'});
        return json(202,{status:'unknown',message:'Termii did not return a definitive response. Check delivery records before attempting another reply.'},origin);
      }
      const providerBody:any = await providerResponse.json().catch(()=>({}));
      const providerId = cleanSmsText(providerBody.message_id_str||providerBody.message_id||'',160);
      const accepted = providerResponse.ok && Boolean(providerId) && (String(providerBody.code||'').toLowerCase()==='ok'||String(providerBody.message||'').toLowerCase().includes('success'));
      if (!accepted) {
        await admin.rpc('calloria_sms_finalize_send',{p_message_id:messageId,p_status:providerResponse.ok?'unknown':'failed',p_provider_message_id:providerId,p_error_code:cleanSmsText(providerBody.code||`http_${providerResponse.status}`,80)});
        return providerResponse.ok ? json(202,{status:'unknown',message:'Termii response was ambiguous. Check its message log before retrying.'},origin)
          : json(502,{error:'Termii rejected the support SMS. Check the provider response and account routing configuration.',status:'failed'},origin);
      }
      const {error:finalizeError} = await admin.rpc('calloria_sms_finalize_send',{p_message_id:messageId,p_status:'sent',p_provider_message_id:providerId,p_error_code:''});
      if (finalizeError) return json(202,{status:'unknown',message:'Termii accepted the message but CALLORIA could not confirm the local status. Check delivery records before retrying.'},origin);
      return json(200,{status:'sent',providerMessageId:providerId},origin);
    }

    return json(400,{error:'Unsupported SMS action.'},origin);
  } catch (error) {
    return json(500,{error:error instanceof Error?error.message:'CALLORIA SMS request failed.'},origin);
  }
});
