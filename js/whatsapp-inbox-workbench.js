import { createClient } from '@supabase/supabase-js';
import { getServiceWindow } from './whatsapp-engine.js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
let supabase = null;
let session = null;
let access = null;
let conversations = [];
let selectedId = null;
let selectedConversation = null;
let refreshTimer = null;
let countdownTimer = null;

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function apiBase() { return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-whatsapp`; }
async function api(action, payload = {}) {
  if (!session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(apiBase(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseKey, Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `WhatsApp request failed (${response.status}).`);
  return result;
}
function showLogin(message = '') {
  $('#login-panel').hidden = false;
  $('#workspace').hidden = true;
  $('#sign-out').hidden = true;
  setStatus($('#login-status'), message);
  clearInterval(refreshTimer);
}
function showWorkspace(user, provider = {}) {
  $('#login-panel').hidden = true;
  $('#workspace').hidden = false;
  $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  const providerNode = $('#provider-config');
  if (providerNode) {
    if (provider.webhookReady && provider.outboundReady && provider.dataProtectionReady) providerNode.textContent = 'Meta webhook verification, encrypted storage and outbound API credentials are present. This is a configuration check, not a live provider connection test.';
    else if (provider.webhookReady) providerNode.textContent = 'Inbound webhook security and encrypted storage are configured. Outbound Meta API credentials are incomplete; replies remain unavailable.';
    else providerNode.textContent = 'Meta webhook / encryption secrets are incomplete. Live WhatsApp events will not be accepted until Supabase Edge Function secrets are configured.';
  }
}
function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Time unavailable' : date.toLocaleString();
}
function formatCountdown(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remainder).padStart(2, '0')}s`;
}
function updateMetrics() {
  $('#metric-total').textContent = String(conversations.length);
  $('#metric-window').textContent = String(conversations.filter(item => getServiceWindow(item.lastInboundAt).open).length);
  $('#metric-queued').textContent = String(conversations.filter(item => ['queued', 'pending', 'escalated'].includes(item.routeStatus)).length);
  $('#metric-optout').textContent = String(conversations.filter(item => item.messagingOptOut).length);
}
function renderConversationList() {
  const box = $('#conversation-list');
  box.replaceChildren();
  const query = $('#conversation-search').value.trim().toLowerCase();
  const rows = conversations.filter(item => !query || [item.routeRef, item.displayName, item.lastMessage].join(' ').toLowerCase().includes(query));
  if (!rows.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state';
    empty.textContent = conversations.length ? 'No conversations match this search.' : 'No WhatsApp conversations are currently visible in your permission scope.';
    box.append(empty); return;
  }
  for (const item of rows) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `conversation-item${item.id === selectedId ? ' selected' : ''}`;
    const top = document.createElement('span'); top.className = 'conversation-top';
    const name = document.createElement('strong'); name.textContent = item.displayName || 'WhatsApp customer';
    const when = document.createElement('small'); when.textContent = item.lastInboundAt ? new Date(item.lastInboundAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    top.append(name, when);
    const preview = document.createElement('span'); preview.className = 'preview'; preview.textContent = item.lastMessage || 'No text preview';
    const bottom = document.createElement('span'); bottom.className = 'conversation-bottom';
    const reference = document.createElement('small'); reference.textContent = item.routeRef || 'Unlinked';
    const badge = document.createElement('span'); badge.className = `mini-badge ${item.windowOpen ? 'open' : 'closed'}`; badge.textContent = item.windowOpen ? 'Window open' : 'Template required';
    bottom.append(reference, badge);
    button.append(top, preview, bottom);
    button.addEventListener('click', () => openConversation(item.id));
    box.append(button);
  }
}
function renderMessages(messages) {
  const box = $('#message-history');
  box.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No messages are recorded for this conversation.'; box.append(empty); return;
  }
  for (const message of messages) {
    const article = document.createElement('article'); article.className = `message-bubble ${message.direction === 'outbound' ? 'outbound' : 'inbound'}`;
    const content = document.createElement('p'); content.textContent = message.body;
    const meta = document.createElement('div'); meta.className = 'message-meta';
    const direction = document.createElement('span'); direction.textContent = message.direction === 'inbound' ? 'Customer' : message.sentBy || 'CALLORIA staff';
    const time = document.createElement('time'); time.textContent = formatTime(message.createdAt);
    const status = document.createElement('span'); status.textContent = message.direction === 'outbound' ? message.status : message.type;
    meta.append(direction, time, status); article.append(content, meta); box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function setReplyAvailability(conversation) {
  const windowState = conversation.serviceWindow;
  const open = !!windowState?.open && !conversation.messagingOptOut && conversation.routeStatus === 'assigned';
  $('#send-reply').disabled = !open;
  $('#reply-text').disabled = !open;
  $('#window-badge').className = `window-badge ${open ? 'open' : 'closed'}`;
  $('#window-badge').textContent = conversation.messagingOptOut ? 'Customer opted out' : windowState?.open ? '24-hour service window open' : 'Service window closed';
  if (conversation.routeStatus !== 'assigned') $('#window-badge').textContent = 'Claim routing request first';
  $('#window-countdown').textContent = windowState?.open ? `Expires in ${formatCountdown(windowState.remainingMs)}` : 'Approved template required after 24 hours';
}
function renderSelected(result) {
  selectedConversation = result.conversation;
  $('#consent-evidence').value = '';
  $('#consent-evidence-reference').value = '';
  $('#empty-detail').hidden = true;
  $('#conversation-detail').hidden = false;
  $('#route-reference').textContent = result.conversation.routeRef || 'NO ROUTE REFERENCE';
  $('#contact-name').textContent = result.conversation.displayName || 'WhatsApp customer';
  $('#contact-meta').textContent = `${result.conversation.maskedContact} · ${result.conversation.department}`;
  const routeMeta = $('#route-meta'); routeMeta.replaceChildren();
  for (const [label, value] of [
    ['Queue status', result.conversation.routeStatus],
    ['Assigned staff', result.conversation.assignedTo === session?.user?.id ? 'Assigned to you' : 'Assigned to another authorised owner'],
    ['Marketing consent', result.conversation.marketingConsent ? 'Recorded opt-in' : 'Not recorded'],
    ['Service follow-up', result.conversation.serviceFollowupConsent ? 'Recorded opt-in' : 'Not recorded']
  ]) {
    const chip = document.createElement('span'); chip.className = 'route-chip';
    const strong = document.createElement('b'); strong.textContent = `${label}:`;
    const text = document.createElement('span'); text.textContent = String(value || '').replaceAll('_', ' ');
    chip.append(strong, text); routeMeta.append(chip);
  }
  renderMessages(result.messages || []);
  setReplyAvailability(result.conversation);
  $('#marketing-optin').disabled = !!result.conversation.marketingConsent;
  $('#marketing-optout').disabled = !result.conversation.marketingConsent;
  $('#followup-optin').disabled = !!result.conversation.serviceFollowupConsent;
  $('#followup-optout').disabled = !result.conversation.serviceFollowupConsent;
  $('#consent-status').textContent = result.conversation.messagingOptOut ? 'The customer has sent an opt-out instruction. Outbound messages are blocked until the customer sends START.' : '';
}
async function openConversation(id) {
  selectedId = id;
  renderConversationList();
  setStatus($('#global-status'), 'Loading encrypted conversation history…');
  try {
    const result = await api('conversation', { conversationId: id });
    renderSelected(result);
    setStatus($('#global-status'), 'Conversation loaded.');
  } catch (error) {
    selectedId = null; selectedConversation = null;
    $('#conversation-detail').hidden = true; $('#empty-detail').hidden = false;
    setStatus($('#global-status'), error.message, 'error');
  }
}
async function refreshInbox() {
  setStatus($('#global-status'), 'Refreshing WhatsApp inbox…');
  try {
    const result = await api('inbox');
    conversations = Array.isArray(result.conversations) ? result.conversations : [];
    updateMetrics(); renderConversationList();
    if (selectedId && conversations.some(item => item.id === selectedId)) await openConversation(selectedId);
    else if (selectedId) { selectedId = null; selectedConversation = null; $('#conversation-detail').hidden = true; $('#empty-detail').hidden = false; }
    setStatus($('#global-status'), 'Inbox refreshed.');
  } catch (error) { setStatus($('#global-status'), error.message, 'error'); }
}
async function recordConsent(kind, consent) {
  if (!selectedId) return;
  const source = consent ? $('#consent-evidence').value : '';
  const evidenceRef = consent ? $('#consent-evidence-reference').value.trim() : '';
  if (consent && !source) { setStatus($('#consent-status'), 'Select the source of the customer’s explicit consent before recording an opt-in.', 'error'); return; }
  if (consent && evidenceRef.length < 3) { setStatus($('#consent-status'), 'Enter the reference for the actual consent evidence. Do not paste private message contents.', 'error'); return; }
  setStatus($('#consent-status'), 'Saving consent record…');
  try {
    await api('record_consent', { conversationId: selectedId, kind, consent, source, evidenceRef });
    setStatus($('#consent-status'), 'Consent record updated. Marketing permission remains separate from service-contact permission.', 'success');
    await openConversation(selectedId);
  } catch (error) { setStatus($('#consent-status'), error.message, 'error'); }
}

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault(); setStatus($('#login-status'), 'Signing in…');
  try {
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase browser configuration is missing.');
    supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.auth.signInWithPassword({ email: $('#staff-email').value.trim(), password: $('#staff-password').value });
    if (error || !data.session) throw error || new Error('Staff sign-in failed.');
    session = data.session;
    const result = await api('whoami'); access = result.access;
    showWorkspace(data.user, result.provider); await refreshInbox();
    refreshTimer = setInterval(refreshInbox, 45000);
  } catch (error) { showLogin(error.message || 'Sign-in failed.'); }
});
$('#sign-out').addEventListener('click', async () => {
  try { await supabase?.auth.signOut(); } finally {
    session = null; access = null; conversations = []; selectedId = null; selectedConversation = null;
    $('#conversation-list').replaceChildren(); $('#conversation-detail').hidden = true; $('#empty-detail').hidden = false;
    showLogin('Signed out.');
  }
});
$('#refresh').addEventListener('click', refreshInbox);
$('#conversation-search').addEventListener('input', renderConversationList);
$('#reply-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!selectedId) return;
  const button = $('#send-reply'); button.disabled = true; setStatus($('#reply-status'), 'Sending through Meta WhatsApp Cloud API…');
  try {
    const result = await api('send_text', { conversationId: selectedId, text: $('#reply-text').value });
    $('#reply-text').value = '';
    setStatus($('#reply-status'), 'Message accepted by the WhatsApp provider. Delivery status will update from Meta webhook events.', 'success');
    await openConversation(selectedId); await refreshInbox();
  } catch (error) { setStatus($('#reply-status'), error.message, 'error'); }
  finally { button.disabled = !selectedConversation?.serviceWindow?.open || !!selectedConversation?.messagingOptOut || selectedConversation?.routeStatus !== 'assigned'; }
});
$('#marketing-optin').addEventListener('click', () => recordConsent('marketing', true));
$('#marketing-optout').addEventListener('click', () => recordConsent('marketing', false));
$('#followup-optin').addEventListener('click', () => recordConsent('service_followup', true));
$('#followup-optout').addEventListener('click', () => recordConsent('service_followup', false));

countdownTimer = setInterval(() => {
  if (!selectedConversation) return;
  const state = getServiceWindow(selectedConversation.lastInboundAt);
  selectedConversation.serviceWindow = state;
  setReplyAvailability(selectedConversation);
}, 1000);

(async () => {
  try {
    if (!supabaseUrl || !supabaseKey) return;
    supabase = createClient(supabaseUrl, supabaseKey);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    session = data.session;
    const result = await api('whoami'); access = result.access;
    showWorkspace(data.session.user, result.provider); await refreshInbox();
    refreshTimer = setInterval(refreshInbox, 45000);
  } catch (error) { showLogin(error.message || 'Staff session could not be restored.'); }
})();
