import { createClient } from '@supabase/supabase-js';
import {
  listScenarios, getScenario, getActionLabels, createCallSession, applyAgentAction,
  holdCall, resumeCall, moveToAfterContactWork, setPracticeDisposition, completeCall, buildPracticeRecord
} from './voice-simulator-engine.js';

const $ = selector => document.querySelector(selector);
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const STORE_PREFIX = 'calloria.voice.practice.v1.';
let supabase = null;
let session = null;
let staff = null;
let practice = null;
let timerHandle = null;
let history = [];
let scoreResult = null;
const ACTION_LABELS = getActionLabels();

function setStatus(node, message, kind = '') {
  node.textContent = message || '';
  node.className = `status ${kind}`.trim();
}
function escapeText(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
function showLogin(message = '') {
  $('#login-panel').hidden = false; $('#workspace').hidden = true; $('#sign-out').hidden = true;
  setStatus($('#login-status'), message);
}
function showWorkspace(user, access) {
  staff = { id:user.id, email:user.email || 'Staff member', access };
  $('#login-panel').hidden = true; $('#workspace').hidden = false; $('#sign-out').hidden = false;
  $('#staff-name').textContent = staff.email;
  $('#staff-scope').textContent = `${access.role} · ${access.departments.includes('*') ? 'All permitted departments' : access.departments.join(', ')}`;
  history = readHistory(); renderHistory(); populateScenarios(); renderActionGrid();
}
async function verifyAgentDesk(token) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-agent-desk`, {
    method:'POST', headers:{ 'Content-Type':'application/json', apikey:supabaseKey, Authorization:`Bearer ${token}` }, body:JSON.stringify({ action:'whoami' })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access) throw new Error(result.error || 'This account is not authorised for the Agent Desk.');
  return result.access;
}
function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_PREFIX + staff.id) || '[]');
    return Array.isArray(value) ? value.slice(0,30) : [];
  } catch { return []; }
}
function saveHistory(record) {
  history.unshift(record); history = history.slice(0,30);
  try { localStorage.setItem(STORE_PREFIX + staff.id, JSON.stringify(history)); }
  catch { setStatus($('#coach-status'), 'Browser storage is unavailable. This result will not persist after this page closes.', 'error'); }
  renderHistory();
}
function populateScenarios() {
  const select = $('#scenario-select'); select.replaceChildren();
  const scenarios = listScenarios();
  const groups = [...new Set(scenarios.map(item => item.group))];
  for (const group of groups) {
    const optgroup = document.createElement('optgroup'); optgroup.label = group;
    for (const scenario of scenarios.filter(item => item.group === group)) {
      const option = document.createElement('option'); option.value = scenario.id; option.textContent = scenario.title; optgroup.append(option);
    }
    select.append(optgroup);
  }
  select.addEventListener('change', renderScenarioSummary);
  renderScenarioSummary();
}
function renderScenarioSummary() {
  const scenario = getScenario($('#scenario-select').value);
  if (!scenario) return;
  $('#scenario-summary').replaceChildren();
  for (const [label,value] of [['Department',scenario.department],['Persona',scenario.persona],['Practice objective',scenario.issue]]) {
    const span = document.createElement('span'); const b = document.createElement('b'); b.textContent = `${label}:`;
    const text = document.createElement('span'); text.textContent = value; span.append(b,text); $('#scenario-summary').append(span);
  }
}
function renderActionGrid() {
  const grid = $('#action-grid'); grid.replaceChildren();
  Object.entries(ACTION_LABELS).forEach(([key,label], index) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'action-button'; button.dataset.action = key;
    const n = document.createElement('span'); n.className = 'number'; n.textContent = String(index+1);
    const name = document.createElement('span'); name.textContent = label; button.append(n,name);
    button.addEventListener('click', () => performAction(key)); grid.append(button);
  });
  updateActionAvailability();
}
function updateActionAvailability() {
  const active = practice?.status === 'active';
  const scenario = practice ? getScenario(practice.scenarioId) : null;
  document.querySelectorAll('.action-button').forEach(button => {
    const action = button.dataset.action;
    let visible = true;
    if (action === 'requested_recommendation') visible = !!scenario?.requestedRecommendation;
    if (action === 'safety_escalate') visible = !!scenario?.crisis;
    if (action === 'safe_verify') visible = !!scenario?.needsVerification;
    button.hidden = !visible;
    button.disabled = !active;
  });
}
function formatClock(seconds) { return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function elapsedActive() {
  if (!practice) return 0;
  let now = Date.now();
  let hold = practice.totalHoldSeconds || 0;
  if (practice.status === 'on_hold' && practice.heldAt) hold += Math.max(0,Math.floor((now-practice.heldAt)/1000));
  return Math.max(0,Math.floor((now-practice.startedAt)/1000)-hold);
}
function updateTimer() { $('#call-timer').textContent = formatClock(elapsedActive()); }
function startTimer() { stopTimer(); timerHandle = setInterval(updateTimer,1000); updateTimer(); }
function stopTimer() { if (timerHandle) clearInterval(timerHandle); timerHandle = null; }
function setCallState() {
  const state = practice?.status || 'idle';
  const chip = $('#call-status'); chip.className = `state-chip ${state === 'active' ? 'active' : state === 'on_hold' ? 'hold' : state === 'after_contact_work' ? 'acw' : state === 'completed' ? 'done' : 'idle'}`;
  chip.textContent = state.replaceAll('_',' ');
  $('#hold-call').disabled = state !== 'active'; $('#resume-call').disabled = state !== 'on_hold';
  $('#finish-call').disabled = state !== 'active'; $('#listen-customer').disabled = !practice || !practice.messages.some(message => message.speaker === 'customer');
  updateActionAvailability(); updateTimer();
}
function renderConversation() {
  const box = $('#conversation'); box.replaceChildren();
  if (!practice?.messages.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'The customer conversation will appear here.'; box.append(empty); return; }
  for (const message of practice.messages) {
    const article = document.createElement('article'); article.className = `message ${message.speaker}`;
    const meta = document.createElement('span'); meta.className = 'message-meta'; meta.textContent = message.speaker === 'customer' ? 'Customer' : message.speaker === 'agent' ? 'Agent action' : 'CALLORIA coach';
    const text = document.createElement('span'); text.textContent = message.text; article.append(meta,text); box.append(article);
  }
  box.scrollTop = box.scrollHeight;
}
function renderCaller() {
  const scenario = practice ? getScenario(practice.scenarioId) : null;
  $('#call-title').textContent = scenario ? scenario.title : 'No active call';
  $('#call-subtitle').textContent = scenario ? `${(practice?.direction || 'inbound').toUpperCase()} PRACTICE · ${scenario.department} · ${scenario.platform}` : 'Choose a scenario to begin.';
  $('#caller-name').textContent = scenario ? 'Simulated customer' : 'Synthetic customer';
  $('#caller-persona').textContent = scenario?.persona || 'Persona appears when a call starts';
  $('#caller-platform').textContent = scenario?.platform || 'General enquiry';
  $('#caller-emotion').textContent = practice?.currentEmotion || scenario?.emotion || '—';
  $('#caller-avatar').textContent = scenario ? scenario.persona.split(/\s+/).map(part => part[0]).slice(0,2).join('').toUpperCase() : '?';
}
function startPractice() {
  if (practice && ['active','on_hold','after_contact_work'].includes(practice.status)) { setStatus($('#coach-status'),'Complete the current practice call before starting another scenario.','error'); return; }
  try {
    practice = createCallSession($('#scenario-select').value);
    $('#acw-panel').hidden = true; $('#score-panel').hidden = true; $('#acw-form').reset();
    setStatus($('#coach-status'),'Scenario started. Greet the customer and establish why they called.','success');
    renderCaller(); renderConversation(); setCallState(); startTimer();
  } catch (error) { setStatus($('#coach-status'),error.message,'error'); }
}
function performAction(action) {
  if (!practice || practice.status !== 'active') return;
  const phrase = $('#agent-wording').value.trim();
  try {
    const result = applyAgentAction(practice,action,phrase);
    $('#agent-wording').value = '';
    renderConversation(); renderCaller(); setCallState();
    const critical = practice.criticalFailures.length > 0;
    setStatus($('#coach-status'),critical ? 'A quality gate has been triggered. Review the coach message in the conversation.' : `${ACTION_LABELS[action]} recorded.`,critical ? 'error' : 'success');
    if (action === 'close') setStatus($('#coach-status'),'Closing statement recorded. Finish the practice call when ready.');
  } catch (error) { setStatus($('#coach-status'),error.message,'error'); }
}
function playLatestCustomer() {
  if (!window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
    setStatus($('#coach-status'),'Text-to-speech is not supported by this browser. The customer transcript remains available on screen.'); return;
  }
  const last = [...practice.messages].reverse().find(message => message.speaker === 'customer');
  if (!last) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(last.text);
  utterance.lang = getScenario(practice.scenarioId)?.language || 'en-NG'; utterance.rate = 0.94; utterance.pitch = 1.0;
  const voices = window.speechSynthesis.getVoices();
  const wanted = utterance.lang.toLowerCase();
  const preferred = voices.find(voice => voice.lang.toLowerCase() === wanted) || voices.find(voice => voice.lang.toLowerCase().startsWith(wanted.split('-')[0]));
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}
function finishCall() {
  if (!practice || practice.status !== 'active') return;
  const disposition = practice.safetyEscalated ? 'safeguarding_escalation' : practice.specialistTransfer ? 'specialist_referral' : practice.guidanceGiven ? 'resolved' : 'unresolved';
  try {
    moveToAfterContactWork(practice,disposition);
    stopTimer(); $('#disposition').value = disposition; $('#acw-panel').hidden = false; $('#acw-panel').scrollIntoView({behavior:'smooth',block:'start'});
    setCallState(); setStatus($('#acw-status'),'Complete the outcome summary. Do not record a transcript or sensitive personal details.');
  } catch (error) { setStatus($('#coach-status'),error.message,'error'); }
}
function renderScore(score, scenarioTitle) {
  $('#score-panel').hidden = false; $('#score-panel').scrollIntoView({behavior:'smooth',block:'start'});
  $('#score-title').textContent = `${scenarioTitle} · Review`;
  $('#score-subtitle').textContent = `${score.elapsedSeconds}s active handling · ${score.holdSeconds}s on hold · no speed penalty applied.`;
  $('#score-value').textContent = `${score.score}`; $('#score-value').className = `score-value ${score.passed ? '' : 'fail'}`;
  $('#score-gate').textContent = score.passed ? 'QUALITY GATES PASSED · Practice result only' : score.gateFailed ? 'CRITICAL QUALITY GATE FAILED · This session cannot pass' : 'PRACTICE STANDARD NOT YET MET · Review the missing competencies';
  $('#score-gate').className = `gate-status ${score.passed ? '' : 'fail'}`;
  const criteria = $('#score-criteria'); criteria.replaceChildren();
  for (const item of score.criteria) {
    const row = document.createElement('div'); row.className = 'criterion';
    const label = document.createElement('span'); label.textContent = `${item.label} · ${item.weight}%`;
    const value = document.createElement('b'); value.className = item.passed ? 'pass' : 'miss'; value.textContent = item.passed ? 'Met' : 'Needs work'; row.append(label,value); criteria.append(row);
  }
  const recommendations = $('#score-recommendations'); recommendations.replaceChildren();
  const heading = document.createElement('strong'); heading.textContent = 'Development points: '; recommendations.append(heading);
  const text = document.createElement('span'); text.textContent = score.recommendations.length ? score.recommendations.join(' · ') : 'No rubric gaps detected in this practice session.'; recommendations.append(text);
}
function completePractice(event) {
  event.preventDefault(); if (!practice) return;
  const summary = $('#practice-summary').value;
  try {
    setPracticeDisposition(practice,$('#disposition').value);
    const result = completeCall(practice,summary);
    scoreResult = result.score;
    const scenarioTitle = getScenario(practice.scenarioId).title;
    const record = buildPracticeRecord(practice,result.score);
    saveHistory(record);
    $('#acw-panel').hidden = true; $('#score-panel').hidden = false;
    renderScore(result.score,scenarioTitle); setCallState(); stopTimer();
    $('#listen-customer').disabled = true; $('#finish-call').disabled = true;
    setStatus($('#coach-status'),'Practice completed. This result is not an official employment KPI.','success');
  } catch (error) { setStatus($('#acw-status'),error.message,'error'); }
}
function renderHistory() {
  const box = $('#history-list'); box.replaceChildren();
  if (!history.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No completed practice sessions yet.'; box.append(empty); return; }
  for (const record of history.slice(0,15)) {
    const row = document.createElement('div'); row.className = 'history-row';
    const title = document.createElement('div'); const strong = document.createElement('strong'); strong.textContent = record.scenarioTitle;
    const small = document.createElement('small'); small.textContent = `${record.platform} · ${new Date(record.completedAt).toLocaleString()}`; title.append(strong,small);
    const score = document.createElement('b'); score.className = `history-score ${record.passed ? '' : 'fail'}`; score.textContent = `${record.score}/100`;
    const outcome = document.createElement('span'); outcome.className = 'history-outcome'; outcome.textContent = record.passed ? 'Passed' : record.gateFailed ? 'Gate failed' : 'More practice';
    row.append(title,score,outcome); box.append(row);
  }
}
async function initialise() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Public Supabase configuration is missing. Configure VITE_SUPABASE_URL and the anon/publishable key.'); return; }
  supabase = createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session:current}} = await supabase.auth.getSession(); session = current;
  if (!session) { showLogin(); return; }
  try { const access = await verifyAgentDesk(session.access_token); showWorkspace(session.user,access); }
  catch (error) { await supabase.auth.signOut(); session=null; showLogin(error.message); }
}
$('#login-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(!supabase){setStatus($('#login-status'),'Supabase configuration is unavailable.','error');return;}
  setStatus($('#login-status'),'Verifying staff access…');
  const email=$('#staff-email').value.trim(), password=$('#staff-password').value;
  const {data,error}=await supabase.auth.signInWithPassword({email,password}); $('#staff-password').value='';
  if(error||!data.user){setStatus($('#login-status'),error?.message||'Sign-in failed.','error');return;}
  session=data.session;
  try{const access=await verifyAgentDesk(session.access_token);showWorkspace(data.user,access);}
  catch(failure){await supabase.auth.signOut();session=null;showLogin(failure.message);}
});
$('#sign-out').addEventListener('click',async()=>{stopTimer();if(window.speechSynthesis)window.speechSynthesis.cancel();await supabase?.auth.signOut();session=null;staff=null;practice=null;showLogin('Signed out.');});
$('#start-call').addEventListener('click',startPractice);
$('#listen-customer').addEventListener('click',playLatestCustomer);
$('#hold-call').addEventListener('click',()=>{try{holdCall(practice);setCallState();setStatus($('#coach-status'),'Practice customer placed on hold. Hold time is excluded from active handling time.');}catch(error){setStatus($('#coach-status'),error.message,'error');}});
$('#resume-call').addEventListener('click',()=>{try{resumeCall(practice);setCallState();setStatus($('#coach-status'),'Practice customer resumed.');}catch(error){setStatus($('#coach-status'),error.message,'error');}});
$('#finish-call').addEventListener('click',finishCall);
$('#acw-form').addEventListener('submit',completePractice);
$('#new-scenario').addEventListener('click',()=>{practice=null;scoreResult=null;$('#score-panel').hidden=true;$('#acw-panel').hidden=true;$('#conversation').replaceChildren();$('#call-title').textContent='No active call';$('#call-subtitle').textContent='Choose a scenario to begin.';$('#caller-name').textContent='Synthetic customer';$('#caller-persona').textContent='Persona appears when a call starts';$('#caller-platform').textContent='General enquiry';$('#caller-emotion').textContent='—';$('#caller-avatar').textContent='?';$('#call-status').textContent='Ready';$('#call-status').className='state-chip idle';$('#call-timer').textContent='00:00';setCallState();window.scrollTo({top:0,behavior:'smooth'});});
$('#clear-history').addEventListener('click',()=>{if(!staff)return;if(!window.confirm('Clear this browser profile’s local practice history?'))return;history=[];localStorage.removeItem(STORE_PREFIX+staff.id);renderHistory();});
(async()=>{try{await initialise();}catch(error){showLogin(error.message||'Unable to initialise the practice studio.');}})();
