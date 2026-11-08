import { createClient } from '@supabase/supabase-js';
import { cleanSmsText, maskSmsNumber, validateSmsSupportReply, estimateSmsSegments } from './sms-engine.js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null;
let session = null;
let access = null;
let provider = null;
let threads = [];
let selectedId = null;
let selectedThread = null;
let refreshTimer = null;

function setStatus(node, message, kind = '') { node.textContent = message || ''; node.className = `status ${kind}`.trim(); }
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-sms`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action, ...payload }) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `SMS request failed (${response.status}).`);
  return result;
}
function showLogin(message = '') {
  $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#sign-out').hidden = true;
  setStatus($('#login-status'), message); clearInterval(refreshTimer);
}
function showWorkspace(user) {
  $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  const node = $('#provider-config');
  if (provider?.webhookReady && provider?.outboundReady && provider?.dataProtectionReady) {
    node.textContent = 'Termii webhook, API credentials, sender ID, DND route activation confirmation and encrypted storage are configured. Configuration presence is not a live delivery test.';
  } else {
    const gaps = [];
    if (!provider?.webhookReady) gaps.push('signed Termii inbound webhook');
    if (!provider?.outboundReady) gaps.push(provider?.dndRouteConfirmed ? 'Termii API / approved sender ID' : 'Termii DND transactional route activation confirmation');
    if (!provider?.dataProtectionReady) gaps.push('SMS encryption / lookup secrets');
    node.textContent = `Incomplete SMS configuration: ${gaps.join(', ')}. Affected operations remain unavailable.`;
    node.classList.add('warning');
  }
}
function formatTime(value) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString(); }
function updateSmsLengthInfo() {
  const text = $('#reply-text').value; const estimate = estimateSmsSegments(text);
  const count = text.length; const node = $('#sms-length-info');
  if (!node) return;
  const segmentLabel = estimate.segments === 1 ? '1 SMS segment' : `${estimate.segments} SMS segments`;
  node.textContent = `${count}/480 characters · ${estimate.encoding} · ${segmentLabel}${estimate.segments > 1 ? ' · longer messages may cost more' : ''}`;
  node.classList.toggle('warning', estimate.segments > 1);
  node.classList.toggle('limit', count > 480);
}
function updateMetrics() {
  $('#metric-total').textContent = String(threads.length);
  $('#metric-queued').textContent = String(threads.filter(row => ['queued', 'pending', 'escalated'].includes(row.routeStatus)).length);
  $('#metric-assigned').textContent = String(threads.filter(row => row.routeStatus === 'assigned').length);
  $('#metric-reply').textContent = String(threads.filter(row => row.routeStatus === 'assigned' && row.canReply).length);
}
function renderThreadList() {
  const box = $('#thread-list'); box.replaceChildren();
  const query = $('#thread-search').value.trim().toLowerCase();
  const rows = threads.filter(row => !query || [row.routeRef, row.phoneMasked, row.department, row.lastPreview].join(' ').toLowerCase().includes(query));
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = threads.length ? 'No SMS threads match this search.' : 'No SMS threads are currently visible in your staff permission scope.';
    box.append(empty); return;
  }
  for (const item of rows) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `thread-item${item.id === selectedId ? ' selected' : ''}`;
    const top = document.createElement('span'); top.className = 'thread-top';
    const name = document.createElement('strong'); name.textContent = item.phoneMasked || 'SMS customer';
    const when = document.createElement('small'); when.textContent = item.lastInboundAt ? new Date(item.lastInboundAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    top.append(name, when);
    const subject = document.createElement('span'); subject.className = 'thread-subject'; subject.textContent = item.department || 'Customer support';
    const preview = document.createElement('span'); preview.className = 'thread-preview'; preview.textContent = item.lastPreview || 'No message preview';
    const bottom = document.createElement('span'); bottom.className = 'thread-bottom';
    const reference = document.createElement('small'); reference.textContent = item.routeRef || 'Unlinked';
    const badge = document.createElement('span'); badge.className = `mini-badge ${item.priority === 'urgent' ? 'urgent' : item.routeStatus === 'assigned' ? 'assigned' : ''}`;
    badge.textContent = item.routeStatus === 'assigned' ? 'Assigned' : item.priority === 'urgent' ? 'Urgent' : item.routeStatus || 'Waiting';
    bottom.append(reference, badge); button.append(top, subject, preview, bottom);
    button.addEventListener('click', () => openThread(item.id)); box.append(button);
  }
}
function renderMessages(messages) {
  const box = $('#message-history'); box.replaceChildren();
  if (!messages.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No messages are recorded in this thread.'; box.append(empty); return; }
  for (const message of messages) {
    const article = document.createElement('article'); article.className = `message-bubble ${message.direction === 'outbound' ? 'outbound' : 'inbound'}`;
    const content = document.createElement('p'); content.textContent = message.body;
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const direction = document.createElement('span'); direction.textContent = message.direction === 'inbound' ? 'Customer' : message.sentBy || 'CALLORIA staff';
    const time = document.createElement('time'); time.textContent = formatTime(message.createdAt);
    const status = document.createElement('span'); status.textContent = message.status || '';
    meta.append(direction, time, status); article.append(content, meta);
    if (message.status === 'unknown') { const warning = document.createElement('p'); warning.className = 'muted'; warning.textContent = 'Provider outcome is unknown. Check Termii delivery records before attempting another reply.'; article.append(warning); }
    box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function setReplyAvailability(thread) {
  const available = thread.routeStatus === 'assigned' && provider?.outboundReady === true && thread.canReply === true && thread.suppressed !== true;
  $('#send-reply').disabled = !available;
  $('#reply-text').disabled = !available;
  $('#route-badge').className = `route-badge ${available ? 'open' : 'closed'}`;
  $('#route-badge').textContent = thread.suppressed ? 'Customer SMS opt-out active' : !provider?.outboundReady ? 'Termii unavailable' : available ? 'Assigned · reply enabled' : 'Claim through Routing Control';
  $('#reply-policy').textContent = thread.suppressed ? 'Outbound SMS is blocked until the customer sends START.' : available ? 'One-to-one support response to this customer-initiated thread. Marketing is disabled.' : 'Claim the routed request and confirm that an inbound customer message is awaiting a response.';
  $('#thread-warning').hidden = !thread.suppressed;
  $('#thread-warning').textContent = thread.suppressed ? 'This customer sent STOP. CALLORIA blocks all outbound SMS to this number until a new START message is received. START does not create marketing consent.' : '';
}
async function openThread(id) {
  selectedId = id; renderThreadList(); $('#empty-detail').hidden = true; $('#thread-detail').hidden = false;
  $('#thread-title').textContent = 'Loading SMS thread…'; $('#message-history').replaceChildren();
  try {
    const result = await api('conversation', { threadId: id }); selectedThread = result.thread;
    $('#route-reference').textContent = result.thread.routeRef;
    $('#thread-title').textContent = result.thread.phoneMasked || 'SMS customer';
    $('#thread-meta').textContent = `${result.thread.department} · latest inbound ${formatTime(result.thread.lastInboundAt)}`;
    $('#route-meta').replaceChildren();
    for (const label of [`Department: ${result.thread.department}`, `Route status: ${result.thread.routeStatus}`, `Priority: ${result.thread.priority}`, `Language: ${result.thread.language}`]) {
      const span = document.createElement('span'); span.textContent = label; $('#route-meta').append(span);
    }
    setReplyAvailability(result.thread); renderMessages(result.messages);
  } catch (error) { setStatus($('#global-status'), error.message, 'error'); }
}
async function refreshInbox(keepSelection = true) {
  try {
    const result = await api('inbox'); threads = result.threads || []; updateMetrics(); renderThreadList();
    if (keepSelection && selectedId && threads.some(row => row.id === selectedId)) await openThread(selectedId);
    else if (!selectedId || !threads.some(row => row.id === selectedId)) { selectedId = null; selectedThread = null; $('#thread-detail').hidden = true; $('#empty-detail').hidden = false; }
    setStatus($('#global-status'), `Updated ${new Date().toLocaleTimeString()}.`);
  } catch (error) { setStatus($('#global-status'), error.message, 'error'); }
}
async function enterWorkspace(user) {
  try {
    const result = await api('whoami'); access = result.access; provider = result.provider; showWorkspace(user); await refreshInbox(false);
    clearInterval(refreshTimer); refreshTimer = setInterval(() => refreshInbox(true), 10000);
  } catch (error) { showLogin(error.message); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); setStatus($('#login-status'), 'Signing in…');
  try {
    if (!supabase) throw new Error('Supabase public configuration is missing from the Vercel build environment.');
    const { data, error } = await supabase.auth.signInWithPassword({ email: $('#staff-email').value.trim(), password: $('#staff-password').value });
    if (error) throw error; session = data.session; await enterWorkspace(data.user);
  } catch (error) { setStatus($('#login-status'), error.message, 'error'); }
});
$('#sign-out').addEventListener('click', async () => { clearInterval(refreshTimer); await supabase?.auth.signOut(); session = null; access = null; provider = null; threads = []; selectedId = null; showLogin('Signed out.'); });
$('#refresh-inbox').addEventListener('click', () => refreshInbox(true));
$('#thread-search').addEventListener('input', renderThreadList);
$('#reply-text').addEventListener('input', updateSmsLengthInfo);
updateSmsLengthInfo();
$('#reply-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!selectedThread) return;
  const button = $('#send-reply'); button.disabled = true; setStatus($('#reply-status'), 'Sending through Termii…');
  try {
    const message = validateSmsSupportReply($('#reply-text').value);
    const result = await api('send_reply', { threadId: selectedThread.id, message, purpose: 'customer_support_response', idempotencyKey: crypto.randomUUID() });
    $('#reply-text').value = '';
    if (result.status === 'unknown') setStatus($('#reply-status'), 'Termii returned an uncertain outcome. Do not resend this message. Check the provider delivery report before taking further action.', 'error');
    else setStatus($('#reply-status'), 'Termii accepted the SMS for delivery. Final handset delivery status will update when its report arrives.', 'success');
    await refreshInbox(true);
  } catch (error) { setStatus($('#reply-status'), error.message, 'error'); }
  finally { if (selectedThread) setReplyAvailability(selectedThread); }
});

if (!supabaseUrl || !supabaseKey) showLogin('Supabase public URL or anonymous/publishable key is not configured.');
else {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  supabase.auth.getSession().then(async ({ data }) => { session = data.session; if (session?.user) await enterWorkspace(session.user); else showLogin(); });
  supabase.auth.onAuthStateChange(async (_event, nextSession) => { session = nextSession; if (!session) showLogin('Your staff session has ended.'); });
}
