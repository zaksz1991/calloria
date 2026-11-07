import { createClient } from '@supabase/supabase-js';
import portfolioCatalog from '../assets/ruffneck-catalog.json';
import {
  cleanText, validateWorkItem, validateWrapUp, queueCounts, dueState, formatDuration
} from './agent-desk-engine.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const $ = selector => document.querySelector(selector);
const loginPanel = $('#login-panel');
const workspace = $('#workspace');
const loginForm = $('#login-form');
const loginStatus = $('#login-status');
const globalStatus = $('#global-status');
const queueList = $('#queue-list');
const newItemDialog = $('#new-item-dialog');
let supabase = null;
let session = null;
let staff = null;
let items = [];
let selected = null;
let catalog = Array.isArray(portfolioCatalog.products) ? portfolioCatalog.products : [];
let refreshTimer = null;

function setStatus(target, message, type = '') {
  target.textContent = message || '';
  target.className = `status ${type}`.trim();
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
function titleCase(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function dateText(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Not recorded'; }
function showLogin(message = '') {
  loginPanel.hidden = false;
  workspace.hidden = true;
  $('#sign-out').hidden = true;
  setStatus(loginStatus, message);
}
function showWorkspace(user, access) {
  staff = access;
  loginPanel.hidden = true;
  workspace.hidden = false;
  $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${titleCase(access.role)} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  const departments = access.departments.includes('*') ? DEPARTMENT_OPTIONS : access.departments;
  fillSelect($('#department-filter'), departments, true);
  fillSelect($('#new-department'), departments, false);
  renderKnowledge('');
}
const DEPARTMENT_OPTIONS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];
function fillSelect(select, options, includeAll) {
  select.replaceChildren();
  if (includeAll) {
    const option = document.createElement('option'); option.value = 'all'; option.textContent = 'All permitted departments'; select.append(option);
  }
  for (const value of options) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); }
}
async function api(action, payload = {}) {
  if (!supabase || !session?.access_token) throw new Error('Staff session has expired. Sign in again.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-agent-desk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey, 'Authorization': `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Agent Desk request failed (${response.status}).`);
  return result;
}
function renderMetrics() {
  const counts = queueCounts(items);
  $('#metric-pending').textContent = counts.pending;
  $('#metric-active').textContent = counts.active + counts.claimed + counts.after_contact_work;
  $('#metric-hold').textContent = counts.on_hold;
  $('#metric-escalated').textContent = counts.escalated;
  $('#metric-resolved').textContent = counts.resolved;
}
function filteredItems() {
  const department = $('#department-filter').value;
  const status = $('#status-filter').value;
  const channel = $('#channel-filter').value;
  return items.filter(item => (department === 'all' || item.department === department)
    && (status === 'all' || (status === 'open' ? !['resolved','cancelled'].includes(item.status) : item.status === status))
    && (channel === 'all' || item.channel === channel))
    .sort((a,b) => { const rank = { urgent:0, high:1, normal:2, low:3 }; return (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4) || new Date(a.due_at || a.created_at) - new Date(b.due_at || b.created_at); });
}
function drawQueue() {
  renderMetrics();
  queueList.replaceChildren();
  const shown = filteredItems();
  if (!shown.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No interactions match these filters.'; queueList.append(empty); return; }
  for (const item of shown) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `queue-card${selected?.id === item.id ? ' selected' : ''}`;
    const top = document.createElement('div'); top.className = 'queue-top';
    const priority = document.createElement('span'); priority.className = `priority ${item.priority}`; priority.textContent = item.priority;
    const status = document.createElement('span'); status.className = 'small muted'; status.textContent = titleCase(item.status);
    top.append(priority, status);
    const title = document.createElement('strong'); title.textContent = item.subject;
    const meta = document.createElement('small'); meta.textContent = `${item.work_ref} · ${titleCase(item.channel)} · ${titleCase(item.department)}`;
    const due = document.createElement('small'); due.textContent = `SLA: ${titleCase(dueState(item.due_at))} · ${dateText(item.created_at)}`;
    button.append(top, title, meta, due);
    button.addEventListener('click', () => loadItem(item.id));
    queueList.append(button);
  }
}
function addInfo(label, value) {
  const cell = document.createElement('div'); cell.className = 'info-cell';
  const key = document.createElement('span'); key.textContent = label;
  const val = document.createElement('strong'); val.textContent = value || '—';
  cell.append(key, val); $('#item-info').append(cell);
}
function control(label, next, disabled = false, style = 'outline') {
  const button = document.createElement('button'); button.type = 'button'; button.className = `button ${style}`; button.textContent = label; button.disabled = disabled;
  button.addEventListener('click', () => changeStatus(next)); $('#work-controls').append(button);
}
function drawItem(item) {
  selected = item;
  $('#no-item').hidden = true; $('#item-content').hidden = false;
  $('#item-ref').textContent = item.work_ref;
  $('#item-subject').textContent = item.subject;
  $('#item-subline').textContent = `${titleCase(item.direction)} ${titleCase(item.channel)} · Opened ${dateText(item.created_at)}`;
  const statusChip = $('#item-status'); statusChip.textContent = titleCase(item.status); statusChip.className = `status-chip ${dueState(item.due_at)}`;
  $('#item-summary').textContent = item.summary;
  $('#item-info').replaceChildren();
  addInfo('Department', item.department); addInfo('Priority', titleCase(item.priority));
  addInfo('Platform', catalog.find(p => p.id === item.platform_id)?.name || 'General');
  addInfo('Assigned to', item.assigned_to === session.user.id ? 'You' : item.assigned_to ? 'Another staff member' : 'Unassigned');
  addInfo('CRM reference', item.crm_customer_id ? `CRM-${item.crm_customer_id.slice(0, 8).toUpperCase()}` : 'None linked');
  addInfo('Case reference', item.case_reference || 'None linked');
  addInfo('SLA target', dateText(item.due_at));
  addInfo('Started', dateText(item.started_at));
  $('#ownership-label').textContent = item.assigned_to === session.user.id ? 'Assigned to you' : item.assigned_to ? 'Owned by another staff member' : 'Unassigned';
  drawControls(item);
  $('#wrapup-panel').hidden = item.status !== 'after_contact_work';
  drawEvents(item.events || []);
  drawQueue();
}
function drawControls(item) {
  const box = $('#work-controls'); box.replaceChildren();
  const mine = item.assigned_to === session.user.id;
  const supervisor = staff.role === 'supervisor';
  const routeManaged = String(item.work_ref || '').startsWith('CR-') && !item.assigned_to && ['pending','escalated'].includes(item.status);
  if (!item.assigned_to && ['pending','escalated'].includes(item.status) && !routeManaged) control('Claim interaction', 'claim', false, 'primary');
  if (routeManaged) { const note = document.createElement('p'); note.className = 'muted small'; note.textContent = 'Guest-routed request: claim it from Routing Control so workforce status, approved skills and language eligibility are enforced.'; box.append(note); }
  if (mine && item.status === 'claimed') { control('Start handling', 'active', false, 'primary'); control('Release back to queue', 'pending', false, 'quiet'); }
  if (mine && item.status === 'active') { control('Place on hold', 'on_hold'); control('Begin after-contact work', 'after_contact_work', false, 'primary'); control('Escalate', 'escalated', false, 'quiet'); }
  if (mine && item.status === 'on_hold') control('Resume handling', 'active', false, 'primary');
  if (supervisor && item.status === 'escalated' && !mine && !routeManaged) control('Assign to me', 'claim', false, 'primary');
  if (supervisor && !['resolved','cancelled'].includes(item.status)) control('Cancel work item', 'cancelled', false, 'quiet');
  if (!box.children.length) { const note = document.createElement('span'); note.className = 'muted small'; note.textContent = 'No actions are available for your current ownership and permission state.'; box.append(note); }
}
function drawEvents(events) {
  const box = $('#event-list'); box.replaceChildren();
  if (!events.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No activity events yet.'; box.append(empty); return; }
  for (const event of events) {
    const row = document.createElement('div'); row.className = 'event-row';
    const dot = document.createElement('span'); dot.className = 'event-dot';
    const body = document.createElement('div');
    const title = document.createElement('strong'); title.textContent = titleCase(event.event_type.replaceAll('.', ' '));
    const date = document.createElement('small'); date.textContent = `${dateText(event.created_at)} · ${event.actor_label || 'System'}`;
    body.append(title, date); row.append(dot, body); box.append(row);
  }
}
async function loadQueue() {
  setStatus(globalStatus, 'Loading permitted queues…');
  try {
    const result = await api('queue'); items = result.items || [];
    drawQueue();
    if (selected) {
      const current = items.find(item => item.id === selected.id);
      if (current) await loadItem(current.id, false); else { selected = null; $('#item-content').hidden = true; $('#no-item').hidden = false; }
    }
    setStatus(globalStatus, `Loaded ${items.length} work item(s) for your permitted departments.`, 'success');
  } catch (error) { setStatus(globalStatus, error.message, 'error'); }
}
async function loadItem(id, updateStatus = true) {
  try {
    const result = await api('get_item', { itemId: id });
    drawItem(result.item);
    if (updateStatus) setStatus(globalStatus, `Opened ${result.item.work_ref}.`, 'success');
  } catch (error) { setStatus(globalStatus, error.message, 'error'); }
}
async function changeStatus(next) {
  if (!selected) return;
  try {
    if (next === 'claim') await api('claim', { itemId: selected.id });
    else await api('transition', { itemId: selected.id, nextStatus: next, expectedVersion: selected.version });
    await loadQueue(); await loadItem(selected.id, false);
    if (next === 'after_contact_work') { $('#wrapup-disposition').focus(); }
    setStatus(globalStatus, next === 'claim' ? 'Interaction claimed.' : `Interaction updated: ${titleCase(next)}.`, 'success');
  } catch (error) { setStatus(globalStatus, error.message, 'error'); }
}
function renderKnowledge(query) {
  const box = $('#knowledge-results'); box.replaceChildren();
  const q = cleanText(query, 100).toLowerCase();
  const found = catalog.filter(product => !q || [product.name, product.summary, product.category, ...(product.customer_needs || []), ...(product.self_service || [])].join(' ').toLowerCase().includes(q)).slice(0, 8);
  if (!found.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = "No catalogue entry matched. Use the owning platform\'s current help information."; box.append(empty); return; }
  for (const product of found) {
    const card = document.createElement('article'); card.className = 'knowledge-card';
    const name = document.createElement('strong'); name.textContent = product.name;
    const summary = document.createElement('p'); summary.textContent = product.summary;
    const steps = document.createElement('p'); steps.textContent = (product.self_service || []).slice(0, 2).join(' ');
    const link = document.createElement('a'); link.href = product.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open platform ↗';
    card.append(name, summary, steps, link); box.append(card);
  }
}
async function createWorkItem(event) {
  event.preventDefault();
  const input = {
    department: $('#new-department').value, channel: $('#new-channel').value,
    direction: $('#new-direction').value, priority: $('#new-priority').value,
    platformId: $('#new-platform').value, subject: $('#new-subject').value,
    summary: $('#new-summary').value, crmCustomerId: $('#new-crm-id').value, caseReference: $('#new-case-reference').value
  };
  try { validateWorkItem(input, staff.departments.includes('*') ? DEPARTMENT_OPTIONS : staff.departments); }
  catch (error) { setStatus($('#new-item-status'), error.message, 'error'); return; }
  try {
    const result = await api('create_item', input);
    newItemDialog.close(); $('#new-item-form').reset();
    await loadQueue(); await loadItem(result.item.id);
    setStatus(globalStatus, `Created ${result.item.work_ref}.`, 'success');
  } catch (error) { setStatus($('#new-item-status'), error.message, 'error'); }
}
async function submitWrapup(event) {
  event.preventDefault(); if (!selected) return;
  let wrapup;
  try { wrapup = validateWrapUp({ disposition: $('#wrapup-disposition').value, summary: $('#wrapup-summary').value }); }
  catch (error) { setStatus($('#wrapup-status'), error.message, 'error'); return; }
  try {
    await api('wrapup', { itemId: selected.id, ...wrapup, expectedVersion: selected.version });
    $('#wrapup-form').reset(); $('#wrapup-panel').hidden = true;
    await loadQueue(); await loadItem(selected.id, false);
    setStatus(globalStatus, 'Interaction completed and disposition recorded.', 'success');
  } catch (error) { setStatus($('#wrapup-status'), error.message, 'error'); }
}
async function start() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Public Supabase configuration is missing. Configure VITE_SUPABASE_URL and the anon/publishable key.'); return; }
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  supabase.auth.onAuthStateChange((_event, updatedSession) => { session = updatedSession; });
  const { data: { session: currentSession } } = await supabase.auth.getSession(); session = currentSession;
  if (!session) { showLogin(); return; }
  try { const access = await api('whoami'); showWorkspace(session.user, access.access); await loadQueue(); }
  catch (error) { await supabase.auth.signOut(); session = null; showLogin(error.message); }
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) { setStatus(loginStatus, 'Supabase public configuration is missing.', 'error'); return; }
  const email = $('#staff-email').value.trim(); const password = $('#staff-password').value;
  setStatus(loginStatus, 'Verifying staff access…');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  $('#staff-password').value = '';
  if (error || !data.user) { setStatus(loginStatus, error?.message || 'Staff sign-in failed.', 'error'); return; }
  session = data.session;
  try { const access = await api('whoami'); showWorkspace(data.user, access.access); await loadQueue(); }
  catch (failure) { await supabase.auth.signOut(); session = null; showLogin(failure.message); }
});
$('#sign-out').addEventListener('click', async () => { if (refreshTimer) clearInterval(refreshTimer); await supabase.auth.signOut(); session = null; staff = null; items = []; selected = null; showLogin('Signed out.'); });
$('#refresh-queue').addEventListener('click', loadQueue);
$('#department-filter').addEventListener('change', drawQueue); $('#status-filter').addEventListener('change', drawQueue); $('#channel-filter').addEventListener('change', drawQueue);
$('#new-item-button').addEventListener('click', () => { $('#new-item-form').reset(); setStatus($('#new-item-status'), ''); newItemDialog.showModal(); });
$('#new-item-form').addEventListener('submit', createWorkItem); $('#wrapup-form').addEventListener('submit', submitWrapup);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
$('#knowledge-search').addEventListener('input', event => renderKnowledge(event.target.value));
(async () => {
  renderKnowledge('');
  await start();
})();
