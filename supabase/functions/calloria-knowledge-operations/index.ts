import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (name: string) => Deno.env.get(name) || '';
const supabaseUrl = env('SUPABASE_URL');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = env('CALLORIA_ALLOWED_ORIGINS').split(',').map(v => v.trim()).filter(Boolean);
const accessRaw = env('CALLORIA_ROUTING_ACCESS');
const MAX_BODY = 18000;
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const PRODUCT_IDS = ['ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Grant = { role: 'agent'|'supervisor'|'people_admin'; departments: string[]; skills: string[]; channels: string[]; languages: string[]; maxConcurrency: number };
const accessMap: Record<string, Grant> = {};
let accessInvalid = false;
const clean = (v: unknown, max = 600) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid staff access map.');
  for (const [id, raw] of Object.entries(parsed)) {
    const row = raw as any;
    if (!UUID.test(id) || !row || !['agent','supervisor','people_admin'].includes(row.role)) throw new Error('Invalid staff entry.');
    if (!Array.isArray(row.departments) || !row.departments.length || !Array.isArray(row.skills) || !Array.isArray(row.channels) || !Array.isArray(row.languages)) throw new Error('Incomplete staff scope.');
    const departments = row.departments.map((x: unknown) => clean(x, 120));
    if (departments.some((x: string) => x !== '*' && !DEPARTMENTS.includes(x))) throw new Error('Unknown department.');
    if (row.role === 'agent' && departments.includes('*')) throw new Error('Agents require explicit department scope.');
    if (row.role === 'people_admin' && !departments.includes('*')) throw new Error('People administrators require wildcard scope.');
    accessMap[id] = { role: row.role, departments, skills: row.skills.map((x: unknown) => clean(x,40)), channels: row.channels.map((x: unknown) => clean(x,24)), languages: row.languages.map((x: unknown) => clean(x,8)), maxConcurrency: Math.max(1, Math.min(10, Number(row.maxConcurrency) || 1)) };
  }
} catch { accessInvalid = true; }
function response(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin && allowedOrigins.includes(origin) ? origin : 'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin' } });
}
function departmentsFor(grant: Grant) { return grant.departments.includes('*') ? DEPARTMENTS : grant.departments; }
function allowedDepartmentTargets(grant: Grant, requested: string[]) {
  const scope = departmentsFor(grant);
  return requested.length === 0 ? scope : requested.filter(value => scope.includes(value));
}
function validHttps(raw: unknown): string | null {
  const value = clean(raw, 400);
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null; } catch { return null; }
}
function validSlug(value: unknown) { return /^[a-z0-9][a-z0-9-]{1,99}$/.test(clean(value,100).toLowerCase()); }
function containsSensitiveNotice(value: string) {
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(value)
    || /(?:\+?234|0)[\s().-]*[789][01]\d[\s().-]*\d{3}[\s().-]*\d{4}\b/.test(value)
    || /\b\d{10,19}\b/.test(value)
    || /\b(password|passcode|one[- ]time password|\botp\b|access token|api key)\s*(?:[:=#]|is)\s*[A-Za-z0-9._~+/-]{4,}/i.test(value);
}
function strings(value: unknown, maxItems = 40, maxLength = 180): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(v => clean(v,maxLength)).filter(Boolean).slice(0,maxItems);
}
function normalisePayload(type: string, raw: any): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (type === 'article') {
    const body = String(raw.body ?? '').trim().slice(0,12000);
    if (body.length < 30) return null;
    return { category: clean(raw.category || 'general',80), body, tags: strings(raw.tags,40,60), audience: ['customer','staff','both'].includes(raw.audience) ? raw.audience : 'customer' };
  }
  if (type === 'service') {
    const name = clean(raw.name,180), description = clean(raw.description,5000);
    if (name.length < 3 || description.length < 20) return null;
    return { name, description, category: clean(raw.category || 'service',80), active: raw.active !== false };
  }
  if (type === 'platform') {
    const name = clean(raw.name,180), url = validHttps(raw.url), purpose = clean(raw.purpose,1600);
    if (name.length < 3 || !url || purpose.length < 20) return null;
    const selfService = (Array.isArray(raw.self_service) ? raw.self_service : []).slice(0,30).map((item: any) => ({ task: clean(item?.task,180), steps: strings(item?.steps,20,500) })).filter((item: any) => item.task && item.steps.length);
    return { name, url, purpose, features: strings(raw.features), support_topics: strings(raw.support_topics), self_service: selfService, limitations: clean(raw.limitations,1800), active: raw.active !== false };
  }
  return null;
}
function sourceRequired(type: string, category: string) {
  return type === 'platform' || type === 'service' || ['psychology','wellbeing','parenting','safeguarding','security','health','legal','financial','product_knowledge','platform_support','service_enquiry','complaint_recovery','pricing','plans'].includes(category.toLowerCase());
}
function sourceIsFresh(url: string | null, verified: string | null) {
  if (!url || !verified) return false;
  const time = new Date(verified).getTime();
  return Number.isFinite(time) && time <= Date.now() && Date.now() - time <= 180 * 86400000;
}
async function audit(admin: any, actor: string, eventType: string, entityType: string, entityId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await admin.from('calloria_km_audit').insert({ actor_user_id: actor, event_type: eventType, entity_type: entityType, entity_id: entityId, metadata });
  if (error) console.error('Knowledge audit insert failed:', clean(error.message,160));
}
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok',{headers:{'Access-Control-Allow-Origin':origin && allowedOrigins.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS',Vary:'Origin'}});
  if (req.method !== 'POST') return response(405,{error:'POST required.'},origin);
  if (!origin || !allowedOrigins.includes(origin)) return response(403,{error:'This origin is not authorised.'},origin);
  if (!supabaseUrl || !serviceKey) return response(503,{error:'Knowledge Operations is not configured.'},origin);
  if (accessInvalid || Object.keys(accessMap).length === 0) return response(503,{error:'CALLORIA staff access is not configured.'},origin);
  const auth = req.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return response(401,{error:'Staff sign-in is required.'},origin);
  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_BODY) return response(413,{error:'Request is too large.'},origin);
  const admin = createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const {data:userData,error:userError} = await admin.auth.getUser(token);
    const user = userData?.user;
    if (userError || !user) return response(401,{error:'Staff session is invalid or expired.'},origin);
    const grant = accessMap[user.id];
    if (!grant) return response(403,{error:'This account is not authorised for Knowledge Operations.'},origin);
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY) return response(413,{error:'Request is too large.'},origin);
    let body:any = null;
    try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { return response(400,{error:'Request must be valid JSON.'},origin); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return response(400,{error:'Request must be valid JSON.'},origin);
    const action = clean(body.action,40);

    if (action === 'whoami') return response(200,{access:{role:grant.role,canDraft:grant.role!=='agent',canReview:grant.role==='people_admin',departments:departmentsFor(grant)}},origin);

    if (action === 'list_records') {
      let query = admin.from('calloria_km_records').select('id,record_type,record_key,title,category,status,version,change_summary,source_url,source_verified_at,authored_by,reviewed_by,updated_at').order('updated_at',{ascending:false}).limit(150);
      if (grant.role === 'agent') query = query.eq('status','published');
      else if (grant.role === 'supervisor') query = query.or(`status.eq.published,authored_by.eq.${user.id}`);
      const {data,error} = await query;
      if (error) throw error;
      return response(200,{records:data || []},origin);
    }
    if (action === 'get_record') {
      const id = clean(body.id,60);
      if (!UUID.test(id)) return response(400,{error:'Invalid knowledge record reference.'},origin);
      const {data,error} = await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle();
      if (error) throw error;
      if (!data || (grant.role === 'agent' && data.status !== 'published') || (grant.role === 'supervisor' && data.status !== 'published' && data.authored_by !== user.id)) return response(404,{error:'Knowledge record was not found.'},origin);
      return response(200,{record:data},origin);
    }
    if (action === 'save_draft') {
      if (grant.role === 'agent') return response(403,{error:'Agents have read-only access to published knowledge.'},origin);
      const type = clean(body.record_type,20), key = clean(body.record_key,100).toLowerCase(), title = clean(body.title,180), category = clean(body.category || 'general',80), summary = clean(body.change_summary,600);
      const payload = normalisePayload(type,body.payload);
      if (!['article','platform','service'].includes(type) || !validSlug(key) || title.length < 2 || summary.length < 3 || !payload) return response(400,{error:'Check the knowledge type, slug, title, structured content and change summary.'},origin);
      if(containsSensitiveNotice(`${title}\n${summary}\n${JSON.stringify(payload)}`))return response(400,{error:'Knowledge records must not contain customer contact details, account-like numbers or credential values.'},origin);
      const sourceUrl = validHttps(body.source_url);
      if (body.source_url && !sourceUrl) return response(400,{error:'Source URL must be valid HTTPS without embedded credentials.'},origin);
      let verifiedAt: string | null = null;
      if (body.source_verified_at) { const date = new Date(body.source_verified_at); if (Number.isNaN(date.getTime())) return response(400,{error:'Source verification date is invalid.'},origin); verifiedAt = date.toISOString(); }
      const id = clean(body.id,60);
      let saved: any;
      if (id) {
        if (!UUID.test(id)) return response(400,{error:'Invalid draft reference.'},origin);
        const {data:existing,error:findError} = await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle();
        if (findError) throw findError;
        if (!existing || !['draft','changes_requested'].includes(existing.status) || (existing.authored_by !== user.id && grant.role !== 'people_admin')) return response(409,{error:'This record is not editable by your account or is already in review.'},origin);
        if(existing.record_type!==type || existing.record_key!==key)return response(409,{error:'Record type and slug are fixed after the first save. Start a new record for a different identity.'},origin);
        const update = await admin.from('calloria_km_records').update({title,category,payload,change_summary:summary,source_url:sourceUrl,source_verified_at:verifiedAt,status:'draft'}).eq('id',id).select('*').single();
        if (update.error) throw update.error;
        saved = update.data;
      } else {
        const {data:latest,error:latestError} = await admin.from('calloria_km_records').select('version').eq('record_type',type).eq('record_key',key).order('version',{ascending:false}).limit(1).maybeSingle();
        if (latestError) throw latestError;
        const insert = await admin.from('calloria_km_records').insert({record_type:type,record_key:key,title,category,payload,change_summary:summary,source_url:sourceUrl,source_verified_at:verifiedAt,version:(Number(latest?.version)||0)+1,authored_by:user.id,status:'draft'}).select('*').single();
        if (insert.error) throw insert.error;
        saved = insert.data;
      }
      await audit(admin,user.id,'draft_saved','record',saved.id,{record_type:type,record_key:key,version:saved.version});
      return response(200,{record:saved},origin);
    }
    if (action === 'submit_review') {
      const id=clean(body.id,60); if (!UUID.test(id)) return response(400,{error:'Invalid record reference.'},origin);
      const {data:row,error:findError}=await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle();
      if (findError) throw findError;
      if (!row || !['draft','changes_requested'].includes(row.status) || (row.authored_by!==user.id && grant.role!=='people_admin')) return response(409,{error:'Only an editable draft can be submitted.'},origin);
      const update=await admin.from('calloria_km_records').update({status:'in_review'}).eq('id',id).select('*').single(); if(update.error)throw update.error;
      await audit(admin,user.id,'submitted','record',id,{version:row.version});
      return response(200,{record:update.data},origin);
    }
    if (action === 'review') {
      if (grant.role !== 'people_admin') return response(403,{error:'Only a knowledge administrator can review submissions.'},origin);
      const id=clean(body.id,60), decision=clean(body.decision,30), note=clean(body.note,1200);
      if (!UUID.test(id) || !['approved','changes_requested','rejected'].includes(decision)) return response(400,{error:'Choose a valid review decision.'},origin);
      const {data:row,error:findError}=await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle(); if(findError)throw findError;
      if (!row || row.status!=='in_review') return response(409,{error:'Only submissions awaiting review can be reviewed.'},origin);
      if (row.authored_by===user.id) return response(403,{error:'The author cannot approve or reject their own content.'},origin);
      const {error:eventError}=await admin.from('calloria_km_review_events').insert({record_id:id,reviewer_user_id:user.id,decision,note}); if(eventError)throw eventError;
      const {data:updated,error:updateError}=await admin.from('calloria_km_records').update({status:decision,reviewed_by:user.id,review_due_at:null}).eq('id',id).select('*').single(); if(updateError)throw updateError;
      await audit(admin,user.id,'reviewed','record',id,{decision});
      return response(200,{record:updated},origin);
    }
    if (action === 'publish') {
      if (grant.role !== 'people_admin') return response(403,{error:'Only a knowledge administrator can publish approved content.'},origin);
      const id=clean(body.id,60); if(!UUID.test(id))return response(400,{error:'Invalid record reference.'},origin);
      const {data:row,error:findError}=await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle(); if(findError)throw findError;
      if(!row || row.status!=='approved' || row.reviewed_by===row.authored_by || !row.reviewed_by)return response(409,{error:'This record needs independent approval before publication.'},origin);
      if(sourceRequired(row.record_type,row.category) && !sourceIsFresh(row.source_url,row.source_verified_at))return response(422,{error:'A current HTTPS source must be verified within the last 180 days before publishing this knowledge.'},origin);
      const {data:published,error:publishError}=await admin.rpc('calloria_km_publish_record',{p_record_id:id,p_actor_user_id:user.id});
      if(publishError){console.error('Atomic knowledge publish failed:',clean(publishError.message,180));return response(422,{error:'Publication failed. Confirm independent approval, source freshness and Phase 4 knowledge tables.'},origin);}
      const {data:updated,error:updateError}=await admin.from('calloria_km_records').select('*').eq('id',id).single();if(updateError)throw updateError;
      return response(200,{record:updated,publication:published,knowledge_synced:true},origin);
    }
    if (action === 'retire') {
      if (grant.role !== 'people_admin') return response(403,{error:'Only a knowledge administrator can retire published information.'},origin);
      const id=clean(body.id,60); if(!UUID.test(id))return response(400,{error:'Invalid record reference.'},origin);
      const {data:row,error:findError}=await admin.from('calloria_km_records').select('*').eq('id',id).maybeSingle(); if(findError)throw findError;
      if(!row || row.status!=='published')return response(409,{error:'Only published records can be retired.'},origin);
      const {data:retired,error:retireError}=await admin.rpc('calloria_km_retire_record',{p_record_id:id,p_actor_user_id:user.id});
      if(retireError){console.error('Atomic knowledge retirement failed:',clean(retireError.message,180));return response(422,{error:'Retirement failed. Confirm the record is still published.'},origin);}
      const {data:updated,error:updateError}=await admin.from('calloria_km_records').select('*').eq('id',id).single();if(updateError)throw updateError;
      return response(200,{record:updated,retirement:retired},origin);
    }
    if (action === 'list_announcements') {
      const now = new Date().toISOString();
      const {data:published,error:publishedError}=await admin.from('calloria_km_announcements').select('id,title,body,category,product_ids,target_departments,starts_at,ends_at,requires_ack,status,authored_by,published_at').eq('status','published').lte('starts_at',now).gte('ends_at',now).order('starts_at',{ascending:false}).limit(80);
      if(publishedError)throw publishedError;
      let drafts:any[]=[];
      if(grant.role==='people_admin' || grant.role==='supervisor'){
        let draftQuery=admin.from('calloria_km_announcements').select('id,title,body,category,product_ids,target_departments,starts_at,ends_at,requires_ack,status,authored_by,published_at').eq('status','draft').order('updated_at',{ascending:false}).limit(40);
        if(grant.role==='supervisor')draftQuery=draftQuery.eq('authored_by',user.id);
        const {data,error}=await draftQuery;
        if(error)throw error; drafts=data||[];
      }
      const rows=[...(published||[]),...drafts].filter((row:any)=>!row.target_departments?.length || row.target_departments.some((d:string)=>departmentsFor(grant).includes(d)));
      const ids=rows.filter((row:any)=>row.status==='published'&&row.requires_ack).map((row:any)=>row.id);
      const acks=ids.length?await admin.from('calloria_km_acknowledgements').select('announcement_id').eq('staff_user_id',user.id).in('announcement_id',ids):{data:[],error:null};
      if(acks.error)throw acks.error;
      const acknowledged=new Set((acks.data||[]).map((r:any)=>r.announcement_id));
      return response(200,{announcements:rows.map((r:any)=>({...r,acknowledged:acknowledged.has(r.id)}))},origin);
    }
    if (action === 'save_announcement') {
      if(grant.role==='agent')return response(403,{error:'Only supervisors and knowledge administrators can draft staff briefings.'},origin);
      const title=clean(body.title,180), bodyText=String(body.body??'').trim().slice(0,5000), category=clean(body.category,40);
      const startsAt=new Date(body.starts_at),endsAt=new Date(body.ends_at);
      if(title.length<3||bodyText.length<10||!['product_update','service_change','policy_update','security_notice','known_issue','training_notice'].includes(category)||Number.isNaN(startsAt.getTime())||Number.isNaN(endsAt.getTime())||endsAt<=startsAt)return response(400,{error:'Check the briefing title, content, category and valid start/end times.'},origin);
      if(containsSensitiveNotice(`${title}\n${bodyText}`))return response(400,{error:'Do not place customer contact details or credentials in staff briefing notices.'},origin);
      const requestedProducts=strings(body.product_ids,6,80);
      if(requestedProducts.some((id:string)=>!PRODUCT_IDS.includes(id)))return response(400,{error:'A related product ID is not in the approved RuffNeck catalogue.'},origin);
      const requestedTargets=strings(body.target_departments,11,120);
      if(requestedTargets.some((d:string)=>!departmentsFor(grant).includes(d)))return response(403,{error:'One or more target departments are outside your staff permission scope.'},origin);
      const targets=requestedTargets.length?requestedTargets:(grant.role==='people_admin'?[]:departmentsFor(grant));
      const productIds=requestedProducts;
      const id=clean(body.id,60); let saved:any;
      if(id){if(!UUID.test(id))return response(400,{error:'Invalid announcement reference.'},origin);const {data:existing,error}=await admin.from('calloria_km_announcements').select('*').eq('id',id).maybeSingle();if(error)throw error;if(!existing||existing.status!=='draft'||(existing.authored_by!==user.id&&grant.role!=='people_admin'))return response(409,{error:'This briefing draft cannot be edited.'},origin);const result=await admin.from('calloria_km_announcements').update({title,body:bodyText,category,product_ids:productIds,target_departments:targets,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),requires_ack:body.requires_ack!==false}).eq('id',id).select('*').single();if(result.error)throw result.error;saved=result.data;}
      else {const result=await admin.from('calloria_km_announcements').insert({title,body:bodyText,category,product_ids:productIds,target_departments:targets,starts_at:startsAt.toISOString(),ends_at:endsAt.toISOString(),requires_ack:body.requires_ack!==false,authored_by:user.id,status:'draft'}).select('*').single();if(result.error)throw result.error;saved=result.data;}
      await audit(admin,user.id,'announcement_saved','announcement',saved.id,{category});
      return response(200,{announcement:saved},origin);
    }
    if (action === 'publish_announcement') {
      if(grant.role!=='people_admin')return response(403,{error:'Only a knowledge administrator can publish staff briefings.'},origin);
      const id=clean(body.id,60);if(!UUID.test(id))return response(400,{error:'Invalid announcement reference.'},origin);
      const {data:row,error}=await admin.from('calloria_km_announcements').select('*').eq('id',id).maybeSingle();if(error)throw error;
      if(!row||row.status!=='draft'||row.authored_by===user.id)return response(409,{error:'A different knowledge administrator must publish this briefing draft.'},origin);
      if(new Date(row.ends_at).getTime()<=Date.now())return response(422,{error:'The briefing end time is already in the past.'},origin);
      const {data:updated,error:updateError}=await admin.from('calloria_km_announcements').update({status:'published',published_by:user.id,published_at:new Date().toISOString()}).eq('id',id).select('*').single();if(updateError)throw updateError;
      await audit(admin,user.id,'announcement_published','announcement',id,{category:row.category});
      return response(200,{announcement:updated},origin);
    }
    if (action === 'acknowledge') {
      const id=clean(body.id,60);if(!UUID.test(id))return response(400,{error:'Invalid briefing reference.'},origin);
      const {data:row,error}=await admin.from('calloria_km_announcements').select('id,status,requires_ack,starts_at,ends_at,target_departments').eq('id',id).maybeSingle();if(error)throw error;
      const now=Date.now();
      if(!row||row.status!=='published'||!row.requires_ack||new Date(row.starts_at).getTime()>now||new Date(row.ends_at).getTime()<=now|| (row.target_departments?.length && !row.target_departments.some((d:string)=>departmentsFor(grant).includes(d))))return response(404,{error:'This acknowledgement-required briefing is not available to your staff scope.'},origin);
      const {error:ackError}=await admin.from('calloria_km_acknowledgements').upsert({announcement_id:id,staff_user_id:user.id},{onConflict:'announcement_id,staff_user_id',ignoreDuplicates:true});if(ackError)throw ackError;
      await audit(admin,user.id,'announcement_acknowledged','announcement',id,{});
      return response(200,{acknowledged:true},origin);
    }
    return response(400,{error:'Unsupported Knowledge Operations action.'},origin);
  } catch(error) {
    const message=error instanceof Error?clean(error.message,180):'unknown';
    console.error('Knowledge Operations error:',message);
    return response(500,{error:'Knowledge Operations could not complete the request. Check the migration and Phase 4 knowledge tables.'},origin);
  }
});
