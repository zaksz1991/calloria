import { createClient } from '@supabase/supabase-js';
import { askCustomerCare, CALLORIA_PLATFORMS, getCustomerCareVisitorId, redactCustomerMessage } from './customer-care-engine.js';
import { validateCasePayload, validateCaseLookup, validateCaseCreateResponse, validateCaseStatus } from './case-desk-engine.js';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const conversation = document.querySelector('#conversation');
const form = document.querySelector('#question-form');
const input = document.querySelector('#question');
const sendButton = document.querySelector('#send-button');
const status = document.querySelector('#care-status');
const caseDialog = document.querySelector('#case-dialog');
const caseOpenButton = document.querySelector('#case-open-button');
const caseCreateForm = document.querySelector('#case-create-form');
const caseCreateButton = document.querySelector('#case-create-submit');
const caseCreateError = document.querySelector('#case-create-error');
const caseCreatedResult = document.querySelector('#case-created-result');
const caseLookupPanel = document.querySelector('#case-lookup-panel');
const caseLookupForm = document.querySelector('#case-lookup-form');
const caseLookupResult = document.querySelector('#case-lookup-result');
const caseContactPreference = document.querySelector('#case-contact-preference');
const caseContactLabel = document.querySelector('#case-contact-label');
const caseContactInput = document.querySelector('#case-contact');
const visitorId = getCustomerCareVisitorId();
const trustedHosts = new Set(CALLORIA_PLATFORMS.map(platform => new URL(platform.url).hostname));
let supabase = null;
let lastQuestion = '';
let lastAnswerMeta = null;

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
  lastAnswerMeta = result;
  caseOpenButton.textContent = result.requiresHuman ? 'Create case for human follow-up' : 'Open a support case';
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
  setStatus(result.requiresHuman ? 'Human follow-up is required. Use Open a support case to send this request for staff review; this is not an emergency service.' : 'Response prepared from the available knowledge base.', result.requiresHuman ? 'error' : 'success');
}
async function submitQuestion(question) {
  const message = String(question || '').trim();
  lastQuestion = message;
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


function openCaseDialog() {
  if (!supabase) { setStatus('Customer Care is not connected to the case service.', 'error'); return; }
  caseCreateError.textContent = '';
  caseCreateButton.disabled = false;
  caseCreateButton.textContent = 'Submit support case';
  caseCreatedResult.hidden = true;
  caseCreatedResult.textContent = '';
  const description = document.querySelector('#case-description');
  const subject = document.querySelector('#case-subject');
  if (lastQuestion) {
    description.value = lastQuestion.slice(0, 1800);
    subject.value = lastQuestion.replace(/\s+/g, ' ').trim().slice(0, 110) || 'Customer support request';
  }
  if (caseDialog.showModal) caseDialog.showModal();
  else caseDialog.setAttribute('open', '');
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

async function readFunctionError(error, fallback) {
  try {
    const serverMessage = String((await error?.context?.json?.())?.error || '').trim();
    if (serverMessage) return serverMessage.slice(0, 360);
  } catch { /* SDK error is used when no JSON body exists. */ }
  return String(error?.message || fallback).slice(0, 360);
}

function renderCreatedCase(result) {
  caseCreatedResult.replaceChildren();
  const heading = document.createElement('strong');
  heading.textContent = 'CASE RECEIVED';
  const intro = document.createElement('p');
  intro.textContent = 'Your request has been recorded for review. Save both credentials below. The access code is displayed once and is not stored in this browser.';
  const referenceLabel = document.createElement('div');
  referenceLabel.textContent = 'Case reference';
  const reference = document.createElement('code');
  reference.textContent = result.caseReference;
  const tokenLabel = document.createElement('div');
  tokenLabel.textContent = 'Private case access code';
  const token = document.createElement('code');
  token.textContent = result.accessToken;
  const copyRow = document.createElement('div');
  copyRow.className = 'case-copy-row';
  const copyReference = document.createElement('button');
  copyReference.type = 'button'; copyReference.textContent = 'Copy reference';
  copyReference.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(result.caseReference); setStatus('Case reference copied.', 'success'); }
    catch { caseCreateError.textContent = 'Clipboard unavailable. Select and copy the reference manually.'; }
  });
  const copyToken = document.createElement('button');
  copyToken.type = 'button'; copyToken.textContent = 'Copy access code';
  copyToken.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(result.accessToken); setStatus('Private access code copied.', 'success'); }
    catch { caseCreateError.textContent = 'Clipboard unavailable. Select and copy the access code manually.'; }
  });
  copyRow.append(copyReference, copyToken);
  const note = document.createElement('p');
  note.textContent = 'Status: Received · Follow-up is not guaranteed immediately. Do not share the access code with anyone who should not see this case.';
  caseCreatedResult.append(heading, intro, referenceLabel, reference, tokenLabel, token, copyRow, note);
  caseCreatedResult.hidden = false;
}

caseOpenButton.addEventListener('click', openCaseDialog);
document.querySelector('#case-dialog-close').addEventListener('click', () => caseDialog.close?.());
caseDialog.addEventListener('click', event => {
  if (event.target === caseDialog) caseDialog.close?.();
});
caseContactPreference.addEventListener('change', () => {
  const visible = caseContactPreference.value !== 'none';
  caseContactLabel.hidden = !visible;
  caseContactInput.required = visible;
  caseContactInput.type = caseContactPreference.value === 'email' ? 'email' : 'tel';
  caseContactInput.autocomplete = caseContactPreference.value === 'email' ? 'email' : 'tel';
  if (!visible) caseContactInput.value = '';
});

caseCreateForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  caseCreateError.textContent = '';
  caseCreateButton.disabled = true;
  caseCreateButton.textContent = 'Submitting securely…';
  try {
    const payload = validateCasePayload({
      subject: document.querySelector('#case-subject').value,
      description: document.querySelector('#case-description').value,
      platformId: document.querySelector('#case-platform').value,
      customerName: document.querySelector('#case-customer-name').value,
      contactPreference: caseContactPreference.value,
      contact: caseContactInput.value,
      consent: document.querySelector('#case-consent').checked
    });
    const { data, error } = await supabase.functions.invoke('calloria-case-desk', {
      body: { action: 'create', visitorId, ...payload, urgency: lastAnswerMeta?.urgency || 'normal' }
    });
    if (error) throw new Error(await readFunctionError(error, 'CALLORIA could not submit the case.'));
    const result = validateCaseCreateResponse(data);
    renderCreatedCase(result);
    setStatus(`Case ${result.caseReference} received. Save its reference and private access code.`, 'success');
    caseCreateButton.textContent = 'Case submitted';
    caseCreateButton.disabled = true;
  } catch (error) {
    caseCreateError.textContent = String(error?.message || 'The support case could not be submitted.').slice(0, 360);
    caseCreateButton.textContent = 'Submit support case';
  } finally {
    if (caseCreatedResult.hidden) caseCreateButton.disabled = false;
  }
});

document.querySelector('#case-track-toggle').addEventListener('click', event => {
  const opening = caseLookupPanel.hidden;
  caseLookupPanel.hidden = !opening;
  event.currentTarget.setAttribute('aria-expanded', String(opening));
  if (opening) document.querySelector('#case-reference').focus();
});

caseLookupForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  caseLookupResult.textContent = 'Checking the private case record…';
  const submit = document.querySelector('#case-lookup-submit');
  submit.disabled = true;
  try {
    const credentials = validateCaseLookup(document.querySelector('#case-reference').value, document.querySelector('#case-access-token').value);
    const { data, error } = await supabase.functions.invoke('calloria-case-desk', { body: { action: 'lookup', ...credentials } });
    if (error) throw new Error(await readFunctionError(error, 'The case status could not be retrieved.'));
    const result = validateCaseStatus(data);
    const card = document.createElement('div');
    card.className = 'case-status-card';
    const title = document.createElement('strong');
    title.textContent = `${result.caseReference} · ${result.status.replaceAll('_', ' ').toUpperCase()}`;
    const message = document.createElement('p');
    message.textContent = result.publicMessage || 'The case is in the customer-care queue.';
    const department = document.createElement('p');
    department.textContent = `Department: ${result.department}${result.platformName ? ` · Product: ${result.platformName}` : ''}`;
    const dates = document.createElement('small');
    dates.textContent = `Created: ${formatDate(result.createdAt)} · Last update: ${formatDate(result.updatedAt)}`;
    card.append(title, message, department, dates);
    result.timeline.forEach(entry => {
      const line = document.createElement('p');
      line.textContent = `${entry.status.replaceAll('_', ' ')} · ${entry.message} · ${formatDate(entry.at)}`;
      card.append(line);
    });
    caseLookupResult.replaceChildren(card);
  } catch (error) {
    caseLookupResult.textContent = String(error?.message || 'The case status could not be retrieved.').slice(0, 360);
  } finally {
    submit.disabled = false;
  }
});

if (!supabaseUrl || !supabaseKey) {
  setStatus('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) to the CALLORIA Vercel project.', 'error');
  sendButton.disabled = true;
  caseOpenButton.disabled = true;
  document.querySelector('#case-lookup-submit').disabled = true;
  caseCreateButton.disabled = true;
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
