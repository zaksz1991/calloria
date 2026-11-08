import { createClient } from '@supabase/supabase-js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null;
let session = null;
let access = null;
let providerConfig = null;
let conversations = [];
let queuedCount = 0;
let selectedId = null;
let selectedConversation = null;
let inboxTimer = null;
let conversationTimer = null;
let sending = false;
let pendingReplyId = null;
let selectedDeliveryBlocked = false;

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-social-inbox`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Social inbox request failed (${response.status}).`);
  return result;
}
function stopTimers() {
  if (inboxTimer) clearInterval(inboxTimer);
  if (conversationTimer) clearInterval(conversationTimer);
  inboxTimer = null; conversationTimer = null;
}
function showLogin(message = '') {
  $('#login-panel').hidden = false;
  $('#workspace').hidden = true;
  $('#sign-out').hidden = true;
  setStatus($('#login-status'), message);
  stopTimers();
}
function showWorkspace(user) {
  $('#login-panel').hidden = true;
  $('#workspace').hidden = false;
  $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  const labels = providerConfig.accounts.map(account => `${account.provider === 'instagram' ? 'Instagram' : 'Facebook Messenger'} · ${account.displayName}`).join(' | ');
  $('#provider-config').textContent = providerConfig.accounts.length
    ? `${providerConfig.accounts.length} Meta account(s) configured. ${labels}. Configuration presence is not a live webhook or send test.`
    : 'No Meta social accounts are configured. The staff inbox is available, but external social messaging is disabled.';
}
function fmt(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}
function providerName(provider) { return provider === 'instagram' ? 'Instagram Direct' : 'Facebook Messenger'; }
function getWindowState(value) {
  const expires = new Date(value).getTime();
  if (!Number.isFinite(expires)) return { open: false, remaining: 'unknown' };
  const difference = expires - Date.now();
  if (difference <= 0) return { open: false, remaining: 'expired' };
  const hours = Math.floor(difference / 3_600_000);
  const minutes = Math.floor((difference % 3_600_000) / 60_000);
  return { open: true, remaining: `${hours}h ${minutes}m` };
}
function renderMetrics() {
  $('#metric-total').textContent = String(conversations.length);
  $('#metric-queued').textContent = String(queuedCount);
  $('#metric-assigned').textContent = String(conversations.filter(row => row.routeStatus === 'assigned').length);
  $('#metric-window').textContent = String(conversations.filter(row => getWindowState(row.replyWindowExpiresAt).open && new Date(row.replyWindowExpiresAt).getTime() - Date.now() < 3 * 3_600_000).length);
}
function renderConversationList() {
  const box = $('#conversation-list');
  box.replaceChildren();
  const query = $('#conversation-search').value.trim().toLowerCase();
  const provider = $('#provider-filter').value;
  const statusFilter = $('#status-filter').value;
  const rows = conversations.filter(row => {
    if (provider !== 'all' && row.provider !== provider) return false;
    if (statusFilter === 'assigned' && row.routeStatus !== 'assigned') return false;
    if (statusFilter === 'window' && !getWindowState(row.replyWindowExpiresAt).open) return false;
    return !query || [row.reference, row.routeRef, row.department, row.provider, row.accountName, row.lastPreview].join(' ').toLowerCase().includes(query);
  });
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = conversations.length ? 'No social conversations match this filter.' : 'No assigned social conversations are visible in your permission scope. Use Routing Control to claim eligible work.';
    box.append(empty); return;
  }
  for (const row of rows) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `conversation-item${row.id === selectedId ? ' selected' : ''}`;
    const top = document.createElement('span'); top.className = 'conversation-top';
    const name = document.createElement('strong'); name.textContent = row.accountName || providerName(row.provider);
    const when = document.createElement('small'); when.textContent = new Date(row.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    top.append(name, when);
    const subject = document.createElement('span'); subject.className = 'conversation-subject'; subject.textContent = `${providerName(row.provider)} · ${row.department} · ${row.language.toUpperCase()}`;
    const preview = document.createElement('span'); preview.className = 'conversation-preview'; preview.textContent = row.lastPreview || 'No message preview';
    const bottom = document.createElement('span'); bottom.className = 'conversation-bottom';
    const ref = document.createElement('small'); ref.textContent = `${row.reference} · ${row.routeRef}`;
    const badge = document.createElement('span'); badge.className = `mini-badge${row.priority === 'urgent' ? ' urgent' : row.routeStatus === 'assigned' ? ' assigned' : ''}`;
    badge.textContent = row.routeStatus === 'assigned' ? 'Assigned' : row.priority === 'urgent' ? 'Urgent' : 'Waiting';
    const provider = document.createElement('span'); provider.className = 'provider-tag'; provider.textContent = row.provider === 'instagram' ? 'INSTAGRAM' : 'MESSENGER';
    bottom.append(ref, badge, provider); button.append(top, subject, preview, bottom);
    button.addEventListener('click', () => openConversation(row.id));
    box.append(button);
  }
}
function renderMessages(messages) {
  const box = $('#message-history'); box.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No messages are recorded for this conversation.'; box.append(empty); return;
  }
  for (const message of messages) {
    const article = document.createElement('article'); article.className = `message ${message.direction === 'outbound' ? 'agent' : 'customer'}`;
    const text = document.createElement('div'); text.textContent = message.text;
    const meta = document.createElement('small');
    const status = message.state && message.state !== 'received' ? ` · ${message.state.toUpperCase()}` : '';
    meta.textContent = `${message.direction === 'outbound' ? 'CALLORIA staff' : 'Customer'} · ${fmt(message.createdAt)}${status}`;
    article.append(text, meta);
    if (message.state === 'uncertain') {
      const warning = document.createElement('p'); warning.className = 'message-warning';
      warning.textContent = 'Provider delivery is uncertain. Check the native Meta inbox before sending another message.';
      article.append(warning);
    }
    box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function setReplyAvailability(conversation) {
  const windowState = getWindowState(conversation?.replyWindowExpiresAt);
  const assigned = conversation?.routeStatus === 'assigned' && conversation?.assignedToCurrentUser === true;
  const enabled = assigned && windowState.open && providerConfig?.outboundReady === true && !sending && !selectedDeliveryBlocked;
  $('#send-reply').disabled = !enabled;
  $('#reply-text').disabled = !enabled;
  $('#route-badge').className = `route-badge ${enabled ? 'ready' : 'blocked'}`;
  $('#route-badge').textContent = assigned ? (windowState.open ? 'Assigned · reply eligible' : 'Reply window expired') : 'Claim through Routing Control';
  const banner = $('#window-banner');
  banner.className = `window-banner${windowState.open ? '' : ' closed'}`;
  banner.textContent = windowState.open
    ? `Meta's standard messaging window is open for approximately ${windowState.remaining}. The window is based on the customer's most recent message.`
    : 'The standard customer-initiated 24-hour window has expired. CALLORIA blocks replies; do not use an unsupported tag or alternate account to bypass the restriction.';
  $('#reply-status').textContent = selectedDeliveryBlocked
    ? 'An earlier reply has an uncertain delivery result. Verify it in Meta Business Suite before another reply can be sent.'
    : !providerConfig?.outboundReady
    ? 'Meta outbound configuration is incomplete. No reply can be sent.'
    : !assigned ? 'This conversation must be claimed by an eligible agent through Routing Control.'
      : !windowState.open ? 'Reply disabled because the customer-initiated messaging window has expired.'
        : 'Human-authored replies only. No marketing or automated messages are sent.';
}
async function openConversation(id) {
  selectedId = id;
  renderConversationList();
  $('#empty-detail').hidden = true;
  $('#conversation-detail').hidden = false;
  $('#conversation-platform').textContent = 'Loading social conversation…';
  $('#message-history').replaceChildren();
  try {
    const result = await api('conversation', { conversationId: id });
    selectedConversation = result.conversation;
    $('#conversation-reference').textContent = `${result.conversation.reference} · ${result.conversation.routeRef}`;
    $('#conversation-platform').textContent = providerName(result.conversation.provider);
    $('#conversation-meta').textContent = `${result.conversation.accountName} · ${result.conversation.department} · ${result.conversation.language.toUpperCase()}`;
    $('#route-meta').replaceChildren();
    for (const label of [`Department: ${result.conversation.department}`, `Routing: ${result.conversation.routeStatus}`, `Route: ${result.conversation.routeRef}`, `Priority: ${result.conversation.priority}`, `Last customer message: ${fmt(result.conversation.lastCustomerMessageAt)}`]) {
      const span = document.createElement('span'); span.textContent = label; $('#route-meta').append(span);
    }
    selectedDeliveryBlocked = (result.messages || []).some(message => message.direction === 'outbound' && ['sending','uncertain'].includes(message.state));
    setReplyAvailability(result.conversation);
    renderMessages(result.messages || []);
    if (conversationTimer) clearInterval(conversationTimer);
    conversationTimer = setInterval(async () => {
      if (!selectedId || selectedId !== id) return;
      try {
        const latest = await api('conversation', { conversationId: id });
        selectedConversation = latest.conversation;
        selectedDeliveryBlocked = (latest.messages || []).some(message => message.direction === 'outbound' && ['sending','uncertain'].includes(message.state));
        setReplyAvailability(latest.conversation);
        renderMessages(latest.messages || []);
      } catch (error) { setStatus($('#reply-status'), error.message, 'error'); }
    }, 7000);
  } catch (error) {
    setStatus($('#global-status'), error.message, 'error');
    selectedConversation = null;
    if (/session|sign in/i.test(error.message)) showLogin(error.message);
  }
}
async function refreshInbox(keepSelection = true) {
  try {
    const result = await api('inbox');
    conversations = result.conversations || [];
    queuedCount = Number.isFinite(Number(result.queuedCount)) ? Number(result.queuedCount) : 0;
    providerConfig = result.provider || providerConfig;
    renderMetrics(); renderConversationList();
    if (keepSelection && selectedId && conversations.some(row => row.id === selectedId)) await openConversation(selectedId);
    else if (!selectedId || !conversations.some(row => row.id === selectedId)) {
      selectedId = null; selectedConversation = null;
      $('#empty-detail').hidden = false; $('#conversation-detail').hidden = true;
      if (conversationTimer) clearInterval(conversationTimer); conversationTimer = null;
    }
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
  const profile = await api('whoami');
  access = profile.access;
  providerConfig = profile.provider;
  showWorkspace(result.data.user);
  await refreshInbox(false);
  stopTimers();
  inboxTimer = setInterval(() => refreshInbox(true), 12000);
}
async function sendReply(event) {
  event.preventDefault();
  if (!selectedConversation || sending) return;
  const text = $('#reply-text').value.trim();
  if (!text) return;
  if (text.length > 1000) { setStatus($('#reply-status'), 'Social messages are limited to 1,000 characters.', 'error'); return; }
  sending = true; setReplyAvailability(selectedConversation);
  setStatus($('#reply-status'), 'Sending through the connected Meta account…');
  if (!pendingReplyId) pendingReplyId = crypto.randomUUID();
  try {
    const result = await api('send_reply', { conversationId: selectedId, clientMessageId: pendingReplyId, text });
    if (result.state === 'sent') {
      pendingReplyId = null;
      $('#reply-text').value = '';
      setStatus($('#reply-status'), result.duplicate ? 'This reply was already recorded as sent; no duplicate message was sent.' : 'Reply accepted by Meta.', 'success');
    } else if (result.state === 'uncertain') {
      pendingReplyId = null;
      setStatus($('#reply-status'), 'Meta delivery is uncertain. Check the native Meta Business Suite inbox before attempting another reply.', 'error');
    } else {
      pendingReplyId = null;
      setStatus($('#reply-status'), result.message || 'Meta did not accept the reply.', 'error');
    }
    await openConversation(selectedId);
    await refreshInbox(true);
  } catch (error) {
    setStatus($('#reply-status'), `${error.message} The same request ID will be reused on retry to prevent a duplicate send.`, 'error');
  } finally {
    sending = false;
    if (selectedConversation) setReplyAvailability(selectedConversation);
  }
}

async function boot() {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault();
    try { setStatus($('#login-status'), 'Verifying staff access…'); await signIn($('#staff-email').value.trim(), $('#staff-password').value); }
    catch (error) { setStatus($('#login-status'), error.message, 'error'); }
  });
  $('#reply-form').addEventListener('submit', sendReply);
  $('#refresh').addEventListener('click', () => refreshInbox(true));
  for (const id of ['conversation-search', 'provider-filter', 'status-filter']) $( `#${id}`).addEventListener('input', renderConversationList);
  $('#sign-out').addEventListener('click', async () => { stopTimers(); await supabase.auth.signOut(); session = null; access = null; providerConfig = null; conversations = []; queuedCount = 0; selectedId = null; selectedConversation = null; showLogin('Signed out.'); });
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    session = data.session;
    try { const profile = await api('whoami'); access = profile.access; providerConfig = profile.provider; showWorkspace({ email: session.user?.email }); await refreshInbox(false); inboxTimer = setInterval(() => refreshInbox(true), 12000); }
    catch (error) { showLogin(error.message); }
  }
}

boot();
