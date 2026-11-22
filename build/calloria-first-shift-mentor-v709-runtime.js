/* CALLORIA v7.09 runtime bridge. This text is injected into the transformed main.js module. */
const CALLORIA_FIRST_SHIFT_MENTOR_NAME = 'Miriam Okafor (simulated mentor)';
function calloriaMentorCurrentRecord() {
  return state?.onboarding?.firstWorkingShift || null;
}
function calloriaMentorSetRecord(record) {
  if (!state.onboarding || typeof state.onboarding !== 'object') state.onboarding = {};
  state.onboarding.firstWorkingShift = record;
  saveState();
}
function calloriaMentorEsc(value) {
  return typeof escapeHTML === 'function' ? escapeHTML(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
function calloriaMentorFormatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Not recorded';
}
function calloriaMentorPanelMarkup(record) {
  const snapshot = firstShiftMentorSnapshot(record);
  if (!snapshot) return '';
  const title = snapshot.status === 'completed' ? 'First shift mentor review signed off' : snapshot.status === 'review_pending' ? 'First shift evidence submitted' : 'Your first independent shift';
  const pill = snapshot.status === 'completed' ? '<span class="pill green">SIGNED OFF</span>' : snapshot.status === 'review_pending' ? '<span class="pill amber">REVIEW PENDING</span>' : '<span class="pill blue">MENTORED SHIFT</span>';
  const average = snapshot.averageQa === null ? 'Pending' : `${snapshot.averageQa}/100`;
  const caseRows = record.cases.slice(-4).reverse().map(item => `<div class="cfsm-evidence-row"><span><strong>${calloriaMentorEsc(item.reference)}</strong><small>${calloriaMentorEsc(item.disposition)} · ${calloriaMentorEsc(calloriaMentorFormatDate(item.savedAt))}</small></span><b class="${item.outcome === 'qualified' ? 'good' : item.outcome === 'coaching-required' ? 'alert' : ''}">${item.qa === null ? 'QA pending' : `QA ${item.qa}/100`} · ${calloriaMentorEsc(String(item.outcome || 'recorded').replaceAll('-', ' '))}</b></div>`).join('');
  let action = '';
  if (snapshot.status === 'supervised' && snapshot.coachingPending) {
    action = `<div class="cfsm-coaching"><strong>Mentor coaching required</strong><p>${calloriaMentorEsc(snapshot.coachingReason || 'Review the latest interaction with your mentor.')}</p><form data-calloria-first-shift-coaching-form><label for="cfsmReflection">COACHING REFLECTION · MINIMUM 20 CHARACTERS</label><textarea id="cfsmReflection" name="reflection" rows="3" minlength="20" maxlength="1200" required placeholder="Record what you learned and how you will apply the guidance on the next customer contact."></textarea><button class="btn primary" type="submit">Acknowledge coaching and continue</button></form></div>`;
  } else if (snapshot.status === 'supervised' && snapshot.qualifiedSinceCoaching >= snapshot.requiredCleanCases) {
    action = '<div class="cfsm-next"><p>Two qualifying, resolved cases have met the first-shift evidence threshold.</p><button type="button" class="btn primary" data-calloria-first-shift-mentor-action="request-review">Request simulated mentor review →</button></div>';
  } else if (snapshot.status === 'supervised') {
    action = `<p class="muted-note">Complete ${Math.max(0, snapshot.requiredCleanCases - snapshot.qualifiedSinceCoaching)} more qualifying resolved case${snapshot.requiredCleanCases - snapshot.qualifiedSinceCoaching === 1 ? '' : 's'} with QA of at least 70/100 and no recorded compliance breach. Low scores, missing QA and breaches require coaching before the clean-case count can restart.</p>`;
  } else if (snapshot.status === 'review_pending') {
    action = `<div class="cfsm-review"><strong>SIMULATED MENTOR REVIEW · ${calloriaMentorEsc(CALLORIA_FIRST_SHIFT_MENTOR_NAME)}</strong><p>Confirm each item only after reviewing the saved evidence. This is an in-game assessment, not a real human or employment certification.</p><form data-calloria-first-shift-review-form><label><input type="checkbox" name="evidenceReviewed" required> I reviewed the first-shift interaction and case evidence.</label><label><input type="checkbox" name="customerCareReady" required> The customer-care standard is demonstrated.</label><label><input type="checkbox" name="safeConductConfirmed" required> Privacy, consent, compliance and escalation boundaries were respected.</label><label><input type="checkbox" name="crmAccuracyConfirmed" required> CRM case outcomes and records are accurate.</label><button type="submit" class="btn primary">Record simulated mentor sign-off</button></form></div>`;
  } else if (snapshot.status === 'completed') {
    action = `<div class="cfsm-complete"><strong>Completed · ${calloriaMentorEsc(calloriaMentorFormatDate(snapshot.completedAt))}</strong><p>Reviewed by ${calloriaMentorEsc(snapshot.mentorReview?.reviewer || CALLORIA_FIRST_SHIFT_MENTOR_NAME)}. Original case and coaching history remain in the record.</p><span class="muted-note">Simulated in-game mentor acknowledgement; it does not alter production QA, salary or promotion eligibility.</span></div>`;
  }
  return `<section class="panel calloria-first-shift-mentor" aria-live="polite" aria-label="First shift mentor progress"><div class="cfsm-head"><div><span class="subtle-label">FIRST-SHIFT MENTOR · ${calloriaMentorEsc(CALLORIA_FIRST_SHIFT_MENTOR_NAME)}</span><h3>${title}</h3><p>Evidence from your first independent operating shift after onboarding and workstation allocation.</p></div>${pill}</div><div class="cfsm-metrics"><div><strong>${snapshot.callsConnected}</strong><small>Calls connected</small></div><div><strong>${snapshot.casesSaved}</strong><small>Cases saved</small></div><div><strong>${snapshot.qualifiedSinceCoaching}/${snapshot.requiredCleanCases}</strong><small>Clean resolved cases</small></div><div><strong>${average}</strong><small>Average recorded QA</small></div></div>${snapshot.coachingPending ? '<div class="cfsm-warning" role="alert">The clean-case count is paused until coaching is acknowledged.</div>' : ''}${action}${caseRows ? `<div class="cfsm-evidence"><h4>Recent first-shift evidence</h4>${caseRows}</div>` : '<p class="muted-note">No saved first-shift customer cases yet. Connected calls are tracked separately from completed CRM records.</p>'}</section>`;
}
function calloriaRenderFirstShiftMentorPanel() {
  if (!state?.hired || !state?.onboarding || state.onboarding.grandfathered === true) return;
  const record = calloriaMentorCurrentRecord();
  if (!record || !['supervised', 'review_pending', 'completed'].includes(record.status)) return;
  if (state.currentView === 'overview' && record.status === 'completed') {
    // Keep the signed-off result visible on the career overview.
  } else if (!['overview', 'inbound', 'outbound', 'digital', 'crm'].includes(state.currentView)) return;
  const root = document.getElementById('viewRoot');
  if (!root || root.querySelector('.calloria-first-shift-mentor')) return;
  root.insertAdjacentHTML('afterbegin', calloriaMentorPanelMarkup(normalizeFirstShiftMentorRecord(record)));
}
window.addEventListener('calloria:game-shift-started', event => {
  if (!state?.hired || !state?.onboarding || state.onboarding.grandfathered === true) return;
  const existing = calloriaMentorCurrentRecord();
  if (existing?.status === 'completed' || existing?.status === 'review_pending') return;
  if (existing?.status === 'supervised') return;
  const allocation = state.onboarding.workstationAllocation || {};
  const startedAt = existing?.startedAt || new Date().toISOString();
  const record = createFirstShiftMentorRecord({
    day: Number(event.detail?.day || state.day || 1),
    workstationId: existing?.workstationId || allocation.workstationId || null,
    queueSkill: existing?.queueSkill || allocation.primarySkill || 'customer-care',
    startedAt,
    mentor: CALLORIA_FIRST_SHIFT_MENTOR_NAME
  });
  if (existing && Array.isArray(existing.cases)) record.cases = existing.cases;
  if (existing && Array.isArray(existing.connectedContacts)) record.connectedContacts = existing.connectedContacts;
  if (existing && Array.isArray(existing.coachingEvents)) record.coachingEvents = existing.coachingEvents;
  record.monitoringStartedAt = new Date().toISOString();
  record.monitoringDay = Number(event.detail?.day || state.day || 1);
  calloriaMentorSetRecord(record);
  if (typeof pushOperationEvent === 'function') pushOperationEvent('workforce', record.workstationId || 'WORKSTATION', 'First independent working shift entered evidence-based mentor monitoring.', 'active', { mentor: CALLORIA_FIRST_SHIFT_MENTOR_NAME, day: record.monitoringDay });
  if (typeof toast === 'function') toast('Your first independent shift is now under simulated mentor monitoring. Saved customer cases will count as evidence.', 'success');
});
window.addEventListener('calloria:game-call-connected', event => {
  const current = calloriaMentorCurrentRecord();
  if (!state?.shiftActive || !current || current.status !== 'supervised') return;
  const result = recordMentorCallConnected(current, event.detail || {});
  if (!result.ok || result.duplicate) return;
  state.onboarding.firstWorkingShift = result.record;
  saveState();
});
window.addEventListener('calloria:game-case-saved', event => {
  const current = calloriaMentorCurrentRecord();
  if (!state?.shiftActive || !current || !['supervised', 'review_pending'].includes(current.status)) return;
  const result = recordMentorCaseSaved(current, event.detail || {});
  if (!result.ok || result.duplicate) return;
  state.onboarding.firstWorkingShift = result.record;
  saveState();
  if (result.case?.outcome === 'coaching-required' && typeof toast === 'function') toast('First-shift mentor coaching required. Review the evidence panel before your next customer case.', 'warning');
});
document.addEventListener('click', event => {
  const button = event.target?.closest?.('[data-calloria-first-shift-mentor-action]');
  if (!button) return;
  const current = calloriaMentorCurrentRecord();
  if (!current) return;
  const action = button.dataset.calloriaFirstShiftMentorAction;
  if (action === 'request-review') {
    event.preventDefault();
    event.stopImmediatePropagation();
    const result = requestMentorReview(current);
    if (!result.ok) { toast('Mentor review is locked until coaching is complete and two qualifying resolved cases are recorded.', 'warning'); return; }
    state.onboarding.firstWorkingShift = result.record;
    saveState();
    renderView();
    toast('First-shift evidence submitted for simulated mentor review.', 'success');
  }
}, true);
document.addEventListener('submit', event => {
  const coachingForm = event.target?.closest?.('[data-calloria-first-shift-coaching-form]');
  if (coachingForm) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = new FormData(coachingForm);
    const result = acknowledgeMentorCoaching(calloriaMentorCurrentRecord(), data.get('reflection'), CALLORIA_FIRST_SHIFT_MENTOR_NAME);
    if (!result.ok) { toast('Enter a coaching reflection of at least 20 characters.', 'warning'); return; }
    state.onboarding.firstWorkingShift = result.record;
    saveState();
    renderView();
    toast('Coaching acknowledgement recorded. The clean-case target has restarted; earlier case evidence remains.', 'success');
    return;
  }
  const reviewForm = event.target?.closest?.('[data-calloria-first-shift-review-form]');
  if (!reviewForm) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const data = new FormData(reviewForm);
  const result = approveMentorReview(calloriaMentorCurrentRecord(), {
    evidenceReviewed: data.get('evidenceReviewed') === 'on',
    customerCareReady: data.get('customerCareReady') === 'on',
    safeConductConfirmed: data.get('safeConductConfirmed') === 'on',
    crmAccuracyConfirmed: data.get('crmAccuracyConfirmed') === 'on'
  }, CALLORIA_FIRST_SHIFT_MENTOR_NAME);
  if (!result.ok) { toast('All four evidence, customer-care, safe-conduct and CRM checks are required before simulated sign-off.', 'warning'); return; }
  state.onboarding.firstWorkingShift = result.record;
  if (typeof pushOperationEvent === 'function') pushOperationEvent('workforce', result.record.workstationId || 'WORKSTATION', 'First independent working shift received simulated mentor sign-off after evidence review.', 'completed', { caseCount: result.record.cases.length, cleanCases: result.record.qualifiedSinceCoaching, mentor: result.record.mentorReview.reviewer });
  saveState();
  renderView();
  toast('First-shift mentor sign-off completed. This simulated review does not change production QA or promotion eligibility.', 'success');
}, true);
