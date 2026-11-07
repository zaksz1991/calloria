import { createClient } from '@supabase/supabase-js';
import { askCustomerCare, CALLORIA_PLATFORMS, getCustomerCareVisitorId, redactCustomerMessage } from './customer-care-engine.js';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const conversation = document.querySelector('#conversation');
const form = document.querySelector('#question-form');
const input = document.querySelector('#question');
const sendButton = document.querySelector('#send-button');
const status = document.querySelector('#care-status');
const visitorId = getCustomerCareVisitorId();
const trustedHosts = new Set(CALLORIA_PLATFORMS.map(platform => new URL(platform.url).hostname));
let supabase = null;

function setStatus(message, type = '') {
  status.textContent = message;
  status.className = `care-status ${type}`.trim();
}
function appendText(parent, tag, text, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}
function addMessage(role, text) {
  const article = document.createElement('article');
  article.className = `message ${role === 'user' ? 'user-message' : 'assistant-message'}`;
  appendText(article, 'div', role === 'user' ? 'CUSTOMER ENQUIRY' : 'CALLORIA CUSTOMER CARE', 'message-label');
  appendText(article, 'p', text);
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}
function addTyping() {
  const article = document.createElement('article');
  article.className = 'message assistant-message';
  article.dataset.typing = 'true';
  appendText(article, 'div', 'CALLORIA CUSTOMER CARE', 'message-label');
  const line = document.createElement('div');
  line.className = 'typing';
  line.append(document.createTextNode('Reviewing verified knowledge '));
  for (let i = 0; i < 3; i += 1) line.append(document.createElement('i'));
  article.append(line);
  conversation.append(article);
  conversation.scrollTop = conversation.scrollHeight;
  return article;
}
function addList(parent, title, values) {
  if (!Array.isArray(values) || !values.length) return;
  const block = document.createElement('section');
  block.className = 'answer-block';
  appendText(block, 'h3', title);
  const list = document.createElement('ul');
  values.forEach(value => appendText(list, 'li', value));
  block.append(list);
  parent.append(block);
}
function renderAnswer(result) {
  const article = addMessage('assistant', result.answer);
  const meta = document.createElement('div');
  meta.className = 'message-meta';
  appendText(meta, 'span', result.department, 'meta-chip');
  appendText(meta, 'span', `Urgency: ${result.urgency}`, `meta-chip ${result.urgency === 'critical' ? 'critical' : result.urgency === 'high' ? 'high' : ''}`.trim());
  if (result.grounded) appendText(meta, 'span', 'Knowledge-grounded', 'meta-chip');
  if (result.redacted) appendText(meta, 'span', 'Sensitive text redacted', 'meta-chip');
  if (result.requiresHuman) appendText(meta, 'span', 'Human follow-up required', 'meta-chip high');
  article.append(meta);
  addList(article, 'RECOMMENDED NEXT ACTIONS', result.actions);
  if (result.sources.length) {
    const block = document.createElement('section');
    block.className = 'answer-block';
    appendText(block, 'h3', 'KNOWLEDGE REFERENCES');
    const links = document.createElement('div');
    links.className = 'source-list';
    result.sources.forEach(source => {
      if (!source.url) {
        appendText(links, 'span', source.title, 'meta-chip');
        return;
      }
      try {
        const url = new URL(source.url);
        if (url.protocol !== 'https:' || !trustedHosts.has(url.hostname)) return;
        const link = document.createElement('a');
        link.className = 'source-link';
        link.href = url.href;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title;
        links.append(link);
      } catch { /* Ignore invalid knowledge URLs. */ }
    });
    block.append(links);
    article.append(block);
  }
  const relevantPlatforms = result.crossSellPlatformIds.map(id => CALLORIA_PLATFORMS.find(platform => platform.id === id)).filter(Boolean);
  if (relevantPlatforms.length) {
    const block = document.createElement('section');
    block.className = 'answer-block';
    appendText(block, 'h3', 'RELEVANT RUFFNECK PLATFORMS');
    const links = document.createElement('div');
    links.className = 'source-list';
    relevantPlatforms.forEach(platform => {
      const link = document.createElement('a');
      link.className = 'source-link'; link.href = platform.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.textContent = platform.name; links.append(link);
    });
    block.append(links); article.append(block);
  }
  addList(article, 'A USEFUL FOLLOW-UP', result.followUpQuestions);
  const actions = document.createElement('div');
  actions.className = 'source-list';
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'copy-answer'; copy.textContent = 'Copy response';
  copy.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(result.answer); setStatus('Response copied.', 'success'); }
    catch { setStatus('Clipboard access is unavailable in this browser.', 'error'); }
  });
  actions.append(copy);
  article.append(actions);
  conversation.scrollTop = conversation.scrollHeight;
  setStatus(result.requiresHuman ? 'Human follow-up is required. This page does not submit a live escalation.' : 'Response prepared from the available knowledge base.', result.requiresHuman ? 'error' : 'success');
}
async function submitQuestion(question) {
  const message = String(question || '').trim();
  if (!message) return;
  let displayMessage = message;
  try { displayMessage = redactCustomerMessage(message).text; } catch { displayMessage = message.slice(0, 1800); }
  addMessage('user', displayMessage);
  input.value = '';
  input.disabled = true;
  sendButton.disabled = true;
  setStatus('Searching CALLORIA knowledge and preparing a response.');
  const typing = addTyping();
  try {
    const result = await askCustomerCare(supabase, { message, visitorId });
    typing.remove();
    renderAnswer(result);
  } catch (error) {
    typing.remove();
    const reason = String(error?.message || 'Customer Care is unavailable.').slice(0, 320);
    addMessage('assistant', `${reason} You can still open the relevant official RuffNeck platform from the left panel.`);
    setStatus(reason, 'error');
  } finally {
    input.disabled = false;
    sendButton.disabled = false;
    input.focus();
  }
}

if (!supabaseUrl || !supabaseKey) {
  setStatus('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) to the CALLORIA Vercel project.', 'error');
  sendButton.disabled = true;
} else {
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } });
  setStatus('Guest access ready. No registration required.', 'success');
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!supabase) return;
  void submitQuestion(input.value);
});
document.querySelectorAll('[data-prompt]').forEach(button => {
  button.addEventListener('click', () => {
    input.value = button.dataset.prompt || '';
    input.focus();
  });
});
