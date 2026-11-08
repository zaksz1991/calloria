import { createClient } from 'npm:@supabase/supabase-js@2';

/** CALLORIA Phase 12. Guest-first request entry and deterministic staff skill routing. */
const env = (name: string) => Deno.env.get(name) || '';
const origins = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(value => value.trim()).filter(Boolean);
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const agentDeskEncryptionSecret = env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const rateSalt = env('CALLORIA_ROUTING_RATE_SALT') || serviceKey;
const accessRaw = env('CALLORIA_ROUTING_ACCESS');
const encoder = new TextEncoder();
const SYSTEM_ACTOR = '00000000-0000-4000-8000-000000000000';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];
const CHANNELS = ['voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'];
const LANGUAGES = ['en','ha','yo','ig','pcm'];
const SKILLS = ['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
const PRODUCTS: Record<string,string> = {
  'ruffneck-learn':'RuffNeck Learn', 'ruffneck-prospector':'RuffNeck Prospector',
  'ruffneck-connect':'RuffNeck Connect', 'ruffneck-social-hub':'RuffNeck Social Hub',
  'kano-run':'Kano Run / Kano Life', 'kano-keke':'Kano Keke'
};
const INTENTS: Record<string,{ department:string; skill:string; priority:string }> = {
  platform_support:{department:DEPARTMENTS[0],skill:'platform_support',priority:'normal'},
  account_access:{department:DEPARTMENTS[0],skill:'account_access',priority:'normal'},
  technical_support:{department:DEPARTMENTS[7],skill:'technical_support',priority:'normal'},
  sales_enquiry:{department:DEPARTMENTS[1],skill:'sales',priority:'normal'},
  complaint:{department:DEPARTMENTS[2],skill:'complaints',priority:'high'},
  personal_guidance:{department:DEPARTMENTS[3],skill:'personal_guidance',priority:'normal'},
  safeguarding:{department:DEPARTMENTS[9],skill:'safeguarding',priority:'urgent'},
  learning_career:{department:DEPARTMENTS[10],skill:'learning_advice',priority:'normal'},
  social_media:{department:DEPARTMENTS[6],skill:'social_support',priority:'normal'},
  general:{department:DEPARTMENTS[4],skill:'general_customer_care',priority:'normal'}
};
type Grant = { role:'agent'|'supervisor'|'people_admin'; departments:string[]; skills:string[]; channels:string[]; languages:string[]; maxConcurrency:number };
const accessMap: Record<string,Grant> = {};
let accessInvalid = false;
function clean(value: unknown, max = 600): string { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function validUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function reply(status:number, body:Record<string,unknown>, origin:string|null) {
  const allowedOrigin = origin && origins.includes(origin) ? origin : 'null';
  return new Response(JSON.stringify(body), { status, headers:{
    'Access-Control-Allow-Origin':allowedOrigin,
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS', 'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store', Vary:'Origin'
  }});
}
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Routing access map must be a JSON object.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!validUuid(userId) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid routing staff entry.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.skills) || !Array.isArray(row.channels) || !Array.isArray(row.languages)) throw new Error('Every routing staff entry requires explicit department, skill, channel and language scopes.');
    const departments = row.departments.map((x:unknown)=>clean(x,120));
    const skills = row.skills.map((x:unknown)=>clean(x,40));
    const channels = row.channels.map((x:unknown)=>clean(x,24));
    const languages = row.languages.map((x:unknown)=>clean(x,8));
    if (departments.some((x:string)=>x !== '*' && !DEPARTMENTS.includes(x)) || skills.some((x:string)=>!SKILLS.includes(x)) || channels.some((x:string)=>!CHANNELS.includes(x)) || languages.some((x:string)=>!LANGUAGES.includes(x))) throw new Error('Unknown routing scope value.');
    if (!skills.includes('general_customer_care')) throw new Error('Every CALLORIA customer-facing employee must hold the approved general_customer_care foundation skill.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Frontline agents require explicit department scopes.');
    if (row.role === 'people_admin' && !departments.includes('*')) throw new Error('People administrators require wildcard department scope.');
    accessMap[userId] = { role:row.role, departments, skills, channels, languages, maxConcurrency:Math.max(1,Math.min(10,Number(row.maxConcurrency)||1)) };
  }
} catch { accessInvalid = true; }
function hasScope(grant:Grant, department:string) { return grant.departments.includes('*') || grant.departments.includes(department); }
function scopedDepartments(grant:Grant) { return grant.departments.includes('*') ? DEPARTMENTS : grant.departments; }
async function authenticate(request:Request, admin:any) {
  if (accessInvalid || Object.keys(accessMap).length === 0) return { error:'Contact Routing staff access is not configured.', status:503 };
  const bearer = request.headers.get('Authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token) return { error:'Staff sign-in is required.', status:401 };
  const {data,error} = await admin.auth.getUser(token);
  if (error || !data?.user) return {error:'Staff session is invalid or expired.',status:401};
  const grant = accessMap[data.user.id];
  if (!grant) return {error:'This account is not authorised for Contact Routing.',status:403};
  return {user:data.user,grant};
}
function b64(bytes:Uint8Array) { let binary=''; for (const b of bytes) binary += String.fromCharCode(b); return btoa(binary); }
async function aesKey() {
  if (encoder.encode(agentDeskEncryptionSecret).length < 32) throw new Error('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET must contain at least 32 bytes and remain identical to the Agent Desk key.');
  const material = await crypto.subtle.importKey('raw',encoder.encode(agentDeskEncryptionSecret),'HKDF',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('CALLORIA-AGENT-DESK-v1'),info:encoder.encode('interaction-summary-encryption')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
async function encrypt(text:string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(),encoder.encode(text));
  return {ciphertext:b64(new Uint8Array(ciphertext)),iv:b64(iv)};
}
function redact(text:string) {
  return clean(text,600)
    .replace(/\b(pin|otp|one[- ]time password|password|passcode|security code)\s*[:#= -]?\s*[a-z0-9-]{3,20}\b/gi,'$1: [REDACTED]')
    .replace(/\b(account|acct|bank account|card)\s*(number)?\s*[:#= -]?\s*\d{6,19}\b/gi,'$1 number: [REDACTED]')
    .replace(/\b(api[_ -]?key|access[_ -]?token|authorization|bearer)\s*[:#= -]?\s*[A-Za-z0-9._~+/-]{12,}\b/gi,'$1: [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[REDACTED EMAIL]')
    .replace(/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g,'[REDACTED PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g,'[REDACTED FINANCIAL NUMBER]');
}
async function sha256(text:string) {
  const bytes=await crypto.subtle.digest('SHA-256',encoder.encode(text));
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
async function hmacFingerprint(request:Request) {
  if (encoder.encode(rateSalt).length < 32) throw new Error('CALLORIA_ROUTING_RATE_SALT must contain at least 32 bytes.');
  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
  const ua = clean(request.headers.get('user-agent'),180);
  const key = await crypto.subtle.importKey('raw',encoder.encode(rateSalt),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest = await crypto.subtle.sign('HMAC',key,encoder.encode(`${ip}|${ua}`));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
function randomToken() {
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
}
function routeRef() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes=crypto.getRandomValues(new Uint8Array(6));
  const code=Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');
  const date=new Date().toISOString().slice(0,10).replaceAll('-','');
  return `CR-${date}-${code}`;
}
function safeEqual(a:string,b:string) {
  if (a.length !== b.length) return false;
  let mismatch=0; for(let i=0;i<a.length;i++) mismatch |= a.charCodeAt(i)^b.charCodeAt(i);
  return mismatch===0;
}
function statusText(status:string) {
  if (status==='queued') return {statusLabel:'Waiting in the relevant support queue',statusMessage:'Your request has been received. It is waiting for an eligible support team member.'};
  if (status==='assigned') return {statusLabel:'Accepted by a support team',statusMessage:'A support team member has accepted the interaction. This status page does not send messages or start a live conversation.'};
  if (status==='completed') return {statusLabel:'Resolved by the support team',statusMessage:'The assigned Agent Desk interaction has been marked resolved.'};
  if (status==='cancelled') return {statusLabel:'Closed by the support team',statusMessage:'The support team closed this interaction. Submit a new request for further assistance.'};
  return {statusLabel:'Withdrawn',statusMessage:'This request is no longer in the support queue.'};
}

Deno.serve(async request => {
  const origin=request.headers.get('origin');
  if (!origins.length) return reply(503,{error:'CALLORIA_ALLOWED_ORIGINS is not configured.'},origin);
  if (request.method==='OPTIONS') return origins.includes(origin || '') ? new Response('ok',{headers:{'Access-Control-Allow-Origin':origin!,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}}) : reply(403,{error:'Origin not permitted.'},origin);
  if (request.method!=='POST') return reply(405,{error:'Only POST is accepted.'},origin);
  if (!origin || !origins.includes(origin)) return reply(403,{error:'Origin not permitted.'},origin);
  if (!supabaseUrl || !serviceKey) return reply(503,{error:'Contact Routing storage is not configured.'},origin);
  const size=Number(request.headers.get('content-length')||0);
  if (size>9000) return reply(413,{error:'Request is too large.'},origin);
  try {
    const raw=await request.text(); if(raw.length>9000) return reply(413,{error:'Request is too large.'},origin);
    let body:any; try { body=JSON.parse(raw); } catch { return reply(400,{error:'A valid JSON request is required.'},origin); }
    const admin=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const action=clean(body?.action,40);

    if (action==='submit_request') {
      if(body.consent!==true) return reply(400,{error:'Explicit storage consent is required.'},origin);
      const intent=clean(body.intent,40); const policy=INTENTS[intent];
      const platformId=clean(body.platformId,40); const language=clean(body.language,8);
      if(!policy) return reply(400,{error:'Select a valid support category.'},origin);
      if(platformId && !Object.hasOwn(PRODUCTS,platformId)) return reply(400,{error:'Select a valid RuffNeck platform or game.'},origin);
      if(!LANGUAGES.includes(language)) return reply(400,{error:'Select a supported language.'},origin);
      const subject=redact(clean(body.subject,140)); const summary=redact(clean(body.summary,600));
      if(subject.length<4 || summary.length<12) return reply(400,{error:'Enter a subject and a request summary with enough detail.'},origin);
      const fingerprint=await hmacFingerprint(request);
      const bucketMilliseconds=10*60*1000; const bucketStart=new Date(Math.floor(Date.now()/bucketMilliseconds)*bucketMilliseconds).toISOString();
      const {data:allowed,error:rateError}=await admin.rpc('calloria_route_consume_limit',{p_fingerprint_hash:fingerprint,p_bucket_start:bucketStart,p_limit:8});
      if(rateError) throw new Error('Request protection is temporarily unavailable. Try again later.');
      if(allowed!==true) return reply(429,{error:'Too many support requests from this connection. Please wait before trying again.'},origin);
      const {error:purgeError}=await admin.rpc('calloria_route_purge_closed');
      if(purgeError) throw new Error('Support retention maintenance is temporarily unavailable. Try again later.');
      const encrypted=await encrypt(summary);
      const token=randomToken(); const tokenHash=await sha256(token); const ref=routeRef();
      const channel=(platformId==='kano-run'||platformId==='kano-keke')?'game':'portal';
      const {data,error}=await admin.rpc('calloria_route_create_request',{
        p_route_ref:ref,p_department:policy.department,p_channel:channel,p_platform_id:platformId||null,
        p_intent:intent,p_language:language,p_required_skills:[policy.skill],p_priority:policy.priority,
        p_subject:subject,p_summary_ciphertext:encrypted.ciphertext,p_summary_iv:encrypted.iv,p_access_token_hash:tokenHash
      });
      if(error || !data) throw new Error('The support request could not be queued. No reference was issued; check before retrying.');
      return reply(200,{routeRef:ref,accessToken:token,department:policy.department},origin);
    }

    if (action==='request_status') {
      const ref=clean(body.routeRef,32).toUpperCase(); const token=clean(body.accessToken,100);
      if(!/^CR-[0-9]{8}-[A-Z0-9]{6}$/.test(ref) || !/^[a-f0-9]{64}$/.test(token)) return reply(400,{error:'Enter the request reference and its one-time access code.'},origin);
      const fingerprint=await hmacFingerprint(request);
      const bucketMilliseconds=10*60*1000; const bucketStart=new Date(Math.floor(Date.now()/bucketMilliseconds)*bucketMilliseconds).toISOString();
      const {data:allowed,error:rateError}=await admin.rpc('calloria_route_consume_limit',{p_fingerprint_hash:fingerprint,p_bucket_start:bucketStart,p_limit:24});
      if(rateError) throw new Error('Request protection is temporarily unavailable. Try again later.');
      if(allowed!==true) return reply(429,{error:'Too many status checks from this connection. Please wait before trying again.'},origin);
      const {error:purgeError}=await admin.rpc('calloria_route_purge_closed');
      if(purgeError) throw new Error('Support retention maintenance is temporarily unavailable. Try again later.');
      const {data,error}=await admin.from('calloria_route_requests').select('route_ref,department,status,created_at,access_token_hash').eq('route_ref',ref).maybeSingle();
      if(error) throw new Error('Request status could not be loaded.');
      if(!data || !safeEqual(data.access_token_hash,await sha256(token))) return reply(404,{error:'The reference and access code did not match a request.'},origin);
      return reply(200,{routeRef:data.route_ref,department:data.department,status:data.status,createdAt:data.created_at,...statusText(data.status)},origin);
    }

    const auth=await authenticate(request,admin);
    if('error' in auth) return reply(auth.status,{error:auth.error},origin);
    const user=auth.user; const grant=auth.grant as Grant;
    if(action==='whoami') return reply(200,{access:{role:grant.role,departments:grant.departments,skills:grant.skills,channels:grant.channels,languages:grant.languages,maxConcurrency:grant.maxConcurrency}},origin);

    if(action==='queues') {
      const departments=scopedDepartments(grant);
      const [{data:summary,error:summaryError},{data:mine,error:mineError}]=await Promise.all([
        admin.rpc('calloria_route_queue_summary',{p_departments:departments}),
        admin.from('calloria_route_requests').select('route_ref,department,channel,platform_id,intent,status,assigned_at,created_at').eq('assigned_to',user.id).order('assigned_at',{ascending:false}).limit(30)
      ]);
      if(summaryError || mineError) throw new Error('Routing queues could not be loaded.');
      return reply(200,{queueSummary:summary||[],recentClaims:mine||[]},origin);
    }

    if(action==='claim_next') {
      if(grant.role==='people_admin') return reply(403,{error:'People administrators can view permitted queue totals but cannot claim customer interactions.'},origin);
      if(!grant.skills.length || !grant.channels.length || !grant.languages.length) return reply(403,{error:'Your routing profile has no approved skills, channels or languages.'},origin);
      const role=grant.role==='agent'?'agent':'supervisor';
      const {data,error}=await admin.rpc('calloria_route_claim_next',{
        p_agent_id:user.id,p_actor_role:role,p_departments:scopedDepartments(grant),
        p_skills:grant.skills,p_channels:grant.channels,p_languages:grant.languages,p_max_concurrency:grant.maxConcurrency
      });
      if(error) throw new Error('The next request could not be claimed. Confirm that you are clocked in on customer-work activity and have capacity.');
      const claimed=Array.isArray(data)?data[0]:data;
      if(!claimed) return reply(200,{claimed:false,message:'No eligible request is available, or your active Workforce status/capacity does not permit another claim.'},origin);
      const {data:item,error:itemError}=await admin.from('calloria_ops_work_items').select('work_ref,status').eq('id',claimed.work_item_id).maybeSingle();
      if(itemError) throw new Error('The work item was claimed, but its Agent Desk reference could not be loaded. Open Agent Desk and refresh your queue.');
      return reply(200,{claimed:true,routeRef:claimed.route_ref,workItemId:claimed.work_item_id,workRef:item?.work_ref||claimed.route_ref,department:claimed.department,channel:claimed.channel,platformId:claimed.platform_id,intent:claimed.intent},origin);
    }

    return reply(400,{error:'Unsupported routing action.'},origin);
  } catch(error) {
    return reply(500,{error:error instanceof Error?error.message:'Contact Routing request failed.'},origin);
  }
});
