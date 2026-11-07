import { createClient } from '@supabase/supabase-js';
import {
  ACTIVITY_LABELS, WFM_ACTIVITIES, WFM_DEPARTMENTS, calculateScheduleAdherence,
  cleanWfmText, currentActivity, localDateTimeToIso, validateBriefingDate,
  validatePlanBlocks, validateShift
} from './wfm-engine.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const $ = selector => document.querySelector(selector);
const loginPanel = $('#wfm-login');
const appPanel = $('#wfm-app');
const loginForm = $('#wfm-login-form');
let supabase = null;
let session = null;
let access = null;
let directory = [];
let myShifts = [];
let teamShifts = [];
let briefings = [];
let selectedShift = null;

function setStatus(node, message, type = '') {
  if (!node) return;
  node.textContent = message || '';
  node.className = `wfm-status ${type}`.trim();
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
function localDate(now = new Date()) {
  const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, '0'); const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function dateTime(value) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}
function timeText(value) {
  return value ? new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
}
function shortId(value) { return String(value || '').slice(0, 8).toUpperCase(); }
function roleLabel(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function addCalendarDay(date) { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + 1); return localDate(value); }
function shiftEndDate(date, startTime, endTime) { return endTime <= startTime ? addCalendarDay(date) : date; }
function blockIso(date, shiftStartTime, blockStartTime, blockEndTime) {
  const blockDate = blockStartTime < shiftStartTime ? addCalendarDay(date) : date;
  const blockEndDate = blockEndTime <= blockStartTime ? addCalendarDay(blockDate) : blockDate;
  return { startAt: localDateTimeToIso(blockDate, blockStartTime), endAt: localDateTimeToIso(blockEndDate, blockEndTime) };
}
function visibleDepartments() { return access?.departments?.includes('*') ? WFM_DEPARTMENTS : (access?.departments || []); }

async function api(action, payload = {}) {
  if (!supabase || !session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-workforce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Workforce request failed (${response.status}).`);
  return body;
}

function fillSelect(select, options, includeAll = false) {
  select.replaceChildren();
  if (includeAll) {
    const option = document.createElement('option'); option.value = 'all'; option.textContent = 'All permitted departments'; select.append(option);
  }
  for (const item of options) {
    const option = document.createElement('option');
    option.value = typeof item === 'string' ? item : item.value;
    option.textContent = typeof item === 'string' ? item : item.label;
    select.append(option);
  }
}

function renderMyShift() {
  const box = $('#wfm-my-shift'); box.replaceChildren();
  const now = Date.now();
  const current = myShifts.find(shift => shift.attendance?.clock_in && !shift.attendance?.clock_out)
    || myShifts.find(shift => shift.status === 'published' && new Date(shift.shift_start).getTime() <= now && new Date(shift.shift_end).getTime() >= now)
    || myShifts[0] || null;
  selectedShift = current;
  if (!myShifts.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No published shifts were found for this date range.'; box.append(empty);
    $('#wfm-clock-in').disabled = true; $('#wfm-clock-out').disabled = true;
    document.querySelectorAll('[data-activity]').forEach(button => { button.disabled = true; button.classList.remove('active'); });
    return;
  }
  for (const shift of myShifts) {
    const card = document.createElement('article'); card.className = 'shift-item';
    const title = document.createElement('h3'); title.textContent = shift.department;
    const range = document.createElement('div'); range.className = 'shift-time'; range.textContent = `${timeText(shift.shift_start)} – ${timeText(shift.shift_end)}`;
    const meta = document.createElement('div'); meta.className = 'shift-meta';
    const date = document.createElement('span'); date.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(shift.shift_start));
    const state = document.createElement('span'); state.textContent = shift.attendance?.clock_out ? 'Completed' : shift.attendance?.clock_in ? 'Clocked in' : 'Not clocked in';
    const planned = document.createElement('span'); planned.textContent = `${(shift.planBlocks || []).length} planned activities`;
    meta.append(date, state, planned);
    const currentActivityRow = currentActivity(shift.activityBlocks || [], now);
    const currentActivityLabel = document.createElement('p'); currentActivityLabel.className = 'muted small';
    currentActivityLabel.textContent = currentActivityRow ? `Current activity: ${ACTIVITY_LABELS[currentActivityRow.activity] || roleLabel(currentActivityRow.activity)}` : 'Current activity: not clocked in';
    const adherence = calculateScheduleAdherence(shift.planBlocks || [], shift.activityBlocks || [], now);
    const adherenceLabel = document.createElement('div'); adherenceLabel.className = 'shift-meta';
    adherenceLabel.textContent = adherence.adherence === null ? 'Adherence pending activity records' : `Schedule adherence: ${adherence.adherence}% · ${adherence.deviationMinutes} deviation minutes`;
    const bar = document.createElement('div'); bar.className = 'adherence-bar';
    const fill = document.createElement('span'); fill.style.width = `${adherence.adherence ?? 0}%`; bar.append(fill);
    const selectButton = document.createElement('button'); selectButton.type = 'button'; selectButton.className = 'wfm-button outline';
    selectButton.textContent = shift.id === selectedShift?.id ? 'Selected for attendance' : 'Select this shift';
    selectButton.disabled = shift.id === selectedShift?.id;
    selectButton.addEventListener('click', () => { selectedShift = shift; renderMyShift(); });
    card.append(title, range, meta, currentActivityLabel, adherenceLabel, bar, selectButton);
    if (shift.id === selectedShift?.id) card.style.borderColor = '#24a99b';
    box.append(card);
  }
  const hasAttendance = !!selectedShift?.attendance?.clock_in;
  const clockedOut = !!selectedShift?.attendance?.clock_out;
  $('#wfm-clock-in').disabled = !selectedShift || hasAttendance || selectedShift.status !== 'published';
  $('#wfm-clock-out').disabled = !selectedShift || !hasAttendance || clockedOut;
  document.querySelectorAll('[data-activity]').forEach(button => {
    button.disabled = !selectedShift || !hasAttendance || clockedOut;
    const actual = currentActivity(selectedShift?.activityBlocks || [], now);
    button.classList.toggle('active', actual?.activity === button.dataset.activity);
  });
}

function renderBriefings() {
  const box = $('#wfm-briefing-list'); box.replaceChildren();
  $('#wfm-metric-briefings').textContent = briefings.filter(item => !item.acknowledged_at).length;
  if (!briefings.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No briefing sessions have been published for this date.'; box.append(empty); return;
  }
  for (const item of briefings) {
    const card = document.createElement('article'); card.className = 'briefing-card';
    const title = document.createElement('h3'); title.textContent = item.title;
    const info = document.createElement('p'); info.textContent = `${roleLabel(item.briefing_type)} · ${item.department} · ${dateTime(item.starts_at)}`;
    const agenda = document.createElement('p');
    agenda.textContent = item.briefing_type === 'morning'
      ? 'Agenda: new product and service releases, policy/process changes, security notices, queue priorities and service targets.'
      : 'Agenda: updates since morning, service incidents and fixes, open customer-impacting issues, knowledge checks and shift handover.';
    const actions = document.createElement('div'); actions.className = 'briefing-actions';
    const tag = document.createElement('span'); tag.className = 'briefing-tag'; tag.textContent = item.acknowledged_at ? `Acknowledged ${dateTime(item.acknowledged_at)}` : 'Attendance not acknowledged';
    actions.append(tag);
    if (!item.acknowledged_at) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wfm-button outline'; button.textContent = 'Acknowledge attendance';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try { await api('acknowledge_briefing', { briefingId: item.id }); await loadBriefings(); setStatus($('#wfm-briefing-status'), 'Briefing attendance recorded.', 'success'); }
        catch (error) { button.disabled = false; setStatus($('#wfm-briefing-status'), error.message, 'error'); }
      });
      actions.append(button);
    }
    card.append(title, info, agenda, actions); box.append(card);
  }
}

function renderTeam() {
  const body = $('#wfm-team-rows'); body.replaceChildren();
  const now = Date.now();
  if (!teamShifts.length) {
    const row = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = 6; cell.textContent = 'No shifts have been published for this roster date.'; row.append(cell); body.append(row); return;
  }
  let clocked = 0; let breaks = 0;
  for (const shift of teamShifts) {
    const attendance = shift.attendance || null;
    const active = currentActivity(shift.activityBlocks || [], now);
    if (attendance?.clock_in && !attendance.clock_out) clocked += 1;
    if (active && ['break','lunch','prayer'].includes(active.activity)) breaks += 1;
    const adherence = calculateScheduleAdherence(shift.planBlocks || [], shift.activityBlocks || [], now);
    const values = [
      `Staff ${shortId(shift.staff_user_id)}`,
      shift.department,
      `${timeText(shift.shift_start)}–${timeText(shift.shift_end)}`,
      attendance?.clock_out ? 'Clocked out' : attendance?.clock_in ? 'Clocked in' : 'Not clocked in',
      active ? (ACTIVITY_LABELS[active.activity] || roleLabel(active.activity)) : 'No activity recorded',
      adherence.adherence === null ? '—' : `${adherence.adherence}%`
    ];
    const row = document.createElement('tr');
    values.forEach((value, index) => {
      const cell = document.createElement('td'); cell.textContent = value;
      if (index === 3 || index === 4) { const pill = document.createElement('span'); pill.className = 'status-pill'; pill.textContent = value; cell.replaceChildren(pill); }
      row.append(cell);
    });
    body.append(row);
  }
  $('#wfm-metric-clocked').textContent = clocked;
  $('#wfm-metric-breaks').textContent = breaks;
}

async function loadMySchedule() {
  const from = new Date(); from.setHours(0,0,0,0); from.setDate(from.getDate() - 1);
  const to = new Date(from); to.setDate(to.getDate() + 10);
  const result = await api('my_schedule', { from: from.toISOString(), to: to.toISOString() });
  myShifts = result.shifts || [];
  renderMyShift();
  $('#wfm-metric-shifts').textContent = myShifts.length;
  const clocked = myShifts.filter(x => x.attendance?.clock_in && !x.attendance?.clock_out).length;
  $('#wfm-metric-clocked').textContent = clocked;
}

async function loadBriefings() {
  const date = validateBriefingDate($('#wfm-briefing-date').value || localDate());
  const result = await api('list_briefings', { date });
  briefings = result.briefings || [];
  renderBriefings();
}

async function loadTeam() {
  if (!['supervisor','wfm_admin'].includes(access?.role)) return;
  const date = $('#wfm-roster-date').value || localDate();
  const department = $('#wfm-team-department').value || 'all';
  setStatus($('#wfm-team-status'), 'Loading team schedule…');
  try {
    const result = await api('team_snapshot', { date, department });
    teamShifts = result.shifts || [];
    renderTeam(); setStatus($('#wfm-team-status'), `Loaded ${teamShifts.length} shift record(s).`, 'success');
  } catch (error) { setStatus($('#wfm-team-status'), error.message, 'error'); }
}

function renderDirectory() {
  const options = directory.map(person => ({ value: person.userId, label: `Staff ${shortId(person.userId)} · ${person.departments.includes('*') ? 'All departments' : person.departments.join(', ')}` }));
  fillSelect($('#wfm-shift-staff'), options);
  fillSelect($('#wfm-shift-department'), visibleDepartments());
  fillSelect($('#wfm-team-department'), visibleDepartments(), true);
  fillSelect($('#wfm-briefing-department'), visibleDepartments(), true);
}

function addBlockRow(activity = 'customer_work', start = '08:00', end = '17:00') {
  const row = document.createElement('div'); row.className = 'block-row';
  const activityLabel = document.createElement('label'); activityLabel.textContent = 'Activity';
  const select = document.createElement('select'); select.dataset.field = 'activity';
  for (const value of WFM_ACTIVITIES) { const option = document.createElement('option'); option.value = value; option.textContent = ACTIVITY_LABELS[value]; select.append(option); }
  select.value = activity; activityLabel.append(select);
  const startLabel = document.createElement('label'); startLabel.textContent = 'Start';
  const startInput = document.createElement('input'); startInput.type = 'time'; startInput.value = start; startInput.dataset.field = 'start'; startInput.required = true; startLabel.append(startInput);
  const endLabel = document.createElement('label'); endLabel.textContent = 'End';
  const endInput = document.createElement('input'); endInput.type = 'time'; endInput.value = end; endInput.dataset.field = 'end'; endInput.required = true; endLabel.append(endInput);
  const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wfm-button danger'; remove.textContent = 'Remove'; remove.addEventListener('click', () => row.remove());
  row.append(activityLabel, startLabel, endLabel, remove); $('#wfm-block-list').append(row);
}

function showLogin(message = '') {
  loginPanel.hidden = false; appPanel.hidden = true; $('#wfm-sign-out').hidden = true;
  setStatus($('#wfm-login-status'), message);
}

async function loadWorkspace(user, response) {
  access = response.access; directory = response.directory || [];
  loginPanel.hidden = true; appPanel.hidden = false; $('#wfm-sign-out').hidden = false;
  $('#wfm-staff-label').textContent = user.email || `Staff ${shortId(user.id)}`;
  $('#wfm-staff-scope').textContent = `${roleLabel(access.role)} · ${access.departments.includes('*') ? 'All workforce departments' : access.departments.join(', ')}`;
  const privileged = ['supervisor','wfm_admin'].includes(access.role);
  $('#wfm-team-panel').hidden = !privileged; $('#wfm-briefing-tools').hidden = !privileged;
  $('#wfm-timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  const today = localDate(); $('#wfm-briefing-date').value = today; $('#wfm-roster-date').value = today; $('#wfm-shift-date').value = today;
  renderDirectory();
  await Promise.all([loadMySchedule(), loadBriefings()]);
  if (privileged) await loadTeam();
}

async function start() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Public Supabase configuration is missing.'); return; }
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data: { session: currentSession } } = await supabase.auth.getSession(); session = currentSession;
  if (!session) { showLogin(); return; }
  try { const response = await api('whoami'); await loadWorkspace(session.user, response); }
  catch (error) { await supabase.auth.signOut(); session = null; showLogin(error.message); }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) { setStatus($('#wfm-login-status'), 'Supabase public configuration is missing.', 'error'); return; }
  setStatus($('#wfm-login-status'), 'Verifying staff access…');
  const { data, error } = await supabase.auth.signInWithPassword({ email: $('#wfm-email').value.trim(), password: $('#wfm-password').value });
  $('#wfm-password').value = '';
  if (error || !data.user) { setStatus($('#wfm-login-status'), error?.message || 'Staff sign-in failed.', 'error'); return; }
  session = data.session;
  try { const response = await api('whoami'); await loadWorkspace(data.user, response); }
  catch (failure) { await supabase.auth.signOut(); session = null; showLogin(failure.message); }
});

$('#wfm-sign-out').addEventListener('click', async () => { await supabase?.auth.signOut(); session = null; access = null; directory = []; myShifts = []; teamShifts = []; showLogin('Signed out.'); });
$('#wfm-refresh').addEventListener('click', async () => {
  try { await Promise.all([loadMySchedule(), loadBriefings()]); await loadTeam(); setStatus($('#wfm-my-status'), 'Workforce data refreshed.', 'success'); }
  catch (error) { setStatus($('#wfm-my-status'), error.message, 'error'); }
});
$('#wfm-clock-in').addEventListener('click', async () => {
  if (!selectedShift) return;
  try { await api('clock_in', { shiftId: selectedShift.id }); await loadMySchedule(); setStatus($('#wfm-my-status'), 'Clock-in recorded by the server.', 'success'); await loadTeam(); }
  catch (error) { setStatus($('#wfm-my-status'), error.message, 'error'); }
});
$('#wfm-clock-out').addEventListener('click', async () => {
  if (!selectedShift) return;
  try { await api('clock_out', { shiftId: selectedShift.id }); await loadMySchedule(); setStatus($('#wfm-my-status'), 'Clock-out recorded by the server.', 'success'); await loadTeam(); }
  catch (error) { setStatus($('#wfm-my-status'), error.message, 'error'); }
});
document.querySelectorAll('[data-activity]').forEach(button => button.addEventListener('click', async () => {
  if (!selectedShift) return;
  try { await api('change_activity', { shiftId: selectedShift.id, activity: button.dataset.activity }); await loadMySchedule(); setStatus($('#wfm-my-status'), `Activity changed to ${ACTIVITY_LABELS[button.dataset.activity]}.`, 'success'); await loadTeam(); }
  catch (error) { setStatus($('#wfm-my-status'), error.message, 'error'); }
}));

$('#wfm-new-shift').addEventListener('click', () => {
  $('#wfm-shift-form').reset(); $('#wfm-shift-date').value = localDate(); $('#wfm-timezone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
  $('#wfm-block-list').replaceChildren(); addBlockRow('customer_work', '08:00', '17:00');
  setStatus($('#wfm-shift-status'), ''); $('#wfm-shift-dialog').showModal();
});
$('#wfm-add-block').addEventListener('click', () => addBlockRow());
['wfm-shift-start','wfm-shift-end'].forEach(id => $(`#${id}`).addEventListener('change', () => {
  const rows = [...$('#wfm-block-list').querySelectorAll('.block-row')];
  if (rows.length === 1 && rows[0].querySelector('[data-field=activity]').value === 'customer_work') {
    rows[0].querySelector('[data-field=start]').value = $('#wfm-shift-start').value;
    rows[0].querySelector('[data-field=end]').value = $('#wfm-shift-end').value;
  }
}));
$('#wfm-shift-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const date = $('#wfm-shift-date').value;
    const input = validateShift({
      staffId: $('#wfm-shift-staff').value, department: $('#wfm-shift-department').value,
      startAt: localDateTimeToIso(date, $('#wfm-shift-start').value),
      endAt: localDateTimeToIso(shiftEndDate(date, $('#wfm-shift-start').value, $('#wfm-shift-end').value), $('#wfm-shift-end').value)
    }, visibleDepartments());
    const rawBlocks = [...$('#wfm-block-list').querySelectorAll('.block-row')].map(row => {
      const startTime = row.querySelector('[data-field="start"]').value;
      const endTime = row.querySelector('[data-field="end"]').value;
      return { activity: row.querySelector('[data-field="activity"]').value, ...blockIso(date, $('#wfm-shift-start').value, startTime, endTime) };
    });
    input.blocks = validatePlanBlocks(rawBlocks, input.startAt, input.endAt);
    await api('create_shift', input);
    $('#wfm-shift-dialog').close(); await loadMySchedule(); await loadTeam();
    setStatus($('#wfm-team-status'), 'Shift published successfully.', 'success');
  } catch (error) { setStatus($('#wfm-shift-status'), error.message, 'error'); }
});

$('#wfm-create-briefings').addEventListener('click', async () => {
  try {
    const date = validateBriefingDate($('#wfm-briefing-date').value);
    const department = $('#wfm-briefing-department').value;
    const result = await api('create_standard_briefings', { date, department });
    await loadBriefings(); setStatus($('#wfm-briefing-status'), `${result.created || 0} standard briefing session(s) created or already scheduled.`, 'success');
  } catch (error) { setStatus($('#wfm-briefing-status'), error.message, 'error'); }
});
$('#wfm-briefing-date').addEventListener('change', loadBriefings);
$('#wfm-roster-date').addEventListener('change', loadTeam);
$('#wfm-team-department').addEventListener('change', loadTeam);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));

(async () => { try { await start(); } catch (error) { showLogin(error.message || 'Workforce Control could not start.'); } })();
