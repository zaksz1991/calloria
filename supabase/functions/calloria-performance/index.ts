import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  CAREER_LADDERS, PERFORMANCE_PROFILES, evaluateQaReview, evaluateScorecard,
  promotionEligibility, scoreExam, validatePromotionTarget
} from '../../../js/performance-engine.js';

const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(x => x.trim()).filter(Boolean);
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const accessRaw = Deno.env.get('CALLORIA_PERFORMANCE_ACCESS') || '';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const departments = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
type StaffRole = 'agent'|'supervisor'|'qa'|'people_admin';
interface Grant { role: StaffRole; departments: string[]; jobProfile: keyof typeof PERFORMANCE_PROFILES; careerTitle: string }
let accessMap: Record<string, Grant> = {};
let accessInvalid = false;
function clean(value: unknown, max = 300): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    const grant = raw as any;
    if (!uuidPattern.test(userId) || !grant || !['agent','supervisor','qa','people_admin'].includes(grant.role) ||
      !Array.isArray(grant.departments) || !grant.departments.length ||
      grant.departments.some((x: unknown) => typeof x !== 'string') || !(grant.jobProfile in PERFORMANCE_PROFILES) ||
      !CAREER_LADDERS[grant.jobProfile]?.includes(grant.careerTitle)) throw new Error('Invalid staff grant.');
    const scoped = grant.departments.map((x: string) => clean(x, 120));
    if (scoped.some((x: string) => x !== '*' && !departments.includes(x))) throw new Error('Unknown department in staff grant.');
    if (grant.role === 'people_admin' && !scoped.includes('*')) throw new Error('People administrators require a wildcard department grant.');
    if (grant.role === 'agent' && scoped.includes('*')) throw new Error('Agents require explicit department grants.');
    accessMap[userId] = { role: grant.role, departments: scoped, jobProfile: grant.jobProfile, careerTitle: grant.careerTitle };
  }
} catch { accessInvalid = true; accessMap = {}; }

function json(status: number, body: Record<string, unknown>, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  }});
}
function isUuid(value: unknown): value is string { return typeof value === 'string' && uuidPattern.test(value); }
function isManager(grant: Grant) { return grant.role === 'supervisor' || grant.role === 'people_admin'; }
function canManageQa(grant: Grant) { return ['supervisor','people_admin','qa'].includes(grant.role); }
function hasDepartment(grant: Grant, department: string) { return grant.departments.includes('*') || grant.departments.includes(department); }
function overlap(a: string[], b: string[]) { return a.includes('*') || b.includes('*') || a.some(x => b.includes(x)); }
function validMonth(value: unknown) {
  const date = clean(value, 10);
  if (!/^\d{4}-\d{2}-01$/.test(date)) throw new Error('Select the first day of a valid month.');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new Error('Choose a valid scorecard month.');
  const end = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, 0)).toISOString().slice(0,10);
  const lagosParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  const lagosYear = Number(lagosParts.find(x => x.type === 'year')?.value);
  const lagosMonth = Number(lagosParts.find(x => x.type === 'month')?.value);
  const currentMonth = new Date(Date.UTC(lagosYear, lagosMonth - 1, 1));
  const earliest = new Date(currentMonth); earliest.setUTCMonth(earliest.getUTCMonth() - 12);
  if (parsed > currentMonth || parsed < earliest) throw new Error('Scorecards can be recorded only for the current month or previous 12 months.');
  return { start: date, end };
}
async function requireStaff(request: Request, admin: ReturnType<typeof createClient>) {
  if (accessInvalid || !Object.keys(accessMap).length) return { error: 'Performance staff access is not configured correctly.', status: 503 };
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error: 'Staff sign-in is required.', status: 401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: 'Your staff session is invalid or expired.', status: 401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error: 'This account is not authorised for Performance and Career Management.', status: 403 };
  return { user: data.user, grant };
}
async function event(admin: ReturnType<typeof createClient>, actor: string, staff: string | null, type: string, entity: string, id: string | null, detail: Record<string, unknown> = {}) {
  const { error } = await admin.from('calloria_perf_events').insert({ actor_user_id: actor, staff_user_id: staff, event_type: type, entity_type: entity, entity_id: id, detail });
  if (error) throw error;
}
function profileFor(grant: Grant, staffId: string) { return accessMap[staffId] || null; }
function requireTarget(actorGrant: Grant, staffId: string, department: string) {
  const target = profileFor(actorGrant, staffId);
  if (!target || !hasDepartment(actorGrant, department) || !hasDepartment(target, department)) throw new Error('Staff member is outside your permitted department scope.');
  return target;
}
function randomQuestions(count = 12) {
  const shuffled = [...QUESTION_BANK];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const j = random[0] % (i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}
const QUESTION_BANK = [
  { id:'CC01', topic:'Privacy', prompt:'A caller asks you to change the email address on an account. What must happen first?', options:['Verify identity using the approved process','Ask the caller to send their password','Change it and verify later','Use the caller ID as proof'], answer:'A' },
  { id:'CC02', topic:'Sales ethics', prompt:'A customer is distressed and asks for help with a complaint. A paid product might be relevant later. What is the correct approach?', options:['Push the product before the call ends','Resolve the complaint first; do not exploit distress or bypass consent','Offer a discount in exchange for a positive review','Add the customer to marketing automatically'], answer:'B' },
  { id:'CC03', topic:'Knowledge accuracy', prompt:'You are unsure whether a RuffNeck platform supports a feature. What should you do?', options:['Guess confidently','Promise it will be released tomorrow','Check approved current knowledge or escalate; state what is unconfirmed','Use another platform’s feature list'], answer:'C' },
  { id:'CC04', topic:'Emotional intelligence', prompt:'A customer is angry and speaking loudly. Which response is most appropriate?', options:['Interrupt and correct their tone','Acknowledge the impact, listen, clarify the issue and explain next steps','End the interaction immediately','Tell them to calm down'], answer:'B' },
  { id:'CC05', topic:'Security', prompt:'A customer sends a one-time password in a public social-media comment. What should you do?', options:['Repeat it to confirm','Copy it into the case notes','Do not use or expose it; direct the customer to a secure official channel and follow incident policy','Forward it to colleagues'], answer:'C' },
  { id:'CC06', topic:'Clinical boundaries', prompt:'A customer asks whether their symptoms mean they have a psychiatric disorder. What is the safe response?', options:['Diagnose from the description','Recommend stopping prescribed medicine','Explain that CALLORIA provides general information, not diagnosis, and encourage qualified clinical assessment','Promise a cure'], answer:'C' },
  { id:'CC07', topic:'Safeguarding', prompt:'A customer indicates immediate danger to themselves or another person. What is the priority?', options:['Continue the normal sales script','Follow the safeguarding escalation protocol and connect to qualified/local emergency support as appropriate','Keep the disclosure secret from every responder','Wait until the next monthly review'], answer:'B' },
  { id:'CC08', topic:'Quality', prompt:'Which is the best measure of a successful customer interaction?', options:['Shortest possible handling time','Most products mentioned','Correct, safe resolution with customer understanding and policy compliance','No escalation under any circumstances'], answer:'C' },
  { id:'CC09', topic:'Consent', prompt:'When may an adviser add a customer to optional marketing communications?', options:['Whenever they open a support case','Only after valid, recorded consent under the applicable policy','When the adviser believes it is useful','When the customer is silent'], answer:'B' },
  { id:'CC10', topic:'Cross-platform guidance', prompt:'A customer needs course access support for RuffNeck Learn. Which action is appropriate?', options:['Ask them to share their password','Explain the supported account/access steps and route unresolved platform issues to the right support team','Create a second unapproved account','Promise a certificate before checking completion'], answer:'B' },
  { id:'CC11', topic:'Complaint ownership', prompt:'Your team cannot resolve a complaint within its authority. What should you do?', options:['Close the case to protect team statistics','Transfer it without context','Explain the next step, preserve the case history and make a documented handover to the authorised team','Ask the customer to start again'], answer:'C' },
  { id:'CC12', topic:'Data minimisation', prompt:'What belongs in a QA evaluation record?', options:['Full customer transcript and passwords','Only necessary interaction reference, rubric findings and proportionate notes','Personal opinions about the customer','Unrelated family or medical details'], answer:'B' },
  { id:'CC13', topic:'Public channels', prompt:'A customer posts an account number in a public complaint. What should you do?', options:['Quote the number to identify the case','Move the conversation to a secure approved channel and follow the platform’s data-exposure process','Ask others to repost it','Leave it visible'], answer:'B' },
  { id:'CC14', topic:'Customer guidance', prompt:'A caller asks for parenting or relationship advice. How should the adviser respond?', options:['Impose a personal moral judgement','Listen respectfully, offer balanced general information and refer clinical, legal or safety matters to qualified support','Guarantee a particular outcome','Pretend to be a licensed therapist'], answer:'B' },
  { id:'CC15', topic:'Service recovery', prompt:'A customer reports that a service feature is unavailable, but the incident has not been confirmed. What should you say?', options:['Claim there is a nationwide outage','Be clear that the issue is being checked, record the details and provide a verified update path','Tell them to keep refreshing indefinitely','Blame the customer'], answer:'B' },
  { id:'CC16', topic:'Fair sales', prompt:'A product is not suitable for the customer’s stated needs. What is the correct action?', options:['Sell it anyway to meet target','Recommend a better-fit option if one exists, or say no sale is appropriate','Hide the limitations','Promise a refund not authorised by policy'], answer:'B' },
  { id:'CC17', topic:'Escalation', prompt:'A customer asks for a refund outside your approval limit. What should you do?', options:['Approve it using a colleague’s credentials','Explain the limit and route the request to an authorised decision-maker','Promise approval without checking','Delete the request'], answer:'B' },
  { id:'CC18', topic:'Team leadership', prompt:'A staff member has high productivity but repeated critical privacy failures. What should determine their performance outcome?', options:['Productivity overrides everything','Critical compliance and safeguarding gates must be addressed; speed cannot cancel the failures','Promote them for speed','Ignore the QA results'], answer:'B' }
];
const QUESTION_MAP = Object.fromEntries(QUESTION_BANK.map(q => [q.id, q]));
function publicQuestion(q) { return { id: q.id, topic: q.topic, prompt: q.prompt, options: q.options.map((text, index) => ({ key: String.fromCharCode(65 + index), text })) }; }

Deno.serve(async request => {
  const origin = request.headers.get('Origin');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin'
  }});
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, origin);
  if (!origin || !allowedOrigins.includes(origin)) return json(403, { error: 'Origin is not authorised.' }, origin);
  if (!supabaseUrl || !serviceKey) return json(503, { error: 'Supabase service configuration is incomplete.' }, origin);
  let body: any;
  try { const raw = await request.text(); if (raw.length > 40000) return json(413, { error: 'Request is too large.' }, origin); body = JSON.parse(raw); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); }
  catch { return json(400, { error: 'Request body must be a valid JSON object.' }, origin); }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await requireStaff(request, admin);
  if ('error' in auth) return json(auth.status, { error: auth.error }, origin);
  const user = auth.user!; const grant = auth.grant!; const action = clean(body.action, 40);
  try {
    if (action === 'whoami') {
      const directory = canManageQa(grant)
        ? Object.entries(accessMap).filter(([id, item]) => id !== user.id && overlap(grant.departments, item.departments))
          .map(([userId, item]) => ({ userId, role: item.role, jobProfile: item.jobProfile, careerTitle: item.careerTitle, departments: item.departments.filter(x => x !== '*') }))
        : [];
      return json(200, { access: { role: grant.role, departments: grant.departments, jobProfile: grant.jobProfile, careerTitle: grant.careerTitle }, directory }, origin);
    }

    if (action === 'my_dashboard') {
      const [scorecards, exams, coaching, qa] = await Promise.all([
        admin.from('calloria_perf_scorecards').select('id,department,job_profile,period_start,period_end,score,rating,gate_pass,critical_fail,status,evidence_summary,submitted_at,reviewed_at').eq('staff_user_id', user.id).order('period_start', { ascending: false }).limit(18),
        admin.from('calloria_perf_exam_attempts').select('id,target_role,attempt_no,exam_year,score,passed,status,started_at,expires_at,submitted_at').eq('staff_user_id', user.id).order('exam_year', { ascending: false }).limit(12),
        admin.from('calloria_perf_coaching').select('id,scorecard_id,action_plan,due_date,status,completion_note,created_at').eq('staff_user_id', user.id).order('created_at', { ascending: false }).limit(20),
        admin.from('calloria_perf_qa_reviews').select('id,channel,score,critical_fail,result,evaluated_at,interaction_ref').eq('staff_user_id', user.id).order('evaluated_at', { ascending: false }).limit(20)
      ]);
      const reviews = await admin.from('calloria_perf_reviews').select('id,scorecard_id,strengths,improvement_areas,employee_response,acknowledged_at,created_at').eq('staff_user_id', user.id).order('created_at', { ascending: false }).limit(20);
      for (const result of [scorecards, exams, coaching, qa, reviews]) if (result.error) throw result.error;
      const eligibility = promotionEligibility(scorecards.data || []);
      return json(200, { scorecards: scorecards.data || [], exams: exams.data || [], coaching: coaching.data || [], reviews: reviews.data || [], qaReviews: qa.data || [], eligibility, careerLadder: CAREER_LADDERS[grant.jobProfile] || [] }, origin);
    }

    if (action === 'team_snapshot') {
      if (!canManageQa(grant)) return json(403, { error: 'Supervisor or QA permissions are required.' }, origin);
      const period = validMonth(body.periodStart);
      const department = clean(body.department, 120);
      const chosen = !department || department === 'all' ? grant.departments.includes('*') ? departments : grant.departments : hasDepartment(grant, department) ? [department] : [];
      if (!chosen.length) return json(403, { error: 'That department is outside your access scope.' }, origin);
      const staffIds = Object.entries(accessMap).filter(([id, item]) => id !== user.id && overlap(chosen, item.departments)).map(([id]) => id);
      if (!staffIds.length) return json(200, { scorecards: [], directory: [] }, origin);
      const [cards, coachingRows] = await Promise.all([
        admin.from('calloria_perf_scorecards').select('id,staff_user_id,department,job_profile,period_start,score,rating,gate_pass,critical_fail,critical_reason,metric_values,evidence_summary,status,submitted_at,reviewed_at').in('staff_user_id', staffIds).eq('period_start', period.start).in('department', chosen).order('department').limit(500),
        admin.from('calloria_perf_coaching').select('id,staff_user_id,action_plan,due_date,status').in('staff_user_id', staffIds).in('status', ['open','in_progress']).limit(500)
      ]);
      if (cards.error) throw cards.error; if (coachingRows.error) throw coachingRows.error;
      const directory = staffIds.map(id => ({ userId: id, jobProfile: accessMap[id].jobProfile, role: accessMap[id].role, departments: accessMap[id].departments }));
      return json(200, { scorecards: cards.data || [], coaching: coachingRows.data || [], directory, period }, origin);
    }

    if (action === 'save_scorecard') {
      if (!isManager(grant)) return json(403, { error: 'Supervisor or People Operations permissions are required.' }, origin);
      const staffId = clean(body.staffUserId, 64); const department = clean(body.department, 120);
      if (!isUuid(staffId) || !hasDepartment(grant, department)) return json(403, { error: 'Staff member or department is outside your permission scope.' }, origin);
      const target = requireTarget(grant, staffId, department);
      if (staffId === user.id) return json(403, { error: 'A manager cannot author their own performance scorecard.' }, origin);
      const jobProfile = clean(body.jobProfile, 50);
      if (jobProfile !== target.jobProfile || !(jobProfile in PERFORMANCE_PROFILES)) return json(400, { error: 'Select the staff member’s assigned performance profile.' }, origin);
      const period = validMonth(body.periodStart);
      const evaluated = evaluateScorecard(jobProfile, body.metricValues || {}, { criticalFail: body.criticalFail === true });
      if (!evaluated.complete) return json(400, { error: `Complete every required metric: ${evaluated.missing.join(', ')}.` }, origin);
      const evidence = clean(body.evidenceSummary, 1200);
      const criticalReason = clean(body.criticalReason, 1000);
      if (evaluated.criticalFail && criticalReason.length < 8) return json(400, { error: 'A specific critical-failure reason is mandatory.' }, origin);
      if (evidence.length < 12) return json(400, { error: 'Add a brief evidence summary identifying the reporting source and coverage period.' }, origin);
      const existing = await admin.from('calloria_perf_scorecards').select('id,status').eq('staff_user_id', staffId).eq('department', department).eq('period_start', period.start).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data && existing.data.status !== 'draft' && existing.data.status !== 'returned') return json(409, { error: 'This monthly scorecard has already been submitted. Use the review/return workflow; do not overwrite a submitted record.' }, origin);
      const payload = {
        staff_user_id: staffId, department, job_profile: jobProfile, period_start: period.start, period_end: period.end,
        metric_values: evaluated.values, score: evaluated.score, rating: evaluated.rating, gate_pass: evaluated.gatePass,
        critical_fail: evaluated.criticalFail, critical_reason: criticalReason, status: 'submitted', evidence_summary: evidence,
        created_by: user.id, submitted_at: new Date().toISOString(), reviewed_by: null, reviewed_at: null
      };
      const saved = existing.data
        ? await admin.from('calloria_perf_scorecards').update(payload).eq('id', existing.data.id).select('*').single()
        : await admin.from('calloria_perf_scorecards').insert(payload).select('*').single();
      if (saved.error) throw saved.error;
      await event(admin, user.id, staffId, 'scorecard_submitted', 'scorecard', saved.data.id, { department, periodStart: period.start, score: evaluated.score, gatePass: evaluated.gatePass });
      return json(200, { scorecard: saved.data, evaluation: evaluated }, origin);
    }

    if (action === 'review_scorecard') {
      if (!isManager(grant)) return json(403, { error: 'Supervisor or People Operations permissions are required.' }, origin);
      const scorecardId = clean(body.scorecardId, 64); if (!isUuid(scorecardId)) return json(400, { error: 'A valid scorecard is required.' }, origin);
      const { data: card, error: cardError } = await admin.from('calloria_perf_scorecards').select('*').eq('id', scorecardId).maybeSingle();
      if (cardError) throw cardError; if (!card || !hasDepartment(grant, card.department)) return json(404, { error: 'Scorecard not found in your department scope.' }, origin);
      if (card.staff_user_id === user.id) return json(403, { error: 'A staff member cannot review their own scorecard.' }, origin);
      if (card.status !== 'submitted') return json(409, { error: 'Only submitted scorecards can be reviewed.' }, origin);
      const strengths = clean(body.strengths, 2000); const improvementAreas = clean(body.improvementAreas, 2000);
      if (strengths.length < 8 || improvementAreas.length < 8) return json(400, { error: 'Record specific strengths and improvement areas before completing the review.' }, origin);
      const finalized = await admin.rpc('calloria_perf_finalize_review', {
        p_scorecard_id: scorecardId, p_reviewer_user_id: user.id, p_strengths: strengths, p_improvement_areas: improvementAreas
      });
      if (finalized.error) throw finalized.error;
      const review = finalized.data?.review;
      await event(admin, user.id, card.staff_user_id, 'scorecard_reviewed', 'review', review?.id || null, { scorecardId, score: card.score, gatePass: card.gate_pass });
      return json(200, finalized.data, origin);
    }

    if (action === 'respond_to_review') {
      const reviewId = clean(body.reviewId, 64); if (!isUuid(reviewId)) return json(400, { error: 'A valid review reference is required.' }, origin);
      const response = clean(body.employeeResponse, 2000); if (response.length < 4) return json(400, { error: 'Enter a brief response or acknowledgement.' }, origin);
      const { data, error } = await admin.from('calloria_perf_reviews').update({ employee_response: response, acknowledged_at: new Date().toISOString() }).eq('id', reviewId).eq('staff_user_id', user.id).select('*').maybeSingle();
      if (error) throw error; if (!data) return json(404, { error: 'Review not found for this staff account.' }, origin);
      await event(admin, user.id, user.id, 'employee_review_response', 'review', data.id);
      return json(200, { review: data }, origin);
    }

    if (action === 'list_reviews') {
      const query = admin.from('calloria_perf_reviews').select('id,scorecard_id,staff_user_id,reviewer_user_id,strengths,improvement_areas,employee_response,acknowledged_at,created_at').eq('staff_user_id', user.id).order('created_at', { ascending: false }).limit(30);
      const { data, error } = await query; if (error) throw error;
      return json(200, { reviews: data || [] }, origin);
    }

    if (action === 'add_coaching') {
      if (!isManager(grant)) return json(403, { error: 'Supervisor or People Operations permissions are required.' }, origin);
      const staffId = clean(body.staffUserId, 64); const department = clean(body.department, 120); const target = requireTarget(grant, staffId, department);
      const actionPlan = clean(body.actionPlan, 2000); if (actionPlan.length < 8) return json(400, { error: 'Enter a specific coaching action.' }, origin);
      let dueDate = body.dueDate ? clean(body.dueDate, 10) : null;
      if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T12:00:00Z`)))) return json(400, { error: 'Enter a valid coaching due date.' }, origin);
      const scorecardId = body.scorecardId && isUuid(body.scorecardId) ? body.scorecardId : null;
      if (scorecardId) {
        const linked = await admin.from('calloria_perf_scorecards').select('id,staff_user_id,department').eq('id', scorecardId).maybeSingle();
        if (linked.error) throw linked.error;
        if (!linked.data || linked.data.staff_user_id !== staffId || linked.data.department !== department) return json(400, { error: 'Coaching must link to a scorecard for the same staff member and department.' }, origin);
      }
      const { data, error } = await admin.from('calloria_perf_coaching').insert({ staff_user_id: staffId, created_by: user.id, action_plan: actionPlan, due_date: dueDate, scorecard_id: scorecardId }).select('*').single();
      if (error) throw error;
      await event(admin, user.id, staffId, 'coaching_action_created', 'coaching', data.id, { jobProfile: target.jobProfile });
      return json(200, { coaching: data }, origin);
    }

    if (action === 'update_coaching') {
      const coachingId = clean(body.coachingId, 64); if (!isUuid(coachingId)) return json(400, { error: 'A valid coaching action is required.' }, origin);
      const status = clean(body.status, 20); if (!['in_progress','completed'].includes(status)) return json(400, { error: 'Choose an allowed coaching status.' }, origin);
      const completionNote = clean(body.completionNote, 1600);
      const update: Record<string, unknown> = { status, completion_note: completionNote, completed_at: status === 'completed' ? new Date().toISOString() : null };
      let query = admin.from('calloria_perf_coaching').update(update).eq('id', coachingId);
      if (!isManager(grant)) query = query.eq('staff_user_id', user.id);
      else if (!grant.departments.includes('*')) {
        const ids = Object.entries(accessMap).filter(([, item]) => overlap(grant.departments, item.departments)).map(([id]) => id);
        query = query.in('staff_user_id', ids);
      }
      const { data, error } = await query.select('*').maybeSingle(); if (error) throw error; if (!data) return json(404, { error: 'Coaching action not found.' }, origin);
      await event(admin, user.id, data.staff_user_id, 'coaching_action_updated', 'coaching', data.id, { status });
      return json(200, { coaching: data }, origin);
    }

    if (action === 'save_qa_review') {
      if (!canManageQa(grant)) return json(403, { error: 'QA or supervisor permissions are required.' }, origin);
      const staffId = clean(body.staffUserId, 64); const department = clean(body.department, 120); requireTarget(grant, staffId, department);
      if (staffId === user.id) return json(403, { error: 'An evaluator cannot score their own interaction.' }, origin);
      const channel = clean(body.channel, 30); const interactionRef = clean(body.interactionRef, 100);
      const evaluated = evaluateQaReview(body.rubricValues || {}, { criticalFail: body.criticalFail === true });
      if (!evaluated.complete) return json(400, { error: `Complete each QA rubric section: ${evaluated.missing.join(', ')}.` }, origin);
      const criticalReason = clean(body.criticalReason, 1000);
      if (evaluated.criticalFail && criticalReason.length < 8) return json(400, { error: 'A critical-failure reason is mandatory.' }, origin);
      if (!['voice','email','live_chat','social','whatsapp','back_office','game_support','platform_support'].includes(channel)) return json(400, { error: 'Choose a supported interaction channel.' }, origin);
      const notes = clean(body.evaluatorNotes, 1600);
      const { data, error } = await admin.from('calloria_perf_qa_reviews').insert({
        staff_user_id: staffId, department, channel, interaction_ref: interactionRef, rubric_values: evaluated.values,
        score: evaluated.score, critical_fail: evaluated.criticalFail, critical_reason: criticalReason,
        result: evaluated.passed ? 'pass' : 'fail', evaluator_notes: notes, evaluated_by: user.id
      }).select('*').single();
      if (error) throw error;
      await event(admin, user.id, staffId, 'qa_review_saved', 'qa_review', data.id, { score: evaluated.score, result: evaluated.result, criticalFail: evaluated.criticalFail });
      return json(200, { qaReview: data, evaluation: evaluated }, origin);
    }

    if (action === 'start_exam') {
      const targetRole = validatePromotionTarget(grant.jobProfile, clean(body.targetRole, 80), grant.careerTitle);
      const lagosParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
      const lagosYear = Number(lagosParts.find(x => x.type === 'year')?.value);
      const lagosMonth = Number(lagosParts.find(x => x.type === 'month')?.value);
      const since = new Date(Date.UTC(lagosYear, lagosMonth - 1, 1)); since.setUTCMonth(since.getUTCMonth() - 6);
      const { data: cards, error: cardError } = await admin.from('calloria_perf_scorecards')
        .select('period_start,score,status,gate_pass,critical_fail').eq('staff_user_id', user.id).gte('period_start', since.toISOString().slice(0,10)).eq('status', 'reviewed').order('period_start', { ascending: false }).limit(6);
      if (cardError) throw cardError;
      const eligibility = promotionEligibility(cards || []);
      if (!eligibility.eligible) return json(409, { error: eligibility.reason, eligibility }, origin);
      const questions = randomQuestions(12);
      const { data: attempt, error } = await admin.rpc('calloria_perf_open_exam', {
        p_staff_user_id: user.id, p_target_role: targetRole, p_exam_year: Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric' }).format(new Date())), p_question_ids: questions.map(q => q.id)
      });
      if (error) return json(409, { error: clean(error.message, 240) || 'A promotion exam could not be opened.' }, origin);
      await event(admin, user.id, user.id, 'promotion_exam_started', 'exam', attempt.id, { targetRole, attemptNo: attempt.attempt_no, examYear: attempt.exam_year });
      return json(200, { attempt: { id: attempt.id, targetRole, attemptNo: attempt.attempt_no, examYear: attempt.exam_year, expiresAt: attempt.expires_at }, questions: questions.map(publicQuestion) }, origin);
    }

    if (action === 'submit_exam') {
      const attemptId = clean(body.attemptId, 64); if (!isUuid(attemptId)) return json(400, { error: 'A valid exam session is required.' }, origin);
      const { data: attempt, error: attemptError } = await admin.from('calloria_perf_exam_attempts').select('*').eq('id', attemptId).eq('staff_user_id', user.id).maybeSingle();
      if (attemptError) throw attemptError; if (!attempt) return json(404, { error: 'Exam session not found.' }, origin);
      if (attempt.status !== 'in_progress' || attempt.submitted_at) return json(409, { error: 'This exam has already been submitted or is no longer active.' }, origin);
      if (Date.now() > new Date(attempt.expires_at).getTime()) {
        await admin.from('calloria_perf_exam_attempts').update({ status: 'expired', submitted_at: new Date().toISOString() }).eq('id', attemptId);
        return json(409, { error: 'The 30-minute exam window has expired. The attempt is recorded as expired.' }, origin);
      }
      const answers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};
      const sanitized: Record<string,string> = {};
      const keys: Record<string,string> = {};
      for (const id of attempt.question_ids as string[]) {
        const q = QUESTION_MAP[id]; if (!q) throw new Error('This exam version is no longer available; contact People Operations.');
        const value = clean(answers[id], 1);
        if (value && !['A','B','C','D'].includes(value)) return json(400, { error: 'An answer contains an invalid option.' }, origin);
        if (value) sanitized[id] = value;
        keys[id] = q.answer;
      }
      const scored = scoreExam(attempt.question_ids, sanitized, keys);
      const updated = await admin.from('calloria_perf_exam_attempts').update({ answers: sanitized, score: scored.score, passed: scored.passed, status: scored.passed ? 'passed' : 'failed', submitted_at: new Date().toISOString() }).eq('id', attemptId).eq('status', 'in_progress').select('id,target_role,attempt_no,exam_year,score,passed,status,submitted_at').maybeSingle();
      if (updated.error) throw updated.error; if (!updated.data) return json(409, { error: 'This exam was already finalised.' }, origin);
      await event(admin, user.id, user.id, 'promotion_exam_submitted', 'exam', attemptId, { targetRole: attempt.target_role, score: scored.score, passed: scored.passed, correct: scored.correct, total: scored.total });
      return json(200, { result: updated.data, correct: scored.correct, total: scored.total, answered: scored.answered, note: scored.passed ? 'Exam passed. Promotion still requires role-vacancy review and formal management approval.' : 'Exam not passed. Another attempt may be available in a later annual examination year, subject to the three-attempt limit and current KPI eligibility.' }, origin);
    }

    return json(400, { error: 'Unsupported Performance and Career action.' }, origin);
  } catch (error) {
    console.error('calloria-performance request failed:', error instanceof Error ? error.message : 'unknown error');
    const message = error instanceof Error ? error.message : '';
    if (/outside your permitted|not the next approved|Only one attempt|three annual|three-year|cannot review|already been passed/i.test(message)) return json(403, { error: clean(message, 240) }, origin);
    if (error instanceof TypeError || error instanceof RangeError || /valid scorecard month|complete every|required|sample count|supported job performance/i.test(message)) return json(400, { error: clean(message, 240) }, origin);
    return json(500, { error: 'Performance and Career Management could not complete the request. Check configuration and server logs.' }, origin);
  }
});
