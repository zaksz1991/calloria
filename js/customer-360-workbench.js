import { createClient } from '@supabase/supabase-js';
import {
  validateNewContact, validateInteraction, canShowRecommendation, statusLabel,
  CHANNELS, DIRECTIONS, INTERACTION_TYPES, CONSENT_PURPOSES
} from './customer-360-engine.js';

const env = import.meta.env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const loginPanel = document.querySelector('#login-panel');
const crmPanel = document.querySelector('#crm-panel');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const signOutButton = document.querySelector('#sign-out');
const crmStatus = document.querySelector('#crm-status');
const searchResults = document.querySelector('#search-results');
const profileContent = document.querySelector('#profile-content');
const noSelection = document.querySelector('#no-selection');
const newContactDialog = document.querySelector('#new-contact-dialog');
const interactionDialog = document.querySelector('#interaction-dialog');

let supabase = null;
let currentContact = null;
let currentAccess = { role: 'agent', departments: [] };
let searchItems = [];

function status(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `status${type ? ` ${type}` : ''}`;
}
function node(tag, text, className = '') {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = String(text);
  return el;
}
function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function titleCase(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase()); }
function showLogin(message = '') {
  loginPanel.hidden = false;
  crmPanel.hidden = true;
  signOutButton.hidden = true;
  currentContact = null;
  status(loginStatus, message);
}
function showCrm(user, access) {
  currentAccess = access || { role: 'agent', departments: [] };
  loginPanel.hidden = true;
  crmPanel.hidden = false;
  signOutButton.hidden = false;
  document.querySelector('#staff-badge').textContent = `${user.email || user.id} · ${titleCase(access.role)}`;
  document.querySelector('#add-identity-button').hidden = currentAccess.role !== 'supervisor';
  const departments = currentAccess.departments.includes('*') ? [
    'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery','Personal Development and Wellbeing Information','General Customer Care','Email and Written Support','Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience','Safeguarding and Trained Human Support','Learning and Career Development'
  ] : currentAccess.departments;
  const departmentSelect = document.querySelector('#new-department');
  departmentSelect.replaceChildren();
  departments.forEach(department => { const option = node('option', department); option.value = department; departmentSelect.append(option); });
  document.querySelector('#erase-contact-button').hidden = currentAccess.role !== 'supervisor';
}
async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('calloria-customer-360', { body: { action, ...payload } });
  if (error) {
    let message = '';
    try { message = (await error.context?.json?.())?.error || ''; } catch { /* no error body */ }
    throw new Error(String(message || error.message || 'Customer 360 service is unavailable.').slice(0, 360));
  }
  if (!data || typeof data !== 'object') throw new Error('Customer 360 returned an invalid response.');
  if (data.error) throw new Error(String(data.error).slice(0, 360));
  return data;
}
function drawSearchResults(items) {
  searchItems = items || [];
  searchResults.replaceChildren();
  if (!searchItems.length) {
    searchResults.append(node('div', 'No customer record matched this search. Search by exact contact detail or name.', 'empty-state'));
    return;
  }
  searchItems.forEach(item => {
    const button = node('button', undefined, `result-card${currentContact?.id === item.id ? ' active' : ''}`);
    button.type = 'button';
    button.append(node('strong', item.name || 'Customer (name not supplied)'));
    button.append(node('small', `${item.maskedEmail || 'No email'} · ${item.maskedPhone || 'No phone'} · ${titleCase(item.department)}`));
    button.addEventListener('click', () => loadContact(item.id));
    searchResults.append(button);
  });
}
function drawDetails(contact) {
  document.querySelector('#profile-name').textContent = contact.name || 'Customer (name not supplied)';
  document.querySelector('#profile-meta').textContent = `${titleCase(contact.department)} · Created ${formatDate(contact.createdAt)}`;
  document.querySelector('#profile-id').textContent = `CRM-${contact.id.slice(0, 8).toUpperCase()}`;
  const details = document.querySelector('#contact-details');
  details.replaceChildren();
  [
    ['Email', contact.maskedEmail || 'Not recorded'],
    ['Phone', contact.maskedPhone || 'Not recorded'],
    ['Preferred contact', titleCase(contact.preferredChannel || 'none')],
    ['Last interaction', formatDate(contact.lastInteractionAt)]
  ].forEach(([label, value]) => {
    const row = node('div', undefined, 'detail-row');
    row.append(node('span', label), node('strong', value));
    details.append(row);
  });

  const consentBox = document.querySelector('#consent-list');
  consentBox.replaceChildren();
  CONSENT_PURPOSES.forEach(purpose => {
    const consent = contact.consents?.[purpose] || null;
    const state = consent?.status || 'not_recorded';
    const row = node('div', undefined, 'consent-row');
    const label = node('span', titleCase(purpose));
    const stateEl = node('span', statusLabel(state), `consent-state ${state === 'granted' ? 'granted' : state === 'revoked' ? 'revoked' : 'none'}`);
    const action = node('button', state === 'granted' ? 'Revoke' : 'Grant', 'consent-action');
    action.type = 'button';
    action.addEventListener('click', () => changeConsent(purpose, state === 'granted' ? 'revoked' : 'granted'));
    row.append(label, stateEl, action);
    consentBox.append(row);
  });
  const consentHistory = document.querySelector('#consent-history');
  consentHistory.replaceChildren();
  (contact.consentHistory || []).slice(0, 12).forEach(item => {
    const line = node('div', `${titleCase(item.purpose)} · ${titleCase(item.status)} · ${titleCase(item.capture_channel)} · ${formatDate(item.created_at)}`, 'consent-history-row');
    consentHistory.append(line);
  });

  const identityList = document.querySelector('#identity-list');
  identityList.replaceChildren();
  if (!contact.identities?.length) identityList.append(node('div', 'No linked identities.', 'empty-state'));
  (contact.identities || []).forEach(identity => {
    const row = node('div', undefined, 'identity-row');
    const info = node('div');
    info.append(node('strong', `${titleCase(identity.identity_type)} · ${identity.masked_value}`));
    const state = node('small', `${titleCase(identity.verification_status)}${identity.verified_at ? ` · ${formatDate(identity.verified_at)}` : ''}`);
    info.append(state);
    row.append(info);
    if (currentAccess.role === 'supervisor' && identity.verification_status === 'unverified') {
      const button = node('button', 'Review', 'consent-action');
      button.type = 'button';
      button.addEventListener('click', () => openIdentityReview(identity.id));
      row.append(button);
    }
    identityList.append(row);
  });

  const timeline = document.querySelector('#interaction-list');
  timeline.replaceChildren();
  if (!contact.interactions?.length) timeline.append(node('div', 'No interactions have been recorded for this customer.', 'empty-state'));
  (contact.interactions || []).forEach(item => {
    const card = node('article', undefined, 'timeline-item');
    const top = node('div', undefined, 'timeline-top');
    top.append(node('strong', `${titleCase(item.type)} · ${titleCase(item.channel)} · ${titleCase(item.direction)}`));
    top.append(node('time', formatDate(item.occurredAt)));
    card.append(top, node('p', item.summary));
    if (item.platformName) card.append(node('p', `Product: ${item.platformName}`));
    if (item.caseReference) card.append(node('p', `Related case: ${item.caseReference} · Open Case Desk to review the case record.`));
    timeline.append(card);
  });
  profileContent.hidden = false;
  noSelection.hidden = true;
  document.querySelector('#recommendation-list').replaceChildren();
}
async function loadContact(id) {
  status(crmStatus, 'Loading customer record…');
  try {
    const result = await invoke('get_contact', { contactId: id });
    currentContact = { ...result.contact, identities: result.identities || [] };
    drawDetails(currentContact);
    drawSearchResults(searchItems);
    status(crmStatus, 'Customer record loaded. Consent and verification boundaries apply to every next action.', 'success');
  } catch (error) { status(crmStatus, error.message, 'error'); }
}

async function changeConsent(purpose, nextStatus) {
  if (!currentContact) return;
  const label = titleCase(purpose);
  const answer = window.confirm(`Confirm that the customer explicitly requested to ${nextStatus === 'granted' ? 'grant' : 'revoke'} ${label} consent. This must reflect the customer's actual decision.`);
  if (!answer) return;
  try {
    await invoke('set_consent', { contactId: currentContact.id, purpose, status: nextStatus, customerExplicitlyConfirmed: true, captureChannel: 'staff_recorded' });
    await loadContact(currentContact.id);
    status(crmStatus, `${label} consent ${nextStatus}.`, 'success');
  } catch (error) { status(crmStatus, error.message, 'error'); }
}

function openIdentityReview(identityId) {
  document.querySelector('#verify-identity-id').value = identityId;
  document.querySelector('#verification-evidence').value = '';
  status(document.querySelector('#verify-identity-error'), '');
  document.querySelector('#verify-identity-dialog').showModal();
}

async function decideIdentity(decision) {
  const identityId = document.querySelector('#verify-identity-id').value;
  const evidence = document.querySelector('#verification-evidence').value.trim();
  try {
    await invoke('verify_identity', { identityId, decision, verificationEvidenceReference: evidence });
    document.querySelector('#verify-identity-dialog').close();
    await loadContact(currentContact.id);
    status(crmStatus, `Identity ${decision}.`, 'success');
  } catch (error) { status(document.querySelector('#verify-identity-error'), error.message, 'error'); }
}

async function start() {
  if (!supabaseUrl || !supabaseKey) {
    showLogin('CALLORIA public Supabase settings are not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_KEY.');
    return;
  }
  supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { showLogin(); return; }
  try {
    const access = await invoke('whoami');
    showCrm(session.user, access.access);
  } catch (error) { await supabase.auth.signOut(); showLogin(error.message); }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!supabase) return;
  const email = document.querySelector('#staff-email').value.trim();
  const password = document.querySelector('#staff-password').value;
  status(loginStatus, 'Verifying staff access…');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  document.querySelector('#staff-password').value = '';
  if (error || !data.user) { status(loginStatus, error?.message || 'Sign-in failed.', 'error'); return; }
  try {
    const result = await invoke('whoami');
    showCrm(data.user, result.access);
    status(crmStatus, 'Staff access verified.', 'success');
  } catch (failure) {
    await supabase.auth.signOut();
    showLogin(failure.message);
  }
});

signOutButton.addEventListener('click', async () => {
  if (supabase) await supabase.auth.signOut();
  showLogin('You have signed out.');
});

document.querySelector('#search-form').addEventListener('submit', async event => {
  event.preventDefault();
  const query = document.querySelector('#customer-search').value.trim();
  if (!query) return;
  status(crmStatus, 'Searching permitted customer records…');
  try {
    const result = await invoke('search', { query });
    drawSearchResults(result.results || []);
    status(crmStatus, `${(result.results || []).length} matching record(s). Exact contact searches require the complete email or phone number.`, 'success');
  } catch (error) { status(crmStatus, error.message, 'error'); }
});

document.querySelector('#new-contact-button').addEventListener('click', () => {
  document.querySelector('#new-contact-form').reset();
  status(document.querySelector('#new-contact-error'), '');
  newContactDialog.showModal();
});

document.querySelector('#new-contact-form').addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    name: document.querySelector('#new-name').value,
    email: document.querySelector('#new-email').value,
    phone: document.querySelector('#new-phone').value,
    preferredChannel: document.querySelector('#new-preferred').value,
    department: document.querySelector('#new-department').value,
    serviceConsent: document.querySelector('#service-consent').checked,
    marketingConsent: document.querySelector('#marketing-consent').checked,
    personalizationConsent: document.querySelector('#personalization-consent').checked
  };
  try {
    const safe = validateNewContact(payload);
    status(document.querySelector('#new-contact-error'), 'Creating encrypted customer record…');
    const result = await invoke('create_contact', safe);
    newContactDialog.close();
    currentContact = null;
    await loadContact(result.contactId);
    status(crmStatus, 'Customer record created. Email/phone identity is not considered verified until the approved verification procedure is completed.', 'success');
  } catch (error) { status(document.querySelector('#new-contact-error'), error.message, 'error'); }
});

document.querySelector('#add-interaction-button').addEventListener('click', () => {
  if (!currentContact) return;
  document.querySelector('#interaction-form').reset();
  document.querySelector('#interaction-summary').disabled = false;
  document.querySelector('#interaction-summary').required = true;
  document.querySelector('#interaction-summary-label').querySelector('textarea').placeholder = 'Record only the request, action taken and next step.';
  status(document.querySelector('#interaction-error'), '');
  interactionDialog.showModal();
});
document.querySelector('#interaction-type').addEventListener('change', event => {
  const personal = event.target.value === 'personal_guidance';
  const summary = document.querySelector('#interaction-summary');
  const label = document.querySelector('#interaction-summary-label');
  summary.disabled = personal;
  summary.required = !personal;
  summary.value = personal ? '' : summary.value;
  label.querySelector('textarea').placeholder = personal ? 'Sensitive personal information is not recorded for this interaction.' : 'Record only the request, action taken and next step.';
});
document.querySelector('#interaction-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentContact) return;
  try {
    const payload = validateInteraction({
      channel: document.querySelector('#interaction-channel').value,
      direction: document.querySelector('#interaction-direction').value,
      type: document.querySelector('#interaction-type').value,
      platformId: document.querySelector('#interaction-platform').value,
      caseReference: document.querySelector('#interaction-case-reference').value,
      summary: document.querySelector('#interaction-summary').value
    });
    status(document.querySelector('#interaction-error'), 'Saving interaction…');
    await invoke('record_interaction', { contactId: currentContact.id, ...payload });
    interactionDialog.close();
    await loadContact(currentContact.id);
  } catch (error) { status(document.querySelector('#interaction-error'), error.message, 'error'); }
});

document.querySelector('#erase-contact-button').addEventListener('click', async () => {
  if (!currentContact || currentAccess.role !== 'supervisor') return;
  const reference = window.prompt('Enter the non-sensitive customer erasure request reference. Do not enter the customer name or contact details.');
  if (!reference || reference.trim().length < 8) return;
  const confirmed = window.confirm('This deletes the CRM contact, linked identities, CRM consent rows and CRM interaction timeline. Separate case-desk records follow their own retention rules. Confirm the customer requested this erasure.');
  if (!confirmed) return;
  try {
    await invoke('erase_contact', { contactId: currentContact.id, customerRequestedErasure: true, erasureRequestReference: reference.trim() });
    currentContact = null;
    profileContent.hidden = true;
    noSelection.hidden = false;
    noSelection.querySelector('h2').textContent = 'Customer CRM record erased';
    noSelection.querySelector('p').textContent = 'CRM profile data and its interaction, identity and consent history were deleted. Separate case records are governed independently.';
    status(crmStatus, 'CRM record erased. The non-sensitive audit event remains.', 'success');
  } catch (error) { status(crmStatus, error.message, 'error'); }
});

document.querySelector('#requested-recommendations').addEventListener('click', () => loadRecommendations('requested'));
document.querySelector('#proactive-recommendations').addEventListener('click', () => loadRecommendations('proactive'));
async function loadRecommendations(mode) {
  if (!currentContact) return;
  status(crmStatus, 'Checking consent and portfolio relevance…');
  try {
    const result = await invoke('recommendations', { contactId: currentContact.id, mode });
    const list = document.querySelector('#recommendation-list');
    list.replaceChildren();
    if (!result.recommendations?.length) list.append(node('div', result.message || 'No recommendations are available for this request.', 'empty-state'));
    (result.recommendations || []).forEach(item => {
      const card = node('article', undefined, 'recommendation-card');
      const info = node('div');
      info.append(node('strong', item.name), node('p', item.summary), node('p', item.boundary));
      const link = node('a', 'Open platform ↗');
      link.href = item.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(info, link);
      list.append(card);
    });
    status(crmStatus, result.message || 'Portfolio information loaded.', 'success');
  } catch (error) { status(crmStatus, error.message, 'error'); }
}

document.querySelector('#add-identity-button').addEventListener('click', () => {
  if (currentAccess.role !== 'supervisor' || !currentContact) return;
  document.querySelector('#identity-form').reset();
  status(document.querySelector('#identity-error'), '');
  document.querySelector('#identity-dialog').showModal();
});

document.querySelector('#identity-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentContact || currentAccess.role !== 'supervisor') return;
  try {
    status(document.querySelector('#identity-error'), 'Creating an unverified identity link…');
    await invoke('link_identity', { contactId: currentContact.id, identityType: document.querySelector('#identity-type').value, value: document.querySelector('#identity-value').value.trim() });
    document.querySelector('#identity-dialog').close();
    await loadContact(currentContact.id);
  } catch (error) { status(document.querySelector('#identity-error'), error.message, 'error'); }
});

document.querySelector('#verify-identity-form').addEventListener('submit', async event => {
  event.preventDefault();
  await decideIdentity('verified');
});
document.querySelector('#reject-identity-button').addEventListener('click', () => decideIdentity('rejected'));

document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.close).close()));
document.querySelector('#interaction-summary').required = true;

// Keep an explicit reference to the domain enums in this page's source for audit tooling.
void CHANNELS; void DIRECTIONS; void INTERACTION_TYPES;

start();
