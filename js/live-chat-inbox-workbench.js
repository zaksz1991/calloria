import { createClient } from '@supabase/supabase-js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null;
let session = null;
let access = null;
let conversations = [];
let selectedId = null;
let selectedConversation = null;
let inboxTimer = null;
let conversationTimer = null;
const pendingReplyIds = new Map();

function status(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-web-chat`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Live chat request failed (${response.status}).`);
  return result;
}
function showLogin(message = '') {
  $('#login-panel').hidden = false;
  $('#workspace').hidden = true;
  $('#sign-out').hidden = true;
  status($('#login-status'), message);
  stopTimers();
}
function showWorkspace(user) {
  $('#login-panel').hidden = true;
  $('#workspace').hidden = false;
  $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
}
function stopTimers() {
  if (inboxTimer) clearInterval(inboxTimer);
  if (conversationTimer) clearInterval(conversationTimer);
  inboxTimer = null; conversationTimer = null;
}
function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}
function updateMetrics() {
  $('#metric-total').textContent = String(conversations.length);
  $('#metric-queued').textContent = String(conversations.filter(row => row.routeStatus === 'queued').length);
  $('#metric-assigned').textContent = String(conversations.filter(row => row.routeStatus === 'assigned').length);
  $('#metric-followup').textContent = String(conversations.filter(row => row.lastDirection === 'customer').length);
}
function renderList() {
  const box = $('#conversation-list');
  box.replaceChildren();
  const query = $('#conversation-search').value.trim().toLowerCase();
  const rows = conversations.filter(row => !query || [row.conversationRef, row.routeRef, row.platformId, row.department, row.lastMessage, row.language].join(' ').toLowerCase().includes(query));
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = conversations.length ? 'No conversations match this search.' : 'No website conversations are currently visible in your staff permission scope.';
    box.append(empty); return;
  }
  for (const row of rows) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `conversation-item${row.id === selectedId ? ' selected' : ''}`;
    const top = document.createElement('span'); top.className = 'conversation-top';
    const platform = document.createElement('strong'); platform.textContent = platformName(row.platformId);
    const when = document.createElement('small'); when.textContent = new Date(row.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    top.append(platform, when);
    const topic = document.createElement('span'); topic.className = 'conversation-subject'; topic.textContent = `${row.department} · ${row.language.toUpperCase()}`;
    const preview = document.createElement('span'); preview.className = 'conversation-preview'; preview.textContent = row.lastMessage || 'No message preview';
    const bottom = document.createElement('span'); bottom.className = 'conversation-bottom';
    const ref = document.createElement('small'); ref.textContent = `${row.conversationRef} · ${row.routeRef}`;
    const badge = document.createElement('span'); badge.className = `mini-badge${row.priority === 'urgent' ? ' urgent' : row.routeStatus === 'assigned' ? ' assigned' : ''}`;
    badge.textContent = row.routeStatus === 'assigned' ? 'Assigned' : row.priority === 'urgent' ? 'Urgent' : 'Waiting';
    bottom.append(ref, badge); button.append(top, topic, preview, bottom);
    button.addEventListener('click', () => openConversation(row.id));
    box.append(button);
  }
}
function platformName(id) {
  return ({ 'ruffneck-learn': 'RuffNeck Learn', 'ruffneck-prospector': 'RuffNeck Prospector', 'ruffneck-connect': 'RuffNeck Connect', 'ruffneck-social-hub': 'RuffNeck Social Hub', 'kano-run': 'Kano Run / Kano Life', 'kano-keke': 'Kano Keke' })[id] || 'RuffNeck website';
}
function renderMessages(messages) {
  const box = $('#message-history'); box.replaceChildren();
  if (!messages.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No messages recorded.'; box.append(empty); return; }
  for (const message of messages) {
    const article = document.createElement('article'); article.className = `message ${message.direction === 'agent' ? 'agent' : 'customer'}`;
    const body = document.createElement('div'); body.textContent = message.text;
    const meta = document.createElement('small'); meta.textContent = `${message.sender || (message.direction === 'agent' ? 'CALLORIA staff' : 'Customer')} · ${formatTime(message.createdAt)}`;
    article.append(body, meta); box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function setReplyAvailability(conversation) {
  const available = conversation?.routeStatus === 'assigned';
  $('#send-reply').disabled = !available;
  $('#reply-text').disabled = !available;
  $('#route-badge').className = `route-badge ${available ? 'ready' : 'waiting'}`;
  $('#route-badge').textContent = available ? 'Assigned · reply enabled' : conversation?.routeStatus === 'queued' ? 'Waiting for routing claim' : `Route ${conversation?.routeStatus || 'unavailable'}`;
  $('#reply-status').textContent = available
    ? 'Replies are delivered to the visitor’s open browser chat session. No email or phone contact is collected.'
    : 'Reply is disabled until the linked work item is claimed through Routing Control.';
}
async function openConversation(id) {
  selectedId = id;
  renderList();
  $('#empty-detail').hidden = true;
  $('#conversation-detail').hidden = false;
  $('#conversation-platform').textContent = 'Loading conversation…';
  $('#message-history').replaceChildren();
  try {
    const result = await api('conversation', { conversationId: id });
    selectedConversation = result.conversation;
    $('#conversation-reference').textContent = `${result.conversation.reference} · ${result.conversation.routeRef}`;
    $('#conversation-platform').textContent = platformName(result.conversation.platformId);
    $('#conversation-meta').textContent = `${result.conversation.department} · ${result.conversation.language.toUpperCase()} · ${result.conversation.priority.toUpperCase()}`;
    $('#route-meta').replaceChildren();
    for (const label of [`Department: ${result.conversation.department}`, `Routing status: ${result.conversation.routeStatus}`, `Route: ${result.conversation.routeRef}`, `Assigned staff: ${result.conversation.assignedTo || 'Not assigned'}`]) {
      const span = document.createElement('span'); span.textContent = label; $('#route-meta').append(span);
    }
    setReplyAvailability(result.conversation);
    renderMessages(result.messages || []);
    if (conversationTimer) clearInterval(conversationTimer);
    conversationTimer = setInterval(async () => {
      if (!selectedId || selectedId !== id) return;
      try {
        const latest = await api('conversation', { conversationId: id });
        selectedConversation = latest.conversation; setReplyAvailability(latest.conversation); renderMessages(latest.messages || []);
      } catch (error) { status($('#reply-status'), error.message, 'error'); }
    }, 6000);
  } catch (error) {
    status($('#global-status'), error.message, 'error');
    selectedConversation = null;
    if (/session|sign in/i.test(error.message)) showLogin(error.message);
  }
}
async function refreshInbox(keepSelection = true) {
  try {
    const result = await api('inbox');
    conversations = result.conversations || [];
    updateMetrics(); renderList();
    if (keepSelection && selectedId && conversations.some(row => row.id === selectedId)) await openConversation(selectedId);
    else if (!selectedId || !conversations.some(row => row.id === selectedId)) {
      selectedId = null; selectedConversation = null; $('#empty-detail').hidden = false; $('#conversation-detail').hidden = true;
      if (conversationTimer) clearInterval(conversationTimer); conversationTimer = null;
    }
    status($('#global-status'), `Updated ${new Date().toLocaleTimeString()}.`, 'success');
  } catch (error) {
    status($('#global-status'), error.message, 'error');
    if (/session|sign in/i.test(error.message)) showLogin(error.message);
  }
}
async function signIn(email, password) {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase public URL or key is missing from Vercel configuration.');
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  session = result.data.session;
  const profile = await api('whoami');
  access = profile.access;
  $('#channel-config').textContent = profile.configuration.encryptedStorage
    ? `Encrypted storage is configured. Approved product website origins: ${profile.configuration.publicOriginsConfigured}. This confirms configuration presence, not live widget availability on each platform.`
    : 'Encrypted storage configuration is incomplete; chat access is unavailable.';
  showWorkspace(result.data.user);
  await refreshInbox(false);
  stopTimers();
  inboxTimer = setInterval(() => refreshInbox(true), 12000);
}
async function boot() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Supabase public configuration is missing.'); return; }
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const current = await supabase.auth.getSession();
  if (current.data.session) {
    session = current.data.session;
    try {
      const profile = await api('whoami');
      access = profile.access;
      $('#channel-config').textContent = profile.configuration.encryptedStorage
        ? `Encrypted storage is configured. Approved product website origins: ${profile.configuration.publicOriginsConfigured}.`
        : 'Encrypted storage configuration is incomplete.';
      showWorkspace(current.data.session.user);
      await refreshInbox(false);
      inboxTimer = setInterval(() => refreshInbox(true), 12000);
    } catch (error) { await supabase.auth.signOut(); session = null; showLogin(error.message); }
  } else showLogin();
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); status($('#login-status'), 'Checking staff access…');
  try { await signIn($('#staff-email').value.trim(), $('#staff-password').value); }
  catch (error) { status($('#login-status'), error.message || 'Sign-in failed.', 'error'); }
});
$('#sign-out').addEventListener('click', async () => {
  stopTimers(); pendingReplyIds.clear(); await supabase?.auth.signOut(); session = null; access = null; conversations = []; selectedId = null; selectedConversation = null; showLogin('Signed out.');
});
$('#refresh').addEventListener('click', () => refreshInbox(true));
$('#conversation-search').addEventListener('input', renderList);
$('#reply-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedId || !selectedConversation) return;
  const button = $('#send-reply'); button.disabled = true; status($('#reply-status'), 'Sending response to the visitor…');
  const replyConversationId = selectedId;
  const replyText = $('#reply-text').value;
  const clientMessageId = pendingReplyIds.get(replyConversationId) || crypto.randomUUID();
  pendingReplyIds.set(replyConversationId, clientMessageId);
  try {
    const result = await api('reply', { conversationId: replyConversationId, clientMessageId, message: replyText });
    if (result.sent) {
      pendingReplyIds.delete(replyConversationId);
      if (selectedId === replyConversationId) { $('#reply-text').value = ''; status($('#reply-status'), 'Reply added to the customer conversation.', 'success'); await openConversation(replyConversationId); }
    } else if (selectedId === replyConversationId) status($('#reply-status'), 'The message was not sent.', 'error');
  } catch (error) {
    if (selectedId === replyConversationId) status($('#reply-status'), `${error.message} Draft retained; retrying will not duplicate a reply already accepted.`, 'error');
  }
  finally { if (selectedConversation) setReplyAvailability(selectedConversation); }
});

boot().catch(error => showLogin(error.message || 'CALLORIA Live Chat Inbox could not initialise.'));
