import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  chooseThreadRoot, classifyEmailMessage, cleanEmailText, extractMessageReferences,
  getPlainEmailBody, maskEmailAddress, normalizeEmailAddress, normalizeEmailSubject,
  parseMailbox, redactEmailSummary, safeMessageId, validateOutboundEmail, verifySvixSignature
} from './email-engine.ts';

const env = (name:string) => Deno.env.get(name) || '';
const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const ORIGINS = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v=>v.trim()).filter(Boolean);
const RESEND_API_KEY = env('RESEND_API_KEY');
const RESEND_WEBHOOK_SECRET = env('RESEND_WEBHOOK_SECRET');
const EMAIL_FROM = env('CALLORIA_EMAIL_FROM');
const EMAIL_REPLY_TO = env('CALLORIA_EMAIL_REPLY_TO');
const INBOUND_ADDRESSES = env('CALLORIA_EMAIL_INBOUND_ADDRESSES').split(',').map(normalizeEmailAddress).filter(Boolean) as string[];
const DATA_SECRET = env('CALLORIA_EMAIL_DATA_KEY');
const LOOKUP_SECRET = env('CALLORIA_EMAIL_LOOKUP_SECRET');
const AGENT_DESK_SECRET = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const ACCESS_RAW = env('CALLORIA_ROUTING_ACCESS');
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_DEPARTMENTS = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const STAFF_CHANNELS = ['voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'];
const STAFF_SKILLS = ['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
type Grant = { role:'agent'|'supervisor'|'people_admin'; departments:string[]; skills:string[]; channels:string[]; languages:string[]; maxConcurrency:number };
const accessMap:Record<string,Grant> = {};
let accessInvalid = false;
try {
  const parsed = ACCESS_RAW ? JSON.parse(ACCESS_RAW) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid routing access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!UUID.test(userId) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid staff access entry.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.channels) || !row.channels.length || !Array.isArray(row.skills) || !row.skills.length || !Array.isArray(row.languages) || !row.languages.length) throw new Error('Incomplete staff access scope.');
    const departments = row.departments.map((v:unknown)=>cleanEmailText(v,120));
    const channels = row.channels.map((v:unknown)=>cleanEmailText(v,24));
    const skills = row.skills.map((v:unknown)=>cleanEmailText(v,40));
    const languages = row.languages.map((v:unknown)=>cleanEmailText(v,8));
    if (departments.some((v:string)=>v!=='*'&&!EMAIL_DEPARTMENTS.includes(v))) throw new Error('Unknown department in staff access map.');
    if (channels.some((v:string)=>!STAFF_CHANNELS.includes(v)) || skills.some((v:string)=>!STAFF_SKILLS.includes(v)) || languages.some((v:string)=>!['en','ha','yo','ig','pcm'].includes(v))) throw new Error('Unknown channel, skill or language.');
    if (!skills.includes('general_customer_care')) throw new Error('Every customer-facing employee must hold general_customer_care.');
    if (row.role==='agent' && departments.includes('*')) throw new Error('Agents require explicit department scopes.');
    accessMap[userId] = { role:row.role, departments, channels, skills, languages, maxConcurrency:Math.max(1,Math.min(10,Number(row.maxConcurrency)||1)) };
  }
} catch { accessInvalid = true; }

function json(status:number, body:Record<string,unknown>, origin:string|null=null) {
  const headers:Record<string,string> = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if (origin && ORIGINS.includes(origin)) {
    headers['Access-Control-Allow-Origin']=origin;
    headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods']='POST, OPTIONS'; headers['Vary']='Origin';
  }
  return new Response(JSON.stringify(body),{status,headers});
}
function plain(status:number, body:string) { return new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}}); }
function safeEqual(a:string,b:string) { if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0; }
function toHex(bytes:Uint8Array) { return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''); }
function fromBase64(value:string) { const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0)); }
function toBase64(bytes:Uint8Array) { let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s); }
function randomHex(bytes=32) { return toHex(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256(value:string) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))); }
async function hmacHex(secret:string,value:string) {
  if(encoder.encode(secret).length<32)throw new Error('CALLORIA email lookup secret is missing or too short.');
  const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));
}
async function deriveAesKey(secret:string,salt:string,info:string) {
  if(encoder.encode(secret).length<32)throw new Error('A required CALLORIA email encryption secret is missing or too short.');
  const material=await crypto.subtle.importKey('raw',encoder.encode(secret),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode(salt),info:encoder.encode(info)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encryptWith(secret:string,salt:string,info:string,value:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await deriveAesKey(secret,salt,info),encoder.encode(value));
  return {ciphertext:toBase64(new Uint8Array(cipher)),iv:toBase64(iv)};
}
async function encryptData(value:string) { return encryptWith(DATA_SECRET,'CALLORIA-EMAIL-DATA-v1','encrypted-email-contact-and-message',value); }
async function decryptData(ciphertext:string,iv:string) {
  const result=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(iv)},await deriveAesKey(DATA_SECRET,'CALLORIA-EMAIL-DATA-v1','encrypted-email-contact-and-message'),fromBase64(ciphertext));
  return new TextDecoder().decode(result);
}
async function encryptAgentSummary(value:string) { return encryptWith(AGENT_DESK_SECRET,'CALLORIA-AGENT-DESK-v1','interaction-summary-encryption',value); }
function routeRef() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const bytes=crypto.getRandomValues(new Uint8Array(6));
  const suffix=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  return `CR-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${suffix}`;
}
function hasDepartment(grant:Grant,department:string) { return grant.departments.includes('*')||grant.departments.includes(department); }
async function authenticate(request:Request,admin:any) {
  if(accessInvalid||!Object.keys(accessMap).length)return {error:'CALLORIA_ROUTING_ACCESS is not configured correctly.',status:503};
  const auth=request.headers.get('Authorization')||'';const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  if(!token)return {error:'Staff sign-in is required.',status:401};
  const {data,error}=await admin.auth.getUser(token);
  if(error||!data?.user)return {error:'Staff session is invalid or expired.',status:401};
  const grant=accessMap[data.user.id];
  if(!grant)return {error:'This account is not on the CALLORIA routing staff access map.',status:403};
  if(grant.role==='people_admin')return {error:'People administrators do not have access to customer message content.',status:403};
  if(!grant.channels.includes('email'))return {error:'Email access is not included in this staff permission scope.',status:403};
  return {user:data.user,grant};
}
async function findPermittedThread(admin:any,threadId:string,user:any,grant:Grant) {
  if(!UUID.test(threadId))return {error:'Select a valid email thread.',status:400};
  const {data:thread,error}=await admin.from('calloria_email_threads').select('*').eq('id',threadId).maybeSingle();
  if(error)throw new Error('Email thread could not be loaded.');
  if(!thread)return {error:'Email thread was not found.',status:404};
  const {data:route,error:routeError}=await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,channel').eq('route_ref',thread.active_route_ref||'').maybeSingle();
  if(routeError||!route||route.channel!=='email')return {error:'This email thread has no valid Email Contact Routing work item.',status:409};
  if(!hasDepartment(grant,route.department))return {error:'This email thread is outside your permitted department scope.',status:403};
  if(grant.role==='agent'&&route.assigned_to!==user.id)return {error:'Claim this request through Routing Control before opening the email thread.',status:403};
  return {thread,route};
}
async function fetchReceivedEmail(emailId:string) {
  if(!RESEND_API_KEY)throw new Error('Resend API access is not configured.');
  const response=await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,{headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'}});
  const result=await response.json().catch(()=>({}));
  const email=result?.data&&typeof result.data==='object'?result.data:result;
  if(!response.ok||!email||typeof email!=='object'||!email.id)throw new Error(`Resend could not return the received email (HTTP ${response.status}).`);
  return email;
}
async function fetchSentMessageId(emailId:string) {
  try {
    const response=await fetch(`https://api.resend.com/emails/${encodeURIComponent(emailId)}`,{headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'}});
    if(!response.ok)return null;
    const result=await response.json().catch(()=>({}));
    const email=result?.data&&typeof result.data==='object'?result.data:result;
    return safeMessageId(email?.message_id||'');
  } catch { return null; }
}
async function ensureRoute(admin:any,thread:any,message:any,recipient:string,subject:string,body:string,receivedAt:string) {
  if(message.route_ref)return message.route_ref;
  const classification=classifyEmailMessage(subject,body,recipient);
  const safeBody=redactEmailSummary(body);
  const summary=redactEmailSummary([
    `Channel: Email`,
    `Received: ${receivedAt}`,
    `Customer subject: ${cleanEmailText(subject,140)}`,
    `Customer message: ${safeBody}`,
    'Handling note: verify identity before discussing account-specific information. Never request passwords, PINs, OTPs, CVVs or API secrets. Replies are human-authorised and transactional only.'
  ].join('\n'));
  const encrypted=await encryptAgentSummary(summary);
  const tokenHash=await sha256(randomHex(32));
  const {data,error}=await admin.rpc('calloria_email_create_or_attach_route',{
    p_thread_id:thread.id,p_message_id:message.id,p_route_ref:routeRef(),p_department:classification.department,
    p_platform_id:classification.platformId,p_intent:classification.intent,p_language:classification.language,
    p_required_skills:[classification.skill],p_priority:classification.priority,p_subject:`Email · ${classification.intent.replaceAll('_',' ')}`.slice(0,140),
    p_summary_ciphertext:encrypted.ciphertext,p_summary_iv:encrypted.iv,p_access_token_hash:tokenHash
  });
  if(error||!data)throw new Error('The inbound email was stored, but CALLORIA could not create its Agent Desk route. Resend will retry the webhook.');
  return data;
}
async function processInbound(admin:any,event:any) {
  const meta=event?.data||{};
  const emailId=cleanEmailText(meta.email_id,140);
  if(!/^[A-Za-z0-9_-]{8,140}$/.test(emailId))throw new Error('The Resend event has no valid email ID.');
  const email=await fetchReceivedEmail(emailId);
  const sender=parseMailbox(email.from||meta.from);
  if(!sender)throw new Error('The inbound email sender address is invalid.');
  const toValues=Array.isArray(email.to)?email.to:(Array.isArray(meta.to)?meta.to:[]);
  const destinations=toValues.map((value:any)=>parseMailbox(value)?.address).filter(Boolean) as string[];
  const matchedRecipient=destinations.find(address=>INBOUND_ADDRESSES.includes(address));
  if(!matchedRecipient)throw new Error('The email was not addressed to a configured CALLORIA support inbox.');
  const subject=cleanEmailText(email.subject||meta.subject||'(No subject)',180).replace(/[\r\n]+/g,' ');
  const body=getPlainEmailBody(email)||'[The email contained no readable plain-text content.]';
  const receivedAt=String(email.created_at||meta.created_at||event.created_at||new Date().toISOString());
  const parsedHeaders=extractMessageReferences(email.headers||{});
  const messageId=safeMessageId(email.message_id||meta.message_id||parsedHeaders.messageId||'');
  const headerIds={...parsedHeaders,messageId:messageId||parsedHeaders.messageId};
  const root=chooseThreadRoot(headerIds,emailId);
  const senderHash=await hmacHex(LOOKUP_SECRET,sender.address);
  const correlationIds=[...new Set([...(headerIds.references||[]),headerIds.inReplyTo,headerIds.messageId].filter(Boolean) as string[])];
  let threadHash:string|null=null;
  for(const referenceId of correlationIds) {
    const {data:matching,error:matchError}=await admin.from('calloria_email_threads').select('thread_hash').eq('sender_hash',senderHash).contains('reference_ids',[referenceId]).limit(1).maybeSingle();
    if(matchError)throw new Error('Email thread correlation lookup failed.');
    if(matching?.thread_hash) { threadHash=matching.thread_hash;break; }
  }
  if(!threadHash)threadHash=await hmacHex(LOOKUP_SECRET,`${sender.address}|${root}`);
  const encryptedSender=await encryptData(sender.address);
  const encryptedName=sender.displayName?await encryptData(sender.displayName):null;
  const encryptedSubject=await encryptData(subject);
  const upsert=await admin.rpc('calloria_email_upsert_thread',{
    p_thread_hash:threadHash,p_sender_hash:senderHash,p_sender_ciphertext:encryptedSender.ciphertext,p_sender_iv:encryptedSender.iv,
    p_display_name_ciphertext:encryptedName?.ciphertext||null,p_display_name_iv:encryptedName?.iv||null,
    p_subject_ciphertext:encryptedSubject.ciphertext,p_subject_iv:encryptedSubject.iv,p_received_at:receivedAt,
    p_latest_message_id:messageId,p_reference_ids:[...new Set([...(headerIds.references||[]),...(headerIds.inReplyTo?[headerIds.inReplyTo]:[]),...(messageId?[messageId]:[])])].slice(-20)
  });
  if(upsert.error||!upsert.data)throw new Error('Email thread storage is unavailable.');
  const thread=upsert.data;
  const existing=await admin.from('calloria_email_messages').select('*').eq('provider_email_id',emailId).maybeSingle();
  if(existing.error)throw new Error('Email message lookup failed.');
  let message=existing.data;
  if(!message) {
    const encryptedBody=await encryptData(body);
    const attachmentMetadata=Array.isArray(email.attachments)?email.attachments:(Array.isArray(meta.attachments)?meta.attachments:[]);
    const encryptedAttachments=attachmentMetadata.length?await encryptData(JSON.stringify(attachmentMetadata.slice(0,20).map((a:any)=>({filename:cleanEmailText(a.filename,180),contentType:cleanEmailText(a.content_type||a.contentType,100),size:Number(a.size)||null})))):null;
    const inserted=await admin.from('calloria_email_messages').insert({
      thread_id:thread.id,provider_email_id:emailId,direction:'inbound',subject_ciphertext:encryptedSubject.ciphertext,subject_iv:encryptedSubject.iv,
      body_ciphertext:encryptedBody.ciphertext,body_iv:encryptedBody.iv,attachments_ciphertext:encryptedAttachments?.ciphertext||null,
      attachments_iv:encryptedAttachments?.iv||null,provider_message_id:messageId,in_reply_to_id:headerIds.inReplyTo,
      reference_ids:headerIds.references||[],provider_status:'received'
    }).select('*').single();
    if(inserted.error||!inserted.data) {
      const reread=await admin.from('calloria_email_messages').select('*').eq('provider_email_id',emailId).maybeSingle();
      if(reread.error||!reread.data)throw new Error('Inbound email could not be stored.');
      message=reread.data;
    } else message=inserted.data;
  }
  if(!message.route_ref)await ensureRoute(admin,thread,message,matchedRecipient,subject,body,receivedAt);
}
async function webhook(admin:any,request:Request) {
  const raw=await request.text();
  if(raw.length>1024*1024)return plain(413,'Webhook payload too large.');
  const valid=await verifySvixSignature({
    secret:RESEND_WEBHOOK_SECRET,id:request.headers.get('svix-id'),timestamp:request.headers.get('svix-timestamp'),
    signature:request.headers.get('svix-signature'),payload:raw
  });
  if(!valid)return plain(401,'Invalid Resend webhook signature.');
  let event:any;
  try { event=JSON.parse(raw); } catch { return plain(400,'Invalid JSON payload.'); }
  const eventId=cleanEmailText(request.headers.get('svix-id'),200);
  if(!eventId)return plain(400,'Missing webhook event ID.');
  const {error:claimError}=await admin.from('calloria_email_webhook_events').upsert({provider_event_id:eventId,event_kind:cleanEmailText(event.type,80),outcome:'received'},{onConflict:'provider_event_id',ignoreDuplicates:true});
  if(claimError)throw new Error('Email webhook idempotency storage is unavailable.');
  const {data:prior}=await admin.from('calloria_email_webhook_events').select('outcome').eq('provider_event_id',eventId).maybeSingle();
  if(prior?.outcome==='processed'||prior?.outcome==='ignored')return plain(200,'EVENT_ALREADY_RECEIVED');
  try {
    if(event.type==='email.received')await processInbound(admin,event);
    else {
      await admin.from('calloria_email_webhook_events').update({outcome:'ignored',processed_at:new Date().toISOString()}).eq('provider_event_id',eventId);
      return plain(200,'EVENT_IGNORED');
    }
    await admin.from('calloria_email_webhook_events').update({outcome:'processed',processed_at:new Date().toISOString()}).eq('provider_event_id',eventId);
    return plain(200,'EVENT_RECEIVED');
  } catch(error) {
    await admin.from('calloria_email_webhook_events').update({outcome:'failed'}).eq('provider_event_id',eventId);
    throw error;
  }
}
async function sendReply(admin:any,user:any,grant:Grant,body:any) {
  if(!RESEND_API_KEY||!EMAIL_FROM)return {status:503,error:'Resend outbound email is not configured.'};
  if(!/^[^<>\r\n]+<[^<>\s]+@[^<>\s]+>$/.test(EMAIL_FROM.trim())&&!normalizeEmailAddress(EMAIL_FROM))return {status:503,error:'CALLORIA_EMAIL_FROM must be a verified sender address or display-name mailbox.'};
  const replyTo=EMAIL_REPLY_TO?parseMailbox(EMAIL_REPLY_TO)?.address:null;
  if(EMAIL_REPLY_TO&&!replyTo)return {status:503,error:'CALLORIA_EMAIL_REPLY_TO is not a valid mailbox address.'};
  const permission=await findPermittedThread(admin,cleanEmailText(body.threadId,64),user,grant);
  if('error' in permission)return permission;
  const {thread,route}=permission;
  const {data:uncertain,error:uncertainError}=await admin.from('calloria_email_messages').select('id,provider_status,created_at').eq('thread_id',thread.id).eq('direction','outbound').in('provider_status',['sending','unknown']).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(uncertainError)throw new Error('Previous email send status could not be checked.');
  if(uncertain)return {status:409,error:'A previous reply has an ambiguous provider result. Check the Resend email log and recipient thread before sending anything else. CALLORIA will not retry it automatically.'};
  if(route.status!=='assigned'||(route.assigned_to!==user.id&&grant.role!=='supervisor'))return {status:409,error:'The email route must be assigned before replying.'};
  const validated=validateOutboundEmail(body.subject||'Re: Customer enquiry',body.text);
  if(!validated.valid)return {status:400,error:validated.error};
  if(!thread.latest_inbound_at||Date.parse(thread.latest_inbound_at)>Date.now()+5*60*1000)return {status:409,error:'The latest customer message timestamp is invalid.'};
  const bucket=new Date(Math.floor(Date.now()/60000)*60000).toISOString();
  const {data:allowed,error:limitError}=await admin.rpc('calloria_email_consume_send_limit',{p_staff_user_id:user.id,p_bucket_start:bucket,p_limit:20});
  if(limitError)throw new Error('Email send protection is temporarily unavailable.');
  if(allowed!==true)return {status:429,error:'This staff account reached its email send limit. Wait one minute before sending again.'};
  const recipient=await decryptData(thread.sender_ciphertext,thread.sender_iv);
  const encryptedSubject=await encryptData(validated.subject);
  const encryptedBody=await encryptData(validated.body);
  const localId=`calloria-send-${crypto.randomUUID()}`;
  const inserted=await admin.from('calloria_email_messages').insert({
    thread_id:thread.id,provider_email_id:localId,direction:'outbound',subject_ciphertext:encryptedSubject.ciphertext,subject_iv:encryptedSubject.iv,
    body_ciphertext:encryptedBody.ciphertext,body_iv:encryptedBody.iv,provider_status:'sending',route_ref:route.route_ref,sent_by:user.id,
    in_reply_to_id:thread.latest_message_id,reference_ids:thread.reference_ids||[]
  }).select('id').single();
  if(inserted.error||!inserted.data)throw new Error('Outbound email could not be safely recorded before sending.');
  const references=[...new Set([...(thread.reference_ids||[]),...(thread.latest_message_id?[thread.latest_message_id]:[])])].slice(-20);
  const headers:Record<string,string>={'X-Calloria-Route-Ref':route.route_ref};
  if(thread.latest_message_id)headers['In-Reply-To']=thread.latest_message_id;
  if(references.length)headers['References']=references.join(' ');
  const payload:any={from:EMAIL_FROM,to:[recipient],subject:validated.subject.startsWith('Re:')?validated.subject:`Re: ${validated.subject}`.slice(0,180),text:validated.body,headers};
  if(replyTo)payload.reply_to=replyTo;
  let response:Response;
  try {
    response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  } catch {
    await admin.from('calloria_email_messages').update({provider_status:'unknown',provider_error_code:'network_result_unknown'}).eq('id',inserted.data.id);
    return {status:202,data:{sent:false,status:'unknown',warning:'Resend did not return a result. Check the provider inbox before attempting another reply.'}};
  }
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result?.id) {
    const definite=response.status>=400&&response.status<500;
    await admin.from('calloria_email_messages').update({provider_status:definite?'failed':'unknown',provider_error_code:cleanEmailText(result?.message||result?.name||`http_${response.status}`,80)}).eq('id',inserted.data.id);
    return {status:definite?502:202,data:{sent:false,status:definite?'failed':'unknown',error:definite?'Resend rejected the email. Review the provider response before editing and resending.':'The provider result is ambiguous. Check the Resend logs before attempting another reply.'}};
  }
  const providerMessageId=safeMessageId(result.message_id||'')||await fetchSentMessageId(result.id);
  const update=await admin.from('calloria_email_messages').update({provider_email_id:cleanEmailText(result.id,160),provider_message_id:providerMessageId,provider_status:'sent'}).eq('id',inserted.data.id);
  if(update.error)throw new Error('Resend accepted the email, but CALLORIA could not record its provider ID. Check Resend before sending again.');
  let threadingWarning='';
  if(providerMessageId) {
    const reference=await admin.rpc('calloria_email_add_thread_reference',{p_thread_id:thread.id,p_message_id:providerMessageId});
    if(reference.error||reference.data!==true)threadingWarning=' The email was sent, but its Message-ID could not be added to the thread index.';
  } else threadingWarning=' The email was sent, but Resend did not return a Message-ID for future reply matching.';
  return {status:200,data:{sent:true,status:'sent',providerId:result.id,warning:threadingWarning||undefined}};
}

Deno.serve(async request=>{
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS')return origin&&ORIGINS.includes(origin)?new Response('ok',{headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}}):json(403,{error:'Origin not permitted.'});
  if(request.method==='POST'&&request.headers.has('svix-id')) {
    if(!SUPABASE_URL||!SERVICE_KEY||!RESEND_WEBHOOK_SECRET||!LOOKUP_SECRET||!DATA_SECRET||!AGENT_DESK_SECRET||!RESEND_API_KEY||!INBOUND_ADDRESSES.length)return plain(503,'CALLORIA email webhook configuration is incomplete.');
    try { const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});return await webhook(admin,request); }
    catch(error) { return plain(500,error instanceof Error?cleanEmailText(error.message,240):'Email webhook processing failed.'); }
  }
  if(request.method!=='POST')return json(405,{error:'Only signed provider webhooks and authenticated staff POST requests are supported.'});
  if(!origin||!ORIGINS.includes(origin))return json(403,{error:'Origin not permitted.'});
  if(!SUPABASE_URL||!SERVICE_KEY)return json(503,{error:'CALLORIA email storage is not configured.'},origin);
  if(Number(request.headers.get('content-length')||0)>16000)return json(413,{error:'Request is too large.'},origin);
  try {
    const raw=await request.text();if(raw.length>16000)return json(413,{error:'Request is too large.'},origin);
    const body=JSON.parse(raw);const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const auth=await authenticate(request,admin);if('error' in auth)return json(auth.status,{error:auth.error},origin);
    const user=auth.user,grant=auth.grant as Grant,action=cleanEmailText(body.action,40);
    if(action==='whoami')return json(200,{access:{role:grant.role,departments:grant.departments,channels:grant.channels},provider:{webhookReady:!!(RESEND_API_KEY&&RESEND_WEBHOOK_SECRET&&INBOUND_ADDRESSES.length&&LOOKUP_SECRET&&DATA_SECRET&&AGENT_DESK_SECRET),outboundReady:!!(RESEND_API_KEY&&EMAIL_FROM),dataProtectionReady:!!(LOOKUP_SECRET&&DATA_SECRET&&AGENT_DESK_SECRET),inboundAddresses:INBOUND_ADDRESSES}},origin);
    if(action==='inbox') {
      const {data:rows,error}=await admin.from('calloria_email_threads').select('id,active_route_ref,latest_inbound_at,subject_ciphertext,subject_iv,sender_ciphertext,sender_iv,display_name_ciphertext,display_name_iv,updated_at').order('latest_inbound_at',{ascending:false}).limit(100);
      if(error)throw new Error('Email inbox could not be loaded.');
      const refs=(rows||[]).map((r:any)=>r.active_route_ref).filter(Boolean);
      const {data:routes,error:routeError}=refs.length?await admin.from('calloria_route_requests').select('route_ref,department,status,assigned_to,priority,created_at').in('route_ref',refs):{data:[],error:null};
      if(routeError)throw new Error('Email routing permissions could not be checked.');
      const routeMap=new Map<string,any>((routes||[]).map((r:any)=>[r.route_ref,r] as [string,any]));const threads=[];
      for(const row of rows||[]) {
        const route=routeMap.get(row.active_route_ref);if(!route||!hasDepartment(grant,route.department))continue;
        if(grant.role==='agent'&&route.assigned_to!==user.id)continue;
        const sender=await decryptData(row.sender_ciphertext,row.sender_iv);
        const name=row.display_name_ciphertext?await decryptData(row.display_name_ciphertext,row.display_name_iv):'';
        const subject=await decryptData(row.subject_ciphertext,row.subject_iv);
        const {data:latest}=await admin.from('calloria_email_messages').select('id,direction,body_ciphertext,body_iv,provider_status,created_at').eq('thread_id',row.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        const preview=latest?await decryptData(latest.body_ciphertext,latest.body_iv):'';
        threads.push({id:row.id,routeRef:route.route_ref,department:route.department,routeStatus:route.status,priority:route.priority,sender:maskEmailAddress(sender),displayName:name||sender,subject,lastInboundAt:row.latest_inbound_at,lastPreview:preview.slice(0,180),lastDirection:latest?.direction||'inbound',lastStatus:latest?.provider_status||'',updatedAt:row.updated_at});
      }
      return json(200,{threads},origin);
    }
    if(action==='conversation') {
      const permission=await findPermittedThread(admin,cleanEmailText(body.threadId,64),user,grant);if('error' in permission)return json(permission.status,{error:permission.error},origin);
      const {thread,route}=permission;
      const {data:rows,error}=await admin.from('calloria_email_messages').select('id,direction,subject_ciphertext,subject_iv,body_ciphertext,body_iv,attachments_ciphertext,attachments_iv,provider_status,provider_error_code,created_at,sent_by').eq('thread_id',thread.id).order('created_at',{ascending:true}).limit(100);
      if(error)throw new Error('Email history could not be loaded.');
      const messages=[];
      for(const row of rows||[])messages.push({id:row.id,direction:row.direction,subject:await decryptData(row.subject_ciphertext,row.subject_iv),body:await decryptData(row.body_ciphertext,row.body_iv),attachments:row.attachments_ciphertext?JSON.parse(await decryptData(row.attachments_ciphertext,row.attachments_iv)):[],status:row.provider_status,errorCode:row.provider_error_code,createdAt:row.created_at,sentBy:row.sent_by===user.id?'You':'CALLORIA staff'});
      const sender=await decryptData(thread.sender_ciphertext,thread.sender_iv),displayName=thread.display_name_ciphertext?await decryptData(thread.display_name_ciphertext,thread.display_name_iv):'';
      return json(200,{thread:{id:thread.id,routeRef:route.route_ref,department:route.department,routeStatus:route.status,assignedTo:route.assigned_to,sender:maskEmailAddress(sender),displayName:displayName||sender,subject:await decryptData(thread.subject_ciphertext,thread.subject_iv),latestInboundAt:thread.latest_inbound_at},messages},origin);
    }
    if(action==='send_reply') {
      const result=await sendReply(admin,user,grant,body);
      if('data' in result)return json(result.status,result.data as Record<string,unknown>,origin);
      return json(result.status,{error:result.error||'Email reply failed.'},origin);
    }
    return json(400,{error:'Unsupported CALLORIA email action.'},origin);
  } catch(error) {
    return json(500,{error:error instanceof Error?cleanEmailText(error.message,240):'CALLORIA email operation failed.'},origin);
  }
});
