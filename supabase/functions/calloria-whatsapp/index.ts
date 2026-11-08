import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  classifyWhatsAppMessage, cleanText, getMetaInboundMessages, getServiceWindow,
  maskWhatsAppId, normalizeWhatsAppId, redactWhatsAppSummary, validateOutboundText, SUPPORTED_LANGUAGES
} from './whatsapp-engine.ts';

const env = (name: string) => Deno.env.get(name) || '';
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const origins = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean);
const metaVerifyToken = env('CALLORIA_META_WEBHOOK_VERIFY_TOKEN');
const metaAppSecret = env('CALLORIA_META_APP_SECRET');
const metaAccessToken = env('CALLORIA_META_ACCESS_TOKEN');
const metaPhoneNumberId = env('CALLORIA_META_PHONE_NUMBER_ID');
const metaGraphVersion = env('CALLORIA_META_GRAPH_API_VERSION');
const dataSecret = env('CALLORIA_WHATSAPP_DATA_KEY');
const lookupSecret = env('CALLORIA_WHATSAPP_LOOKUP_SECRET');
const agentDeskSecret = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const accessRaw = env('CALLORIA_ROUTING_ACCESS');
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONSENT_SOURCES = ['customer_message','customer_webform','recorded_call','signed_form','existing_consent_record'];
const STAFF_CHANNELS = ['voice','email','live_chat','social','whatsapp','website','portal','game','back_office'];
const STAFF_SKILLS = ['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
const STAFF_DEPARTMENTS = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
type Grant = { role:'agent'|'supervisor'|'people_admin'; departments:string[]; skills:string[]; channels:string[]; languages:string[]; maxConcurrency:number };
const accessMap: Record<string,Grant> = {};
let accessInvalid = false;
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid routing access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!UUID.test(userId) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid staff access entry.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.channels) || !row.channels.length || !Array.isArray(row.skills) || !row.skills.length || !Array.isArray(row.languages) || !row.languages.length) throw new Error('Incomplete staff access scope.');
    const departments = row.departments.map((item:unknown) => cleanText(item,120));
    const channels = row.channels.map((item:unknown) => cleanText(item,24));
    const skills = row.skills.map((item:unknown) => cleanText(item,40));
    const languages = row.languages.map((item:unknown) => cleanText(item,8));
    if (departments.some((item:string) => item !== '*' && !STAFF_DEPARTMENTS.includes(item))) throw new Error('Unknown department in staff access map.');
    if (channels.some((item:string) => !STAFF_CHANNELS.includes(item)) || skills.some((item:string) => !STAFF_SKILLS.includes(item)) || languages.some((item:string) => !SUPPORTED_LANGUAGES.includes(item as any))) throw new Error('Unknown channel, skill or language in staff access map.');
    if (!skills.includes('general_customer_care')) throw new Error('Every customer-facing CALLORIA employee must hold general_customer_care.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Agents require explicit department scopes.');
    accessMap[userId] = { role:row.role, departments, channels, skills, languages, maxConcurrency:Math.max(1,Math.min(10,Number(row.maxConcurrency)||1)) };
  }
} catch { accessInvalid = true; }

function json(status:number, body:Record<string,unknown>, origin:string|null = null) {
  const headers:Record<string,string> = { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' };
  if (origin && origins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}
function text(status:number, body:string) { return new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}); }
function safeEqual(a:string,b:string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function toHex(bytes:Uint8Array) { return Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join(''); }
function fromBase64(value:string) {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
function toBase64(bytes:Uint8Array) {
  let value=''; for (const byte of bytes) value += String.fromCharCode(byte); return btoa(value);
}
async function sha256(value:string) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))); }
async function hmacHex(secret:string,value:string) {
  if (encoder.encode(secret).length < 32) throw new Error('A required HMAC secret is missing or too short.');
  const key = await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));
}
async function verifyMetaSignature(raw:string,signature:string) {
  if (!metaAppSecret || !signature.startsWith('sha256=')) return false;
  const expected = `sha256=${await hmacHex(metaAppSecret,raw)}`;
  return safeEqual(expected.toLowerCase(),signature.toLowerCase());
}
async function deriveAesKey(secret:string,salt:string,info:string) {
  if (encoder.encode(secret).length < 32) throw new Error('A required encryption secret must contain at least 32 bytes.');
  const material = await crypto.subtle.importKey('raw',encoder.encode(secret),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode(salt),info:encoder.encode(info)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptWith(secret:string,salt:string,info:string,value:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const result=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deriveAesKey(secret,salt,info),encoder.encode(value));
  return {ciphertext:toBase64(new Uint8Array(result)),iv:toBase64(iv)};
}
async function decryptData(ciphertext:string,iv:string) {
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(iv)},await deriveAesKey(dataSecret,'CALLORIA-WHATSAPP-DATA-v1','message-and-contact-encryption'),fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
async function encryptData(value:string) {
  return encryptWith(dataSecret,'CALLORIA-WHATSAPP-DATA-v1','message-and-contact-encryption',value);
}
async function encryptAgentSummary(value:string) {
  return encryptWith(agentDeskSecret,'CALLORIA-AGENT-DESK-v1','interaction-summary-encryption',value);
}
function randomHex(bytes = 32) { return toHex(crypto.getRandomValues(new Uint8Array(bytes))); }
function createRouteRef() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  const suffix=Array.from(bytes,byte=>alphabet[byte%alphabet.length]).join('');
  const date=new Date().toISOString().slice(0,10).replaceAll('-','');
  return `CR-${date}-${suffix}`;
}
function hasDepartment(grant:Grant,department:string) { return grant.departments.includes('*') || grant.departments.includes(department); }
async function authenticate(request:Request,admin:any) {
  if (accessInvalid || !Object.keys(accessMap).length) return {error:'CALLORIA_ROUTING_ACCESS is not configured correctly.',status:503};
  const authorization=request.headers.get('Authorization')||'';
  const token=authorization.startsWith('Bearer ')?authorization.slice(7):'';
  if(!token) return {error:'Staff sign-in is required.',status:401};
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data?.user) return {error:'Staff session is invalid or expired.',status:401};
  const grant=accessMap[data.user.id];
  if(!grant) return {error:'This account is not on the CALLORIA routing staff access map.',status:403};
  if(grant.role==='people_admin') return {error:'People administrators do not have access to customer message content.',status:403};
  if(!grant.channels.includes('whatsapp')) return {error:'WhatsApp access is not included in this staff permission scope.',status:403};
  return {user:data.user,grant};
}
async function findPermittedConversation(admin:any,conversationId:string,user:any,grant:Grant) {
  if(!UUID.test(conversationId)) return {error:'Select a valid WhatsApp conversation.',status:400};
  const {data:conversation,error}=await admin.from('calloria_wa_conversations').select('*').eq('id',conversationId).maybeSingle();
  if(error) throw new Error('WhatsApp conversation could not be loaded.');
  if(!conversation) return {error:'WhatsApp conversation was not found.',status:404};
  const {data:route,error:routeError}=await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,channel').eq('route_ref',conversation.active_route_ref||'').maybeSingle();
  if(routeError || !route) return {error:'This conversation has no linked Contact Routing work item.',status:409};
  if(!hasDepartment(grant,route.department)) return {error:'This conversation is outside your permitted department scope.',status:403};
  if(grant.role==='agent' && route.assigned_to!==user.id) return {error:'Claim this request through Routing Control before opening its WhatsApp conversation.',status:403};
  return {conversation,route};
}
async function ensureRoute(admin:any,conversation:any,messageRow:any,contact:string,displayName:string,body:string,receivedAt:string) {
  if(messageRow.route_ref) return messageRow.route_ref;
  const classification=classifyWhatsAppMessage(body);
  const safeBody=redactWhatsAppSummary(body);
  const summary=redactWhatsAppSummary([
    `WhatsApp customer contact: +${contact}`,
    displayName ? `WhatsApp profile name: ${displayName}` : '',
    `Received at: ${receivedAt}`,
    `Customer message: ${safeBody}`,
    'Handling note: do not request passwords, PINs, OTPs, CVVs or API secrets. Respond only within the WhatsApp service window.'
  ].filter(Boolean).join('\n'));
  const encrypted=await encryptAgentSummary(summary);
  const routeRef=createRouteRef();
  const tokenHash=await sha256(randomHex(32));
  const {data,error}=await admin.rpc('calloria_wa_create_or_attach_route',{
    p_conversation_id:conversation.id,
    p_message_id:messageRow.id,
    p_route_ref:routeRef,
    p_department:classification.department,
    p_platform_id:classification.platformId,
    p_intent:classification.intent,
    p_language:classification.language || 'en',
    p_required_skills:[classification.skill],
    p_priority:classification.priority,
    p_subject:`WhatsApp · ${classification.intent.replaceAll('_',' ')}`.slice(0,140),
    p_summary_ciphertext:encrypted.ciphertext,
    p_summary_iv:encrypted.iv,
    p_access_token_hash:tokenHash
  });
  if(error||!data) throw new Error('The inbound message was stored, but CALLORIA could not create its Agent Desk work item. The webhook will retry.');
  return data;
}
async function recordMetaInbound(admin:any,message:any) {
  const contact=normalizeWhatsAppId(message.from);
  if(!contact) return;
  const lookup=await hmacHex(lookupSecret,contact);
  const contactEncrypted=await encryptData(contact);
  const nameEncrypted=message.displayName?await encryptData(message.displayName):null;
  const inboundAt=new Date(message.timestamp).toISOString();
  const {data:conversation,error:conversationError}=await admin.rpc('calloria_wa_upsert_conversation',{
    p_wa_id_hash:lookup,
    p_contact_ciphertext:contactEncrypted.ciphertext,
    p_contact_iv:contactEncrypted.iv,
    p_display_name_ciphertext:nameEncrypted?.ciphertext||null,
    p_display_name_iv:nameEncrypted?.iv||null,
    p_inbound_at:inboundAt
  });
  if(conversationError||!conversation) throw new Error('WhatsApp conversation storage is unavailable.');
  const body=cleanText(message.body,4096);
  const bodyEncrypted=await encryptData(body);
  let {data:messageRow,error:messageError}=await admin.from('calloria_wa_messages').select('*').eq('provider_message_id',message.providerMessageId).maybeSingle();
  if(messageError) throw new Error('WhatsApp message lookup failed.');
  if(!messageRow) {
    const inserted=await admin.from('calloria_wa_messages').insert({
      conversation_id:conversation.id,direction:'inbound',message_type:['text','image','video','audio','document','sticker','location','interactive','button'].includes(message.type)?message.type:'unknown',
      body_ciphertext:bodyEncrypted.ciphertext,body_iv:bodyEncrypted.iv,provider_message_id:message.providerMessageId,
      provider_status:'received',provider_timestamp:inboundAt
    }).select('*').single();
    if(inserted.error||!inserted.data) {
      // A concurrent delivery may have won the unique provider-message insert.
      const reread=await admin.from('calloria_wa_messages').select('*').eq('provider_message_id',message.providerMessageId).maybeSingle();
      if(reread.error||!reread.data) throw new Error('WhatsApp message could not be stored.');
      messageRow=reread.data;
    } else messageRow=inserted.data;
  }
  const normalized = body.trim().toLowerCase().replace(/[.!\s]+$/g,'');
  const optOutCommand=['stop','stop all','unsubscribe','cancel','end','quit','stop messages','do not message me','remove me'].includes(normalized);
  const resumeCommand=['start','unstop','resume messages'].includes(normalized);
  if(optOutCommand) {
    await admin.from('calloria_wa_conversations').update({messaging_opt_out:true,messaging_opt_out_at:new Date().toISOString(),marketing_consent:false,marketing_consent_at:null,marketing_consent_by:null,marketing_consent_source:null,marketing_consent_evidence_ref:null,service_followup_consent:false,service_followup_consent_at:null,service_followup_consent_by:null,service_followup_consent_source:null,service_followup_consent_evidence_ref:null}).eq('id',conversation.id);
  } else if(resumeCommand) {
    // A fresh customer-initiated START permits service replies again, but does not
    // restore marketing or post-window follow-up consent.
    await admin.from('calloria_wa_conversations').update({messaging_opt_out:false,messaging_opt_out_at:null}).eq('id',conversation.id);
  }
  // STOP/START are messaging-control instructions, not customer-service tickets.
  if(!optOutCommand&&!resumeCommand&&!messageRow.route_ref) await ensureRoute(admin,conversation,messageRow,contact,message.displayName,body,inboundAt);
}
async function recordMetaStatus(admin:any,status:any) {
  const mapping:Record<string,string>={sent:'sent',delivered:'delivered',read:'read',failed:'failed'};
  const next=mapping[status.status];
  if(!next) return;
  const {data:existing,error}=await admin.from('calloria_wa_messages').select('id,provider_status').eq('provider_message_id',status.providerMessageId).maybeSingle();
  if(error||!existing) return;
  const rank=(value:string)=>({received:0,sending:1,sent:2,delivered:3,read:4,failed:5,unknown:1}[value]??0);
  if(rank(existing.provider_status)>=rank(next)) return;
  await admin.from('calloria_wa_messages').update({provider_status:next,provider_error_code:next==='failed'?status.errorCode||'provider_error':null}).eq('id',existing.id);
}
async function processWebhook(admin:any,payload:any) {
  if(!metaPhoneNumberId) throw new Error('The Meta phone-number ID is not configured.');
  // A Meta app may be subscribed to more than one WhatsApp Business number.
  // Process only events for the single configured CALLORIA sender number.
  const matchingEntries=(Array.isArray(payload?.entry)?payload.entry:[]).map((entry:any)=>({
    ...entry,
    changes:(Array.isArray(entry?.changes)?entry.changes:[]).filter((change:any)=>change?.field==='messages' && String(change?.value?.metadata?.phone_number_id||'')===metaPhoneNumberId)
  })).filter((entry:any)=>entry.changes.length);
  const extracted=getMetaInboundMessages({...payload,entry:matchingEntries});
  for(const message of extracted.messages) {
    const key=`meta:message:${message.providerMessageId}`;
    await admin.from('calloria_wa_webhook_events').upsert({provider_event_id:key,event_kind:'inbound_message',outcome:'received'},{onConflict:'provider_event_id',ignoreDuplicates:true});
    await recordMetaInbound(admin,message);
    await admin.from('calloria_wa_webhook_events').update({processed_at:new Date().toISOString(),outcome:'processed'}).eq('provider_event_id',key);
  }
  for(const status of extracted.statuses) {
    const key=`meta:status:${status.providerMessageId}:${status.status}:${status.timestamp}`;
    await admin.from('calloria_wa_webhook_events').upsert({provider_event_id:key,event_kind:'delivery_status',outcome:'received'},{onConflict:'provider_event_id',ignoreDuplicates:true});
    await recordMetaStatus(admin,status);
    await admin.from('calloria_wa_webhook_events').update({processed_at:new Date().toISOString(),outcome:'processed'}).eq('provider_event_id',key);
  }
}
async function handleGetWebhook(request:Request) {
  const url=new URL(request.url);
  const mode=url.searchParams.get('hub.mode')||'';
  const token=url.searchParams.get('hub.verify_token')||'';
  const challenge=url.searchParams.get('hub.challenge')||'';
  if(mode==='subscribe' && metaVerifyToken && safeEqual(token,metaVerifyToken) && challenge.length<=256) return text(200,challenge);
  return text(403,'Webhook verification failed.');
}
async function sendText(admin:any,user:any,grant:Grant,body:any) {
  if(!metaAccessToken||!metaPhoneNumberId||!/^v\d{2,3}\.0$/.test(metaGraphVersion)) return {status:503,error:'Meta WhatsApp Cloud API sending is not configured.'};
  const permission=await findPermittedConversation(admin,cleanText(body.conversationId,64),user,grant);
  if('error' in permission) return permission;
  const {conversation,route}=permission;
  if(route.status!=='assigned' || (route.assigned_to!==user.id && grant.role!=='supervisor')) return {status:409,error:'This WhatsApp conversation must be assigned in Contact Routing before replying.'};
  if(conversation.messaging_opt_out) return {status:403,error:'The customer opted out of WhatsApp messages. No message was sent.'};
  const windowState=getServiceWindow(conversation.last_inbound_at,Date.now());
  if(!windowState.open) return {status:409,error:'The 24-hour WhatsApp customer-service window is closed. Free-form replies are blocked; a separately approved template workflow is not included in this phase.'};
  const validated=validateOutboundText(body.text);
  if(!validated.valid) return {status:400,error:validated.error};
  const bucket=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  const {data:allowed,error:limitError}=await admin.rpc('calloria_wa_consume_send_limit',{p_staff_user_id:user.id,p_bucket_start:bucket,p_limit:30});
  if(limitError) throw new Error('WhatsApp send protection is temporarily unavailable.');
  if(allowed!==true) return {status:429,error:'The staff account reached its WhatsApp send limit. Wait one minute before sending again.'};
  const contact=await decryptData(conversation.contact_ciphertext,conversation.contact_iv);
  const encrypted=await encryptData(validated.body);
  const {data:messageRow,error:insertError}=await admin.from('calloria_wa_messages').insert({
    conversation_id:conversation.id,direction:'outbound',message_type:'text',body_ciphertext:encrypted.ciphertext,body_iv:encrypted.iv,
    provider_status:'sending',route_ref:route.route_ref,sent_by:user.id
  }).select('id').single();
  if(insertError||!messageRow) throw new Error('The outbound message could not be safely queued.');
  let providerResponse:any=null;
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    const response=await fetch(`https://graph.facebook.com/${metaGraphVersion}/${metaPhoneNumberId}/messages`,{
      method:'POST',signal:controller.signal,
      headers:{Authorization:`Bearer ${metaAccessToken}`,'Content-Type':'application/json'},
      body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:contact,type:'text',text:{preview_url:false,body:validated.body}})
    });
    clearTimeout(timeout);
    providerResponse=await response.json().catch(()=>({}));
    if(!response.ok) {
      await admin.from('calloria_wa_messages').update({provider_status:'failed',provider_error_code:cleanText(providerResponse?.error?.code||'provider_rejected',40)}).eq('id',messageRow.id);
      return {status:502,error:'Meta did not accept the WhatsApp message. Check the provider error details in Meta Business Manager; no automatic retry was attempted.'};
    }
  } catch {
    // Network timeout is ambiguous: Meta may have accepted the message. Mark it
    // unknown so an agent cannot accidentally send a duplicate by retrying.
    await admin.from('calloria_wa_messages').update({provider_status:'unknown',provider_error_code:'provider_result_unknown'}).eq('id',messageRow.id);
    return {status:504,error:'The provider response was not confirmed. The message is marked unknown; check the Meta conversation before sending again.'};
  }
  const providerMessageId=cleanText(providerResponse?.messages?.[0]?.id,180);
  if(!providerMessageId) {
    await admin.from('calloria_wa_messages').update({provider_status:'unknown',provider_error_code:'provider_message_id_missing'}).eq('id',messageRow.id);
    return {status:502,error:'Meta returned no message identifier. The send result is marked unknown; check the provider conversation before retrying.'};
  }
  await admin.from('calloria_wa_messages').update({provider_status:'sent',provider_message_id:providerMessageId}).eq('id',messageRow.id);
  return {status:200,data:{sent:true,messageId:messageRow.id,providerMessageId}};
}

Deno.serve(async request => {
  if(request.method==='GET') return await handleGetWebhook(request);
  if(request.method==='POST' && request.headers.has('x-hub-signature-256')) {
    if(!supabaseUrl||!serviceKey||!metaAppSecret||!metaPhoneNumberId||!lookupSecret||!dataSecret||!agentDeskSecret) return text(503,'WhatsApp webhook configuration is incomplete.');
    const declared=Number(request.headers.get('content-length')||0);
    if(declared>1024*1024) return text(413,'Webhook body is too large.');
    const raw=await request.text();
    if(raw.length>1024*1024) return text(413,'Webhook body is too large.');
    try {
      if(!await verifyMetaSignature(raw,request.headers.get('x-hub-signature-256')||'')) return text(401,'Invalid webhook signature.');
      const payload=JSON.parse(raw);
      const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
      await processWebhook(admin,payload);
      return text(200,'EVENT_RECEIVED');
    } catch(error) {
      return text(500,error instanceof Error?cleanText(error.message,240):'Webhook processing failed.');
    }
  }
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS') return origins.includes(origin||'') ? new Response('ok',{headers:{'Access-Control-Allow-Origin':origin!,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}}) : json(403,{error:'Origin not permitted.'});
  if(request.method!=='POST') return json(405,{error:'Only GET webhooks and POST staff actions are supported.'});
  if(!origin||!origins.includes(origin)) return json(403,{error:'Origin not permitted.'});
  if(!supabaseUrl||!serviceKey) return json(503,{error:'WhatsApp storage is not configured.'},origin);
  if(Number(request.headers.get('content-length')||0)>12000) return json(413,{error:'Request is too large.'},origin);
  try {
    const raw=await request.text(); if(raw.length>12000) return json(413,{error:'Request is too large.'},origin);
    const body=JSON.parse(raw);
    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const auth=await authenticate(request,admin);
    if('error' in auth) return json(auth.status,{error:auth.error},origin);
    const user=auth.user; const grant=auth.grant as Grant; const action=cleanText(body.action,40);
    if(action==='whoami') return json(200,{access:{role:grant.role,departments:grant.departments,channels:grant.channels},provider:{webhookReady:!!(metaVerifyToken&&metaAppSecret&&metaPhoneNumberId&&lookupSecret&&dataSecret&&agentDeskSecret),outboundReady:!!(metaAccessToken&&metaPhoneNumberId&&/^v\d{2,3}\.0$/.test(metaGraphVersion)),dataProtectionReady:!!(lookupSecret&&dataSecret&&agentDeskSecret)}},origin);
    if(action==='inbox') {
      const {data:rows,error}=await admin.from('calloria_wa_conversations').select('id,last_inbound_at,service_window_expires_at,active_route_ref,messaging_opt_out,marketing_consent,service_followup_consent,display_name_ciphertext,display_name_iv,contact_ciphertext,contact_iv,updated_at').order('last_inbound_at',{ascending:false,nullsFirst:false}).limit(100);
      if(error) throw new Error('WhatsApp inbox could not be loaded.');
      const references=(rows||[]).map((row:any)=>row.active_route_ref).filter(Boolean);
      const {data:routes,error:routeError}=references.length?await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,created_at').in('route_ref',references):{data:[],error:null};
      if(routeError) throw new Error('Conversation permission scopes could not be checked.');
      const routeMap=new Map<string,any>((routes||[]).map((row:any)=>[row.route_ref,row] as [string,any]));
      const permitted=[];
      for(const row of rows||[]) {
        const route=routeMap.get(row.active_route_ref);
        if(!route||!hasDepartment(grant,route.department)) continue;
        if(grant.role==='agent' && route.assigned_to!==user.id) continue;
        const displayName=row.display_name_ciphertext?await decryptData(row.display_name_ciphertext,row.display_name_iv):'';
        const contact=await decryptData(row.contact_ciphertext,row.contact_iv);
        const {data:latest}=await admin.from('calloria_wa_messages').select('direction,body_ciphertext,body_iv,provider_status,created_at').eq('conversation_id',row.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        const latestBody=latest?await decryptData(latest.body_ciphertext,latest.body_iv):'';
        permitted.push({id:row.id,routeRef:row.active_route_ref,department:route.department,routeStatus:route.status,priority:route.priority,displayName:displayName||'WhatsApp customer',maskedContact:maskWhatsAppId(contact),lastInboundAt:row.last_inbound_at,serviceWindowExpiresAt:row.service_window_expires_at,windowOpen:getServiceWindow(row.last_inbound_at).open,messagingOptOut:row.messaging_opt_out,marketingConsent:row.marketing_consent,serviceFollowupConsent:row.service_followup_consent,lastMessage:latestBody.slice(0,180),lastDirection:latest?.direction||'inbound',updatedAt:row.updated_at});
      }
      return json(200,{conversations:permitted},origin);
    }
    if(action==='conversation') {
      const permission=await findPermittedConversation(admin,cleanText(body.conversationId,64),user,grant);
      if('error' in permission) return json(permission.status,{error:permission.error},origin);
      const {conversation,route}=permission;
      const {data:messages,error}=await admin.from('calloria_wa_messages').select('id,direction,message_type,body_ciphertext,body_iv,provider_status,provider_error_code,provider_timestamp,created_at,sent_by').eq('conversation_id',conversation.id).order('created_at',{ascending:true}).limit(100);
      if(error) throw new Error('WhatsApp message history could not be loaded.');
      const decoded=[];
      for(const row of messages||[]) decoded.push({id:row.id,direction:row.direction,type:row.message_type,body:await decryptData(row.body_ciphertext,row.body_iv),status:row.provider_status,errorCode:row.provider_error_code,createdAt:row.created_at,sentBy:row.sent_by===user.id?'You':'Staff'});
      const contact=await decryptData(conversation.contact_ciphertext,conversation.contact_iv);
      const name=conversation.display_name_ciphertext?await decryptData(conversation.display_name_ciphertext,conversation.display_name_iv):'';
      return json(200,{conversation:{id:conversation.id,routeRef:route.route_ref,department:route.department,routeStatus:route.status,assignedTo:route.assigned_to,displayName:name||'WhatsApp customer',maskedContact:maskWhatsAppId(contact),lastInboundAt:conversation.last_inbound_at,serviceWindow:getServiceWindow(conversation.last_inbound_at),messagingOptOut:conversation.messaging_opt_out,marketingConsent:conversation.marketing_consent,serviceFollowupConsent:conversation.service_followup_consent},messages:decoded},origin);
    }
    if(action==='send_text') {
      const result=await sendText(admin,user,grant,body);
      if('data' in result) return json(result.status,result.data as Record<string,unknown>,origin);
      return json(result.status,{error:result.error||'WhatsApp send failed.'},origin);
    }
    if(action==='record_consent') {
      const permission=await findPermittedConversation(admin,cleanText(body.conversationId,64),user,grant);
      if('error' in permission) return json(permission.status,{error:permission.error},origin);
      const kind=cleanText(body.kind,32); const consent=body.consent===true; const source=cleanText(body.source,40);
      if(!['marketing','service_followup'].includes(kind)) return json(400,{error:'Select a supported consent category.'},origin);
      const evidenceRef=cleanText(body.evidenceRef,160);
      if(consent&&!CONSENT_SOURCES.includes(source)) return json(400,{error:'Opt-in requires a permitted evidence source.'},origin);
      if(consent&&evidenceRef.length<3) return json(400,{error:'A non-sensitive evidence reference (such as a form, CRM or case reference) is required.'},origin);
      if(consent&&permission.conversation.messaging_opt_out) return json(409,{error:'The customer has opted out. A fresh customer-initiated START instruction is required before recording new messaging permission.'},origin);
      const columns=kind==='marketing'
        ? {marketing_consent:consent,marketing_consent_at:consent?new Date().toISOString():null,marketing_consent_by:consent?user.id:null,marketing_consent_source:consent?source:null,marketing_consent_evidence_ref:consent?evidenceRef:null,updated_at:new Date().toISOString()}
        : {service_followup_consent:consent,service_followup_consent_at:consent?new Date().toISOString():null,service_followup_consent_by:consent?user.id:null,service_followup_consent_source:consent?source:null,service_followup_consent_evidence_ref:consent?evidenceRef:null,updated_at:new Date().toISOString()};
      const {error}=await admin.from('calloria_wa_conversations').update(columns).eq('id',permission.conversation.id);
      if(error) throw new Error('Consent status could not be saved.');
      return json(200,{saved:true,kind,consent},origin);
    }
    return json(400,{error:'Unsupported WhatsApp action.'},origin);
  } catch(error) {
    return json(500,{error:error instanceof Error?cleanText(error.message,240):'WhatsApp operation failed.'},origin);
  }
});
