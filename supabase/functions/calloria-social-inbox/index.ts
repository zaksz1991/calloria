import { createClient } from 'npm:@supabase/supabase-js@2';
import { classifySocialMessage, cleanSocialText, normalizeWebhookMessage, redactSocialText, validateSocialReply } from './social-engine.ts';

const env = (name: string) => Deno.env.get(name) || '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const META_APP_SECRET = env('CALLORIA_META_APP_SECRET');
const META_VERIFY_TOKEN = env('CALLORIA_META_VERIFY_TOKEN');
const SOCIAL_DATA_KEY = env('CALLORIA_SOCIAL_INBOX_DATA_KEY');
const SOCIAL_LOOKUP_SECRET = env('CALLORIA_SOCIAL_INBOX_LOOKUP_SECRET');
const AGENT_DESK_SECRET = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const ROUTING_ACCESS_RAW = env('CALLORIA_ROUTING_ACCESS');
const GRAPH_VERSION_RAW = env('CALLORIA_META_GRAPH_API_VERSION') || 'v26.0';
const GRAPH_VERSION = /^v\d+\.\d+$/.test(GRAPH_VERSION_RAW) ? GRAPH_VERSION_RAW : '';
const STAFF_ORIGINS = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v => v.trim().replace(/\/$/, '')).filter(Boolean);
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const ALLOWED_SKILLS = ['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
const ALLOWED_CHANNELS = ['voice','email','live_chat','social','whatsapp','website','portal','game','back_office'];
const ALLOWED_LANGUAGES = ['en','ha','yo','ig','pcm'];

type Provider = 'messenger' | 'instagram';
type SocialAccount = { provider: Provider; webhookObject: 'page'|'instagram'; accountId: string; apiNodeId: string; apiHost: 'graph.facebook.com'|'graph.instagram.com'; displayName: string; accessToken: string; platformId?: string };
type Grant = { role: 'agent'|'supervisor'|'people_admin'; departments: string[]; skills: string[]; channels: string[]; languages: string[]; maxConcurrency: number };
const PRODUCTS = ['ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke'];
const socialAccounts: SocialAccount[] = [];
let accountsInvalid = !GRAPH_VERSION;
try {
  const parsed = env('CALLORIA_META_SOCIAL_ACCOUNTS_JSON') ? JSON.parse(env('CALLORIA_META_SOCIAL_ACCOUNTS_JSON')) : [];
  if (!Array.isArray(parsed) || parsed.length > 20) throw new Error('Invalid Meta account map.');
  for (const row of parsed) {
    if (!row || !['messenger','instagram'].includes(row.provider) || !['page','instagram'].includes(row.webhookObject)) throw new Error('Invalid Meta account provider.');
    if (row.provider === 'messenger' && (row.webhookObject !== 'page' || row.apiHost !== 'graph.facebook.com')) throw new Error('Messenger requires Page webhooks and the Facebook Graph API host.');
    if (row.provider === 'instagram' && (row.webhookObject !== 'instagram' || !['graph.instagram.com','graph.facebook.com'].includes(row.apiHost))) throw new Error('Instagram requires Instagram webhooks and an approved Graph API host.');
    if (typeof row.accountId !== 'string' || typeof row.apiNodeId !== 'string' || typeof row.accessToken !== 'string' || typeof row.displayName !== 'string') throw new Error('Incomplete Meta account settings.');
    if (!/^\d{5,30}$/.test(row.accountId) || !/^\d{5,30}$/.test(row.apiNodeId) || row.accessToken.length < 20) throw new Error('Invalid Meta account identifiers or token.');
    if (row.platformId && !PRODUCTS.includes(row.platformId)) throw new Error('Invalid associated RuffNeck platform.');
    socialAccounts.push({ provider: row.provider, webhookObject: row.webhookObject, accountId: row.accountId, apiNodeId: row.apiNodeId, apiHost: row.apiHost, displayName: cleanSocialText(row.displayName, 100), accessToken: row.accessToken, platformId: row.platformId || undefined });
  }
} catch { accountsInvalid = true; }
const grants: Record<string, Grant> = {};
let grantsInvalid = false;
try {
  const parsed = ROUTING_ACCESS_RAW ? JSON.parse(ROUTING_ACCESS_RAW) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid routing access map.');
  for (const [userId, row] of Object.entries(parsed) as [string, any][]) {
    if (!UUID.test(userId) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid user grant.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.skills) || !row.skills.length || !Array.isArray(row.channels) || !row.channels.length || !Array.isArray(row.languages) || !row.languages.length) throw new Error('Incomplete routing grant.');
    const departments = row.departments.map((v: unknown) => cleanSocialText(v, 120));
    const skills = row.skills.map((v: unknown) => cleanSocialText(v, 40));
    const channels = row.channels.map((v: unknown) => cleanSocialText(v, 24));
    const languages = row.languages.map((v: unknown) => cleanSocialText(v, 8));
    if (departments.some((v: string) => v !== '*' && !DEPARTMENTS.includes(v)) || skills.some((v: string) => !ALLOWED_SKILLS.includes(v)) || channels.some((v: string) => !ALLOWED_CHANNELS.includes(v)) || languages.some((v: string) => !ALLOWED_LANGUAGES.includes(v))) throw new Error('Unknown routing grant value.');
    if (!skills.includes('general_customer_care')) throw new Error('General customer care is required.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Agents require explicit department scope.');
    grants[userId] = { role: row.role, departments, skills, channels, languages, maxConcurrency: Math.max(1, Math.min(10, Number(row.maxConcurrency) || 1)) };
  }
} catch { grantsInvalid = true; }

function response(status: number, body: Record<string, unknown>, origin: string | null = null) {
  const headers: Record<string,string> = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };
  if (origin && STAFF_ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function safeEqual(a: string, b: string) { if (a.length !== b.length) return false; let difference = 0; for (let i=0;i<a.length;i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i); return difference === 0; }
function toHex(bytes: Uint8Array) { return Array.from(bytes, byte => byte.toString(16).padStart(2,'0')).join(''); }
function fromHex(value: string) { return Uint8Array.from(value.match(/.{1,2}/g) || [], part => parseInt(part,16)); }
function toBase64(bytes: Uint8Array) { let raw=''; for (const byte of bytes) raw += String.fromCharCode(byte); return btoa(raw); }
function fromBase64(value: string) { const raw=atob(value); return Uint8Array.from(raw, char => char.charCodeAt(0)); }
function randomHex(length = 32) { return toHex(crypto.getRandomValues(new Uint8Array(length))); }
async function sha256(value: string) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))); }
async function hmac(secret: string, value: string) {
  if (encoder.encode(secret).length < 32) throw new Error('Social lookup secret is missing or too short.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))));
}
async function deriveKey(secret: string, salt: string, info: string) {
  if (encoder.encode(secret).length < 32) throw new Error('A required CALLORIA social encryption secret is missing or too short.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt:encoder.encode(salt), info:encoder.encode(info) }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encryptSocial(value: string, purpose: 'message'|'sender-id' = 'message') {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(SOCIAL_DATA_KEY,'CALLORIA-SOCIAL-INBOX-v1',purpose==='message'?'social-message':'social-sender-id');
  const cipher=await crypto.subtle.encrypt({ name:'AES-GCM', iv },key,encoder.encode(value));
  return { ciphertext:toBase64(new Uint8Array(cipher)), iv:toBase64(iv) };
}
async function decryptSocial(ciphertext: string, iv: string, purpose: 'message'|'sender-id' = 'message') {
  const key=await deriveKey(SOCIAL_DATA_KEY,'CALLORIA-SOCIAL-INBOX-v1',purpose==='message'?'social-message':'social-sender-id');
  const plain=await crypto.subtle.decrypt({ name:'AES-GCM', iv:fromBase64(iv) },key,fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
async function encryptAgentSummary(value: string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const key=await deriveKey(AGENT_DESK_SECRET,'CALLORIA-AGENT-DESK-v1','interaction-summary-encryption');
  const cipher=await crypto.subtle.encrypt({ name:'AES-GCM', iv },key,encoder.encode(value));
  return { ciphertext:toBase64(new Uint8Array(cipher)), iv:toBase64(iv) };
}
function makeRef(prefix: 'CR'|'SM') {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  const suffix=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${suffix}`;
}
function allowedDepartment(grant: Grant, department: string) { return grant.departments.includes('*') || grant.departments.includes(department); }
function providerAccount(provider: string, accountId: string) { return socialAccounts.find(row => row.provider === provider && row.accountId === accountId) || null; }
function parseAuthHeader(request: Request) { const value=request.headers.get('authorization')||''; return value.match(/^Bearer\s+(.+)$/i)?.[1] || ''; }
async function authenticate(request: Request, admin: any) {
  if (grantsInvalid) return { error:'Social staff access configuration is invalid.', status:503 };
  const token=parseAuthHeader(request);
  if (!token) return { error:'A valid staff session is required.', status:401 };
  const { data, error }=await admin.auth.getUser(token);
  if (error || !data?.user) return { error:'Your staff session is invalid or expired.', status:401 };
  const grant=grants[data.user.id];
  if (!grant || !grant.channels.includes('social') || !grant.skills.includes('general_customer_care')) return { error:'Your staff account does not have Social channel permission.', status:403 };
  return { user:data.user, grant };
}
async function verifyMetaSignature(raw: string, signature: string) {
  if (!META_APP_SECRET || !signature.startsWith('sha256=')) return false;
  const provided=signature.slice(7).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  const key=await crypto.subtle.importKey('raw',encoder.encode(META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const expected=toHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(raw))));
  return safeEqual(expected,provided);
}
function accountName(provider: string, accountId: string) { return providerAccount(provider,accountId)?.displayName || (provider==='instagram'?'Instagram account':'Facebook Page'); }
function authorizedRoute(grant: Grant, userId: string, route: any) {
  if (!route || route.channel !== 'social' || route.status !== 'assigned' || !allowedDepartment(grant,route.department)) return false;
  if (grant.role === 'agent' && route.assigned_to !== userId) return false;
  if (grant.role === 'agent' && !(route.required_skills || []).every((skill: string) => grant.skills.includes(skill))) return false;
  return true;
}
function webhookMessageEvents(payload: any, provider: Provider) {
  if (!payload || (provider==='messenger' && payload.object!=='page') || (provider==='instagram' && payload.object!=='instagram')) return [];
  const events: Array<{entry:any,event:any}> = [];
  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) events.push({ entry, event });
  }
  return events;
}
async function processWebhook(raw: string, admin: any) {
  let payload: any;
  try { payload=JSON.parse(raw); } catch { throw new Error('Meta sent invalid JSON.'); }
  const provider: Provider | null = payload.object==='page' ? 'messenger' : payload.object==='instagram' ? 'instagram' : null;
  if (!provider) return { received:true, processed:0 };
  let processed=0;
  for (const {entry,event} of webhookMessageEvents(payload,provider)) {
    const entryId=cleanSocialText(entry?.id,100);
    const candidate=providerAccount(provider,entryId) || providerAccount(provider,cleanSocialText(event?.recipient?.id,100));
    if (!candidate) continue;
    const normalized=normalizeWebhookMessage(provider,{id:candidate.accountId},event);
    if (!normalized) continue;
    const policy=classifySocialMessage(normalized.text);
    const senderHash=await hmac(SOCIAL_LOOKUP_SECRET,`${provider}|${candidate.accountId}|${normalized.senderId}`);
    const senderEncrypted=await encryptSocial(normalized.senderId,'sender-id');
    const bodyEncrypted=await encryptSocial(normalized.text,'message');
    const summary=await encryptAgentSummary(`Inbound ${provider==='instagram'?'Instagram Direct':'Facebook Messenger'} message. ${normalized.text.slice(0,500)}`);
    const randomAccessHash=await sha256(randomHex());
    const { error }=await admin.rpc('calloria_social_ingest_message',{
      p_route_ref:makeRef('CR'),p_conversation_ref:makeRef('SM'),p_provider:provider,
      p_account_id:candidate.accountId,p_sender_hash:senderHash,p_sender_ciphertext:senderEncrypted.ciphertext,
      p_sender_iv:senderEncrypted.iv,p_received_at:normalized.receivedAt,p_provider_message_id:normalized.providerMessageId,
      p_body_ciphertext:bodyEncrypted.ciphertext,p_body_iv:bodyEncrypted.iv,
      p_subject:`${provider==='instagram'?'Instagram Direct':'Facebook Messenger'} · ${candidate.displayName}`,
      p_department:policy.department,p_intent:policy.intent,p_language:policy.language,
      p_required_skills:policy.requiredSkills,p_priority:policy.priority,p_platform_id:candidate.platformId || null,
      p_summary_ciphertext:summary.ciphertext,p_summary_iv:summary.iv,p_access_token_hash:randomAccessHash
    });
    if (error) throw new Error('A verified social message could not be queued. Meta may retry this delivery safely.');
    processed++;
  }
  return { received:true, processed };
}
async function authorizedConversation(admin: any, grant: Grant, userId: string, conversationId: string) {
  if (!UUID.test(conversationId)) return { error:'Conversation reference is invalid.', status:400 };
  const {data:conversation,error}=await admin.from('calloria_social_conversations').select('id,conversation_ref,route_ref,provider,account_id,status,sender_ciphertext,sender_iv,last_customer_message_at,reply_window_expires_at,last_message_at,created_at').eq('id',conversationId).maybeSingle();
  if (error) throw new Error('Social conversation could not be loaded.');
  if (!conversation) return { error:'Social conversation was not found.', status:404 };
  const {data:route,error:routeError}=await admin.from('calloria_route_requests').select('route_ref,department,channel,platform_id,intent,language,priority,status,assigned_to,required_skills,assigned_at,created_at').eq('route_ref',conversation.route_ref).maybeSingle();
  if (routeError) throw new Error('Social routing assignment could not be checked.');
  if (!authorizedRoute(grant,userId,route)) return { error:'This conversation is outside your assignment or department permission.', status:403 };
  return { conversation, route };
}
async function actionHandler(request: Request, body: any, admin: any, origin: string) {
  const auth=await authenticate(request,admin);
  if ('error' in auth) return response(auth.status,{error:auth.error},origin);
  const user=auth.user as any; const grant=auth.grant as Grant;
  const configuration={
    accounts:socialAccounts.map(account=>({provider:account.provider,accountId:account.accountId,displayName:account.displayName})),
    webhookReady:Boolean(META_APP_SECRET && META_VERIFY_TOKEN && socialAccounts.length && !accountsInvalid),
    graphVersion:GRAPH_VERSION || 'invalid',
    outboundReady:Boolean(!accountsInvalid && socialAccounts.length && socialAccounts.every(account=>account.accessToken.length>20) && encoder.encode(SOCIAL_DATA_KEY).length>=32 && encoder.encode(SOCIAL_LOOKUP_SECRET).length>=32),
    dataProtectionReady:Boolean(encoder.encode(SOCIAL_DATA_KEY).length>=32 && encoder.encode(SOCIAL_LOOKUP_SECRET).length>=32 && encoder.encode(AGENT_DESK_SECRET).length>=32)
  };
  if (body.action==='whoami') return response(200,{access:{role:grant.role,departments:grant.departments,skills:grant.skills,channels:grant.channels},provider:configuration},origin);
  if (body.action==='inbox') {
    const departments=grant.departments.includes('*')?DEPARTMENTS:grant.departments;
    let query=admin.from('calloria_route_requests').select('route_ref,department,channel,platform_id,intent,language,priority,status,assigned_to,required_skills,created_at,assigned_at').eq('channel','social').eq('status','assigned').in('department',departments).order('assigned_at',{ascending:false}).limit(100);
    if (grant.role==='agent') query=query.eq('assigned_to',user.id);
    const [{data:routes,error:routeError},{count:queuedCount,error:queueError}]=await Promise.all([
      query,
      admin.from('calloria_route_requests').select('id',{count:'exact',head:true}).eq('channel','social').eq('status','queued').in('department',departments)
    ]);
    if (routeError || queueError) throw new Error('Social inbox could not be loaded.');
    const routeRows=(routes||[]).filter((route:any)=>authorizedRoute(grant,user.id,route));
    const refs=routeRows.map((route:any)=>route.route_ref);
    if (!refs.length) return response(200,{conversations:[],queuedCount:queuedCount||0,provider:configuration},origin);
    const {data:conversations,error:conversationError}=await admin.from('calloria_social_conversations').select('id,conversation_ref,route_ref,provider,account_id,status,last_customer_message_at,reply_window_expires_at,last_message_at').in('route_ref',refs).order('last_message_at',{ascending:false}).limit(100);
    if (conversationError) throw new Error('Social conversation list could not be loaded.');
    const routeMap=new Map(routeRows.map((route:any)=>[route.route_ref,route]));
    const ids=(conversations||[]).map((row:any)=>row.id);
    const {data:messageRows,error:messageError}=ids.length?await admin.rpc('calloria_social_latest_messages',{p_conversation_ids:ids}):{data:[],error:null};
    if (messageError) throw new Error('Social message previews could not be loaded.');
    const previewMap=new Map<string,string>();
    for (const row of messageRows||[]) if (!previewMap.has(row.conversation_id)) previewMap.set(row.conversation_id,await decryptSocial(row.body_ciphertext,row.body_iv));
    const result=[];
    for (const row of conversations||[]) {
      const route=routeMap.get(row.route_ref) as any; if (!route) continue;
      result.push({id:row.id,reference:row.conversation_ref,routeRef:row.route_ref,provider:row.provider,accountName:accountName(row.provider,row.account_id),department:route.department,platformId:route.platform_id,intent:route.intent,language:route.language,priority:route.priority,routeStatus:route.status,assignedAt:route.assigned_at,assignedToCurrentUser:route.assigned_to===user.id,lastCustomerMessageAt:row.last_customer_message_at,replyWindowExpiresAt:row.reply_window_expires_at,lastMessageAt:row.last_message_at,lastPreview:previewMap.get(row.id)||''});
    }
    return response(200,{conversations:result,queuedCount:queuedCount||0,provider:configuration},origin);
  }
  if (body.action==='conversation') {
    const permission=await authorizedConversation(admin,grant,user.id,cleanSocialText(body.conversationId,64));
    if ('error' in permission) return response(permission.status,{error:permission.error},origin);
    const {conversation,route}=permission;
    const {data:rows,error}=await admin.from('calloria_social_messages').select('id,direction,body_ciphertext,body_iv,delivery_state,provider_error_code,created_at').eq('conversation_id',conversation.id).order('created_at',{ascending:true}).limit(200);
    if (error) throw new Error('Social conversation messages could not be loaded.');
    const messages=[];
    for (const row of rows||[]) messages.push({id:row.id,direction:row.direction,text:await decryptSocial(row.body_ciphertext,row.body_iv),state:row.delivery_state,errorCode:row.provider_error_code,createdAt:row.created_at});
    return response(200,{conversation:{id:conversation.id,reference:conversation.conversation_ref,routeRef:conversation.route_ref,provider:conversation.provider,accountName:accountName(conversation.provider,conversation.account_id),department:route.department,platformId:route.platform_id,intent:route.intent,language:route.language,priority:route.priority,routeStatus:route.status,assignedToCurrentUser:route.assigned_to===user.id,lastCustomerMessageAt:conversation.last_customer_message_at,replyWindowExpiresAt:conversation.reply_window_expires_at,lastMessageAt:conversation.last_message_at},messages},origin);
  }
  if (body.action==='send_reply') {
    const conversationId=cleanSocialText(body.conversationId,64);
    const clientMessageId=cleanSocialText(body.clientMessageId,64);
    if (!UUID.test(clientMessageId)) return response(400,{error:'A valid reply id is required.'},origin);
    const permission=await authorizedConversation(admin,grant,user.id,conversationId);
    if ('error' in permission) return response(permission.status,{error:permission.error},origin);
    const {conversation,route}=permission;
    if (route.assigned_to!==user.id) return response(403,{error:'Only the currently assigned agent can send a reply.'},origin);
    if (!(route.required_skills||[]).every((skill:string)=>grant.skills.includes(skill))) return response(403,{error:'Your staff skill grant does not cover this social interaction.'},origin);
    if (new Date(conversation.reply_window_expires_at).getTime()<=Date.now()) return response(409,{error:'The standard Meta 24-hour messaging window has expired. The reply was not sent.'},origin);
    if (encoder.encode(SOCIAL_LOOKUP_SECRET).length<32 || encoder.encode(SOCIAL_DATA_KEY).length<32) return response(503,{error:'Social messaging encryption and lookup secrets are not configured. The reply was not sent.'},origin);
    const sendRateHash=await hmac(SOCIAL_LOOKUP_SECRET,`staff-social-send|${user.id}`);
    const sendBucket=new Date(Math.floor(Date.now()/60_000)*60_000).toISOString();
    const {data:sendAllowed,error:sendRateError}=await admin.rpc('calloria_route_consume_limit',{
      p_fingerprint_hash:sendRateHash,p_bucket_start:sendBucket,p_limit:20
    });
    if (sendRateError) throw new Error('CALLORIA could not verify the staff messaging rate limit. No reply was sent.');
    if (sendAllowed!==true) return response(429,{error:'Social reply limit reached. Wait one minute before sending another message.'},origin);
    const account=providerAccount(conversation.provider,conversation.account_id);
    if (!account || accountsInvalid || !account.accessToken) return response(503,{error:'The connected Meta account is not configured for outbound messaging.'},origin);
    const text=validateSocialReply(body.text);
    const {data:unresolved,error:unresolvedError}=await admin.from('calloria_social_messages').select('id,delivery_state').eq('conversation_id',conversation.id).eq('direction','outbound').in('delivery_state',['sending','uncertain']).limit(1);
    if (unresolvedError) throw new Error('An earlier Meta delivery status could not be checked. No new reply was sent.');
    if (unresolved?.length) return response(409,{error:'A previous reply has an uncertain delivery result. Check the native Meta inbox and resolve the delivery before sending another CALLORIA reply.'},origin);
    const encrypted=await encryptSocial(text);
    const {data:prepared,error:prepareError}=await admin.rpc('calloria_social_prepare_reply',{
      p_conversation_id:conversation.id,p_sender_id:user.id,p_client_message_id:clientMessageId,
      p_body_ciphertext:encrypted.ciphertext,p_body_iv:encrypted.iv
    });
    if (prepareError || !prepared) {
      const reason=String(prepareError?.message||'').toLowerCase();
      if (reason.includes('24-hour')) return response(409,{error:'The standard Meta 24-hour messaging window has expired. The reply was not sent.'},origin);
      if (reason.includes('assigned')) return response(403,{error:'This interaction is no longer assigned to you.'},origin);
      if (reason.includes('unresolved')) return response(409,{error:'Another reply has an unresolved delivery result. Check the native Meta inbox before sending again.'},origin);
      throw new Error('The reply could not be reserved safely. No provider send was attempted.');
    }
    if (!prepared.created) {
      if (prepared.delivery_state==='sent') return response(200,{state:'sent',duplicate:true,message:'This exact reply was already accepted by Meta. No duplicate was sent.'},origin);
      if (prepared.delivery_state==='failed') return response(200,{state:'failed',duplicate:true,message:'The previous provider request was rejected. Review the error and prepare a new, corrected reply.'},origin);
      return response(200,{state:'uncertain',duplicate:true,message:'A previous send attempt is still unresolved. Check the native Meta inbox before sending another reply.'},origin);
    }
    const {data:identity,error:identityError}=await admin.from('calloria_social_conversations').select('sender_ciphertext,sender_iv').eq('id',conversation.id).maybeSingle();
    if (identityError || !identity) {
      await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:'uncertain',p_provider_message_id:null,p_error_code:'identity_read_failed'});
      return response(200,{state:'uncertain',message:'The sender identity could not be read after reserving the send. Check Meta before any further attempt.'},origin);
    }
    let recipientId='';
    try { recipientId=await decryptSocial(identity.sender_ciphertext,identity.sender_iv,'sender-id'); }
    catch {
      await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:'failed',p_provider_message_id:null,p_error_code:'identity_decrypt_failed'});
      return response(500,{state:'failed',message:'The encrypted customer identifier could not be opened. No Meta message was sent.'},origin);
    }
    const url=`https://${account.apiHost}/${GRAPH_VERSION}/${account.apiNodeId}/messages`;
    const messagePayload:Record<string,unknown>={recipient:{id:recipientId},message:{text}};
    if (account.provider==='messenger') messagePayload.messaging_type='RESPONSE';
    const controller=new AbortController(); const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const providerResponse=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${account.accessToken}`},body:JSON.stringify(messagePayload),signal:controller.signal});
      const providerBody:any=await providerResponse.json().catch(()=>({}));
      if (!providerResponse.ok) {
        const state=providerResponse.status>=500?'uncertain':'failed';
        const code=providerBody?.error?.code!=null?`meta_${String(providerBody.error.code).replace(/[^A-Za-z0-9_.-]/g,'').slice(0,30)}`:`http_${providerResponse.status}`;
        await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:state,p_provider_message_id:null,p_error_code:code});
        return response(200,{state,message:state==='uncertain'?'Meta returned a server error. Check the native Meta inbox before attempting another reply.':'Meta rejected the message. Review the account permission and policy window before preparing a corrected reply.'},origin);
      }
      const providerMessageId=cleanSocialText(providerBody?.message_id,200);
      if (!providerMessageId) {
        await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:'uncertain',p_provider_message_id:null,p_error_code:'missing_provider_message_id'});
        return response(200,{state:'uncertain',message:'Meta returned without a message ID. Check the native Meta inbox before attempting another reply.'},origin);
      }
      const {error:finishError}=await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:'sent',p_provider_message_id:providerMessageId,p_error_code:null});
      if (finishError) return response(200,{state:'uncertain',message:'Meta accepted the reply, but CALLORIA could not confirm the final record. Check the native Meta inbox before attempting another reply.'},origin);
      return response(200,{state:'sent'},origin);
    } catch {
      await admin.rpc('calloria_social_finish_reply',{p_message_id:prepared.message_id,p_delivery_state:'uncertain',p_provider_message_id:null,p_error_code:'network_timeout_or_failure'});
      return response(200,{state:'uncertain',message:'The provider request timed out or disconnected. Meta may have accepted it; check the native Meta inbox before attempting another reply.'},origin);
    } finally { clearTimeout(timeout); }
  }
  return response(400,{error:'Unsupported social inbox action.'},origin);
}

Deno.serve(async request => {
  const url=new URL(request.url);
  if (request.method==='GET') {
    const mode=url.searchParams.get('hub.mode')||'';
    const verifyToken=url.searchParams.get('hub.verify_token')||'';
    const challenge=url.searchParams.get('hub.challenge')||'';
    if (mode==='subscribe' && META_VERIFY_TOKEN && safeEqual(verifyToken,META_VERIFY_TOKEN)) return new Response(challenge,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
    return new Response('Forbidden',{status:403});
  }
  const origin=request.headers.get('origin');
  if (request.method==='OPTIONS') return origin && STAFF_ORIGINS.includes(origin)
    ? new Response('ok',{headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}})
    : response(403,{error:'Origin not permitted.'});
  if (request.method!=='POST') return response(405,{error:'Only GET and POST are supported.'},origin);
  const length=Number(request.headers.get('content-length')||0);
  if (length>1_500_000) return response(413,{error:'Webhook or request body is too large.'},origin);
  try {
    const raw=await request.text();
    if (raw.length>1_500_000) return response(413,{error:'Webhook or request body is too large.'},origin);
    if (!SUPABASE_URL || !SERVICE_KEY) return response(503,{error:'CALLORIA social storage is not configured.'},origin);
    const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    if (!origin) {
      if (!await verifyMetaSignature(raw,request.headers.get('x-hub-signature-256')||'')) return response(401,{error:'Invalid Meta webhook signature.'});
      if (accountsInvalid) return response(503,{error:'Meta social account configuration is invalid.'});
      if (!socialAccounts.length) return response(503,{error:'No Meta social accounts are configured.'});
      if (encoder.encode(SOCIAL_DATA_KEY).length<32 || encoder.encode(SOCIAL_LOOKUP_SECRET).length<32 || encoder.encode(AGENT_DESK_SECRET).length<32) return response(503,{error:'Social message encryption and lookup secrets are not configured.'});
      const result=await processWebhook(raw,admin);
      return response(200,result);
    }
    if (!STAFF_ORIGINS.includes(origin)) return response(403,{error:'Origin not permitted.'},origin);
    if (grantsInvalid) return response(503,{error:'Staff routing permission configuration is invalid.'},origin);
    let body:any; try { body=JSON.parse(raw); } catch { return response(400,{error:'A valid JSON request is required.'},origin); }
    return await actionHandler(request,body,admin,origin);
  } catch (error) {
    return response(500,{error:error instanceof Error?error.message:'Social inbox request failed.'},origin);
  }
});
