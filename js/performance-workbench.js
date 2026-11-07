import { createClient } from '@supabase/supabase-js';
import {
  PERFORMANCE_PROFILES, QA_RUBRIC, evaluateQaReview, evaluateScorecard, nextCareerTarget
} from './performance-engine.js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const $ = selector => document.querySelector(selector);
let supabase = null; let session = null; let access = null; let directory = [];
let dashboard = null; let currentScorecard = null; let activeExam = null; let examTimer = null;
const $id = id => document.getElementById(id);

function setStatus(node, message, type = '') { if (!node) return; node.textContent = message || ''; node.className = `perf-status ${type}`.trim(); }
function shortId(value) { return String(value || '').slice(0, 8).toUpperCase(); }
function roleLabel(value) { return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; }
function fmtMonth(value) { return value ? new Intl.DateTimeFormat(undefined, { month:'long', year:'numeric', timeZone:'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—'; }
function fmtDate(value) { return value ? new Intl.DateTimeFormat(undefined, { dateStyle:'medium' }).format(new Date(value)) : '—'; }
function visibleDepartments() { return access?.departments?.includes('*') ? [
  'RuffNeck Products and Platform Support','Sales and Service Enquiries','Complaints and Service Recovery',
  'Personal Development and Wellbeing Information','General Customer Care','Email and Written Support',
  'Social Media Support','Technical Support and IT','Quality Assurance and Customer Experience',
  'Safeguarding and Trained Human Support','Learning and Career Development'
] : (access?.departments || []); }
function isManager() { return ['supervisor','people_admin'].includes(access?.role); }
function canQa() { return ['supervisor','people_admin','qa'].includes(access?.role); }
function setSelect(select, entries, emptyLabel = 'Select') {
  select.replaceChildren();
  const empty = document.createElement('option'); empty.value = ''; empty.textContent = emptyLabel; select.append(empty);
  for (const item of entries) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; select.append(option); }
}

async function api(action, payload = {}) {
  if (!supabase || !session?.access_token) throw new Error('Your staff session has expired. Sign in again.');
  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/functions/v1/calloria-performance`, {
    method: 'POST', headers: { 'Content-Type':'application/json', apikey:supabaseKey, Authorization:`Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Performance request failed (${response.status}).`);
  return body;
}

function renderCareer() {
  const next = nextCareerTarget(access.jobProfile, access.careerTitle);
  const targets = next ? [next] : [];
  setSelect($id('perf-target-role'), targets.map(role => ({ value:role, label:roleLabel(role) })), targets.length ? 'Select next role' : 'Top of current career ladder');
  $id('perf-current-role').textContent = `${roleLabel(access.careerTitle)} · ${roleLabel(access.jobProfile)} profile`;
  $id('perf-eligibility-reason').textContent = dashboard?.eligibility?.reason || 'Eligibility is being calculated.';
  $id('perf-start-exam').disabled = !dashboard?.eligibility?.eligible || !targets.length;
  const box = $id('perf-exam-history'); box.replaceChildren();
  const attempts = dashboard?.exams || [];
  if (!attempts.length) { const p = document.createElement('p'); p.className='empty'; p.textContent='No promotion exam attempts recorded.'; box.append(p); return; }
  for (const item of attempts) {
    const chip = document.createElement('div'); chip.className='exam-chip';
    chip.textContent = `${roleLabel(item.target_role)} · Attempt ${item.attempt_no}/3 · ${item.exam_year} · ${item.status === 'in_progress' ? 'In progress' : item.passed ? `Passed ${item.score}%` : item.status === 'expired' ? 'Expired' : `Not passed ${item.score ?? '—'}%`}`;
    box.append(chip);
  }
}

function renderDashboard() {
  const cards = dashboard?.scorecards || [];
  const reviewed = cards.filter(x => x.status === 'reviewed');
  const latest = reviewed[0];
  $id('perf-metric-score').textContent = latest?.score == null ? '—' : `${latest.score}%`;
  $id('perf-metric-reviewed').textContent = reviewed.length;
  $id('perf-metric-coaching').textContent = (dashboard?.coaching || []).filter(x => ['open','in_progress'].includes(x.status)).length;
  $id('perf-metric-ready').textContent = dashboard?.eligibility?.eligible ? 'KPI gates met' : 'Not yet';
  const body = $id('perf-my-scorecards'); body.replaceChildren();
  if (!cards.length) { const row = body.insertRow(); const cell = row.insertCell(); cell.colSpan=5; cell.textContent='No monthly scorecards recorded yet.'; }
  for (const item of cards) {
    const row=body.insertRow();
    [fmtMonth(item.period_start), roleLabel(item.job_profile), item.score == null ? '—' : `${item.score}%`, roleLabel(item.rating), item.status].forEach(v=>{row.insertCell().textContent=v;});
  }
  const reviewBox = $id('perf-my-reviews'); reviewBox.replaceChildren();
  const reviews = dashboard?.reviews || [];
  if (!reviews.length) { const p=document.createElement('p'); p.className='empty'; p.textContent='Manager feedback will appear here after a review.'; reviewBox.append(p); }
  for (const item of reviews) {
    const card=document.createElement('article'); card.className='review-item';
    const title=document.createElement('h3'); title.textContent=`Review · ${fmtDate(item.created_at)}`;
    const strengths=document.createElement('p'); strengths.textContent=`Strengths: ${item.strengths}`;
    const improvements=document.createElement('p'); improvements.textContent=`Development: ${item.improvement_areas}`;
    card.append(title,strengths,improvements);
    if (item.employee_response) { const response=document.createElement('p'); response.textContent=`Your response: ${item.employee_response}`; card.append(response); }
    else {
      const textarea=document.createElement('textarea'); textarea.rows=2; textarea.maxLength=2000; textarea.placeholder='Your response or acknowledgement';
      const button=document.createElement('button'); button.type='button'; button.className='perf-button outline small-button'; button.textContent='Submit response';
      button.addEventListener('click',async()=>{button.disabled=true;try{await api('respond_to_review',{reviewId:item.id,employeeResponse:textarea.value});await refreshDashboard();}catch(error){button.disabled=false;window.alert(error.message);}});
      card.append(textarea,button);
    }
    reviewBox.append(card);
  }
  const coachingBox = $id('perf-my-coaching'); coachingBox.replaceChildren();
  const actions = dashboard?.coaching || [];
  if (!actions.length) { const p=document.createElement('p'); p.className='empty'; p.textContent='No coaching actions recorded.'; coachingBox.append(p); }
  for (const action of actions) {
    const card=document.createElement('article'); card.className='coaching-item';
    const title=document.createElement('strong'); title.textContent=`${roleLabel(action.status)} · Due ${fmtDate(action.due_date)}`;
    const desc=document.createElement('p'); desc.textContent=action.action_plan;
    card.append(title,desc);
    if (action.status === 'open' || action.status === 'in_progress') {
      const button=document.createElement('button'); button.className='perf-button outline small-button'; button.type='button'; button.textContent=action.status === 'open' ? 'Mark in progress' : 'Mark completed';
      button.addEventListener('click', async()=>{
        button.disabled=true;
        try { await api('update_coaching',{coachingId:action.id,status:action.status === 'open' ? 'in_progress':'completed',completionNote:action.status === 'in_progress' ? 'Staff marked action completed.' : ''}); await refreshDashboard(); }
        catch(error){button.disabled=false;window.alert(error.message);}
      }); card.append(button);
    }
    coachingBox.append(card);
  }
  renderCareer();
}

async function refreshDashboard() { dashboard = await api('my_dashboard'); renderDashboard(); }

function populateStaffSelects() {
  const options = directory.map(person => ({ value:person.userId, label:`Staff ${shortId(person.userId)} · ${roleLabel(person.careerTitle)} · ${roleLabel(person.jobProfile)} profile` }));
  for (const id of ['perf-staff-select','perf-qa-staff','perf-coaching-staff']) setSelect($id(id), options, 'Select staff member');
  const deptOptions = visibleDepartments().map(x=>({value:x,label:x}));
  setSelect($id('perf-department'), [{value:'all',label:'All permitted departments'},...deptOptions], 'Select department');
  setSelect($id('perf-qa-department'), deptOptions, 'Select department');
}

async function loadTeam() {
  const start = `${$id('perf-month').value || monthStart().slice(0,7)}-01`;
  const department = $id('perf-department').value || 'all';
  setStatus($id('perf-team-status'),'Loading scorecards…');
  const result = await api('team_snapshot',{periodStart:start,department});
  const rows = $id('perf-team-rows'); rows.replaceChildren();
  if (!result.scorecards.length) { const row=rows.insertRow(); const cell=row.insertCell(); cell.colSpan=7; cell.textContent='No scorecards exist for this month and department.'; }
  for (const card of result.scorecards) {
    const row=rows.insertRow();
    const vals=[`Staff ${shortId(card.staff_user_id)}`,card.department,roleLabel(card.job_profile),card.score == null ? '—' : `${card.score}%`,card.gate_pass && !card.critical_fail ? 'Passed' : 'Failed',roleLabel(card.status)];
    vals.forEach((value,index)=>{
      const cell=row.insertCell(); cell.textContent=value;
      if (index===4) { const chip=document.createElement('span'); chip.className=`status-chip ${card.gate_pass && !card.critical_fail ? 'good':'bad'}`; chip.textContent=value; cell.replaceChildren(chip); }
    });
    const actionCell=row.insertCell();
    if (card.status === 'submitted' && card.staff_user_id !== session.user.id && isManager()) {
      const button=document.createElement('button'); button.type='button'; button.className='perf-button outline small-button'; button.textContent='Review';
      button.addEventListener('click',()=>openReview(card)); actionCell.append(button);
    } else actionCell.textContent='—';
  }
  setStatus($id('perf-team-status'),`Loaded ${result.scorecards.length} monthly scorecard(s).`,'success');
  populateStaffSelects();
}

function selectedStaff() { return directory.find(x=>x.userId === $id('perf-staff-select').value) || null; }
function scorecardDepartment(person) {
  const chosen=$id('perf-department').value;
  if (chosen && chosen !== 'all' && person.departments.includes(chosen)) return chosen;
  return person.departments.find(x=>visibleDepartments().includes(x)) || visibleDepartments()[0] || '';
}
function buildMetricFields(profileId) {
  const box=$id('perf-kpi-fields'); box.replaceChildren();
  for (const [id,label,weight,gate] of PERFORMANCE_PROFILES[profileId].metrics) {
    const card=document.createElement('article'); card.className='kpi-item';
    const title=document.createElement('h3'); title.textContent=`${label} · ${weight}% weight${gate ? ` · gate ≥${gate}`:''}`;
    const inputs=document.createElement('div'); inputs.className='kpi-inputs';
    const scoreLabel=document.createElement('label'); scoreLabel.textContent='Score / 100'; const score=document.createElement('input'); score.type='number'; score.min='0'; score.max='100'; score.step='0.1'; score.required=true; score.dataset.metric=id; score.dataset.field='score'; score.placeholder='0–100'; scoreLabel.append(score);
    const countLabel=document.createElement('label'); countLabel.textContent='Samples'; const count=document.createElement('input'); count.type='number'; count.min='1'; count.step='1'; count.required=true; count.dataset.metric=id; count.dataset.field='sampleCount'; count.placeholder='Count'; countLabel.append(count);
    const sourceLabel=document.createElement('label'); sourceLabel.textContent='Evidence source'; const source=document.createElement('input'); source.type='text'; source.maxLength=160; source.required=true; source.dataset.metric=id; source.dataset.field='source'; source.placeholder='Approved report / QA sample'; sourceLabel.append(source);
    inputs.append(scoreLabel,countLabel,sourceLabel); card.append(title,inputs); box.append(card);
  }
  box.querySelectorAll('input').forEach(input=>input.addEventListener('input',previewScorecard));
  previewScorecard();
}
function collectMetricValues() {
  const values={};
  $id('perf-kpi-fields').querySelectorAll('input[data-metric]').forEach(input=>{
    const id=input.dataset.metric; values[id] ||= {}; values[id][input.dataset.field]=input.value;
  });
  for (const value of Object.values(values)) if (value.score !== '') value.score=Number(value.score);
  return values;
}
function previewScorecard() {
  const profileId=$id('perf-scorecard-dialog').dataset.profile;
  if (!profileId) return;
  $id('perf-score-critical-reason-wrap').hidden=!$id('perf-score-critical').checked;
  try {
    const result=evaluateScorecard(profileId,collectMetricValues(),{criticalFail:$id('perf-score-critical').checked});
    $id('perf-score-preview').textContent=result.complete ? `${result.score}%` : 'Incomplete';
    $id('perf-score-gates').textContent=result.complete ? (result.gatePass ? `All gates passed · ${roleLabel(result.rating)}` : `Gate failure: ${result.failedGates.map(x=>x.label).join(', ') || 'Critical incident'}`) : `${result.missing.length} KPI measure(s) still need score, sample count and source.`;
  } catch(error) { $id('perf-score-preview').textContent='Check values'; $id('perf-score-gates').textContent=error.message; }
}

function openScorecard() {
  const person=selectedStaff(); if (!person) { setStatus($id('perf-team-status'),'Select a staff member first.','error'); return; }
  const department=scorecardDepartment(person); if (!department) { setStatus($id('perf-team-status'),'The selected staff member has no matching department grant.','error'); return; }
  const periodStart=`${$id('perf-month').value || monthStart().slice(0,7)}-01`;
  $id('perf-scorecard-dialog').dataset.staff=person.userId;
  $id('perf-scorecard-dialog').dataset.department=department;
  $id('perf-scorecard-dialog').dataset.profile=person.jobProfile;
  $id('perf-scorecard-person').textContent=`Staff ${shortId(person.userId)}`;
  $id('perf-scorecard-role').textContent=`${roleLabel(person.careerTitle)} · ${roleLabel(person.jobProfile)} profile`;
  $id('perf-scorecard-period').textContent=fmtMonth(periodStart);
  $id('perf-scorecard-form').reset();
  $id('perf-score-critical-reason-wrap').hidden=true;
  buildMetricFields(person.jobProfile);
  $id('perf-scorecard-dialog').showModal();
}

function openReview(card) {
  currentScorecard=card;
  $id('perf-review-context').textContent=`Staff ${shortId(card.staff_user_id)} · ${card.department} · ${fmtMonth(card.period_start)} · ${card.score}% · Gates ${card.gate_pass && !card.critical_fail ? 'passed':'failed'}`;
  const details=$id('perf-review-details'); details.replaceChildren();
  const evidence=document.createElement('p'); evidence.textContent=`Evidence: ${card.evidence_summary || 'No evidence summary recorded.'}`; details.append(evidence);
  const list=document.createElement('ul');
  const metricValues=card.metric_values || {};
  for(const [key,item] of Object.entries(metricValues)) { const li=document.createElement('li'); li.textContent=`${roleLabel(key)}: ${item.score}/100 · ${item.sampleCount} samples · ${item.source}`; list.append(li); }
  details.append(list);
  if(card.critical_fail) { const critical=document.createElement('p'); critical.textContent=`Critical failure: ${card.critical_reason || 'No reason entered.'}`; details.append(critical); }
  $id('perf-review-form').reset(); setStatus($id('perf-review-status'),''); $id('perf-review-dialog').showModal();
}

function buildQaRubric() {
  const box=$id('perf-qa-rubric'); box.replaceChildren();
  for (const item of QA_RUBRIC) {
    const card=document.createElement('article'); card.className='rubric-item';
    const title=document.createElement('strong'); title.textContent=`${item.label} · ${item.weight}%${item.gate ? ` · minimum ${item.gate}`:''}`;
    const label=document.createElement('label'); label.textContent='Evaluation score / 100'; const input=document.createElement('input'); input.type='number'; input.min='0'; input.max='100'; input.step='1'; input.required=true; input.dataset.rubric=item.id; label.append(input); card.append(title,label); box.append(card);
  }
}

function renderExam(questions, attempt) {
  activeExam=attempt; $id('perf-exam-title').textContent=`Assessment for ${roleLabel(attempt.targetRole)}`;
  const box=$id('perf-exam-questions'); box.replaceChildren();
  for (const [index,question] of questions.entries()) {
    const card=document.createElement('article'); card.className='exam-question';
    const topic=document.createElement('span'); topic.className='topic'; topic.textContent=`Question ${index+1} · ${question.topic}`;
    const prompt=document.createElement('h3'); prompt.textContent=question.prompt; card.append(topic,prompt);
    for (const option of question.options) {
      const label=document.createElement('label'); label.className='exam-option';
      const input=document.createElement('input'); input.type='radio'; input.name=question.id; input.value=option.key;
      const text=document.createElement('span'); text.textContent=`${option.key}. ${option.text}`; label.append(input,text); card.append(label);
    }
    box.append(card);
  }
  $id('perf-exam-overlay').hidden=false;
  const expires=new Date(attempt.expiresAt).getTime();
  clearInterval(examTimer);
  const tick=()=>{
    const seconds=Math.max(0,Math.ceil((expires-Date.now())/1000));
    $id('perf-exam-countdown').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    if (seconds===0) { clearInterval(examTimer); submitExam(true); }
  };
  tick(); examTimer=setInterval(tick,1000);
}

async function submitExam(auto=false) {
  if (!activeExam) return;
  const answers={};
  for (const input of $id('perf-exam-form').querySelectorAll('input[type=radio]:checked')) answers[input.name]=input.value;
  const submit=$id('perf-exam-form').querySelector('button[type=submit]'); if (submit) submit.disabled=true;
  setStatus($id('perf-exam-status'),auto ? 'Time reached. Submitting recorded answers…':'Submitting final answers…');
  try {
    const result=await api('submit_exam',{attemptId:activeExam.id,answers});
    clearInterval(examTimer); activeExam=null;
    $id('perf-exam-questions').replaceChildren();
    setStatus($id('perf-exam-status'),`${result.result.passed ? 'PASSED':'NOT PASSED'} · ${result.result.score}% · ${result.correct}/${result.total} correct. ${result.note}`,result.result.passed?'success':'error');
    const close=document.createElement('button'); close.type='button'; close.className='perf-button outline'; close.textContent='Close assessment'; close.addEventListener('click',()=>{$id('perf-exam-overlay').hidden=true;});
    $id('perf-exam-status').after(close);
    await refreshDashboard();
  } catch(error) {
    setStatus($id('perf-exam-status'),error.message,'error');
    if (submit) submit.disabled=false;
    if (auto) { activeExam=null; clearInterval(examTimer); }
  }
}

async function loadWorkspace(user, response) {
  access=response.access; directory=response.directory || [];
  $id('perf-login').hidden=true; $id('perf-app').hidden=false; $id('perf-sign-out').hidden=false;
  $id('perf-staff-label').textContent=user.email || `Staff ${shortId(user.id)}`;
  $id('perf-staff-scope').textContent=`${roleLabel(access.role)} · ${access.departments.includes('*') ? 'All departments':access.departments.join(', ')}`;
  $id('perf-manager-panel').hidden=!isManager(); $id('perf-qa-panel').hidden=!canQa();
  $id('perf-month').value=monthStart().slice(0,7);
  renderCareer(); populateStaffSelects(); buildQaRubric();
  await refreshDashboard();
  if (canQa()) await loadTeam();
}
function showLogin(message='') { $id('perf-login').hidden=false; $id('perf-app').hidden=true; $id('perf-sign-out').hidden=true; setStatus($id('perf-login-status'),message); }
async function start() {
  if (!supabaseUrl || !supabaseKey) { showLogin('Public Supabase configuration is missing.'); return; }
  supabase=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const {data:{session:current}}=await supabase.auth.getSession(); session=current;
  if (!session) { showLogin(); return; }
  try { const who=await api('whoami'); await loadWorkspace(session.user,who); }
  catch(error) { await supabase.auth.signOut(); session=null; showLogin(error.message); }
}

$id('perf-login-form').addEventListener('submit',async event=>{
  event.preventDefault(); if (!supabase) return setStatus($id('perf-login-status'),'Supabase public configuration is missing.','error');
  setStatus($id('perf-login-status'),'Verifying staff access…');
  const {data,error}=await supabase.auth.signInWithPassword({email:$id('perf-email').value.trim(),password:$id('perf-password').value});
  $id('perf-password').value='';
  if (error || !data.user) return setStatus($id('perf-login-status'),error?.message || 'Staff sign-in failed.','error');
  session=data.session;
  try { await loadWorkspace(data.user,await api('whoami')); }
  catch(failure) { await supabase.auth.signOut(); session=null; showLogin(failure.message); }
});
$id('perf-sign-out').addEventListener('click',async()=>{clearInterval(examTimer); await supabase?.auth.signOut(); session=null; access=null; directory=[]; dashboard=null; showLogin('Signed out.');});
$id('perf-refresh').addEventListener('click',async()=>{try{await refreshDashboard();if(canQa())await loadTeam();}catch(error){window.alert(error.message);}});
$id('perf-load-team').addEventListener('click',()=>loadTeam().catch(error=>setStatus($id('perf-team-status'),error.message,'error')));
$id('perf-month').addEventListener('change',()=>loadTeam().catch(error=>setStatus($id('perf-team-status'),error.message,'error')));
$id('perf-department').addEventListener('change',()=>loadTeam().catch(error=>setStatus($id('perf-team-status'),error.message,'error')));
$id('perf-open-scorecard').addEventListener('click',openScorecard);
$id('perf-score-critical').addEventListener('change',previewScorecard);
$id('perf-scorecard-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const dialog=$id('perf-scorecard-dialog');
  try {
    const evaluation=evaluateScorecard(dialog.dataset.profile,collectMetricValues(),{criticalFail:$id('perf-score-critical').checked});
    if (!evaluation.complete) throw new Error(`Complete all required KPI measures: ${evaluation.missing.join(', ')}.`);
    if ($id('perf-evidence-summary').value.trim().length<12) throw new Error('Add a verifiable evidence summary.');
    if ($id('perf-score-critical').checked && $id('perf-score-critical-reason').value.trim().length<8) throw new Error('A specific critical-failure reason is required.');
    const result=await api('save_scorecard',{staffUserId:dialog.dataset.staff,department:dialog.dataset.department,jobProfile:dialog.dataset.profile,periodStart:`${$id('perf-month').value}-01`,metricValues:collectMetricValues(),criticalFail:$id('perf-score-critical').checked,criticalReason:$id('perf-score-critical-reason').value,evidenceSummary:$id('perf-evidence-summary').value});
    dialog.close(); setStatus($id('perf-team-status'),`Scorecard submitted. Calculated score ${result.evaluation.score}%. ${result.evaluation.gatePass?'All gates passed.':'A gate failed; coaching and eligibility controls apply.'}`,'success');
    await loadTeam(); if(dialog.dataset.staff===session.user.id) await refreshDashboard();
  } catch(error) { setStatus($id('perf-scorecard-status'),error.message,'error'); }
});
$id('perf-review-form').addEventListener('submit',async event=>{
  event.preventDefault(); if(!currentScorecard)return;
  try { await api('review_scorecard',{scorecardId:currentScorecard.id,strengths:$id('perf-review-strengths').value,improvementAreas:$id('perf-review-improvements').value}); $id('perf-review-dialog').close(); currentScorecard=null; await loadTeam(); await refreshDashboard(); setStatus($id('perf-team-status'),'Monthly review finalised.','success'); }
  catch(error){setStatus($id('perf-review-status'),error.message,'error');}
});
$id('perf-qa-critical').addEventListener('change',()=>{$id('perf-qa-critical-reason-wrap').hidden=!$id('perf-qa-critical').checked;});
$id('perf-qa-form').addEventListener('submit',async event=>{
  event.preventDefault();
  const rubricValues={}; $id('perf-qa-rubric').querySelectorAll('input[data-rubric]').forEach(input=>{rubricValues[input.dataset.rubric]=input.value===''?'':Number(input.value);});
  try {
    const evaluation=evaluateQaReview(rubricValues,{criticalFail:$id('perf-qa-critical').checked});
    if(!evaluation.complete)throw new Error(`Complete each rubric section: ${evaluation.missing.join(', ')}.`);
    if(evaluation.criticalFail && $id('perf-qa-critical-reason').value.trim().length<8)throw new Error('A specific reason is required for a critical failure.');
    const result=await api('save_qa_review',{staffUserId:$id('perf-qa-staff').value,department:$id('perf-qa-department').value,channel:$id('perf-qa-channel').value,interactionRef:$id('perf-qa-reference').value,rubricValues,criticalFail:$id('perf-qa-critical').checked,criticalReason:$id('perf-qa-critical-reason').value,evaluatorNotes:$id('perf-qa-notes').value});
    setStatus($id('perf-qa-status'),`QA evaluation saved: ${result.evaluation.result.toUpperCase()} · ${result.evaluation.score}%.` ,result.evaluation.passed?'success':'error');
    $id('perf-qa-form').reset(); $id('perf-qa-critical-reason-wrap').hidden=true; buildQaRubric();
  } catch(error){setStatus($id('perf-qa-status'),error.message,'error');}
});
$id('perf-coaching-form').addEventListener('submit',async event=>{
  event.preventDefault(); const person=directory.find(x=>x.userId===$id('perf-coaching-staff').value);
  if(!person)return setStatus($id('perf-coaching-status'),'Select a staff member.','error');
  const department=person.departments.find(x=>visibleDepartments().includes(x)) || visibleDepartments()[0];
  try {await api('add_coaching',{staffUserId:person.userId,department,actionPlan:$id('perf-coaching-plan').value,dueDate:$id('perf-coaching-due').value || null});$id('perf-coaching-form').reset();setStatus($id('perf-coaching-status'),'Coaching action assigned.','success');await refreshDashboard();}
  catch(error){setStatus($id('perf-coaching-status'),error.message,'error');}
});
$id('perf-start-exam').addEventListener('click',async()=>{
  const targetRole=$id('perf-target-role').value;if(!targetRole)return setStatus($id('perf-eligibility-reason'),'Select an approved promotion target.','error');
  $id('perf-start-exam').disabled=true;
  try {const result=await api('start_exam',{targetRole});renderExam(result.questions,result.attempt);}
  catch(error){setStatus($id('perf-eligibility-reason'),error.message,'error');$id('perf-start-exam').disabled=false;}
});
$id('perf-exam-form').addEventListener('submit',event=>{event.preventDefault();submitExam(false);});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>document.getElementById(button.dataset.close).close()));

(async()=>{try{await start();}catch(error){showLogin(error.message || 'Performance Centre could not start.');}})();
