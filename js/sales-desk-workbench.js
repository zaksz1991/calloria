import { createClient } from '@supabase/supabase-js';
import catalogData from '../assets/ruffneck-catalog.json';
import {
  NEED_CATEGORIES, validateOpportunity, recommendProducts, getNextStages,
  validateFollowUp
} from './sales-desk-engine.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const $ = selector => document.querySelector(selector);
const catalog = Array.isArray(catalogData.products) ? catalogData.products : [];
const departments = [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
];
let supabase = null;
let session = null;
let staff = null;
let opportunities = [];
let selected = null;

function status(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function clean(value) { return String(value ?? '').trim(); }
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function titleCase(value) { return String(value || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase()); }
function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined,{ dateStyle:'medium', timeStyle:'short' }).format(date) : 'Not recorded';
}
function fillDepartments(values) {
  const select = $('#department'); select.replaceChildren();
  for (const value of values) { const option = document.createElement('option'); option.value = value; option.textContent = value; select.append(option); }
}
function showLogin(message = '') {
  $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#sign-out').hidden = true;
  status($('#login-status'), message);
}
function showWorkspace(user, access) {
  staff = access; $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#sign-out').hidden = false;
  $('#staff-name').textContent = user.email || 'Authenticated staff';
  $('#staff-scope').textContent = `${titleCase(access.role)} · ${access.departments.includes('*') ? 'All departments' : access.departments.join(', ')}`;
  fillDepartments(access.departments.includes('*') ? departments : access.departments);
  renderPortfolio();
}
async function api(action, payload = {}) {
  if (!supabase || !session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/,'')}/functions/v1/calloria-sales-desk`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'apikey':supabaseKey, 'Authorization':`Bearer ${session.access_token}` },
    body:JSON.stringify({ action, ...payload })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Sales Desk request failed (${response.status}).`);
  return result;
}
function renderMetrics() {
  const open = opportunities.filter(x => x.stage !== 'closed_no_interest');
  $('#metric-open').textContent = open.length;
  $('#metric-discovery').textContent = open.filter(x => ['new','discovery'].includes(x.stage)).length;
  $('#metric-interested').textContent = open.filter(x => x.stage === 'customer_interested').length;
  $('#metric-referred').textContent = open.filter(x => ['referred_to_platform','follow_up_due'].includes(x.stage)).length;
}
function filteredOpportunities() {
  const stage = $('#stage-filter').value;
  return opportunities.filter(item => stage === 'all' || item.stage === stage);
}
function renderList() {
  const box = $('#opportunity-list'); box.replaceChildren();
  for (const item of filteredOpportunities()) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = `opportunity-card${selected?.id === item.id ? ' selected' : ''}`;
    const top = document.createElement('div'); top.className = 'queue-top';
    const ref = document.createElement('small'); ref.textContent = `OPP-${item.id.slice(0,8).toUpperCase()}`;
    const stage = document.createElement('span'); stage.className = `stage-pill${item.stage === 'closed_no_interest' ? ' closed' : ''}`; stage.textContent = titleCase(item.stage);
    top.append(ref,stage);
    const heading = document.createElement('strong'); heading.textContent = titleCase(item.needCategory);
    const summary = document.createElement('small'); summary.textContent = item.needSummary;
    const foot = document.createElement('small'); foot.textContent = `${item.department} · ${titleCase(item.sourceChannel)} · ${formatDate(item.updatedAt)}`;
    button.append(top,heading,summary,foot); button.addEventListener('click', () => selectOpportunity(item.id)); box.append(button);
  }
  if (!box.children.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No opportunities in this view. Create a new record from an actual customer enquiry.'; box.append(empty); }
  renderMetrics();
}
function metaCell(label,value) {
  const node = document.createElement('div'); node.className = 'meta-cell';
  const name = document.createElement('span'); name.textContent = label;
  const text = document.createElement('strong'); text.textContent = value || '—';
  node.append(name,text); return node;
}
function renderOptions() {
  const box = $('#recommendation-options'); box.replaceChildren();
  const existing = new Set((selected?.recommendations || []).map(x => x.product_id));
  const matches = recommendProducts(catalogData, selected?.needCategory, 3);
  if (!matches.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No direct product fit is defined for this need. Handle the service request without forcing a sale or refer it to the appropriate specialist.'; box.append(empty); return; }
  for (const match of matches) {
    const row = document.createElement('label'); row.className = 'recommendation-option';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = match.product.id; input.disabled = existing.has(match.product.id) || selected.stage === 'closed_no_interest';
    const content = document.createElement('span');
    const title = document.createElement('strong'); title.textContent = `${match.product.name} · ${match.fitScore}% fit`;
    const description = document.createElement('small'); description.textContent = `${match.product.summary} ${match.matchReason}`;
    const boundary = document.createElement('small'); boundary.textContent = match.product.sales_boundary || 'Confirm current features and commercial terms on the platform.';
    content.append(title,description,boundary); row.append(input,content); box.append(row);
  }
}
function renderPresented() {
  const box = $('#presented-list'); box.replaceChildren();
  const recommendations = selected?.recommendations || [];
  if (!recommendations.length) { const empty = document.createElement('p'); empty.className = 'muted small'; empty.textContent = 'No product recommendations recorded yet.'; box.append(empty); return; }
  for (const rec of recommendations) {
    const product = catalog.find(item => item.id === rec.product_id);
    if (!product) continue;
    const card = document.createElement('article'); card.className = 'presented-card';
    const top = document.createElement('div'); top.className = 'presented-card-top';
    const name = document.createElement('strong'); name.textContent = product.name;
    const pill = document.createElement('span'); pill.className = 'stage-pill'; pill.textContent = titleCase(rec.status);
    top.append(name,pill);
    const reason = document.createElement('p'); reason.textContent = `${rec.match_reason} ${rec.fit_score}% fit · ${titleCase(rec.presentation_context)}.`;
    const link = document.createElement('a'); link.href = product.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open official platform ↗'; link.className = 'small';
    card.append(top,reason,link);
    if (rec.status === 'presented' && selected.stage !== 'closed_no_interest') {
      const actions = document.createElement('div'); actions.className = 'tiny-actions';
      for (const [label,value] of [['Customer interested','customer_interested'],['Declined','declined']]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'button outline'; button.textContent = label;
        button.addEventListener('click', () => updateRecommendation(rec.id,value)); actions.append(button);
      }
      card.append(actions);
    }
    box.append(card);
  }
}
function renderStageActions() {
  const box = $('#stage-actions'); box.replaceChildren();
  for (const next of getNextStages(selected.stage)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = `button ${next === 'closed_no_interest' ? 'quiet' : 'outline'}`;
    button.textContent = next === 'closed_no_interest' ? 'Close · no interest' : `Move to ${titleCase(next)}`;
    button.addEventListener('click', () => setStage(next)); box.append(button);
  }
  if (!box.children.length) { const text = document.createElement('span'); text.className = 'muted small'; text.textContent = 'This opportunity is closed. No further stage changes are available.'; box.append(text); }
}
function renderFollowups() {
  const box = $('#followup-list'); box.replaceChildren();
  for (const followup of selected.followups || []) {
    const row = document.createElement('div'); row.className = 'followup-row';
    const body = document.createElement('div'); const title = document.createElement('strong'); title.textContent = `${titleCase(followup.purpose)} · ${titleCase(followup.status)}`;
    const date = document.createElement('small'); date.textContent = `Due ${formatDate(followup.due_at)}`; body.append(title,date); row.append(body);
    if (followup.status === 'scheduled') { const button = document.createElement('button'); button.type = 'button'; button.className = 'button outline'; button.textContent = 'Mark completed'; button.addEventListener('click', () => completeFollowup(followup.id)); row.append(button); }
    box.append(row);
  }
}
function renderEvents() {
  const box = $('#event-list'); box.replaceChildren();
  for (const event of selected.events || []) {
    const row = document.createElement('div'); row.className = 'event-row';
    const name = document.createElement('strong'); name.textContent = titleCase(event.event_type);
    const date = document.createElement('small'); date.textContent = formatDate(event.created_at);
    row.append(name,date); box.append(row);
  }
  if (!box.children.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No activity recorded.'; box.append(empty); }
}
function renderDetail() {
  const none = $('#no-selection'); const detail = $('#opportunity-detail');
  if (!selected) { none.hidden = false; detail.hidden = true; return; }
  none.hidden = true; detail.hidden = false;
  $('#opp-id').textContent = `OPP-${selected.id.slice(0,8).toUpperCase()}`;
  $('#opp-title').textContent = titleCase(selected.needCategory);
  $('#opp-subline').textContent = `${titleCase(selected.sourceType)} · Created ${formatDate(selected.createdAt)}`;
  $('#opp-stage').textContent = titleCase(selected.stage); $('#opp-stage').className = `stage-pill${selected.stage === 'closed_no_interest' ? ' closed' : ''}`;
  $('#opp-summary').textContent = selected.needSummary;
  const meta = $('#opp-meta'); meta.replaceChildren();
  meta.append(metaCell('Department',selected.department),metaCell('Channel',titleCase(selected.sourceChannel)),metaCell('CRM record',selected.crmCustomerId ? `CRM-${selected.crmCustomerId.slice(0,8).toUpperCase()}` : 'Not linked'),metaCell('Owner',selected.ownerUserId === session.user.id ? 'You' : 'Assigned within department'),metaCell('Last updated',formatDate(selected.updatedAt)));
  renderOptions(); renderPresented(); renderStageActions(); renderFollowups(); renderEvents();
  $('#followup-form').hidden = !selected.crmCustomerId || selected.stage === 'closed_no_interest';
  $('#present-requested').disabled = selected.stage === 'closed_no_interest' || selected.sourceType !== 'customer_requested';
  $('#present-proactive').disabled = selected.stage === 'closed_no_interest';
}
async function loadQueue() {
  status($('#global-status'),'Loading your permitted sales pipeline…');
  try {
    const result = await api('list_opportunities'); opportunities = result.opportunities || [];
    if (selected) selected = opportunities.find(x => x.id === selected.id) || null;
    renderList();
    if (selected) await selectOpportunity(selected.id,false); else renderDetail();
    status($('#global-status'),`Loaded ${opportunities.length} opportunity record(s).`,'success');
  } catch (error) { status($('#global-status'),error.message,'error'); }
}
async function selectOpportunity(id, announce = true) {
  try {
    const result = await api('get_opportunity',{ opportunityId:id }); selected = result.opportunity;
    renderList(); renderDetail();
    if (announce) status($('#global-status'),`Opened OPP-${id.slice(0,8).toUpperCase()}.`,'success');
  } catch (error) { status($('#global-status'),error.message,'error'); }
}
async function createOpportunity(event) {
  event.preventDefault();
  const payload = {
    department:$('#department').value, sourceChannel:$('#source-channel').value, sourceType:$('#source-type').value,
    needCategory:$('#need-category').value, needSummary:$('#need-summary').value,
    crmCustomerId:clean($('#crm-customer-id').value) || null,
    allowedDepartments:staff.departments.includes('*') ? departments : staff.departments
  };
  try { validateOpportunity(payload); } catch (error) { status($('#form-status'),error.message,'error'); return; }
  try {
    const result = await api('create_opportunity',payload);
    $('#opportunity-form').reset(); status($('#form-status'),'Opportunity created.','success');
    await loadQueue(); await selectOpportunity(result.opportunity.id);
  } catch (error) { status($('#form-status'),error.message,'error'); }
}
function selectedProducts() {
  return [...$('#recommendation-options').querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
}
async function presentRecommendations(context) {
  if (!selected) return;
  const productIds = selectedProducts();
  if (!productIds.length) { status($('#recommendation-status'),'Select at least one suitable product.','error'); return; }
  try {
    const result = await api('present_recommendations',{ opportunityId:selected.id, productIds, context });
    status($('#recommendation-status'),`${result.recommendations.length} recommendation(s) recorded.`, 'success');
    await loadQueue(); await selectOpportunity(selected.id,false);
  } catch (error) { status($('#recommendation-status'),error.message,'error'); }
}
async function updateRecommendation(recommendationId, nextStatus) {
  try {
    await api('set_recommendation_status',{ recommendationId,status:nextStatus });
    await loadQueue(); await selectOpportunity(selected.id,false);
  } catch (error) { status($('#global-status'),error.message,'error'); }
}
async function setStage(nextStage) {
  try {
    const result = await api('set_stage',{ opportunityId:selected.id,nextStage });
    selected = result.opportunity; await loadQueue(); await selectOpportunity(selected.id,false);
  } catch (error) { status($('#global-status'),error.message,'error'); }
}
async function scheduleFollowup(event) {
  event.preventDefault(); if (!selected) return;
  let followup;
  try {
    const rawDueAt = $('#followup-due').value;
    const parsedDueAt = new Date(rawDueAt);
    if (!rawDueAt || !Number.isFinite(parsedDueAt.getTime())) throw new Error('Choose a valid follow-up date and time.');
    followup = validateFollowUp({ purpose:$('#followup-purpose').value,dueAt:parsedDueAt.toISOString() });
  }
  catch (error) { status($('#followup-status'),error.message,'error'); return; }
  try {
    await api('schedule_followup',{ opportunityId:selected.id,...followup });
    status($('#followup-status'),'Follow-up task scheduled after consent verification. No message has been sent.','success');
    await loadQueue(); await selectOpportunity(selected.id,false);
  } catch (error) { status($('#followup-status'),error.message,'error'); }
}
async function completeFollowup(followupId) {
  try { await api('complete_followup',{ followupId }); await loadQueue(); await selectOpportunity(selected.id,false); }
  catch (error) { status($('#global-status'),error.message,'error'); }
}
function renderPortfolio() {
  const box = $('#portfolio-grid'); box.replaceChildren();
  for (const product of catalog) {
    const card = document.createElement('article'); card.className = 'portfolio-card';
    const title = document.createElement('h3'); title.textContent = product.name;
    const summary = document.createElement('p'); summary.textContent = product.summary;
    const boundary = document.createElement('small'); boundary.textContent = product.sales_boundary || 'Verify current capabilities and terms on the platform.';
    const link = document.createElement('a'); link.href = product.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Open official platform ↗';
    card.append(title,summary,boundary,link); box.append(card);
  }
}
async function start() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Supabase public configuration is missing.'); return; }
  supabase = createClient(supabaseUrl,supabaseKey,{ auth:{ persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
  supabase.auth.onAuthStateChange((_event,next) => { session = next; });
  const { data:{ session:currentSession } } = await supabase.auth.getSession(); session = currentSession;
  if (!session) { showLogin(); return; }
  try { const result = await api('whoami'); showWorkspace(session.user,result.access); await loadQueue(); }
  catch (error) { await supabase.auth.signOut(); session = null; showLogin(error.message); }
}

$('#login-form').addEventListener('submit',async event => {
  event.preventDefault();
  if (!supabase) { status($('#login-status'),'Supabase public configuration is missing.','error'); return; }
  status($('#login-status'),'Verifying staff access…');
  const { data,error } = await supabase.auth.signInWithPassword({ email:$('#staff-email').value.trim(), password:$('#staff-password').value });
  $('#staff-password').value = '';
  if (error || !data?.user) { status($('#login-status'),error?.message || 'Staff sign-in failed.','error'); return; }
  session = data.session;
  try { const result = await api('whoami'); showWorkspace(data.user,result.access); await loadQueue(); }
  catch (failure) { await supabase.auth.signOut(); session = null; showLogin(failure.message); }
});
$('#sign-out').addEventListener('click',async () => { await supabase?.auth.signOut(); session = null; staff = null; opportunities = []; selected = null; showLogin('Signed out.'); });
$('#opportunity-form').addEventListener('submit',createOpportunity);
$('#refresh').addEventListener('click',loadQueue);
$('#stage-filter').addEventListener('change',renderList);
$('#present-requested').addEventListener('click',() => presentRecommendations('customer_requested'));
$('#present-proactive').addEventListener('click',() => presentRecommendations('proactive'));
$('#followup-form').addEventListener('submit',scheduleFollowup);
(async () => { renderPortfolio(); await start(); })();
