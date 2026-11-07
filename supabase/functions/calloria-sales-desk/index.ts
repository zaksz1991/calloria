import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * CALLORIA Sales Desk. Staff-only opportunity and referral workflow.
 * It never takes payments, quotes unverified prices or sends outbound messages.
 * Private need summaries are AES-GCM encrypted before database storage.
 */
const origins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(x => x.trim()).filter(Boolean);
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const accessRaw = Deno.env.get('CALLORIA_SALES_DESK_ACCESS') || '';
const encryptionSecret = Deno.env.get('CALLORIA_SALES_DESK_ENCRYPTION_SECRET') || '';
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];
const CHANNELS = ['voice','email','live_chat','social','whatsapp','website','portal','in_person','platform_referral'];
const NEEDS = ['learning_development','business_growth','community_collaboration','social_media_operations','entertainment','career_development','customer_care_consultation','technical_support','product_access','cross_platform'];
const PRODUCTS: Record<string, { name: string; url: string; needs: string[] }> = {
  'ruffneck-learn': { name:'RuffNeck Learn', url:'https://ruffneck-lms.vercel.app/', needs:['learning_development','career_development','cross_platform'] },
  'ruffneck-prospector': { name:'RuffNeck Prospector', url:'https://ruffneck-prospector.vercel.app/', needs:['business_growth','cross_platform'] },
  'ruffneck-connect': { name:'RuffNeck Connect', url:'https://ruffneck-connect.vercel.app/', needs:['community_collaboration','cross_platform'] },
  'ruffneck-social-hub': { name:'RuffNeck Social Hub', url:'https://ruffneck-social-hub.vercel.app/', needs:['social_media_operations','business_growth','cross_platform'] },
  'kano-run': { name:'Kano Run / Kano Life', url:'https://kano-run.vercel.app/', needs:['entertainment','cross_platform'] },
  'kano-keke': { name:'Kano Keke', url:'https://kano-keke.vercel.app/', needs:['entertainment','cross_platform'] }
};
type Role = 'agent'|'sales_advisor'|'supervisor'|'sales_supervisor'|'people_admin';
interface Grant { role: Role; departments: string[] }
const accessMap: Record<string, Grant> = {};
let accessInvalid = false;
function clean(value: unknown, max = 700): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID.test(value); }
function hasDepartment(grant: Grant, department: string): boolean { return grant.departments.includes('*') || grant.departments.includes(department); }
function canManage(grant: Grant): boolean { return ['supervisor','sales_supervisor','people_admin'].includes(grant.role); }
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const grant = raw as any;
    if (!UUID.test(userId) || !grant || !['agent','sales_advisor','supervisor','sales_supervisor','people_admin'].includes(grant.role) ||
      !Array.isArray(grant.departments) || grant.departments.length < 1 || grant.departments.some((d: unknown) => typeof d !== 'string')) throw new Error('Invalid staff grant.');
    const scope = grant.departments.map((d: string) => clean(d, 120));
    if (scope.some((d: string) => d !== '*' && !DEPARTMENTS.includes(d))) throw new Error('Unknown staff department.');
    if (grant.role === 'people_admin' && !scope.includes('*')) throw new Error('People administrators require wildcard scope.');
    if (grant.role === 'agent' && scope.includes('*')) throw new Error('Agents require explicit department scope.');
    accessMap[userId] = { role: grant.role, departments: scope };
  }
} catch { accessInvalid = true; }

function reply(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Access-Control-Allow-Origin': origin && origins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store', Vary: 'Origin'
  }});
}
async function requireStaff(request: Request, admin: any) {
  if (accessInvalid || !Object.keys(accessMap).length) return { error:'Sales Desk staff access is not configured correctly.', status:503 };
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error:'Staff sign-in is required.', status:401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return { error:'Your staff session is invalid or expired.', status:401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error:'This account is not authorised for the Sales Desk.', status:403 };
  return { user:data.user, grant };
}
function scopeDepartments(grant: Grant): string[] { return grant.departments.includes('*') ? DEPARTMENTS : grant.departments; }
function allowedOpportunity(row: any, userId: string, grant: Grant): boolean {
  return !!row && hasDepartment(grant, row.owner_department) && (canManage(grant) || row.owner_user_id === userId);
}
function base64(bytes: Uint8Array): string { let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function fromBase64(value: string): Uint8Array { const binary = atob(value); return Uint8Array.from(binary, c => c.charCodeAt(0)); }
async function cryptoKey() {
  if (encoder.encode(encryptionSecret).length < 32) throw new Error('CALLORIA_SALES_DESK_ENCRYPTION_SECRET must contain at least 32 characters and be set in Supabase Edge Function Secrets.');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(encryptionSecret));
  return crypto.subtle.importKey('raw', digest, { name:'AES-GCM' }, false, ['encrypt','decrypt']);
}
async function encryptText(text: string) {
  const key = await cryptoKey(); const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, encoder.encode(text));
  return { ciphertext:base64(new Uint8Array(data)), iv:base64(iv) };
}
async function decryptText(ciphertext: string, ivText: string) {
  const key = await cryptoKey();
  const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv:fromBase64(ivText) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}
function redact(text: string) {
  return clean(text, 700)
    .replace(/\b(pin|otp|one[- ]time password|password|passcode|security code)\s*[:#= -]?\s*[a-z0-9-]{3,20}\b/gi, '$1: [REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED EMAIL]')
    .replace(/(?:\+?234|0)[ -]?(?:\d[ -]?){9,11}/g, '[REDACTED PHONE]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED FINANCIAL NUMBER]');
}
async function recordEvent(admin: any, opportunityId: string, actorId: string, eventType: string, metadata: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const key of ['from_stage','to_stage','product_id','presentation_context','purpose','channel','department','source_type','need_category','recommendation_status']) {
    if (metadata[key] !== undefined) safe[key] = clean(metadata[key], 80);
  }
  for (const key of ['fit_score','recommendation_count']) {
    if (typeof metadata[key] === 'number' && Number.isFinite(metadata[key])) safe[key] = metadata[key];
  }
  const { error } = await admin.from('calloria_sales_events').insert({ opportunity_id:opportunityId, actor_user_id:actorId, event_type:eventType, metadata:safe });
  if (error) throw new Error('The sales audit event could not be recorded. The operation was not confirmed.');
}
async function getOpportunity(admin: any, id: string) {
  const { data, error } = await admin.from('calloria_sales_opportunities').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error('Opportunity could not be loaded.');
  return data;
}
async function loadOpportunity(admin: any, row: any) {
  const [recommendations, followups, events, summary] = await Promise.all([
    admin.from('calloria_sales_recommendations').select('id,product_id,fit_score,match_reason,presentation_context,status,catalogue_version,created_at').eq('opportunity_id', row.id).order('created_at', { ascending:false }),
    admin.from('calloria_sales_followups').select('id,purpose,due_at,status,created_at,completed_at').eq('opportunity_id', row.id).order('due_at', { ascending:true }),
    admin.from('calloria_sales_events').select('id,event_type,metadata,created_at').eq('opportunity_id', row.id).order('created_at', { ascending:false }).limit(50),
    decryptText(row.need_summary_ciphertext, row.need_summary_iv)
  ]);
  for (const result of [recommendations, followups, events]) if (result.error) throw new Error('Opportunity details could not be loaded.');
  return {
    id:row.id, crmCustomerId:row.crm_customer_id, ownerUserId:row.owner_user_id, department:row.owner_department,
    sourceChannel:row.source_channel, sourceType:row.source_type, needCategory:row.need_category,
    needSummary:summary, stage:row.stage, createdAt:row.created_at, updatedAt:row.updated_at,
    recommendations:recommendations.data || [], followups:followups.data || [], events:events.data || []
  };
}
async function checkCrmContact(admin: any, contactId: string, grant: Grant) {
  const { data, error } = await admin.from('calloria_crm_contacts').select('id,owner_department').eq('id', contactId).maybeSingle();
  if (error) throw new Error('CRM contact could not be checked.');
  if (!data || !hasDepartment(grant, data.owner_department)) throw new Error('The CRM record is unavailable in your department scope.');
  return data;
}
async function latestConsent(admin: any, contactId: string, purpose: string) {
  const { data, error } = await admin.from('calloria_crm_consents').select('id,status,purpose,created_at').eq('contact_id', contactId).eq('purpose', purpose).order('created_at', { ascending:false }).limit(1).maybeSingle();
  if (error) throw new Error('The latest customer consent could not be verified.');
  return data;
}
const NEXT_STAGES: Record<string, string[]> = {
  new:['discovery','closed_no_interest'], discovery:['recommended','closed_no_interest'],
  recommended:['customer_interested','referred_to_platform','closed_no_interest'],
  customer_interested:['referred_to_platform','closed_no_interest'],
  referred_to_platform:['follow_up_due','closed_no_interest'],
  follow_up_due:['referred_to_platform','closed_no_interest'], closed_no_interest:[]
};

Deno.serve(async request => {
  const origin = request.headers.get('origin');
  if (!origins.length) return reply(503, { error:'CALLORIA_ALLOWED_ORIGINS is not configured.' }, origin);
  if (request.method === 'OPTIONS') return origins.includes(origin || '') ? new Response('ok', { headers:{ 'Access-Control-Allow-Origin':origin!, 'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods':'POST, OPTIONS', Vary:'Origin' }}) : reply(403, { error:'Origin not permitted.' }, origin);
  if (request.method !== 'POST') return reply(405, { error:'Only POST is accepted.' }, origin);
  if (!origin || !origins.includes(origin)) return reply(403, { error:'Origin not permitted.' }, origin);
  if (!supabaseUrl || !serviceKey) return reply(503, { error:'Sales Desk storage is not configured.' }, origin);
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 9000) return reply(413, { error:'Request is too large.' }, origin);
  try {
    const raw = await request.text();
    if (raw.length > 9000) return reply(413, { error:'Request is too large.' }, origin);
    let body: any; try { body = JSON.parse(raw); } catch { return reply(400, { error:'A valid JSON request is required.' }, origin); }
    const admin = createClient(supabaseUrl, serviceKey, { auth:{ persistSession:false, autoRefreshToken:false } });
    const auth = await requireStaff(request, admin);
    if ('error' in auth) return reply(auth.status, { error:auth.error }, origin);
    const user = auth.user; const grant = auth.grant as Grant;
    const action = clean(body?.action, 40);

    if (action === 'whoami') return reply(200, { access:{ role:grant.role, departments:grant.departments } }, origin);

    if (action === 'list_opportunities') {
      const departments = scopeDepartments(grant);
      let query = admin.from('calloria_sales_opportunities').select('*').in('owner_department', departments).order('updated_at', { ascending:false }).limit(100);
      if (!canManage(grant)) query = query.eq('owner_user_id', user.id);
      const { data, error } = await query;
      if (error) throw new Error('Sales opportunities could not be loaded.');
      const opportunities = [];
      for (const row of data || []) opportunities.push(await loadOpportunity(admin, row));
      return reply(200, { opportunities }, origin);
    }

    if (action === 'create_opportunity') {
      const department = clean(body.department, 120); const needCategory = clean(body.needCategory, 48);
      const sourceChannel = clean(body.sourceChannel, 40); const sourceType = clean(body.sourceType || 'inbound_enquiry', 40);
      if (!hasDepartment(grant, department)) return reply(403, { error:'The selected department is outside your permission scope.' }, origin);
      if (!NEEDS.includes(needCategory) || !CHANNELS.includes(sourceChannel) || !['inbound_enquiry','customer_requested','platform_referral','staff_referral'].includes(sourceType)) return reply(400, { error:'Select a valid customer need, source and channel.' }, origin);
      const summary = redact(clean(body.needSummary, 700));
      if (summary.length < 12) return reply(400, { error:'Add a customer-need summary of at least 12 characters.' }, origin);
      let contactId: string | null = null;
      if (body.crmCustomerId) {
        if (!isUuid(body.crmCustomerId)) return reply(400, { error:'The CRM reference must be a valid Customer 360 record ID.' }, origin);
        await checkCrmContact(admin, body.crmCustomerId, grant); contactId = body.crmCustomerId;
      }
      const encrypted = await encryptText(summary);
      const { data, error } = await admin.from('calloria_sales_opportunities').insert({
        crm_customer_id:contactId, owner_user_id:user.id, owner_department:department,
        source_channel:sourceChannel, source_type:sourceType, need_category:needCategory,
        need_summary_ciphertext:encrypted.ciphertext, need_summary_iv:encrypted.iv, stage:'new'
      }).select('*').single();
      if (error) throw new Error('The opportunity could not be created.');
      await recordEvent(admin, data.id, user.id, 'opportunity_created', { department, channel:sourceChannel, source_type:sourceType, need_category:needCategory });
      return reply(200, { opportunity:await loadOpportunity(admin, data) }, origin);
    }

    if (action === 'get_opportunity') {
      const id = clean(body.opportunityId, 64); if (!isUuid(id)) return reply(400, { error:'A valid opportunity reference is required.' }, origin);
      const row = await getOpportunity(admin, id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      return reply(200, { opportunity:await loadOpportunity(admin, row) }, origin);
    }

    if (action === 'present_recommendations') {
      const id = clean(body.opportunityId, 64); if (!isUuid(id)) return reply(400, { error:'A valid opportunity reference is required.' }, origin);
      const row = await getOpportunity(admin, id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      if (!['discovery','recommended','customer_interested'].includes(row.stage)) return reply(409, { error:'Complete discovery before presenting product recommendations.' }, origin);
      const context = clean(body.context, 32);
      if (!['customer_requested','proactive'].includes(context)) return reply(400, { error:'Select whether the customer requested the recommendation or whether it is proactive.' }, origin);
      if (context === 'customer_requested' && row.source_type !== 'customer_requested') return reply(403, { error:'Record the opportunity as customer-requested only when the customer explicitly asked for product information.' }, origin);
      let marketingConsentId: string | null = null;
      if (context === 'proactive') {
        if (!row.crm_customer_id) return reply(403, { error:'Proactive recommendations require a linked Customer 360 record with verified marketing consent.' }, origin);
        const consent = await latestConsent(admin, row.crm_customer_id, 'marketing');
        if (consent?.status !== 'granted') return reply(403, { error:'Proactive cross-selling is blocked. Current marketing consent is not recorded as granted.' }, origin);
        marketingConsentId = consent.id;
      }
      const productIds: string[] = Array.isArray(body.productIds) ? Array.from(new Set<string>((body.productIds as unknown[]).map((x: unknown) => clean(x, 60)))) : [];
      if (!productIds.length || productIds.length > 3) return reply(400, { error:'Select one to three relevant portfolio products.' }, origin);
      const { data:existingRows, error:existingError } = await admin.from('calloria_sales_recommendations').select('product_id').eq('opportunity_id', id);
      if (existingError) throw new Error('Existing recommendations could not be checked.');
      const existingIds = new Set((existingRows || []).map((item: any) => item.product_id));
      if (productIds.some(productId => existingIds.has(productId))) return reply(409, { error:'One or more selected products have already been presented for this opportunity. Existing response history is preserved.' }, origin);
      const recommendationRows = [];
      for (const productId of productIds) {
        const product = PRODUCTS[productId];
        if (!product || !product.needs.includes(row.need_category)) return reply(400, { error:`${product?.name || 'Selected product'} does not match the recorded customer need category.` }, origin);
        const fitScore = product.needs[0] === row.need_category ? 96 : 78;
        const matchReason = fitScore === 96 ? 'Direct match to the recorded customer need.' : 'Related portfolio option; confirm suitability with the customer.';
        recommendationRows.push({
          opportunity_id:id, product_id:productId, fit_score:fitScore, match_reason:matchReason,
          presentation_context:context, marketing_consent_record_id:marketingConsentId, status:'presented', catalogue_version:'2026-11-07.1', created_by:user.id
        });
      }
      const { data:inserted, error:insertError } = await admin.from('calloria_sales_recommendations').insert(recommendationRows).select('*');
      if (insertError) throw new Error('Recommendations could not be recorded. Refresh and check the existing opportunity before retrying.');
      for (const item of inserted || []) await recordEvent(admin, id, user.id, 'recommendation_presented', { product_id:item.product_id, fit_score:item.fit_score, presentation_context:context });
      if (row.stage === 'discovery') {
        const { error:stageError } = await admin.from('calloria_sales_opportunities').update({ stage:'recommended', updated_at:new Date().toISOString() }).eq('id', id);
        if (stageError) throw new Error('Recommendations were stored, but the stage update failed. Refresh before continuing.');
        await recordEvent(admin, id, user.id, 'stage_changed', { from_stage:'discovery', to_stage:'recommended' });
      }
      return reply(200, { recommendations:inserted }, origin);
    }

    if (action === 'set_recommendation_status') {
      const recommendationId = clean(body.recommendationId, 64); const status = clean(body.status, 32);
      if (!isUuid(recommendationId) || !['customer_interested','declined'].includes(status)) return reply(400, { error:'A valid recommendation and customer response are required.' }, origin);
      const { data: rec, error: recError } = await admin.from('calloria_sales_recommendations').select('*').eq('id', recommendationId).maybeSingle();
      if (recError) throw new Error('Recommendation could not be loaded.');
      if (!rec) return reply(404, { error:'Recommendation not found.' }, origin);
      if (rec.status !== 'presented') return reply(409, { error:'A customer response has already been recorded for this recommendation.' }, origin);
      const row = await getOpportunity(admin, rec.opportunity_id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      if (row.stage === 'closed_no_interest') return reply(409, { error:'This opportunity is closed.' }, origin);
      const { data, error } = await admin.from('calloria_sales_recommendations').update({ status }).eq('id', recommendationId).eq('status','presented').select('*').maybeSingle();
      if (error) throw new Error('Customer response could not be recorded.');
      if (!data) return reply(409, { error:'This recommendation response was already recorded. Refresh the opportunity.' }, origin);
      let resultingStage = row.stage;
      if (status === 'customer_interested' && row.stage === 'recommended') {
        const { error:stageError } = await admin.from('calloria_sales_opportunities').update({ stage:'customer_interested', updated_at:new Date().toISOString() }).eq('id', row.id).eq('stage','recommended');
        if (stageError) throw new Error('The customer response was recorded, but the opportunity stage needs supervisor review. Refresh before continuing.');
        resultingStage = 'customer_interested';
      }
      await recordEvent(admin, row.id, user.id, 'recommendation_responded', { product_id:rec.product_id, recommendation_status:status, from_stage:row.stage, to_stage:resultingStage });
      return reply(200, { recommendation:data }, origin);
    }

    if (action === 'set_stage') {
      const id = clean(body.opportunityId, 64); const next = clean(body.nextStage, 40);
      if (!isUuid(id)) return reply(400, { error:'A valid opportunity reference is required.' }, origin);
      const row = await getOpportunity(admin, id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      if (!(NEXT_STAGES[row.stage] || []).includes(next)) return reply(409, { error:`The transition from ${row.stage} to ${next} is not permitted.` }, origin);
      if (next === 'recommended') {
        const { count, error } = await admin.from('calloria_sales_recommendations').select('id', { count:'exact', head:true }).eq('opportunity_id', id);
        if (error) throw new Error('Recommendation evidence could not be checked.');
        if (!count) return reply(409, { error:'Present a relevant product recommendation before moving this opportunity to that stage.' }, origin);
      }
      if (next === 'customer_interested' || next === 'referred_to_platform') {
        const { count, error } = await admin.from('calloria_sales_recommendations').select('id', { count:'exact', head:true }).eq('opportunity_id', id).eq('status','customer_interested');
        if (error) throw new Error('Customer interest evidence could not be checked.');
        if (!count) return reply(409, { error:'Record the customer as interested in a specific recommendation before moving to this stage.' }, origin);
      }
      if (next === 'follow_up_due') {
        const { count, error } = await admin.from('calloria_sales_followups').select('id', { count:'exact', head:true }).eq('opportunity_id', id).eq('status','scheduled');
        if (error) throw new Error('Follow-up evidence could not be checked.');
        if (!count) return reply(409, { error:'Schedule a consent-verified follow-up before selecting this stage.' }, origin);
      }
      const now = new Date().toISOString();
      const { data, error } = await admin.from('calloria_sales_opportunities').update({ stage:next, updated_at:now, closed_at:next === 'closed_no_interest' ? now : null }).eq('id', id).select('*').single();
      if (error) throw new Error('Opportunity stage could not be updated.');
      await recordEvent(admin, id, user.id, next === 'referred_to_platform' ? 'referral_recorded' : 'stage_changed', { from_stage:row.stage, to_stage:next });
      return reply(200, { opportunity:await loadOpportunity(admin, data) }, origin);
    }

    if (action === 'schedule_followup') {
      const id = clean(body.opportunityId, 64); const purpose = clean(body.purpose, 32); const dueAt = Date.parse(body.dueAt);
      if (!isUuid(id) || !['service_contact','marketing'].includes(purpose) || !Number.isFinite(dueAt)) return reply(400, { error:'A valid opportunity, follow-up purpose and due date are required.' }, origin);
      const nowMs = Date.now(); if (dueAt <= nowMs || dueAt > nowMs + 90 * 86400000) return reply(400, { error:'Follow-up must be in the future and within the next 90 days.' }, origin);
      const row = await getOpportunity(admin, id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      if (row.stage === 'closed_no_interest') return reply(409, { error:'This opportunity is closed.' }, origin);
      if (!row.crm_customer_id) return reply(403, { error:'Link a Customer 360 record before scheduling a follow-up.' }, origin);
      const consent = await latestConsent(admin, row.crm_customer_id, purpose);
      if (!consent || consent.status !== 'granted') return reply(403, { error:`Follow-up blocked. The latest ${purpose.replaceAll('_',' ')} consent must be recorded as granted in Customer 360.` }, origin);
      const { data, error } = await admin.from('calloria_sales_followups').insert({ opportunity_id:id, crm_customer_id:row.crm_customer_id, purpose, consent_record_id:consent.id, due_at:new Date(dueAt).toISOString(), created_by:user.id }).select('id,purpose,due_at,status,created_at').single();
      if (error) {
        if (error.code === '23505') return reply(409, { error:'An open follow-up already exists for this opportunity.' }, origin);
        throw new Error('Follow-up task could not be scheduled.');
      }
      await recordEvent(admin, id, user.id, 'followup_scheduled', { purpose });
      return reply(200, { followup:data }, origin);
    }

    if (action === 'complete_followup') {
      const followupId = clean(body.followupId, 64); if (!isUuid(followupId)) return reply(400, { error:'A valid follow-up reference is required.' }, origin);
      const { data: followup, error: fError } = await admin.from('calloria_sales_followups').select('*').eq('id', followupId).maybeSingle();
      if (fError) throw new Error('Follow-up could not be loaded.');
      if (!followup) return reply(404, { error:'Follow-up not found.' }, origin);
      const row = await getOpportunity(admin, followup.opportunity_id);
      if (!allowedOpportunity(row, user.id, grant)) return reply(404, { error:'Opportunity not found in your permitted scope.' }, origin);
      if (followup.status !== 'scheduled') return reply(409, { error:'Only scheduled follow-ups can be completed.' }, origin);
      const { data, error } = await admin.from('calloria_sales_followups').update({ status:'completed', completed_by:user.id, completed_at:new Date().toISOString() }).eq('id', followupId).eq('status','scheduled').select('id,status,completed_at').maybeSingle();
      if (error) throw new Error('Follow-up completion could not be recorded.');
      if (!data) return reply(409, { error:'The follow-up was already updated.' }, origin);
      await recordEvent(admin, row.id, user.id, 'followup_completed', { purpose:followup.purpose });
      if (row.stage === 'follow_up_due') {
        const { error:stageError } = await admin.from('calloria_sales_opportunities').update({ stage:'referred_to_platform', updated_at:new Date().toISOString() }).eq('id', row.id);
        if (stageError) throw new Error('Follow-up completed, but the opportunity stage needs supervisor review.');
        await recordEvent(admin, row.id, user.id, 'stage_changed', { from_stage:'follow_up_due', to_stage:'referred_to_platform' });
      }
      return reply(200, { followup:data }, origin);
    }

    return reply(400, { error:'Unknown Sales Desk action.' }, origin);
  } catch (error) {
    console.error('CALLORIA Sales Desk request failed:', error instanceof Error ? error.message : 'Unknown error');
    return reply(400, { error:error instanceof Error ? error.message : 'Sales Desk request failed.' }, origin);
  }
});
