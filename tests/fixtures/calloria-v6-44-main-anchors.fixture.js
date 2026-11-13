function renderVoicePractice(call, customerPrompt) {
  const recording = voiceStatus === 'recording';
  const transcribing = voiceStatus === 'transcribing';
  const busy = recording || transcribing;
  return `<section class="voice-practice-panel">
    <label class="voice-consent"><input type="checkbox" id="voiceConsent" ${voiceConsent?'checked':''}> I consent to microphone use for this practice interaction. I understand browser speech recognition may be processed by the browser's speech service.</label>
    <div class="form-field"><label for="voiceTranscriptText">TEMPORARY PRACTICE TRANSCRIPT</label><div class="voice-transcript" id="voiceTranscriptText">${escapeHTML(voiceTranscript||'No transcript captured yet.')}</div></div>
    <form id="voiceFallbackForm" class="form-stack"><label class="form-field">Text fallback<input name="utterance" maxlength="1200" placeholder="Type what you would say to the customer…" autocomplete="off"></label><button class="btn outline" type="submit">Record text response</button></form>
    <div class="voice-privacy-note">Recording stays in this page's memory and is not uploaded or written to the employment save. Clear it before leaving a shared device. Never speak or enter a PIN, password, one-time code or full payment-card number.</div>
  </section>`;
}
function applyCallChoice(index){
  const call=state.currentCall;const scenario=inboundScenarios.find(s=>s.id===call.scenarioId);const option=scenario.steps[call.stepIndex].options[index];if(!option)return;
}
function renderInbound(){
  const call=state.currentCall;
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  const step=scenario.steps[call.stepIndex];
  const contact=findQueueContact(call.queueContactId);
  const supervisorOpen=state.supervisorRequests.some(item=>item.contactId===call.queueContactId&&item.status==='open');
  viewRoot.innerHTML = `</p><div class="panel-head" style="margin:16px 0 11px"></div>`;
}
function renderWrapUp(){
  const wrap=state.wrapUp;
  if(!wrap)return;
  const inbound=wrap.type==='inbound';
  const contact=findQueueContact(wrap.contactId);
  const transferLine=wrap.transferTarget?`<div class="data-row"><span>Transfer destination</span><strong>${escapeHTML(wrap.transferTarget)}</strong></div>`:'';
  viewRoot.innerHTML=`<div class="wrapup-layout"><section class="panel assessment-card"><div class="article-box"><h4>After-contact checklist</h4><p>Confirm the disposition, document the actual action, set a callback only when requested, and route unresolved or security-sensitive cases correctly.</p></div><div class="assessment-footer"><small>Saving this record updates the queue, case history and performance metrics.</small><button class="btn primary" data-action="save-wrap-up">Save record & finish →</button></div></section><aside class="panel"><div class="data-list">${transferLine}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p></aside></div>`;
}
function handleAction(action,event={}){
  switch(action){
    case 'clear-voice-practice':clearVoicePractice();break;
    case 'save-wrap-up':saveWrapUp();break;
  }
}
function saveWrapUp(){
  const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',timeline:contact.timeline.slice()};
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='customerLabReplyForm'){e.preventDefault();submitCustomerTurn(state.customerLabSession,String(new FormData(e.target).get('reply')||''));return;}
});
