import { createClient } from '@supabase/supabase-js';
import { maskEmailAddress, cleanEmailText } from './email-engine.js';

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

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-email`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Email request failed (${response.status}).`);
  return result;
}
function showLogin(message = '') {
  $('#login-panel').hidden = false;
  $('#workspace').hidden = true;
  $('#sign-out').hidden = true;
  setStatus($('#login-status'), message);
  clearInterval(refreshTimer);
}
function showWorkspace(user) {
  $('#login-panel').hidden = true;
  $('#workspace').hidden = false;
  $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  const node = $('#provider-config');
  if (provider.webhookReady && provider.outboundReady && provider.dataProtectionReady) {
    node.textContent = `Resend webhook verification, configured inbound addresses, encrypted storage and outbound credentials are present. Configuration presence is not a live provider test. Inboxes: ${provider.inboundAddresses.length}.`;
  } else {
    const gaps = [];
    if (!provider.webhookReady) gaps.push('inbound webhook / data protection');
    if (!provider.outboundReady) gaps.push('outbound sender / API credentials');
    if (!provider.dataProtectionReady) gaps.push('encryption / lookup secrets');
    node.textContent = `Incomplete server-side configuration: ${gaps.join(', ')}. The affected channel operations remain unavailable.`;
  }
}
function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}
function updateMetrics() {
  $('#metric-total').textContent = String(threads.length);
  $('#metric-queued').textContent = String(threads.filter(row => ['queued', 'pending', 'escalated'].includes(row.routeStatus)).length);
  $('#metric-mine').textContent = String(threads.filter(row => row.routeStatus === 'assigned').length);
  $('#metric-followup').textContent = String(threads.filter(row => row.lastDirection === 'inbound' && row.routeStatus === 'assigned').length);
}
function renderThreadList() {
  const box = $('#thread-list');
  box.replaceChildren();
  const query = $('#thread-search').value.trim().toLowerCase();
  const rows = threads.filter(row => !query || [row.routeRef, row.displayName, row.sender, row.subject, row.lastPreview].join(' ').toLowerCase().includes(query));
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = threads.length ? 'No email threads match this search.' : 'No email threads are currently visible in your staff permission scope.';
    box.append(empty); return;
  }
  for (const item of rows) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `thread-item${item.id === selectedId ? ' selected' : ''}`;
    const top = document.createElement('span'); top.className = 'thread-top';
    const name = document.createElement('strong'); name.textContent = item.displayName || maskEmailAddress(item.sender);
    const when = document.createElement('small'); when.textContent = item.lastInboundAt ? new Date(item.lastInboundAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    top.append(name, when);
    const subject = document.createElement('span'); subject.className = 'thread-subject'; subject.textContent = item.subject || '(No subject)';
    const preview = document.createElement('span'); preview.className = 'thread-preview'; preview.textContent = item.lastPreview || 'No message preview';
    const bottom = document.createElement('span'); bottom.className = 'thread-bottom';
    const reference = document.createElement('small'); reference.textContent = item.routeRef || 'Unlinked';
    const badge = document.createElement('span'); badge.className = `mini-badge ${item.priority === 'urgent' ? 'urgent' : item.routeStatus === 'assigned' ? 'assigned' : ''}`;
    badge.textContent = item.routeStatus === 'assigned' ? 'Assigned' : item.priority === 'urgent' ? 'Urgent' : item.routeStatus || 'Pending';
    bottom.append(reference, badge);
    button.append(top, subject, preview, bottom);
    button.addEventListener('click', () => openThread(item.id));
    box.append(button);
  }
}
function renderMessages(messages) {
  const box = $('#message-history');
  box.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No messages are recorded for this email thread.'; box.append(empty); return;
  }
  for (const message of messages) {
    const article = document.createElement('article'); article.className = `message-bubble ${message.direction === 'outbound' ? 'outbound' : 'inbound'}`;
    const subject = document.createElement('p'); subject.className = 'subject'; subject.textContent = message.subject || '(No subject)';
    const content = document.createElement('p'); content.className = 'body'; content.textContent = message.body;
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const direction = document.createElement('span'); direction.textContent = message.direction === 'inbound' ? 'Customer' : message.sentBy || 'CALLORIA staff';
    const time = document.createElement('time'); time.textContent = formatTime(message.createdAt);
    const status = document.createElement('span'); status.textContent = message.status || '';
    meta.append(direction, time, status); article.append(subject, content, meta);
    if (message.attachments?.length) {
      const list = document.createElement('ul'); list.className = 'attachment-list';
      for (const attachment of message.attachments) {
        const item = document.createElement('li');
        const size = Number(attachment.size) > 0 ? ` · ${Math.round(Number(attachment.size) / 1024)} KB` : '';
        item.textContent = `${attachment.filename || 'Unnamed attachment'} (${attachment.contentType || 'unknown type'})${size}`;
        list.append(item);
      }
      article.append(list);
    }
    if (message.status === 'unknown') {
      const warning = document.createElement('p'); warning.className = 'message-warning'; warning.textContent = 'Provider result is unknown. Check Resend logs before trying again.'; article.append(warning);
    }
    box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function setReplyAvailability(thread) {
  const available = thread.routeStatus === 'assigned' && provider?.outboundReady === true;
  $('#send-reply').disabled = !available;
  $('#reply-subject').disabled = !available;
  $('#reply-text').disabled = !available;
  $('#route-badge').className = `route-badge ${available ? 'open' : 'closed'}`;
  $('#route-badge').textContent = !provider?.outboundReady ? 'Email provider unavailable' : thread.routeStatus === 'assigned' ? 'Assigned · reply enabled' : 'Claim routing request first';
  $('#reply-status').textContent = available ? 'Replies send to this customer for this support thread only.' : 'Reply is disabled until the linked route is assigned and Resend outbound configuration is complete.';
}
async function openThread(id) {
  selectedId = id;
  renderThreadList();
  $('#empty-detail').hidden = true;
  $('#thread-detail').hidden = false;
  $('#thread-subject').textContent = 'Loading email thread…';
  $('#message-history').replaceChildren();
  try {
    const result = await api('conversation', { threadId: id });
    selectedThread = result.thread;
    $('#route-reference').textContent = result.thread.routeRef;
    $('#thread-subject').textContent = result.thread.subject || '(No subject)';
    $('#thread-meta').textContent = `${result.thread.displayName} · ${result.thread.sender} · latest inbound ${formatTime(result.thread.latestInboundAt)}`;
    $('#route-meta').replaceChildren();
    for (const label of [`Department: ${result.thread.department}`, `Route status: ${result.thread.routeStatus}`, `Reference: ${result.thread.routeRef}`]) {
      const span = document.createElement('span'); span.textContent = label; $('#route-meta').append(span);
    }
    $('#reply-subject').value = /^re:/i.test(result.thread.subject) ? result.thread.subject : `Re: ${result.thread.subject}`;
    setReplyAvailability(result.thread);
    renderMessages(result.messages);
  } catch (error) {
    setStatus($('#global-status'), error.message, 'error');
  }
}
async function refreshInbox(keepSelection = true) {
  try {
    const result = await api('inbox');
    threads = result.threads || [];
    updateMetrics(); renderThreadList();
    if (keepSelection && selectedId && threads.some(row => row.id === selectedId)) await openThread(selectedId);
    else if (!selectedId || !threads.some(row => row.id === selectedId)) {
      selectedId = null; selectedThread = null; $('#empty-detail').hidden = false; $('#thread-detail').hidden = true;
    }
    setStatus($('#global-status'), `Updated ${new Date().toLocaleTimeString()}.`, 'success');
  } catch (error) {
    setStatus($('#global-status'), error.message, 'error');
    if (/session|sign in/i.test(error.message)) showLogin(error.message);
  }
}
async function signIn(email, password) {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase public configuration is missing.');
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  session = result.data.session;
  const profile = await api('whoami');
  access = profile.access; provider = profile.provider;
  showWorkspace(result.data.user);
  await refreshInbox(false);
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refreshInbox(true), 60000);
}

async function boot() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Supabase public URL or anonymous/publishable key is not configured.'); return; }
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const current = await supabase.auth.getSession();
  if (current.data.session) {
    session = current.data.session;
    try {
      const profile = await api('whoami');
      access = profile.access; provider = profile.provider;
      showWorkspace(current.data.session.user);
      await refreshInbox(false);
      refreshTimer = setInterval(() => refreshInbox(true), 60000);
    } catch (error) { await supabase.auth.signOut(); showLogin(error.message); }
  } else showLogin();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); setStatus($('#login-status'), 'Checking staff access…');
  try { await signIn($('#staff-email').value.trim(), $('#staff-password').value); }
  catch (error) { setStatus($('#login-status'), error.message || 'Sign-in failed.', 'error'); }
});
$('#sign-out').addEventListener('click', async () => {
  clearInterval(refreshTimer); await supabase?.auth.signOut(); session = null; access = null; provider = null; threads = []; selectedId = null; showLogin('Signed out.');
});
$('#refresh').addEventListener('click', () => refreshInbox(true));
$('#thread-search').addEventListener('input', renderThreadList);
$('#reply-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedThread || !selectedId) return;
  const button = $('#send-reply'); button.disabled = true;
  setStatus($('#reply-status'), 'Submitting reply to Resend…');
  try {
    const result = await api('send_reply', { threadId: selectedId, subject: $('#reply-subject').value, text: $('#reply-text').value });
    if (result.status === 'unknown') {
      setStatus($('#reply-status'), result.warning || 'Provider result is unknown. Check Resend logs before any retry.', 'error');
    } else if (result.sent) {
      $('#reply-text').value = '';
      setStatus($('#reply-status'), `Resend accepted the email. Provider acceptance is not proof that the recipient read it.${result.warning || ''}`, result.warning ? 'error' : 'success');
      await openThread(selectedId);
    } else setStatus($('#reply-status'), result.error || 'Email was not sent.', 'error');
  } catch (error) { setStatus($('#reply-status'), error.message, 'error'); }
  finally { if (selectedThread) setReplyAvailability(selectedThread); }
});

boot().catch(error => showLogin(error.message || 'CALLORIA Email Inbox could not initialise.'));
