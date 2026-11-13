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
  const call=state.currentCall;
}
function handleAction(action,event={}){
  switch(action){
    case 'clear-voice-practice':clearVoicePractice();break;
  }
}
function saveWrapUp(){
  const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',timeline:contact.timeline.slice()};
}
