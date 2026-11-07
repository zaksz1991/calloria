import { createClient } from 'npm:@supabase/supabase-js@2';

const allowedOrigins = (Deno.env.get('CALLORIA_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean);
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const accessRaw = Deno.env.get('CALLORIA_WORKFORCE_ACCESS') || '';
const departments = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
const activities = ['customer_work','break','lunch','briefing','training','coaching','quality_assurance','back_office','system_admin','prayer'];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
interface StaffGrant { role: 'agent'|'supervisor'|'wfm_admin'; departments: string[] }
let accessMap: Record<string, StaffGrant> = {};
let accessInvalid = false;
try {
  const parsed = accessRaw ? JSON.parse(accessRaw) : {};
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid access map.');
  for (const [userId, raw] of Object.entries(parsed)) {
    if (!uuidPattern.test(userId)) throw new Error('Invalid staff UUID.');
    const grant = raw as any;
    if (!grant || !['agent','supervisor','wfm_admin'].includes(grant.role) || !Array.isArray(grant.departments) || grant.departments.some((item: unknown) => typeof item !== 'string')) throw new Error('Invalid staff grant.');
    const scoped = grant.departments.map((item: string) => clean(item, 120));
    if (!scoped.length || scoped.some((item: string) => item !== '*' && !departments.includes(item))) throw new Error('Unknown or empty department grant.');
    if (grant.role === 'wfm_admin' && !scoped.includes('*')) throw new Error('Workforce administrators require a wildcard grant.');
    if (grant.role === 'agent' && scoped.includes('*')) throw new Error('Agents require explicit department grants.');
    accessMap[userId] = { role: grant.role, departments: scoped };
  }
} catch { accessInvalid = true; accessMap = {}; }

function clean(value: unknown, max = 300): string {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function json(status: number, body: Record<string, unknown>, origin: string | null) {
  const headers = {
    'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin',
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  };
  return new Response(JSON.stringify(body), { status, headers });
}
function isPrivileged(access: StaffGrant) { return access.role === 'supervisor' || access.role === 'wfm_admin'; }
function scopedDepartments(access: StaffGrant): string[] { return access.departments.includes('*') ? departments : access.departments; }
function canDepartment(access: StaffGrant, department: string): boolean { return access.departments.includes('*') || access.departments.includes(department); }
function intersects(a: string[], b: string[]) { return a.includes('*') || b.includes('*') || a.some(value => b.includes(value)); }
function isUuid(value: unknown): value is string { return typeof value === 'string' && uuidPattern.test(value); }
function validDate(value: unknown): string {
  const date = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid calendar date.');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new Error('Choose a valid calendar date.');
  return date;
}
async function requireStaff(request: Request, admin: ReturnType<typeof createClient>) {
  if (accessInvalid || !Object.keys(accessMap).length) return { error: 'Workforce staff access is not configured correctly.', status: 503 };
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { error: 'Staff sign-in is required.', status: 401 };
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { error: 'Your staff session is invalid or expired.', status: 401 };
  const grant = accessMap[data.user.id];
  if (!grant) return { error: 'This account is not authorised for Workforce Control.', status: 403 };
  return { user: data.user, access: grant };
}

async function attachShiftData(admin: ReturnType<typeof createClient>, shifts: any[]) {
  const ids = shifts.map(shift => shift.id);
  if (!ids.length) return [];
  const [blocks, attendance, actual] = await Promise.all([
    admin.from('calloria_wfm_schedule_blocks').select('id,shift_id,activity,start_at,end_at').in('shift_id', ids).order('start_at'),
    admin.from('calloria_wfm_attendance').select('id,shift_id,clock_in,clock_out,current_activity,last_activity_at').in('shift_id', ids),
    admin.from('calloria_wfm_activity_blocks').select('id,shift_id,activity,started_at,ended_at').in('shift_id', ids).order('started_at')
  ]);
  if (blocks.error) throw blocks.error;
  if (attendance.error) throw attendance.error;
  if (actual.error) throw actual.error;
  const byShift = (records: any[]) => records.reduce((map: Record<string, any[]>, item: any) => {
    (map[item.shift_id] ||= []).push(item); return map;
  }, {});
  const blockMap = byShift(blocks.data || []); const actualMap = byShift(actual.data || []);
  const attendanceMap = Object.fromEntries((attendance.data || []).map((item: any) => [item.shift_id, item]));
  return shifts.map(shift => ({
    ...shift, planBlocks: blockMap[shift.id] || [],
    activityBlocks: actualMap[shift.id] || [], attendance: attendanceMap[shift.id] || null
  }));
}

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
  try {
    const raw = await request.text();
    if (raw.length > 20000) return json(413, { error: 'Request is too large.' }, origin);
    body = JSON.parse(raw);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON object.');
  } catch { return json(400, { error: 'Request body must be a valid JSON object.' }, origin); }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const auth = await requireStaff(request, admin);
  if ('error' in auth) return json(auth.status, { error: auth.error }, origin);
  const user = auth.user!; const access = auth.access!; const scope = scopedDepartments(access);
  const action = clean(body.action, 40);

  try {
    if (action === 'whoami') {
      const directory = isPrivileged(access)
        ? Object.entries(accessMap).filter(([, grant]) => intersects(scope, grant.departments))
            .map(([userId, grant]) => ({ userId, role: grant.role, departments: grant.departments.filter((item: string) => item !== '*') }))
        : [];
      return json(200, { access: { role: access.role, departments: access.departments }, directory }, origin);
    }

    if (action === 'my_schedule') {
      const fromDate = new Date(body.from); const toDate = new Date(body.to);
      if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime()) || toDate <= fromDate || toDate.getTime() - fromDate.getTime() > 45 * 86400000) {
        return json(400, { error: 'A valid schedule window of 45 days or less is required.' }, origin);
      }
      const from = fromDate.toISOString(); const to = toDate.toISOString();
      const { data, error } = await admin.from('calloria_wfm_shifts').select('*').eq('staff_user_id', user.id)
        .lt('shift_start', to).gt('shift_end', from).order('shift_start').limit(40);
      if (error) throw error;
      return json(200, { shifts: await attachShiftData(admin, data || []) }, origin);
    }

    if (action === 'team_snapshot') {
      if (!isPrivileged(access)) return json(403, { error: 'Supervisor permissions are required.' }, origin);
      const date = validDate(body.date); const department = clean(body.department, 120);
      const start = new Date(`${date}T00:00:00+01:00`).toISOString();
      const end = new Date(new Date(`${date}T00:00:00+01:00`).getTime() + 86400000).toISOString();
      const selected = !department || department === 'all' ? scope : canDepartment(access, department) ? [department] : [];
      if (!selected.length) return json(403, { error: 'You do not have access to that department.' }, origin);
      const { data, error } = await admin.from('calloria_wfm_shifts').select('*').in('department', selected)
        .lt('shift_start', end).gt('shift_end', start).order('shift_start').limit(300);
      if (error) throw error;
      return json(200, { shifts: await attachShiftData(admin, data || []) }, origin);
    }

    if (action === 'create_shift') {
      if (!isPrivileged(access)) return json(403, { error: 'Supervisor permissions are required to publish shifts.' }, origin);
      const staffId = clean(body.staffId, 64); const department = clean(body.department, 120);
      if (!isUuid(staffId) || !accessMap[staffId]) return json(400, { error: 'Select a valid employee from the authorised workforce list.' }, origin);
      if (!canDepartment(access, department) || !departments.includes(department)) return json(403, { error: 'You cannot schedule that department.' }, origin);
      const target = accessMap[staffId];
      if (!canDepartment(target, department)) return json(403, { error: 'The selected employee is not authorised for this department.' }, origin);
      const start = new Date(body.startAt); const end = new Date(body.endAt);
      const startMs = start.getTime(); const endMs = end.getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs || endMs - startMs < 4 * 3600000 || endMs - startMs > 16 * 3600000) {
        return json(400, { error: 'A shift must be between four and sixteen hours.' }, origin);
      }
      if (startMs < Date.now() - 86400000 || startMs > Date.now() + 120 * 86400000) return json(400, { error: 'Shifts can be scheduled from yesterday through the next 120 days.' }, origin);
      const blocks = Array.isArray(body.blocks) ? body.blocks : [];
      if (blocks.length > 24) return json(400, { error: 'A shift can contain up to 24 planned activity blocks.' }, origin);
      for (const block of blocks) {
        const blockStart = new Date(block.startAt); const blockEnd = new Date(block.endAt);
        const blockStartMs = blockStart.getTime(); const blockEndMs = blockEnd.getTime();
        if (!activities.includes(block.activity) || !Number.isFinite(blockStartMs) || !Number.isFinite(blockEndMs)
          || blockStartMs < startMs || blockEndMs > endMs || blockEndMs - blockStartMs < 5 * 60000) {
          return json(400, { error: 'One or more planned activity blocks are invalid or outside the shift.' }, origin);
        }
      }
      const ordered = [...blocks].sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
      for (let index = 1; index < ordered.length; index += 1) {
        if (new Date(ordered[index].startAt).getTime() < new Date(ordered[index - 1].endAt).getTime()) return json(400, { error: 'Planned activity blocks must not overlap.' }, origin);
      }
      const { data, error } = await admin.rpc('calloria_wfm_create_shift', {
        p_staff_user_id: staffId, p_department: department, p_shift_start: start.toISOString(),
        p_shift_end: end.toISOString(), p_created_by: user.id, p_blocks: blocks
      });
      if (error) {
        const message = error.message || '';
        if (/overlapping published shift/i.test(message)) return json(409, { error: 'This employee already has an overlapping published shift.' }, origin);
        if (/activity block|planned activity/i.test(message)) return json(400, { error: 'The planned activity blocks are invalid.' }, origin);
        throw error;
      }
      return json(201, { shiftId: data }, origin);
    }

    if (['clock_in','clock_out','change_activity'].includes(action)) {
      const shiftId = clean(body.shiftId, 64);
      if (!isUuid(shiftId)) return json(400, { error: 'A valid shift ID is required.' }, origin);
      const { data: shift, error: shiftError } = await admin.from('calloria_wfm_shifts').select('id,staff_user_id,status')
        .eq('id', shiftId).maybeSingle();
      if (shiftError) throw shiftError;
      if (!shift || shift.staff_user_id !== user.id) return json(404, { error: 'Your shift was not found.' }, origin);
      if (shift.status !== 'published') return json(409, { error: 'This shift is not active for attendance.' }, origin);
      let rpcName = ''; let args: Record<string, unknown> = { p_shift_id: shiftId, p_staff_user_id: user.id };
      if (action === 'clock_in') rpcName = 'calloria_wfm_clock_in';
      if (action === 'clock_out') rpcName = 'calloria_wfm_clock_out';
      if (action === 'change_activity') {
        rpcName = 'calloria_wfm_change_activity';
        const activity = clean(body.activity, 32);
        if (!activities.includes(activity) || activity === 'offline') return json(400, { error: 'Choose a valid on-duty workforce activity.' }, origin);
        args = { ...args, p_activity: activity };
      }
      const { data, error } = await admin.rpc(rpcName, args);
      if (error) {
        const message = error.message || '';
        if (/already|clock in|clock-out|attendance|permitted window|overlapping/i.test(message)) return json(409, { error: clean(message, 220) }, origin);
        throw error;
      }
      return json(200, { attendance: data }, origin);
    }

    if (action === 'list_briefings') {
      const date = validDate(body.date);
      const { data, error } = await admin.from('calloria_wfm_briefings').select('id,work_date,department,briefing_type,title,starts_at,ends_at,timezone')
        .eq('work_date', date).in('department', scope).order('starts_at');
      if (error) throw error;
      const ids = (data || []).map((item: any) => item.id);
      let acknowledgements: any[] = [];
      if (ids.length) {
        const { data: rows, error: ackError } = await admin.from('calloria_wfm_briefing_attendance')
          .select('briefing_id,acknowledged_at').eq('staff_user_id', user.id).in('briefing_id', ids);
        if (ackError) throw ackError; acknowledgements = rows || [];
      }
      const ackMap = new Map(acknowledgements.map((row: any) => [row.briefing_id, row.acknowledged_at]));
      return json(200, { briefings: (data || []).map((item: any) => ({ ...item, acknowledged_at: ackMap.get(item.id) || null })) }, origin);
    }

    if (action === 'create_standard_briefings') {
      if (!isPrivileged(access)) return json(403, { error: 'Supervisor permissions are required to publish briefings.' }, origin);
      const date = validDate(body.date); const requested = clean(body.department, 120);
      const chosen = !requested || requested === 'all' ? scope : canDepartment(access, requested) ? [requested] : [];
      if (!chosen.length) return json(403, { error: 'You do not have access to that briefing department.' }, origin);
      const targetTime = new Date(`${date}T00:00:00+01:00`).getTime();
      if (targetTime < Date.now() - 30 * 86400000 || targetTime > Date.now() + 90 * 86400000) return json(400, { error: 'Briefings can be scheduled from 30 days ago through the next 90 days.' }, origin);
      const { data, error } = await admin.rpc('calloria_wfm_seed_standard_briefings', {
        p_work_date: date, p_departments: chosen, p_created_by: user.id
      });
      if (error) throw error;
      return json(200, { created: Number(data || 0) }, origin);
    }

    if (action === 'acknowledge_briefing') {
      const briefingId = clean(body.briefingId, 64);
      if (!isUuid(briefingId)) return json(400, { error: 'A valid briefing reference is required.' }, origin);
      const { data: briefing, error: briefingError } = await admin.from('calloria_wfm_briefings')
        .select('id,department').eq('id', briefingId).maybeSingle();
      if (briefingError) throw briefingError;
      if (!briefing || !canDepartment(access, briefing.department)) return json(404, { error: 'Briefing was not found in your permitted departments.' }, origin);
      const { error } = await admin.from('calloria_wfm_briefing_attendance').upsert(
        { briefing_id: briefingId, staff_user_id: user.id }, { onConflict: 'briefing_id,staff_user_id', ignoreDuplicates: true }
      );
      if (error) throw error;
      const { error: eventError } = await admin.from('calloria_wfm_events').insert({ staff_user_id: user.id, actor_user_id: user.id, event_type: 'briefing_acknowledged', detail: 'briefing' });
      if (eventError) throw eventError;
      return json(200, { acknowledged: true }, origin);
    }

    return json(400, { error: 'Unsupported Workforce Control action.' }, origin);
  } catch (error) {
    console.error('calloria-workforce request failed:', error instanceof Error ? error.message : 'unknown error');
    return json(500, { error: 'Workforce Control could not complete the request. Check configuration and server logs.' }, origin);
  }
});
