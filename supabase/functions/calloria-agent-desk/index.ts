import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(v => v.trim()).filter(Boolean);
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const encryptionSecret = Deno.env.get('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET') || '';
const accessRaw = Deno.env.get('CALLORIA_AGENT_WORKSPACE_ACCESS') || '';
const encoder = new TextEncoder();
const departments = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const channels = ['voice','email','live_chat','social','whatsapp','website','portal','game','back_office'];
const priorities = ['low','normal','high','urgent'];
const statuses = ['pending','claimed','active','on_hold','after_contact_work','resolved','escalated','cancelled'];
const transitions: Record<string, string[]> = {
  pending: ['claimed','cancelled'], claimed: ['active','pending','cancelled'],
  active: ['on_hold','after_contact_work','escalated'], on_hold: ['active','escalated'],
  after_contact_work: ['resolved','escalated'], escalated: ['claimed','cancelled'],
  resolved: [], cancelled: []
};
const dispositions = ['information_provided','self_service_guided','technical_resolution','case_created','referred_to_specialist','complaint_escalated','sales_enquiry_recorded','customer_requested_follow_up','no_response','resolved_without_action'];
interface Access { role: 'agent'|'supervisor'; departments: string[] }
let accessMap: Record<string, Access> = {};
let accessInvalid = false;
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('access map invalid');
  for (const [userId, raw] of Object.entries(parsed)) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) throw new Error('user id invalid');
    const value = raw as any;
    if (!value || !['agent','supervisor'].includes(value.role) || !Array.isArray(value.departments) || value.departments.some((d: unknown) => typeof d !== 'string')) throw new Error('staff grant invalid');
    const granted = value.departments.map((d: string) => clean(d, 120));
    if (granted.some((d: string) => d !== '*' && !departments.includes(d))) throw new Error('unknown department');
    if (value.role === 'supervisor' && !granted.includes('*')) throw new Error('supervisors must have wildcard department grant');
    if (value.role === 'agent' && (!granted.length || granted.includes('*'))) throw new Error('agents need explicit departments');
    accessMap[userId] = { role: value.role, departments: granted };
  }
} catch { accessInvalid = true; accessMap = {}; }

function clean(value: unknown, max = 300): string { return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max); }
function uuid(value: unknown): string { const id = clean(value, 64); return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ? id : ''; }
function json(status: number, body: Record<string, unknown>, origin: string | null) {
  const headers = { 'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin', 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  return new Response(JSON.stringify(body), { status, headers });
}
function b64(bytes: Uint8Array): string { let raw=''; for (const b of bytes) raw += String.fromCharCode(b); return btoa(raw).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,''); }
function unb64(value: string): Uint8Array { const s=value.replace(/-/g,'+').replace(/_/g,'/'); const raw=atob(s+'='.repeat((4-s.length%4)%4)); return Uint8Array.from(raw,c=>c.charCodeAt(0)); }
async function key(): Promise<CryptoKey> {
  if (encoder.encode(encryptionSecret).length < 32) throw new Error('CALLORIA_AGENT_DESK_ENCRYPTION_SECRET must contain at least 32 bytes.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(encryptionSecret), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'HKDF', hash:'SHA-256', salt:encoder.encode('CALLORIA-AGENT-DESK-v1'), info:encoder.encode('interaction-summary-encryption') }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
}
async function encrypt(value: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, await key(), encoder.encode(value));
  return { ciphertext:b64(new Uint8Array(cipher)), iv:b64(iv) };
}
async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const clear = await crypto.subtle.decrypt({ name:'AES-GCM', iv:unb64(iv) }, await key(), unb64(ciphertext));
  return new TextDecoder().decode(clear);
}
function containsRestrictedData(value: string): boolean {
  return /(password|passcode|one[ -]?time password|\botp\b|pin code|cvv|card number|api key|access token)/i.test(value)
    || /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /(?:\+?234|0)[789][01]\d{8}\b/.test(value)
    || /(?:\+?\d[\d ()-]{7,}\d)/.test(value);
}
function slaMinutes(priority: string): number { return ({ urgent:5, high:15, normal:60, low:240 } as Record<string,number>)[priority] || 60; }
function ref(): string {
  const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; const bytes = crypto.getRandomValues(new Uint8Array(6));
  const token = Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
  const date = new Date(); const ymd = `${String(date.getUTCFullYear()).slice(-2)}${String(date.getUTCMonth()+1).padStart(2,'0')}${String(date.getUTCDate()).padStart(2,'0')}`;
  return `CW-${ymd}-${token}`;
}
async function requireStaff(request: Request, admin: ReturnType<typeof createClient>) {
  if (accessInvalid) return { error:'Staff access map is invalid. Correct CALLORIA_AGENT_WORKSPACE_ACCESS before enabling the desk.', status:503 };
  const bearer = request.headers.get('Authorization') || '';
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
  if (!token) return { error:'Sign in is required.', status:401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error:'Your staff session is invalid or expired.', status:401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error:'This account is not authorised for CALLORIA Agent Desk.', status:403 };
  return { user:data.user, access:grant };
}
function canDepartment(access: Access, department: string): boolean { return access.departments.includes('*') || access.departments.includes(department); }
function allowedDepts(access: Access): string[] { return access.departments.includes('*') ? departments : access.departments; }
function publicItem(item: any) {
  const { summary_ciphertext, summary_iv, outcome_ciphertext, outcome_iv, ...safe } = item;
  return safe;
}

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' } });
  if (request.method !== 'POST') return json(405, { error:'Method not allowed.' }, origin);
  if (!origin || !allowedOrigins.includes(origin)) return json(403, { error:'Origin is not authorised.' }, origin);
  if (!supabaseUrl || !serviceKey) return json(503, { error:'Supabase service configuration is incomplete.' }, origin);
  let body: any;
  try { const raw = await request.text(); if (raw.length > 10000) return json(413,{error:'Request is too large.'},origin); body = JSON.parse(raw); }
  catch { return json(400,{error:'Request body must be valid JSON.'},origin); }
  const admin = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
  const auth = await requireStaff(request, admin);
  if ('error' in auth) return json(auth.status, { error:auth.error }, origin);
  const user = auth.user!; const access = auth.access!; const agentDepartments = allowedDepts(access);
  const action = clean(body.action, 40);
  try {
    if (action === 'whoami') return json(200,{ access:{ role:access.role, departments:access.departments } },origin);

    if (action === 'queue') {
      const requested = clean(body.department,120);
      const scope = requested && requested !== 'all' ? (canDepartment(access,requested) ? [requested] : []) : agentDepartments;
      if (!scope.length) return json(403,{error:'You do not have access to that department.'},origin);
      let query = admin.from('calloria_ops_work_items').select('id,work_ref,department,channel,direction,priority,platform_id,subject,status,assigned_to,claimed_at,started_at,due_at,disposition,created_at,updated_at,version').in('department',scope).order('created_at',{ascending:false}).limit(100);
      const status = clean(body.status,32); const channel = clean(body.channel,24);
      if (statuses.includes(status)) query = query.eq('status',status);
      if (channels.includes(channel)) query = query.eq('channel',channel);
      const {data,error} = await query; if(error) throw error;
      return json(200,{items:data||[]},origin);
    }

    if (action === 'create_item') {
      const department = clean(body.department,120); const channel = clean(body.channel,24); const direction=clean(body.direction || 'inbound',12); const priority=clean(body.priority || 'normal',12);
      const platformId=clean(body.platformId,40); const caseReference=clean(body.caseReference,24).toUpperCase(); const subject=clean(body.subject,140); const summary=clean(body.summary,600); const customerId=body.crmCustomerId ? uuid(body.crmCustomerId) : '';
      if (!canDepartment(access,department) || !departments.includes(department)) return json(403,{error:'You do not have access to the selected department.'},origin);
      if (!channels.includes(channel) || !['inbound','outbound','internal'].includes(direction) || !priorities.includes(priority)) return json(400,{error:'Select supported channel, direction and priority values.'},origin);
      if (platformId && !['ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke'].includes(platformId)) return json(400,{error:'Unknown RuffNeck platform reference.'},origin);
      if (subject.length<3 || summary.length<8 || containsRestrictedData(`${subject} ${summary}`)) return json(400,{error:'Enter a clear, non-sensitive summary. Do not include customer contact details, credentials or payment information.'},origin);
      if (body.crmCustomerId && !customerId) return json(400,{error:'CRM reference must be a UUID.'},origin);
      if (caseReference && !/^CC-[0-9]{6}-[A-Z2-9]{6}$/.test(caseReference)) return json(400,{error:'Enter a valid CALLORIA case reference or leave it blank.'},origin);
      const encrypted = await encrypt(summary);
      const dueAt = new Date(Date.now()+slaMinutes(priority)*60000).toISOString();
      let created:any=null; let insertError:any=null;
      for(let attempt=0;attempt<3;attempt++) {
        const {data,error}=await admin.from('calloria_ops_work_items').insert({ work_ref:ref(),department,channel,direction,priority,platform_id:platformId||null,crm_customer_id:customerId||null,case_reference:caseReference||null,subject,summary_ciphertext:encrypted.ciphertext,summary_iv:encrypted.iv,due_at:dueAt,created_by:user.id,last_actor_id:user.id,last_actor_role:access.role }).select('id,work_ref,department,channel,direction,priority,platform_id,subject,status,assigned_to,due_at,created_at,version').single();
        if(!error){created=data;break;} insertError=error; if(error.code!=='23505') break;
      }
      if(!created) throw insertError || new Error('Unable to create work item.');
      return json(201,{item:created},origin);
    }

    const itemId=uuid(body.itemId); if(!itemId) return json(400,{error:'A valid work-item ID is required.'},origin);
    const {data:item,error:itemError}=await admin.from('calloria_ops_work_items').select('*').eq('id',itemId).maybeSingle();
    if(itemError) throw itemError;
    if(!item) return json(404,{error:'Work item was not found.'},origin);
    if(!canDepartment(access,item.department)) return json(403,{error:'You do not have access to this work item.'},origin);

    if (action === 'get_item') {
      const [{data:events,error:eventError},summary,outcome] = await Promise.all([
        admin.from('calloria_ops_events').select('event_type,actor_role,from_status,to_status,created_at').eq('work_item_id',itemId).order('created_at',{ascending:true}).limit(80),
        decrypt(item.summary_ciphertext,item.summary_iv),
        item.outcome_ciphertext && item.outcome_iv ? decrypt(item.outcome_ciphertext,item.outcome_iv) : Promise.resolve('')
      ]);
      if(eventError) throw eventError;
      return json(200,{item:{...publicItem(item),summary,outcomeSummary:outcome,events:(events||[]).map((event:any)=>({...event,actor_label:event.actor_role==='supervisor'?'Supervisor':'Agent'}))}},origin);
    }

    if (action === 'claim') {
      const {data,error}=await admin.rpc('calloria_ops_claim_work_item',{p_item_id:itemId,p_agent_id:user.id,p_actor_role:access.role,p_departments:agentDepartments});
      if(error) throw error;
      const claimed=Array.isArray(data)?data[0]:null;
      if(!claimed) return json(409,{error:'Another agent may have claimed this item, or it is no longer available.'},origin);
      return json(200,{item:publicItem(claimed)},origin);
    }

    if (action === 'transition') {
      const next=clean(body.nextStatus,32); const expected=Number(body.expectedVersion);
      if(!statuses.includes(next) || !Number.isInteger(expected)) return json(400,{error:'A valid next status and version are required.'},origin);
      if(access.role!=='supervisor' && item.assigned_to!==user.id) return json(403,{error:'Only the assigned agent or a supervisor can change this interaction.'},origin);
      if(!(transitions[item.status]||[]).includes(next)) return json(409,{error:`Invalid status change from ${item.status} to ${next}.`},origin);
      const patch:any={status:next,version:item.version+1,last_actor_id:user.id,last_actor_role:access.role};
      if(next==='active' && !item.started_at) patch.started_at=new Date().toISOString();
      if(item.status==='on_hold' && item.hold_started_at) {
        patch.hold_seconds=(item.hold_seconds||0)+Math.max(0,Math.floor((Date.now()-new Date(item.hold_started_at).getTime())/1000));
        patch.hold_started_at=null;
      }
      if(next==='on_hold') patch.hold_started_at=new Date().toISOString();
      if(next==='escalated') { patch.assigned_to=null; patch.claimed_at=null; }
      if(next==='resolved') patch.resolved_at=new Date().toISOString();
      if(next==='cancelled') patch.resolved_at=new Date().toISOString();
      const {data,error}=await admin.from('calloria_ops_work_items').update(patch).eq('id',itemId).eq('version',expected).select('*').maybeSingle();
      if(error) throw error; if(!data) return json(409,{error:'This item changed in another session. Refresh and review its current state.'},origin);
      return json(200,{item:publicItem(data)},origin);
    }

    if (action === 'wrapup') {
      const disposition=clean(body.disposition,48); const summary=clean(body.summary,600); const expected=Number(body.expectedVersion);
      if(item.status!=='after_contact_work' || (access.role!=='supervisor' && item.assigned_to!==user.id)) return json(409,{error:'The work item must be in after-contact work and assigned to you before completion.'},origin);
      if(!dispositions.includes(disposition) || summary.length<8 || containsRestrictedData(summary)) return json(400,{error:'Choose a valid disposition and enter a non-sensitive outcome summary.'},origin);
      if(!Number.isInteger(expected)) return json(400,{error:'A valid item version is required.'},origin);
      const encrypted=await encrypt(summary);
      const {data,error}=await admin.from('calloria_ops_work_items').update({status:'resolved',disposition,outcome_ciphertext:encrypted.ciphertext,outcome_iv:encrypted.iv,resolved_at:new Date().toISOString(),version:item.version+1,last_actor_id:user.id,last_actor_role:access.role}).eq('id',itemId).eq('version',expected).select('*').maybeSingle();
      if(error) throw error; if(!data) return json(409,{error:'This item changed in another session. Refresh and review its current state.'},origin);
      return json(200,{item:publicItem(data)},origin);
    }
    return json(400,{error:'Unsupported Agent Desk action.'},origin);
  } catch(error) {
    console.error('calloria-agent-desk request failed:', error instanceof Error ? error.message : 'unknown error');
    return json(500,{error:'Agent Desk could not complete the request. Check configuration and server logs.'},origin);
  }
});
