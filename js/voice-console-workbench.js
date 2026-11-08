import { createClient } from '@supabase/supabase-js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null;
let session = null;
let access = null;
let provider = null;
let snapshot = { calls: [], routes: [], callbacks: [], queuedCount: 0, pendingCallbackApprovals: 0 };
let refreshTimer = null;
let currentUserId = '';

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-voice-telephony`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Voice request failed (${response.status}).`);
  return result;
}
function stopRefresh() { if (refreshTimer) clearInterval(refreshTimer); refreshTimer = null; }
function showLogin(message = '') {
  $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#sign-out').hidden = true;
  setStatus($('#login-status'), message); stopRefresh();
}
function showWorkspace(user) {
  $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#sign-out').hidden = false;
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  $('#metric-line').textContent = provider.lineConfigured ? 'Configured' : 'Not set';
  $('#start-call').disabled = !provider.ready || !provider.lineConfigured;
  $('#provider-state').textContent = provider.ready ? 'Signals configuration present' : 'Voice provider not configured';
  $('#provider-dot').parentElement.classList.toggle('ready', provider.ready);
  $('#provider-detail').textContent = provider.ready
    ? `Signals · ${provider.inboundNumbers.length} inbound number(s) · call recording ${provider.recordingMode.toUpperCase()}`
    : 'No live calling until credentials, numbers, agent line and callback configuration are complete.';
  currentUserId = user.id;
}
function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}
function safeText(value, fallback = '—') { return value === null || value === undefined || value === '' ? fallback : String(value); }
function createNode(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderMetrics() {
  $('#metric-calls').textContent = String(snapshot.calls.length);
  $('#metric-queued').textContent = String(snapshot.queuedCount);
  $('#metric-pending').textContent = String(snapshot.pendingCallbackApprovals);
  $('#metric-line').textContent = provider?.lineConfigured ? 'Configured' : 'Not set';
}
function renderCallbacks() {
  const host = $('#callback-list'); host.replaceChildren();
  if (!snapshot.callbacks.length) { host.append(createNode('p', 'empty-state', 'No callback approvals in your permitted work.')); return; }
  for (const row of snapshot.callbacks) {
    const card = createNode('article', 'record-card');
    const info = createNode('div');
    info.append(createNode('strong', '', `${row.callback_ref} · ${row.status.toUpperCase()}`));
    info.append(createNode('p', '', `${row.route_ref} · ${row.consent_type === 'customer_requested_callback' ? 'Customer requested' : 'Service follow-up permission'} · requested ${formatDate(row.requested_at)}`));
    info.append(createNode('p', '', `Evidence: ${row.evidence_reference} · expires ${formatDate(row.expires_at)}`));
    const actions = createNode('div', 'record-actions');
    if (row.status === 'pending' && access.role !== 'agent' && row.requested_by !== currentUserId) {
      const approve = createNode('button', 'mini-action approve', 'Approve'); approve.type = 'button';
      approve.addEventListener('click', () => decideCallback(row.callback_ref, true));
      const reject = createNode('button', 'mini-action reject', 'Reject'); reject.type = 'button';
      reject.addEventListener('click', () => decideCallback(row.callback_ref, false));
      actions.append(approve, reject);
    }
    if (row.status === 'approved' && row.requested_by === currentUserId) {
      const use = createNode('button', 'mini-action approve', 'Use authorization'); use.type = 'button';
      use.addEventListener('click', () => {
        $('#outbound-callback-ref').value = row.callback_ref;
        $('#outbound-route-ref').value = row.route_ref;
        $('#outbound-phone').focus();
        setStatus($('#outbound-status'), 'Re-enter the exact customer number from the approved request. CALLORIA checks it against the stored HMAC.', 'success');
      });
      actions.append(use);
    }
    actions.append(createNode('span', 'state-chip', row.status));
    card.append(info, actions); host.append(card);
  }
}
async function decideCallback(callbackRef, approve) {
  const note = approve ? 'Supervisor approved documented customer callback permission.' : 'Supervisor rejected callback request.';
  try {
    const result = await api('decide_callback', { callbackRef, approve, note });
    setStatus($('#global-status'), `${callbackRef}: ${result.decision.status}.`, 'success');
    await refreshVoice();
  } catch (error) { setStatus($('#global-status'), error.message, 'error'); }
}
function renderCalls() {
  const body = $('#call-history'); body.replaceChildren();
  if (!snapshot.calls.length) {
    const row = document.createElement('tr'); const cell = createNode('td', 'empty-state', 'No provider call records yet.'); cell.colSpan = 7; row.append(cell); body.append(row); return;
  }
  for (const call of snapshot.calls) {
    const row = document.createElement('tr');
    const values = [call.call_ref, call.direction, `${safeText(call.from_masked)} → ${safeText(call.to_masked)}`, safeText(call.department), call.status, call.call_duration_seconds === null ? '—' : `${call.call_duration_seconds}s`, formatDate(call.created_at)];
    values.forEach((value, index) => {
      const cell = document.createElement('td');
      if (index === 4) cell.append(createNode('span', `state-chip ${call.status}`, value));
      else cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  }
}
async function refreshVoice() {
  try {
    snapshot = await api('inbox');
    renderMetrics(); renderCallbacks(); renderCalls();
    setStatus($('#global-status'), `Updated ${new Date().toLocaleTimeString()}.`, 'success');
  } catch (error) {
    setStatus($('#global-status'), error.message, 'error');
    if (/session|sign in/i.test(error.message)) showLogin(error.message);
  }
}
async function signIn(email, password) {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase public URL or key is missing from Vercel configuration.');
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  session = result.data.session;
  const profile = await api('whoami'); access = profile.access; provider = profile.provider;
  showWorkspace(result.data.user); await refreshVoice();
  stopRefresh(); refreshTimer = setInterval(refreshVoice, 12000);
}
function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
async function requestCallback(event) {
  event.preventDefault();
  setStatus($('#callback-request-status'), 'Submitting callback authorization request…');
  try {
    const result = await api('request_callback', {
      routeRef: $('#callback-route-ref').value.trim(),
      customerPhone: $('#callback-phone').value.trim(),
      consentType: $('#callback-consent-type').value,
      requestedAt: new Date($('#callback-requested-at').value).toISOString(),
      evidenceReference: $('#callback-evidence').value.trim(),
      customerConfirmed: $('#callback-confirmed').checked
    });
    $('#callback-request-form').reset(); $('#callback-requested-at').value = localNow();
    setStatus($('#callback-request-status'), `${result.callback.callback_ref} submitted. No call has been placed.`, 'success');
    await refreshVoice();
  } catch (error) { setStatus($('#callback-request-status'), error.message, 'error'); }
}
function storedIdempotency(callbackRef) {
  const key = `calloria.voice.pending.${callbackRef}`;
  let value = sessionStorage.getItem(key);
  if (!value) { value = crypto.randomUUID(); sessionStorage.setItem(key, value); }
  return { key, value };
}
async function startOutbound(event) {
  event.preventDefault();
  const button = $('#start-call'); button.disabled = true;
  setStatus($('#outbound-status'), 'Requesting provider call…');
  const callbackRef = $('#outbound-callback-ref').value.trim();
  const idempotency = storedIdempotency(callbackRef);
  try {
    const result = await api('start_outbound', {
      callbackRef,
      routeRef: $('#outbound-route-ref').value.trim(),
      customerPhone: $('#outbound-phone').value.trim(),
      idempotencyKey: idempotency.value
    });
    if (result.status === 'queued') {
      sessionStorage.removeItem(idempotency.key);
      setStatus($('#outbound-status'), `${result.callRef}: ${result.message}`, 'success');
    } else {
      setStatus($('#outbound-status'), `${result.callRef}: ${result.message}`, result.status === 'rejected' ? 'error' : '');
    }
    await refreshVoice();
  } catch (error) {
    setStatus($('#outbound-status'), `${error.message} The same request ID will be reused to prevent a duplicate call.`, 'error');
  } finally { button.disabled = !provider?.ready || !provider?.lineConfigured; }
}

async function boot() {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  $('#callback-requested-at').value = localNow();
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { await signIn($('#login-email').value.trim(), $('#login-password').value); }
    catch (error) { setStatus($('#login-status'), error.message, 'error'); }
  });
  $('#callback-request-form').addEventListener('submit', requestCallback);
  $('#outbound-form').addEventListener('submit', startOutbound);
  $('#refresh-voice').addEventListener('click', refreshVoice);
  $('#sign-out').addEventListener('click', async () => { stopRefresh(); await supabase.auth.signOut(); session = null; access = null; provider = null; showLogin(); });
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    session = data.session;
    try { const profile = await api('whoami'); access = profile.access; provider = profile.provider; showWorkspace(data.session.user); await refreshVoice(); refreshTimer = setInterval(refreshVoice, 12000); }
    catch (error) { showLogin(error.message); }
  } else showLogin();
}
boot();
