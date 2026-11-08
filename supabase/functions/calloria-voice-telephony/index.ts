import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  VOICE_DEPARTMENTS, VOICE_LANGUAGES, buildDepartmentMenu, buildDialResponse, buildLanguageMenu,
  cleanVoiceText, maskVoiceNumber, normalizeCallStatus, validE164Nigeria, validNigeriaE164, validateCallbackEvidence, voiceDepartment, voiceLanguage
} from './voice-engine.ts';

const env=(name:string)=>Deno.env.get(name)||'';
const SUPABASE_URL=env('SUPABASE_URL');
const SERVICE_KEY=env('SUPABASE_SERVICE_ROLE_KEY');
const ACCOUNT_SID=env('SIGNALS_ACCOUNT_SID');
const AUTH_TOKEN=env('SIGNALS_AUTH_TOKEN');
const BUSINESS_NUMBER_RAW=env('CALLORIA_VOICE_BUSINESS_NUMBER');
const PUBLIC_FUNCTION_URL=env('CALLORIA_VOICE_PUBLIC_URL').replace(/\/$/,'');
const DATA_KEY=env('CALLORIA_VOICE_DATA_KEY');
const LOOKUP_SECRET=env('CALLORIA_VOICE_LOOKUP_SECRET');
const AGENT_DESK_SECRET=env('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET');
const ROUTING_ACCESS_RAW=env('CALLORIA_ROUTING_ACCESS');
const STAFF_ORIGINS=env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v=>v.trim().replace(/\/$/,'')).filter(Boolean);
const SIGNALS_API_URL='https://api.signals.pressone.africa/2010-04-01';
const encoder=new TextEncoder();
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_ANY=/^[0-9a-f-]{36}$/i;
const ALLOWED_SKILLS=['platform_support','account_access','technical_support','sales','complaints','personal_guidance','safeguarding','learning_advice','social_support','general_customer_care'];
const ALLOWED_CHANNELS=['voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'];
const ALLOWED_LANGUAGES=['en','ha','yo','ig','pcm'];
const DEPARTMENTS:string[]=[...new Set(VOICE_DEPARTMENTS.map(row=>row.department))];

type Grant={role:'agent'|'supervisor'|'people_admin';departments:string[];skills:string[];channels:string[];languages:string[];maxConcurrency:number};
type VoiceLine={phone:string;enabled:boolean};
type IncomingNumber={number:string;label:string};
const grants:Record<string,Grant>={};
const agentLines:Record<string,VoiceLine>={};
const ringGroups:Record<string,string>={};
const incomingNumbers:IncomingNumber[]=[];
let configInvalid=false;
try {
  const parsed=ROUTING_ACCESS_RAW?JSON.parse(ROUTING_ACCESS_RAW):{};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('invalid');
  for(const [userId,row] of Object.entries(parsed) as [string,any][]) {
    if(!UUID.test(userId)||!row||!['agent','supervisor','people_admin'].includes(row.role)) throw new Error('invalid grant');
    const fields=['departments','skills','channels','languages'];
    if(fields.some(field=>!Array.isArray(row[field])||!row[field].length)) throw new Error('incomplete grant');
    const grant:Grant={role:row.role,departments:row.departments.map((v:unknown)=>cleanVoiceText(v,120)),skills:row.skills.map((v:unknown)=>cleanVoiceText(v,40)),channels:row.channels.map((v:unknown)=>cleanVoiceText(v,24)),languages:row.languages.map((v:unknown)=>cleanVoiceText(v,8)),maxConcurrency:Math.max(1,Math.min(10,Number(row.maxConcurrency)||1))};
    if(grant.skills.some(v=>!ALLOWED_SKILLS.includes(v))||grant.channels.some(v=>!ALLOWED_CHANNELS.includes(v))||grant.languages.some(v=>!ALLOWED_LANGUAGES.includes(v))||grant.departments.some(v=>v!=='*'&&!DEPARTMENTS.includes(v))||!grant.skills.includes('general_customer_care')) throw new Error('unknown grant');
    grants[userId]=grant;
  }
} catch {configInvalid=true;}
try {
  const parsed=env('CALLORIA_VOICE_AGENT_LINES_JSON')?JSON.parse(env('CALLORIA_VOICE_AGENT_LINES_JSON')):{};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('invalid lines');
  for(const [userId,row] of Object.entries(parsed) as [string,any][]) {
    if(!UUID.test(userId)||!row||typeof row.enabled!=='boolean') throw new Error('invalid line');
    if(row.enabled) {
      const phone=validE164Nigeria(row.phone);
      if(!grants[userId]?.channels.includes('voice')) throw new Error('line without voice permission');
      agentLines[userId]={phone,enabled:true};
    }
  }
} catch {configInvalid=true;}
try {
  const parsed=env('CALLORIA_VOICE_RING_GROUPS_JSON')?JSON.parse(env('CALLORIA_VOICE_RING_GROUPS_JSON')):{};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)) throw new Error('invalid ring groups');
  for(const [department,userIdRaw] of Object.entries(parsed)) {
    const userId=String(userIdRaw);
    const grant=grants[userId];
    if(!DEPARTMENTS.includes(department)||!UUID.test(userId)||!agentLines[userId]||!grant?.channels.includes('voice')||(!grant.departments.includes('*')&&!grant.departments.includes(department))) throw new Error('invalid ring target');
    ringGroups[department]=userId;
  }
} catch {configInvalid=true;}
try {
  const parsed=env('CALLORIA_VOICE_NUMBERS_JSON')?JSON.parse(env('CALLORIA_VOICE_NUMBERS_JSON')):[];
  if(!Array.isArray(parsed)||parsed.length>20) throw new Error('invalid incoming numbers');
  for(const row of parsed) {
    const number=validNigeriaE164(row?.number);
    if(incomingNumbers.some(item=>item.number===number)) throw new Error('duplicate incoming number');
    incomingNumbers.push({number,label:cleanVoiceText(row.label||'RuffNeck Customer Care',80)});
  }
} catch {configInvalid=true;}

function jsonResponse(status:number,body:Record<string,unknown>,origin:string|null=null){
  const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(origin&&STAFF_ORIGINS.includes(origin)){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='authorization, apikey, content-type, x-client-info';headers['Access-Control-Allow-Methods']='POST, OPTIONS';headers.Vary='Origin';}
  return new Response(status===204?null:JSON.stringify(body),{status,headers});
}
function xmlResponse(xml:string,status=200){return new Response(xml,{status,headers:{'Content-Type':'text/xml; charset=utf-8','Cache-Control':'no-store'}});}
function b64(bytes:Uint8Array){let raw='';for(const value of bytes)raw+=String.fromCharCode(value);return btoa(raw);}
function fromHex(hex:string){return Uint8Array.from(hex.match(/.{1,2}/g)||[],item=>parseInt(item,16));}
function toHex(bytes:Uint8Array){return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');}
function constantEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
function randomBytes(length=32){return crypto.getRandomValues(new Uint8Array(length));}
function makeRef(prefix:'VC'|'VCA'|'CR'){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const suffix=Array.from(randomBytes(6),v=>alphabet[v%alphabet.length]).join('');return `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${suffix}`;}
async function sha256(text:string){return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(text))));}
async function hmacHex(secret:string,value:string){if(encoder.encode(secret).length<32)throw new Error('CALLORIA voice lookup secret is missing or too short.');const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return toHex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));}
async function hmacSha1Base64(secret:string,value:string){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);return b64(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(value))));}
async function deriveAes(secret:string,salt:string,info:string){if(encoder.encode(secret).length<32)throw new Error('CALLORIA voice encryption secret is missing or too short.');const material=await crypto.subtle.importKey('raw',encoder.encode(secret),'HKDF',false,['deriveKey']);return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode(salt),info:encoder.encode(info)},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);}
async function encrypt(value:string,secret:string,purpose:string){const iv=randomBytes(12);const key=await deriveAes(secret,'CALLORIA-VOICE-v1',purpose);const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,encoder.encode(value));return {ciphertext:b64(new Uint8Array(cipher)),iv:b64(iv)};}
function parseBasicAuthRequest(body:URLSearchParams){const params:Record<string,string|string[]>={};for(const [key,value] of body.entries()){const old=params[key];if(old===undefined)params[key]=value;else if(Array.isArray(old))old.push(value);else params[key]=[old,value];}return params;}
async function verifySignalsRequest(request:Request,body:URLSearchParams){
  const signature=request.headers.get('x-twilio-signature')||'';
  if(!AUTH_TOKEN||!PUBLIC_FUNCTION_URL||!signature||!/^https:\/\//.test(PUBLIC_FUNCTION_URL))return false;
  const requestUrl=new URL(request.url);const configuredBase=new URL(PUBLIC_FUNCTION_URL);
  const signedUrl=`${configuredBase.origin}${configuredBase.pathname}${requestUrl.search}`;
  const params=parseBasicAuthRequest(body);let data=signedUrl;
  for(const name of Object.keys(params).sort()){
    const raw=params[name];const values=[...new Set(Array.isArray(raw)?raw:[raw])].sort();
    for(const value of values)data+=name+value;
  }
  const expected=await hmacSha1Base64(AUTH_TOKEN,data);
  return constantEqual(expected,signature);
}
function publicActionUrl(flow:string,params:Record<string,string>={}){if(!PUBLIC_FUNCTION_URL)throw new Error('CALLORIA_VOICE_PUBLIC_URL is not configured.');const url=new URL(PUBLIC_FUNCTION_URL);url.searchParams.set('flow',flow);for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);return url.toString();}
function allowedDepartment(grant:Grant,department:string){return grant.departments.includes('*')||grant.departments.includes(department);}
function requestToken(request:Request){return (request.headers.get('authorization')||'').match(/^Bearer\s+(.+)$/i)?.[1]||'';}
async function authenticate(request:Request,admin:any){
  if(configInvalid)return {error:'CALLORIA voice staff access or ring-group configuration is invalid.',status:503};
  const token=requestToken(request);if(!token)return {error:'A valid staff session is required.',status:401};
  const {data,error}=await admin.auth.getUser(token);if(error||!data?.user)return {error:'Your staff session is invalid or expired.',status:401};
  const grant=grants[data.user.id];if(!grant||!grant.channels.includes('voice')||!grant.skills.includes('general_customer_care'))return {error:'Your staff account does not have voice channel permission.',status:403};
  return {user:data.user,grant};
}
function routeAuthorized(grant:Grant,userId:string,route:any){return Boolean(route&&route.status==='assigned'&&route.assigned_to===userId&&allowedDepartment(grant,route.department)&&grant.languages.includes(route.language)&&(route.required_skills||[]).every((skill:string)=>grant.skills.includes(skill)));}
async function encryptAgentSummary(value:string){const packed=await encrypt(value,AGENT_DESK_SECRET,'interaction-summary-encryption');return packed;}
async function providerCall(params:URLSearchParams){
  if(!ACCOUNT_SID||!AUTH_TOKEN)throw new Error('Signals Programmable Voice credentials are not configured.');
  const auth=btoa(`${ACCOUNT_SID}:${AUTH_TOKEN}`);
  const response=await fetch(`${SIGNALS_API_URL}/Accounts/${ACCOUNT_SID}/Calls.json`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:params,signal:AbortSignal.timeout(15000)});
  const result=await response.json().catch(()=>({}));
  return {response,result};
}
async function updateFinalize(admin:any,callRef:string,sid:string|null,status:'queued'|'uncertain'|'rejected',errorCode:string|null){
  const {error}=await admin.rpc('calloria_voice_finalize_outbound',{p_call_ref:callRef,p_provider_call_sid:sid,p_status:status,p_error_code:errorCode});if(error)throw new Error('Provider result could not be recorded. The outbound call must be checked in the Signals console.');
}
async function processProviderWebhook(request:Request,admin:any,flow:string){
  const raw=await request.text();const form=new URLSearchParams(raw);
  if(!(await verifySignalsRequest(request,form)))return xmlResponse('<Response><Say>Request could not be verified.</Say><Hangup/></Response>',403);
  const accountSid=form.get('AccountSid')||'';if(!ACCOUNT_SID||accountSid!==ACCOUNT_SID)return xmlResponse('<Response><Say>Account not recognised.</Say><Hangup/></Response>',403);
  const callSid=form.get('CallSid')||'';if(!/^CA[0-9a-fA-F]{32}$/.test(callSid))return xmlResponse('<Response><Say>Call reference is invalid.</Say><Hangup/></Response>',400);

  if(['language','department','dial-result'].includes(flow)){
    const actionCallSid=new URL(request.url).searchParams.get('callSid');
    if(actionCallSid!==callSid)return xmlResponse('<Response><Say>Call session could not be verified.</Say><Hangup/></Response>',403);
    const {data:parentCall,error:parentError}=await admin.from('calloria_voice_calls').select('direction').eq('provider_call_sid',callSid).maybeSingle();
    if(parentError)return xmlResponse('<Response><Say>Call session could not be checked. Please call again.</Say><Hangup/></Response>',503);
    if(!parentCall||parentCall.direction!=='inbound')return xmlResponse('<Response><Say>Call session was not found. Please call again.</Say><Hangup/></Response>',404);
  }

  if(flow==='inbound'){
    const from=validNigeriaE164(form.get('From'));const to=validNigeriaE164(form.get('To'));
    if(form.get('Direction')!=='inbound'||!incomingNumbers.some(row=>row.number===to))return xmlResponse('<Response><Say>This number is not configured for inbound customer care.</Say><Hangup/></Response>',403);
    if(encoder.encode(DATA_KEY).length<32)return xmlResponse('<Response><Say>Customer care is temporarily unavailable. Please try again later.</Say><Hangup/></Response>',503);
    const encryptedFrom=await encrypt(from,DATA_KEY,'caller-number');const encryptedTo=await encrypt(to,DATA_KEY,'called-number');
    const {error}=await admin.rpc('calloria_voice_start_inbound',{p_call_ref:makeRef('VC'),p_provider_call_sid:callSid,p_from_ciphertext:encryptedFrom.ciphertext,p_from_iv:encryptedFrom.iv,p_to_ciphertext:encryptedTo.ciphertext,p_to_iv:encryptedTo.iv,p_from_masked:maskVoiceNumber(from),p_to_masked:maskVoiceNumber(to),p_received_at:new Date().toISOString()});
    if(error)return xmlResponse('<Response><Say>We could not safely register your call. Please try again.</Say><Hangup/></Response>',503);
    return xmlResponse(buildLanguageMenu(publicActionUrl('language',{callSid})));
  }

  if(flow==='language'){
    const language=voiceLanguage(form.get('Digits'));
    if(!language)return xmlResponse('<Response><Say>That selection was not recognised. Please call again and choose a language.</Say><Hangup/></Response>');
    return xmlResponse(buildDepartmentMenu(language,publicActionUrl('department',{callSid,language})));
  }

  if(flow==='department'){
    const selected=voiceDepartment(form.get('Digits'));const language=VOICE_LANGUAGES.includes((new URL(request.url).searchParams.get('language')||'en') as any)?(new URL(request.url).searchParams.get('language')||'en'):'en';
    if(!selected)return xmlResponse(buildDepartmentMenu(language,publicActionUrl('department',{callSid,language})));
    const targetUserId=ringGroups[selected.department]||'';const target=targetUserId?agentLines[targetUserId]:null;const grant=targetUserId?grants[targetUserId]:null;
    let ringAllowed=Boolean(target&&grant&&grant.languages.includes(language)&&grant.skills.includes(selected.skill)&&allowedDepartment(grant,selected.department));
    if(ringAllowed){
      const ready=await admin.rpc('calloria_voice_agent_ready',{p_agent_id:targetUserId,p_department:selected.department,p_language:language,p_required_skill:selected.skill,p_max_concurrency:grant!.maxConcurrency,p_ignore_route_ref:null});
      ringAllowed=!ready.error&&ready.data===true;
    }
    const routeRef=makeRef('CR');const summary=await encryptAgentSummary(`Inbound customer voice call. Caller requested ${selected.department}. Language selected: ${language.toUpperCase()}. Caller number is encrypted in the voice call record and masked in staff views. Call audio is not recorded by CALLORIA.`);
    const hash=await sha256(crypto.randomUUID()+callSid);
    const {data:routeResult,error}=await admin.rpc('calloria_voice_route_inbound',{p_provider_call_sid:callSid,p_route_ref:routeRef,p_department:selected.department,p_language:language,p_intent:selected.intent,p_required_skills:[selected.skill],p_priority:selected.priority,p_subject:`Inbound phone call · ${selected.department}`,p_summary_ciphertext:summary.ciphertext,p_summary_iv:summary.iv,p_access_token_hash:hash,p_ring_target_user_id:ringAllowed?targetUserId:null});
    if(error||!routeResult?.route_ref)return xmlResponse('<Response><Say>We could not create a secure support request. Please try again later.</Say><Hangup/></Response>',503);
    if(!ringAllowed)return xmlResponse(`<Response><Say>Our ${language==='ha'?'Hausa':language==='yo'?'Yoruba':language==='ig'?'Igbo':'customer care'} team is not available on this line now. Please use our secure website support or call again during business hours. Goodbye.</Say><Hangup/></Response>`);
    const dialReservation=await admin.rpc('calloria_voice_reserve_inbound_dial',{p_provider_call_sid:callSid});
    if(dialReservation.error)return xmlResponse('<Response><Say>We could not connect your call safely. Please try again later.</Say><Hangup/></Response>',503);
    if(dialReservation.data!==true)return xmlResponse('<Response><Say>Your request has already been registered. Please use our website support if you are disconnected. Goodbye.</Say><Hangup/></Response>');
    return xmlResponse(buildDialResponse(target!.phone,publicActionUrl('dial-result',{callSid}),language));
  }

  if(flow==='dial-result'){
    const status=normalizeCallStatus(form.get('DialCallStatus'));const duration=Number.parseInt(form.get('DialCallDuration')||'',10);
    const eventKey=`${callSid}:dial:${status}:${Number.isFinite(duration)?duration:0}`;
    const {error}=await admin.rpc('calloria_voice_record_dial_result',{p_provider_call_sid:callSid,p_event_key:eventKey,p_dial_status:status,p_duration_seconds:Number.isFinite(duration)?Math.max(0,Math.min(duration,86400)):null});
    if(error)return xmlResponse('<Response><Say>Call status could not be recorded.</Say></Response>',503);
    const {data:call,error:callError}=await admin.from('calloria_voice_calls').select('ring_target_user_id,route_ref,language').eq('provider_call_sid',callSid).maybeSingle();
    if(callError||!call)return xmlResponse('<Response><Say>We could not complete this call step. Please try our online support service.</Say><Hangup/></Response>',503);
    if(status==='completed'&&call.ring_target_user_id&&call.route_ref){
      const grant=grants[call.ring_target_user_id];
      if(grant?.channels.includes('voice')){
        const {error:claimError}=await admin.rpc('calloria_voice_claim_inbound',{p_provider_call_sid:callSid,p_agent_id:call.ring_target_user_id,p_actor_role:grant.role==='people_admin'?'supervisor':grant.role,p_departments:grant.departments.includes('*')?DEPARTMENTS:grant.departments,p_skills:grant.skills,p_languages:grant.languages,p_max_concurrency:grant.maxConcurrency});
        if(claimError)return xmlResponse('<Response><Say>Your call ended, but the interaction could not be assigned automatically. Please contact customer care through our website.</Say><Hangup/></Response>',503);
      }
    }
    if(status==='completed')return xmlResponse('<Response></Response>');
    const language=call.language||'en';
    const fallback=language==='ha'?'Ba a samu ma’aikaci ba a yanzu. Da fatan za a yi amfani da taimakon yanar gizo ko a sake kira daga baya.':language==='yo'?'A ko ri aṣoju wa ni bayi. Jọwọ lo iranlowo ori ayelujara tabi tun pe nigbamii.':language==='ig'?'Anyị enwetaghị onye ọrụ ugbu a. Biko jiri enyemaka weebụ ma ọ bụ kpọọ ọzọ ma emechaa.':'We could not connect you to an agent. Please use RuffNeck online support or call again later. Goodbye.';
    return xmlResponse(`<Response><Say>${cleanVoiceText(fallback,300)}</Say><Hangup/></Response>`);
  }

  if(flow==='status'){
    const outboundCallRef=new URL(request.url).searchParams.get('callRef');
    if(outboundCallRef){
      const {data:bound,error:bindError}=await admin.rpc('calloria_voice_bind_provider_sid',{p_call_ref:outboundCallRef,p_provider_call_sid:callSid});
      if(bindError||bound!==true)return new Response('call binding error',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
    const {data:knownCall,error:knownCallError}=await admin.from('calloria_voice_calls').select('id').eq('provider_call_sid',callSid).maybeSingle();
    if(knownCallError)return new Response('call lookup error',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    if(!knownCall)return new Response('call not registered',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    const sequence=Number.parseInt(form.get('SequenceNumber')||'-1',10);if(!Number.isInteger(sequence)||sequence<0||sequence>3)return new Response('invalid event sequence',{status:400,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    const eventStatus=normalizeCallStatus(form.get('CallStatus'));
    const duration=Number.parseInt(form.get('CallDuration')||'',10);const timestamp=form.get('Timestamp');const receivedAt=timestamp&&Number.isFinite(Date.parse(timestamp))?new Date(timestamp).toISOString():new Date().toISOString();
    const eventKey=`${callSid}:${Number.isFinite(sequence)?sequence:-1}:${eventStatus}`;
    const {data,error}=await admin.rpc('calloria_voice_update_status',{p_provider_call_sid:callSid,p_event_key:eventKey,p_sequence_number:Number.isFinite(sequence)?sequence:-1,p_status:eventStatus,p_duration_seconds:Number.isFinite(duration)?Math.max(0,Math.min(duration,86400)):null,p_received_at:receivedAt});
    return new Response(error||data!==true?'status error':'ok',{status:error||data!==true?503:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
  }
  return xmlResponse('<Response><Say>Unsupported call flow.</Say><Hangup/></Response>',400);
}

async function apiHandler(request:Request,body:any,admin:any,origin:string){
  const auth=await authenticate(request,admin);if('error'in auth)return jsonResponse(auth.status,{error:auth.error},origin);
  const user=auth.user as any;const grant=auth.grant as Grant;const line=agentLines[user.id];
  let businessNumber='';try{businessNumber=validNigeriaE164(BUSINESS_NUMBER_RAW);}catch{}
  const businessNumberOwned=Boolean(businessNumber&&incomingNumbers.some(row=>row.number===businessNumber));
  const providerReady=Boolean(ACCOUNT_SID&&/^AC[0-9a-fA-F]{32}$/.test(ACCOUNT_SID)&&AUTH_TOKEN&&businessNumberOwned&&PUBLIC_FUNCTION_URL&&/^https:\/\//.test(PUBLIC_FUNCTION_URL)&&encoder.encode(DATA_KEY).length>=32&&encoder.encode(LOOKUP_SECRET).length>=32&&encoder.encode(AGENT_DESK_SECRET).length>=32&&!configInvalid);
  if(body.action==='whoami')return jsonResponse(200,{access:{role:grant.role,departments:grant.departments,skills:grant.skills,languages:grant.languages,channels:grant.channels},provider:{name:'Signals Programmable Voice',ready:providerReady,businessNumberConfigured:businessNumberOwned,inboundNumbers:incomingNumbers.map(v=>({label:v.label,numberMasked:maskVoiceNumber(v.number)})),agentLineConfigured:Boolean(line),recordingMode:'off',ringGroupsConfigured:Object.keys(ringGroups).length}},origin);

  if(body.action==='inbox'){
    const departments=grant.departments.includes('*')?DEPARTMENTS:grant.departments;
    let routeQuery=admin.from('calloria_route_requests').select('route_ref,department,channel,language,priority,status,assigned_to,required_skills,created_at,assigned_at').eq('channel','voice').in('department',departments).order('created_at',{ascending:false}).limit(100);
    if(grant.role==='agent')routeQuery=routeQuery.eq('assigned_to',user.id);
    const {data:routes,error:routeError}=await routeQuery;if(routeError)throw new Error('Voice routing records could not be loaded.');
    const routeRefs=(routes||[]).map((v:any)=>v.route_ref);
    const {data:calls,error:callError}=routeRefs.length?await admin.from('calloria_voice_calls').select('call_ref,provider_call_sid,direction,status,route_ref,department,language,staff_user_id,ring_target_user_id,from_masked,to_masked,call_duration_seconds,created_at,answered_at,completed_at,callback_authorization_id').in('route_ref',routeRefs).order('created_at',{ascending:false}).limit(100):{data:[],error:null};
    if(callError)throw new Error('Voice call history could not be loaded.');
    const {data:callbacks,error:callbackError}=await admin.from('calloria_voice_callback_approvals').select('callback_ref,route_ref,requested_by,consent_type,requested_at,evidence_reference,status,decided_at,expires_at').in('route_ref',routeRefs.length?routeRefs:['00000000-0000-0000-0000-000000000000']).order('created_at',{ascending:false}).limit(100);
    if(callbackError)throw new Error('Callback approvals could not be loaded.');
    const filtered=(callbacks||[]).filter((row:any)=>row.requested_by===user.id||grant.role!=='agent');
    const {count:queuedCount}=await admin.from('calloria_route_requests').select('id',{count:'exact',head:true}).eq('channel','voice').eq('status','queued').in('department',departments);
    const {count:pendingCount}=await admin.from('calloria_voice_callback_approvals').select('id',{count:'exact',head:true}).eq('status','pending').in('route_ref',routeRefs.length?routeRefs:['00000000-0000-0000-0000-000000000000']);
    return jsonResponse(200,{calls:calls||[],routes:routes||[],callbacks:filtered,queuedCount:queuedCount||0,pendingCallbackApprovals:pendingCount||0,providerReady,lineConfigured:Boolean(line)},origin);
  }

  if(body.action==='request_callback'){
    const routeRef=cleanVoiceText(body.routeRef,40);const consentType=body.consentType;
    if(!line)return jsonResponse(409,{error:'Your verified agent phone line is not configured. A callback cannot be placed.'},origin);
    if(body.customerConfirmed!==true)return jsonResponse(400,{error:'Record only a callback the customer explicitly requested or agreed to.'},origin);
    const routeResult=await admin.from('calloria_route_requests').select('route_ref,department,channel,language,status,assigned_to,required_skills').eq('route_ref',routeRef).maybeSingle();
    if(routeResult.error)throw new Error('Related CALLORIA interaction could not be checked.');
    if(!routeAuthorized(grant,user.id,routeResult.data)||routeResult.data.channel!=='voice')return jsonResponse(403,{error:'Callback request must refer to an inbound voice interaction currently assigned to you.'},origin);
    if(!allowedDepartment(grant,routeResult.data.department))return jsonResponse(403,{error:'This callback belongs to a department outside your scope.'},origin);
    let phone:string;let evidence:string;try{phone=validE164Nigeria(body.customerPhone);evidence=validateCallbackEvidence(body.evidenceReference);}catch(error){return jsonResponse(400,{error:error instanceof Error?error.message:'The callback details are invalid.'},origin);}
    const requestedAt=new Date(body.requestedAt||'');if(Number.isNaN(requestedAt.getTime()))return jsonResponse(400,{error:'Enter the date and time the customer agreed to the callback.'},origin);
    const phoneHash=await hmacHex(LOOKUP_SECRET,phone);const callbackRef=makeRef('VCA');
    const {data,error}=await admin.rpc('calloria_voice_request_callback',{p_callback_ref:callbackRef,p_route_ref:routeRef,p_staff_user_id:user.id,p_phone_lookup_hash:phoneHash,p_consent_type:consentType,p_requested_at:requestedAt.toISOString(),p_evidence_reference:evidence});
    if(error)return jsonResponse(400,{error:error.message||'Callback authorization could not be requested.'},origin);
    return jsonResponse(200,{callback:data,message:'Callback request submitted for supervisor approval. No call has been placed.'},origin);
  }

  if(body.action==='decide_callback'){
    if(!['supervisor','people_admin'].includes(grant.role))return jsonResponse(403,{error:'Only a supervisor or People Administrator can approve callback requests.'},origin);
    const callbackRef=cleanVoiceText(body.callbackRef,40);const {data:approval,error:approvalError}=await admin.from('calloria_voice_callback_approvals').select('callback_ref,route_ref,requested_by,status').eq('callback_ref',callbackRef).maybeSingle();
    if(approvalError)throw new Error('Callback approval request could not be loaded.');if(!approval)return jsonResponse(404,{error:'Callback request not found.'},origin);
    const {data:route,error:routeError}=await admin.from('calloria_route_requests').select('department,status').eq('route_ref',approval.route_ref).maybeSingle();
    if(routeError)throw new Error('Callback department could not be checked.');if(!route||!allowedDepartment(grant,route.department))return jsonResponse(403,{error:'The callback is outside your supervisor department scope.'},origin);
    if(approval.requested_by===user.id)return jsonResponse(403,{error:'You cannot approve your own callback request.'},origin);
    const {data,error}=await admin.rpc('calloria_voice_decide_callback',{p_callback_ref:callbackRef,p_supervisor_id:user.id,p_approve:body.approve===true,p_note:cleanVoiceText(body.note,300)});
    if(error)return jsonResponse(409,{error:error.message||'Callback decision could not be saved.'},origin);
    return jsonResponse(200,{decision:data},origin);
  }

  if(body.action==='start_outbound'){
    if(!providerReady)return jsonResponse(503,{error:'Signals voice, encryption or public callback configuration is incomplete. No call was attempted.'},origin);
    if(!line)return jsonResponse(403,{error:'No verified agent phone line is configured for this staff account.'},origin);
    const routeRef=cleanVoiceText(body.routeRef,40);const callbackRef=cleanVoiceText(body.callbackRef,40);let customerPhone:string;try{customerPhone=validE164Nigeria(body.customerPhone);}catch(error){return jsonResponse(400,{error:error instanceof Error?error.message:'The customer number is invalid.'},origin);}
    const {data:route,error:routeError}=await admin.from('calloria_route_requests').select('route_ref,department,channel,language,status,assigned_to,required_skills').eq('route_ref',routeRef).maybeSingle();
    if(routeError)throw new Error('Related interaction could not be checked.');if(!routeAuthorized(grant,user.id,route)||route.channel!=='voice')return jsonResponse(403,{error:'Outbound call requires an inbound voice interaction currently assigned to you.'},origin);
    const readiness=await admin.rpc('calloria_voice_agent_ready',{p_agent_id:user.id,p_department:route.department,p_language:route.language,p_required_skill:(route.required_skills||[])[0]||'general_customer_care',p_max_concurrency:grant.maxConcurrency,p_ignore_route_ref:routeRef});
    if(readiness.error||readiness.data!==true)return jsonResponse(409,{error:'Your published shift or customer-work availability does not permit an outbound call now.'},origin);
    const phoneHash=await hmacHex(LOOKUP_SECRET,customerPhone);const {data:callbackApproval,error:callbackError}=await admin.from('calloria_voice_callback_approvals').select('callback_ref,status,expires_at').eq('callback_ref',callbackRef).eq('route_ref',routeRef).eq('requested_by',user.id).eq('phone_lookup_hash',phoneHash).maybeSingle();
    if(callbackError)throw new Error('Callback approval could not be checked.');if(!callbackApproval||callbackApproval.status!=='approved'||new Date(callbackApproval.expires_at).getTime()<=Date.now())return jsonResponse(403,{error:'The callback is not approved, does not match this number, or has expired.'},origin);
    const customerEncrypted=await encrypt(customerPhone,DATA_KEY,'customer-number');const agentEncrypted=await encrypt(line.phone,DATA_KEY,'agent-number');
    const callRef=makeRef('VC');const idempotency=cleanVoiceText(body.idempotencyKey,80);
    if(!/^[0-9a-f-]{36}$/i.test(idempotency))return jsonResponse(400,{error:'A valid unique call request ID is required.'},origin);
    const reserved=await admin.rpc('calloria_voice_reserve_outbound',{p_call_ref:callRef,p_idempotency_key:idempotency,p_route_ref:routeRef,p_staff_user_id:user.id,p_callback_ref:callbackRef,p_phone_lookup_hash:phoneHash,p_customer_ciphertext:customerEncrypted.ciphertext,p_customer_iv:customerEncrypted.iv,p_agent_ciphertext:agentEncrypted.ciphertext,p_agent_iv:agentEncrypted.iv,p_customer_masked:maskVoiceNumber(customerPhone),p_agent_masked:maskVoiceNumber(line.phone),p_max_concurrency:grant.maxConcurrency});
    if(reserved.error)return jsonResponse(409,{error:reserved.error.message||'The outbound call could not be reserved.'},origin);
    const reservation=reserved.data as any;
    if(reservation.duplicate)return jsonResponse(200,{callRef:reservation.call_ref,status:reservation.status,providerCallSid:reservation.provider_call_sid||null,duplicate:true,message:reservation.status==='uncertain'||reservation.status==='initiated'?'This call request was already reserved. Check the Signals console before retrying; CALLORIA will not place a second call.':'This callback request has already been processed.'},origin);

    const xml=`<Response><Say>CALLORIA is connecting your approved customer callback.</Say><Dial callerId="${businessNumber}"><Number>${customerPhone}</Number></Dial></Response>`;
    const params=new URLSearchParams();params.set('To',line.phone);params.set('From',businessNumber);params.set('Twiml',xml);params.set('StatusCallback',publicActionUrl('status',{callRef}));params.set('StatusCallbackMethod','POST');for(const event of ['initiated','ringing','answered','completed'])params.append('StatusCallbackEvent',event);
    try {
      const {response,result}=await providerCall(params);
      if(response.status>=200&&response.status<300&&typeof result?.sid==='string'&&/^CA[0-9a-fA-F]{32}$/.test(result.sid)){
        await updateFinalize(admin,callRef,result.sid,'queued',null);
        return jsonResponse(200,{callRef,status:'queued',message:'Signals accepted the callback. Your verified agent handset will ring first; when answered, the customer is called with the configured RuffNeck caller ID. Recording is off.'},origin);
      }
      const definite= response.status>=400&&response.status<500;
      await updateFinalize(admin,callRef,null,definite?'rejected':'uncertain',String(result?.code||response.status));
      return jsonResponse(definite?502:202,{callRef,status:definite?'rejected':'uncertain',message:definite?'The voice provider rejected this request. Review the provider error before requesting a new callback.':'Provider acceptance could not be confirmed. Check the Signals console before retrying; CALLORIA blocks duplicate attempts.'},origin);
    } catch {
      await updateFinalize(admin,callRef,null,'uncertain','network-timeout').catch(()=>{});
      return jsonResponse(202,{callRef,status:'uncertain',message:'The provider response timed out. A call may have been placed. Check Signals call history before any further action; this callback cannot be retried here.'},origin);
    }
  }
  return jsonResponse(400,{error:'Unsupported voice action.'},origin);
}

Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('origin');
  if(request.method==='OPTIONS')return jsonResponse(204,{},origin);
  if(request.method==='GET')return jsonResponse(405,{error:'Use the configured voice webhook or authenticated staff API.'},origin);
  const url=new URL(request.url);
  const flow=url.searchParams.get('flow');
  const isProvider=['inbound','language','department','dial-result','status'].includes(flow||'');
  if(isProvider){
    if(request.method!=='POST')return xmlResponse('<Response><Say>Unsupported request method.</Say><Hangup/></Response>',405);
    if(!SUPABASE_URL||!SERVICE_KEY)return xmlResponse('<Response><Say>Customer care is temporarily unavailable.</Say><Hangup/></Response>',503);
    const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    try{return await processProviderWebhook(request,admin,flow!);}catch{return xmlResponse('<Response><Say>We could not complete this call step. Please try again later.</Say><Hangup/></Response>',503);}
  }
  if(request.method!=='POST')return jsonResponse(405,{error:'Method not allowed.'},origin);
  if(!origin||!STAFF_ORIGINS.includes(origin.replace(/\/$/,'')))return jsonResponse(403,{error:'Origin is not permitted.'});
  if(!SUPABASE_URL||!SERVICE_KEY)return jsonResponse(503,{error:'CALLORIA voice service configuration is incomplete.'},origin);
  let body:any;try{body=await request.json();}catch{return jsonResponse(400,{error:'Invalid request body.'},origin);}
  if(!body||typeof body!=='object'||Array.isArray(body))return jsonResponse(400,{error:'Invalid request body.'},origin);
  const admin=createClient(SUPABASE_URL,SERVICE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  try{return await apiHandler(request,body,admin,origin.replace(/\/$/,''));}catch(error){return jsonResponse(500,{error:error instanceof Error?error.message:'CALLORIA voice request failed.'},origin);}
});
