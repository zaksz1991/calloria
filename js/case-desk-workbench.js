import { createClient } from '@supabase/supabase-js';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const loginPanel = document.querySelector('#login-panel');
const deskPanel = document.querySelector('#desk-panel');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const signOutButton = document.querySelector('#sign-out');
const caseList = document.querySelector('#case-list');
const detailPanel = document.querySelector('#case-detail-panel');
const deskStatus = document.querySelector('#desk-status');
const statusFilter = document.querySelector('#status-filter');
const searchInput = document.querySelector('#case-search');
const queueCount = document.querySelector('#queue-count');
let supabase = null;
let currentUser = null;
let currentAccess = { role: 'agent', departments: [] };
let cases = [];
let selectedReference = '';

const STATUSES = [
  ['received', 'Received'], ['triaged', 'Triaged'], ['assigned', 'Assigned'],
  ['in_progress', 'In progress'], ['awaiting_customer', 'Awaiting customer'],
  ['resolved', 'Resolved'], ['closed', 'Closed']
];
const DEPARTMENTS = [
  'RuffNeck Products and Platform Support', 'Sales and Service Enquiries',
  'Complaints and Service Recovery', 'Personal Development and Wellbeing Information',
  'General Customer Care', 'Email and Written Support', 'Social Media Support',
  'Technical Support and IT', 'Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support', 'Learning and Career Development'
];

function setLoginStatus(message, type = '') {
  loginStatus.textContent = message;
  loginStatus.className = type;
}
function setDeskStatus(message, type = '') {
  deskStatus.textContent = message;
  deskStatus.className = type;
}
function node(tag, text, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = String(text);
  return element;
}
function showDesk(user) {
  currentUser = user;
  loginPanel.hidden = true;
  deskPanel.hidden = false;
  signOutButton.hidden = false;
  document.querySelector('#agent-identity').textContent = `Signed in: ${user.email || user.id}`;
}
function showLogin() {
  currentUser = null;
  deskPanel.hidden = true;
  loginPanel.hidden = false;
  signOutButton.hidden = true;
}
async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('calloria-case-desk', { body: { action, ...payload } });
  if (error) {
    let message = '';
    try { message = (await error.context?.json?.())?.error || ''; } catch { /* no error body */ }
    throw new Error(String(message || error.message || 'The case service is unavailable.').slice(0, 360));
  }
  if (!data || typeof data !== 'object') throw new Error('The case service returned an invalid response.');
  if (data.error) throw new Error(String(data.error).slice(0, 360));
  return data;
}
function filteredCases() {
  const status = statusFilter.value;
  const needle = searchInput.value.trim().toLowerCase();
  return cases.filter(item => {
    if (status !== 'all' && item.status !== status) return false;
    if (!needle) return true;
    return [item.caseReference, item.department, item.platformName, item.subject, item.customerName, item.description]
      .some(value => String(value || '').toLowerCase().includes(needle));
  });
}
function drawQueue() {
  const rows = filteredCases();
  caseList.replaceChildren();
  queueCount.textContent = `${rows.length} shown · ${cases.length} loaded`;
  if (!rows.length) {
    caseList.append(node('div', 'No cases match this filter.', 'empty-state'));
    if (selectedReference && !cases.some(item => item.caseReference === selectedReference)) selectedReference = '';
    return;
  }
  rows.forEach(item => {
    const button = node('button', undefined, `case-card${item.caseReference === selectedReference ? ' active' : ''}`);
    button.type = 'button';
    button.append(node('strong', `${item.caseReference} · ${String(item.status).replaceAll('_', ' ').toUpperCase()}`));
    button.append(node('p', item.subject || item.description || 'Encrypted case details unavailable.'));
    const meta = node('div');
    meta.append(node('span', item.department, 'pill'));
    if (item.urgency === 'high') meta.append(node('span', 'HIGH PRIORITY', 'pill high'));
    if (item.platformName) meta.append(node('span', item.platformName, 'pill'));
    button.append(meta);
    button.append(node('small', `Created ${new Date(item.createdAt).toLocaleString()}`));
    button.addEventListener('click', () => {
      selectedReference = item.caseReference;
      drawQueue();
      drawDetail(item);
    });
    caseList.append(button);
  });
}
function drawDetail(item) {
  detailPanel.replaceChildren();
  if (item.decryptionError) {
    detailPanel.append(node('div', 'The case details could not be decrypted. Verify that CALLORIA_CASE_ENCRYPTION_SECRET matches the value used when this case was created.', 'empty-state'));
    return;
  }
  const header = node('div', undefined, 'detail-header');
  const titleGroup = node('div');
  titleGroup.append(node('h2', item.subject || item.caseReference));
  titleGroup.append(node('p', `${item.caseReference} · ${item.status.replaceAll('_', ' ')} · ${item.urgency.toUpperCase()}`));
  header.append(titleGroup);
  header.append(node('span', item.platformName || 'General enquiry', 'pill'));
  detailPanel.append(header);
  const meta = node('p', `Department: ${item.department} · Created: ${new Date(item.createdAt).toLocaleString()} · Updated: ${new Date(item.updatedAt).toLocaleString()}`, 'case-meta');
  detailPanel.append(meta);
  detailPanel.append(node('div', item.description || 'No description was recorded.', 'case-description'));
  const contact = node('div', undefined, 'private-contact');
  contact.append(node('strong', 'CONFIDENTIAL CUSTOMER DETAILS'));
  contact.append(node('span', `Customer: ${item.customerName || 'Not provided'}`));
  contact.append(node('span', `Preferred follow-up: ${item.contactPreference || 'none'}`));
  contact.append(node('span', `Contact: ${item.contact || 'Not provided'}`));
  detailPanel.append(contact);
  if (Array.isArray(item.timeline) && item.timeline.length) {
    const history = node('div', undefined, 'timeline');
    item.timeline.forEach(entry => {
      const line = node('div', undefined, 'timeline-item');
      line.append(node('strong', String(entry.status || 'update').replaceAll('_', ' ').toUpperCase()));
      if (entry.message) line.append(node('div', entry.message));
      if (entry.internalNote) line.append(node('div', `INTERNAL NOTE: ${entry.internalNote}`));
      line.append(node('small', new Date(entry.at).toLocaleString()));
      history.append(line);
    });
    detailPanel.append(history);
  }

  const editor = node('form', undefined, 'case-editor');
  editor.append(node('h3', 'CASE HANDLING & CUSTOMER UPDATE'));
  const row = node('div', undefined, 'editor-row');
  const statusLabel = node('label', 'Case status');
  const statusSelect = node('select');
  statusSelect.name = 'status';
  STATUSES.forEach(([value, label]) => {
    const option = node('option', label); option.value = value; statusSelect.append(option);
  });
  statusSelect.value = item.status;
  statusLabel.append(statusSelect);
  const departmentLabel = node('label', 'Responsible department');
  const departmentSelect = node('select');
  departmentSelect.name = 'department';
  const availableDepartments = currentAccess.role === 'supervisor' ? DEPARTMENTS : DEPARTMENTS.filter(value => currentAccess.departments.includes(value));
  availableDepartments.forEach(value => {
    const option = node('option', value); option.value = value; departmentSelect.append(option);
  });
  if (!DEPARTMENTS.includes(item.department)) {
    const option = node('option', item.department); option.value = item.department; departmentSelect.insertBefore(option, departmentSelect.firstChild);
  }
  departmentSelect.value = item.department;
  departmentLabel.append(departmentSelect);
  row.append(statusLabel, departmentLabel);
  editor.append(row);
  const publicLabel = node('label', 'Customer-visible progress message');
  const publicInput = node('textarea');
  publicInput.name = 'publicMessage'; publicInput.maxLength = 320; publicInput.required = true;
  publicInput.value = item.status === 'received' ? 'Your support request has been received. The relevant team is reviewing it.' : 'Your support request has been updated by the customer-care team.';
  publicLabel.append(publicInput);
  editor.append(publicLabel);
  const noteLabel = node('label', 'Internal case note (encrypted)');
  const noteInput = node('textarea');
  noteInput.name = 'privateNote'; noteInput.maxLength = 1200;
  noteInput.placeholder = 'Internal handling notes. These are not visible to the customer.';
  noteLabel.append(noteInput);
  editor.append(noteLabel);
  const assignLabel = node('label', 'Assignment');
  const assignMe = node('input'); assignMe.type = 'checkbox'; assignMe.checked = true;
  const assignText = node('span', 'Assign this case to me');
  const assignWrap = node('div'); assignWrap.style.display = 'flex'; assignWrap.style.alignItems = 'center'; assignWrap.style.gap = '8px';
  assignWrap.append(assignMe, assignText); assignLabel.append(assignWrap); editor.append(assignLabel);
  const submit = node('button', 'Save case update'); submit.type = 'submit';
  const errorText = node('div', '', 'case-meta');
  editor.append(submit, errorText);
  editor.addEventListener('submit', async event => {
    event.preventDefault();
    submit.disabled = true; submit.textContent = 'Saving securely…'; errorText.textContent = '';
    try {
      await invoke('agent_update', {
        caseReference: item.caseReference,
        status: statusSelect.value,
        department: departmentSelect.value,
        publicMessage: publicInput.value.trim(),
        privateNote: noteInput.value.trim(),
        assignedTo: assignMe.checked ? currentUser.id : ''
      });
      setDeskStatus(`Updated ${item.caseReference}.`, 'success');
      await loadQueue(item.caseReference);
    } catch (error) {
      errorText.textContent = String(error.message || 'Update failed.').slice(0, 360);
      setDeskStatus(errorText.textContent, 'error');
    } finally {
      submit.disabled = false; submit.textContent = 'Save case update';
    }
  });
  detailPanel.append(editor);
}
async function loadQueue(preferredReference = selectedReference) {
  setDeskStatus('Loading authorised case queue…');
  const response = await invoke('agent_list', { status: statusFilter.value || 'all' });
  currentAccess = { role: response.agentRole === 'supervisor' ? 'supervisor' : 'agent', departments: Array.isArray(response.agentDepartments) ? response.agentDepartments : [] };
  cases = Array.isArray(response.cases) ? response.cases : [];
  selectedReference = preferredReference;
  drawQueue();
  const selected = cases.find(item => item.caseReference === selectedReference);
  if (selected) drawDetail(selected);
  else if (cases.length) {
    selectedReference = cases[0].caseReference;
    drawQueue(); drawDetail(cases[0]);
  } else detailPanel.replaceChildren(node('div', 'The queue is empty. New customer requests will appear here after they are submitted.', 'empty-state'));
  setDeskStatus('Case queue loaded.', 'success');
}
async function activateSession(session) {
  if (!session?.user) return false;
  showDesk(session.user);
  try { await loadQueue(''); return true; }
  catch (error) {
    setDeskStatus(String(error.message || 'This account is not authorised for CALLORIA case handling.'), 'error');
    return true;
  }
}

if (!supabaseUrl || !supabaseKey) {
  setLoginStatus('Supabase browser configuration is missing. Add the existing VITE_SUPABASE_URL and public anon/publishable key.', 'error');
  loginForm.querySelector('button').disabled = true;
} else {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) void activateSession(data.session);
  });
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  const button = document.querySelector('#login-button');
  button.disabled = true; button.textContent = 'Signing in…';
  setLoginStatus('Verifying the staff account…');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.querySelector('#agent-email').value.trim(),
      password: document.querySelector('#agent-password').value
    });
    if (error) throw error;
    const accepted = await activateSession(data.session);
    if (accepted) setLoginStatus('Signed in. Server-side staff access is being enforced.', 'success');
  } catch (error) {
    setLoginStatus(String(error.message || 'Sign-in failed.').slice(0, 300), 'error');
  } finally { button.disabled = false; button.textContent = 'Sign in securely'; }
});

signOutButton.addEventListener('click', async () => {
  await supabase?.auth.signOut();
  cases = []; selectedReference = '';
  showLogin(); setLoginStatus('Signed out.');
});
document.querySelector('#refresh-queue').addEventListener('click', () => void loadQueue().catch(error => setDeskStatus(error.message, 'error')));
statusFilter.addEventListener('change', () => void loadQueue('').catch(error => setDeskStatus(error.message, 'error')));
searchInput.addEventListener('input', drawQueue);
