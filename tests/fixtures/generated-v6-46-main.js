/* __CALLORIA_QA_COACHING_FOLLOWTHROUGH_V646__ */
/* __CALLORIA_INBOUND_QA_REVIEW_BRIDGE_V645__ */
/* __CALLORIA_INBOUND_CONVERSATION_WRAPUP_V644__ */
/* __CALLORIA_INBOUND_CUSTOMER_DIALOGUE_V643__ */
/* __CALLORIA_VOICE_RESPONSE_WORKFLOW_V642__ */
function renderVoicePractice(call, customerPrompt) {
  const recording = voiceStatus === 'recording';
  const transcribing = voiceStatus === 'transcribing';
  const busy = recording || transcribing;
  return `<section class="voice-practice-panel">
    <label class="voice-consent"><input type="checkbox" id="voiceConsent" ${voiceConsent?'checked':''}> I consent to microphone use for this interaction. Browser speech recognition may be processed by the browser service. A transcript is saved to this contact's case history only when I explicitly log it and may sync with enabled cloud save.</label>
    <div class="form-field"><label for="voiceTranscriptText">TEMPORARY PRACTICE TRANSCRIPT</label><div class="voice-transcript" id="voiceTranscriptText">${escapeHTML(voiceTranscript||'No transcript captured yet.')}</div></div>
    <form id="voiceFallbackForm" class="form-stack"><label class="form-field">Text fallback<input name="utterance" maxlength="1200" placeholder="Type what you would say to the customer…" autocomplete="off"></label><button class="btn outline" type="submit">Record text response</button></form>
    <button class="btn primary" type="button" data-action="log-voice-response" ${!voiceTranscript.trim()||busy||call.held?'disabled':''}>Log agent response to contact</button>
    ${calloriaRenderVoiceHistoryV642(call)}
    <div class="voice-privacy-note">Microphone audio stays in this page's memory and is not saved. Only transcripts you explicitly log are added to the contact case history and may sync with enabled cloud save. Never capture PINs, passwords, one-time codes or full card numbers.</div>
  </section>`;
}

function calloriaReviewVoiceResponseV642(rawValue){
  const original=sanitizeTranscript(String(rawValue||'')).trim().slice(0,1200);
  const asksForSecret=/\b(?:what is|what's|tell me|give me|send me|read out|provide me with|confirm)\s+(?:your\s+)?(?:pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\b/i.test(original);
  const text=original
    .replace(/\b(pin|password|otp|one[-\s]?time\s+(?:password|code)|security code)\s*(?:is|:|=)?\s*[A-Za-z0-9-]{3,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){4,}\b/g,'[redacted number]')
    .slice(0,1200);
  const markers=[];
  if(/\b(understand|appreciate|sorry|concern|frustrat|inconvenien|thank you for)\w*/i.test(original))markers.push('empathy');
  if(/\b(i will|i'll|let me|i can|allow me|we will|we'll|look into|check|review|investigate|assist|help you)\b/i.test(original))markers.push('ownership');
  if(/\b(next step|case reference|reference number|update|follow[- ]?up|confirm|timeframe|when|by)\b/i.test(original))markers.push('clear next step');
  const wordCount=original.split(/\s+/).filter(Boolean).length;
  let scoreDelta=markers.length;
  if(wordCount<4&&markers.length===0)scoreDelta=-1;
  if(asksForSecret)scoreDelta=-5;
  return {text,markers,scoreDelta,breach:asksForSecret,wordCount};
}
function calloriaRenderVoiceHistoryV642(call){
  const replies=Array.isArray(call?.voiceReplies)?call.voiceReplies.slice(-3):[];
  if(!replies.length)return '';
  const rows=replies.map(item=>'<div><p>'+escapeHTML(item.text)+'</p><small>Quality markers: '+escapeHTML((item.quality?.markers||[]).join(', ')||'none')+' · '+(Number(item.quality?.scoreDelta)||0)+' points</small></div>').join('');
  return '<div class="article-box"><h4>Agent statements logged ('+call.voiceReplies.length+')</h4>'+rows+'</div>';
}

function calloriaLogVoiceResponseV642(){
  const call=state.currentCall;
  if(!call||call.held){toast('A connected inbound call is required before logging an agent response.','warning');return;}
  const raw=String(voiceTranscript||'').trim();
  if(!raw){toast('Capture or enter an agent response before logging it.','warning');return;}
  const review=calloriaReviewVoiceResponseV642(raw);
  if(!review.text){toast('The response was empty after transcript cleaning.','warning');return;}
  const at=new Date().toISOString();
  const entry={type:'agent',text:review.text,at,quality:{markers:review.markers,scoreDelta:review.scoreDelta,breach:review.breach}};
  call.voiceReplies=Array.isArray(call.voiceReplies)?call.voiceReplies:[];
  call.voiceReplies.push(entry);
  if(call.voiceReplies.length>20)call.voiceReplies.splice(0,call.voiceReplies.length-20);
  call.score=(Number(call.score)||0)+review.scoreDelta;
  if(review.breach){call.breach=true;state.incidents++;}
  call.lastVoiceReview=entry.quality;
  addCallTimeline(call,'Agent response logged to the contact transcript',{scoreDelta:review.scoreDelta,breach:review.breach,qualityMarkers:review.markers,transcript:review.text});
  if(speechRecognition){try{speechRecognition.stop();}catch{}speechRecognition=null;}
  if(voiceSession){finishVoiceSession(voiceSession);voiceSession=null;}
  if(voiceStatus==='transcribing')voiceStatus='ready';
  voiceTranscript='';
  saveState();renderView();
  toast(review.breach?'Response logged · critical security request flagged.':'Response logged · '+review.markers.length+' communication markers.',review.breach?'error':'success');
}


function calloriaEnsureDialogueStylesV643(){
  if(document.getElementById('calloriaDialogueStylesV643'))return;
  const style=document.createElement('style');style.id='calloriaDialogueStylesV643';
  style.textContent='.calloria-dialogue-panel{margin:14px 0;padding:13px;border:1px solid rgba(148,163,184,.24);border-radius:14px;background:rgba(15,23,42,.22)}.calloria-dialogue-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.calloria-dialogue-head h4{margin:0;font-size:14px}.calloria-dialogue-thread{display:flex;flex-direction:column;gap:8px;max-height:210px;overflow:auto;padding:5px 2px 10px}.calloria-dialogue-message{max-width:94%;padding:9px 11px;border:1px solid rgba(148,163,184,.2);border-radius:12px;background:rgba(148,163,184,.08);font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.calloria-dialogue-message.agent{margin-left:auto;background:rgba(59,130,246,.12);border-color:rgba(59,130,246,.28)}.calloria-dialogue-message small{display:block;margin-bottom:4px;opacity:.72;font-size:10px;letter-spacing:.06em}.calloria-dialogue-composer{display:grid;gap:8px;margin-top:8px}.calloria-dialogue-composer textarea{width:100%;min-height:76px;resize:vertical}.calloria-dialogue-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.calloria-dialogue-note{font-size:11px;opacity:.72;margin:5px 0 0}.calloria-dialogue-empty{font-size:12px;opacity:.7;padding:8px 2px}';
  document.head.append(style);
}
function calloriaDialogueReviewV643(rawValue){
  const original=sanitizeTranscript(String(rawValue||'')).trim().slice(0,1000);
  const protectiveInstruction=/\b(?:do not|don't|never|not to|avoid)\s+(?:ever\s+)?(?:share|provide|tell|send|disclose|give|ask for|request)\b/i.test(original);
  const asksForSecret=!protectiveInstruction && /\b(?:can|could|would)\s+you\s+(?:please\s+)?(?:tell|give|send|share|provide|read(?:\s+out)?|confirm)\s+(?:me\s+)?(?:with\s+)?(?:your|the)?\s*(?:pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\b|\b(?:please\s+)?(?:tell|give|send|share|provide|read(?:\s+out)?|confirm|enter|disclose)\s+(?:me\s+)?(?:with\s+)?(?:your|the)?\s*(?:pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\b|\b(?:what is|what's|i need|we need)\s+(?:your|the)?\s*(?:pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\b/i.test(original);
  const safeText=original
    .replace(/\b(pin|password|otp|one[-\s]?time\s+(?:password|code)|security code)\s*(?:is|:|=)\s*[A-Za-z0-9-]{3,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){9,}\b/g,'[redacted number]')
    .slice(0,1000);
  const markers=[];
  if(/\b(understand|appreciate|sorry|concern|frustrat|inconvenien|thank you for)\w*/i.test(original))markers.push('empathy');
  if(/\b(i will|i'll|let me|i can|allow me|we will|we'll|look into|assist|help you|take ownership)\b/i.test(original))markers.push('ownership');
  if(/\b(verify|verification|confirm your identity|registered (?:number|email)|approved security check)\b/i.test(original))markers.push('approved verification');
  if(/\b(check|review|investigate|trace|look into|check the status|examine)\b/i.test(original))markers.push('investigation');
  if(/\b(next step|case reference|reference number|ticket|follow[- ]?up|update|timeframe|by (?:today|tomorrow|monday|tuesday|wednesday|thursday|friday))\b/i.test(original))markers.push('clear next step');
  const words=original.split(/\s+/).filter(Boolean).length;
  let scoreDelta=markers.length>=3?2:markers.length===2?1:0;
  if(words<5&&markers.length===0)scoreDelta=-1;
  if(asksForSecret)scoreDelta=-5;
  return {text:safeText,markers,scoreDelta,breach:asksForSecret,wordCount:words};
}
function calloriaCustomerReplyV643(review,call,scenario){
  if(review.breach)return {text:'I cannot share a PIN, password or one-time code. Please use the approved secure verification process.',mood:'guarded'};
  const markers=review.markers||[];
  if(markers.includes('empathy')&&markers.includes('ownership'))return {text:'Thank you for acknowledging the problem and taking ownership. I am ready to work through the checks with you.',mood:'calmer'};
  if(markers.includes('approved verification'))return {text:'I can complete the approved identity checks. Please tell me which permitted details are required; I will not share a PIN or one-time code.',mood:'neutral'};
  if(markers.includes('investigation'))return {text:'I have explained what happened. Please tell me what your checks show and what action is available.',mood:'neutral'};
  if(markers.includes('clear next step'))return {text:'That gives me a clearer expectation. Please make sure the agreed update or case reference is recorded.',mood:'calmer'};
  return {text:'I still need a clear explanation of what you will do, how the issue will be checked and what happens next.',mood:'frustrated'};
}
function calloriaRenderInboundDialogueV643(call,scenario){
  calloriaEnsureDialogueStylesV643();
  const turns=Array.isArray(call.dialogueTurns)?call.dialogueTurns:[];
  const mood=call.customerMood||'waiting';
  const rows=turns.slice(-12).map(item=>'<div class="calloria-dialogue-message '+(item.type==='agent'?'agent':'customer')+'"><small>'+(item.type==='agent'?'YOU · AGENT':escapeHTML(scenario.customer)+' · CUSTOMER')+'</small>'+escapeHTML(item.text)+'</div>').join('');
  const voiceReady=String(voiceTranscript||'').trim().length>0;
  return '<section class="calloria-dialogue-panel"><div class="calloria-dialogue-head"><h4>Live customer conversation</h4><span class="pill '+(mood==='guarded'?'red':mood==='frustrated'?'amber':mood==='calmer'?'green':'')+'">CUSTOMER TONE · '+escapeHTML(mood.toUpperCase())+'</span></div><div class="calloria-dialogue-thread" aria-live="polite">'+(rows||'<div class="calloria-dialogue-empty">The customer is waiting for your first response. Replies are simulated from the scenario and your wording.</div>')+'</div><form id="inboundDialogueFormV643" class="calloria-dialogue-composer"><label class="form-field">YOUR SPOKEN RESPONSE<textarea name="reply" rows="3" maxlength="1000" placeholder="Acknowledge the customer, explain your checks and state the next step…"></textarea></label><div class="calloria-dialogue-actions"><button class="btn primary" type="submit">Send response to customer</button>'+(voiceReady?'<button class="btn outline" type="submit" name="source" value="voice">Send captured voice transcript</button>':'')+'</div><p class="calloria-dialogue-note">Scripted customer responses · no AI request or external call. Do not ask for PINs, passwords or one-time codes.</p></form></section>';
}
function calloriaSubmitInboundDialogueV643(rawValue){
  const call=state.currentCall;
  if(!call||call.held){toast('A connected inbound call is required before replying.','warning');return;}
  const scenario=inboundScenarios.find(item=>item.id===call.scenarioId);
  if(!scenario){toast('The active customer scenario is unavailable.','error');return;}
  const review=calloriaDialogueReviewV643(rawValue);
  if(!review.text){toast('Enter a response before sending it to the customer.','warning');return;}
  call.dialogueTurns=Array.isArray(call.dialogueTurns)?call.dialogueTurns:[];
  const at=new Date().toISOString();
  call.dialogueTurns.push({type:'agent',text:review.text,at,quality:{markers:review.markers,scoreDelta:review.scoreDelta,breach:review.breach}});
  const reply=calloriaCustomerReplyV643(review,call,scenario);
  call.dialogueTurns.push({type:'customer',text:reply.text,at:new Date(Date.now()+1).toISOString(),mood:reply.mood});
  call.dialogueTurns=call.dialogueTurns.slice(-24);
  call.customerMood=reply.mood;
  call.score=(Number(call.score)||0)+review.scoreDelta;
  if(review.breach&&!call.dialogueBreachV643){call.breach=true;call.dialogueBreachV643=true;state.incidents++;}
  addCallTimeline(call,'Live dialogue exchange recorded',{agentMessage:review.text,customerReply:reply.text,qualityMarkers:review.markers,scoreDelta:review.scoreDelta,breach:review.breach});
  if(voiceTranscript&&String(rawValue)===String(voiceTranscript)){if(speechRecognition){try{speechRecognition.stop();}catch{}speechRecognition=null;}if(voiceSession){finishVoiceSession(voiceSession);voiceSession=null;}if(voiceStatus==='transcribing')voiceStatus='ready';voiceTranscript='';}
  saveState();renderView();
  toast(review.breach?'Security breach flagged in the live conversation.':'Customer response recorded · '+review.markers.length+' quality markers.',review.breach?'error':'success');
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
   const liveDialogueMarkup=calloriaRenderInboundDialogueV643(call,scenario);
  viewRoot.innerHTML = `</p>${liveDialogueMarkup}<div class="panel-head" style="margin:16px 0 11px"></div>`;
}

function calloriaScrubInboundQATextV645(value){
  return String(value??'')
    .replace(/\b(pin|password|passcode|otp|one[-\s]?time\s+(?:password|code)|security\s+code|cvv)\s*(?:(?:is|:|=)\s*)?[A-Za-z0-9-]{2,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){8,}\b/g,'[redacted number]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
    .replace(/\s+/g,' ').trim().slice(0,1000);
}
function calloriaBuildInboundQATranscriptV645({wrap,call,contact,scenario,notes}){
  const transcript=[];
  const add=(speaker,text,at)=>{
    const safe=calloriaScrubInboundQATextV645(text);
    if(!safe)return;
    if(transcript.some(line=>line.speaker===speaker&&line.text===safe))return;
    transcript.push({speaker,text:safe,at:at||null});
  };
  if(scenario?.opening)add('customer',scenario.opening,scenario.createdAt||null);
  const turns=Array.isArray(call?.dialogueTurns)?call.dialogueTurns:[];
  if(turns.length){
    for(const turn of turns)add(turn?.type==='agent'?'agent':'customer',turn?.text,turn?.at);
  }
  const replies=Array.isArray(call?.voiceReplies)?call.voiceReplies:[];
  for(const reply of replies)add('agent',reply?.text,reply?.at);
  if(!turns.length&&!replies.length){
    const timeline=Array.isArray(contact?.timeline)?contact.timeline:[];
    for(const item of timeline){
      const event=String(item?.event||'');
      if(event.startsWith('Agent selected:'))add('agent',event.replace(/^Agent selected:\s*/,''),item.at);
      if(item?.agentMessage)add('agent',item.agentMessage,item.at);
      if(item?.customerReply)add('customer',item.customerReply,item.at);
    }
  }
  if(notes)add('case-note','Factual case note: '+notes,new Date().toISOString());
  return transcript.slice(-40);
}
function calloriaQueueInboundQAV645({wrap,call,contact,notes,disposition,createdAt}){
  if(!wrap||wrap.type!=='inbound'||!contact?.id)return null;
  if(!Array.isArray(state.customerQaHistory))state.customerQaHistory=[];
  const id='INB-QA-'+String(contact.id).replace(/[^A-Za-z0-9_-]/g,'').slice(0,72);
  const existing=state.customerQaHistory.find(item=>item.id===id||item.sourceCaseId===contact.id);
  if(existing)return existing;
  const scenario=inboundScenarios.find(item=>item.id===(wrap.scenarioId||call?.scenarioId));
  const transcript=calloriaBuildInboundQATranscriptV645({wrap,call,contact,scenario,notes});
  if(!transcript.length)return null;
  const breached=Boolean(wrap.breach||call?.breach||call?.dialogueBreachV643);
  const item={
    id,sourceCaseId:contact.id,sourceType:'inbound-operations',
    issueId:scenario?.id||wrap.scenarioId||'inbound-contact',
    personaId:'',channel:'Voice',customer:wrap.customer||scenario?.customer||'Customer',
    caseReference:wrap.reference||'',caseTitle:wrap.title||scenario?.issue||'Inbound customer contact',
    caseNotes:calloriaScrubInboundQATextV645(notes||''),
    disposition:String(disposition||''),estimatedQA:Math.max(0,Math.min(100,Number(wrap.qa)||0)),
    criticalBreaches:breached?['inbound_policy_or_security_breach']:[],
    transcript,createdAt:createdAt||new Date().toISOString(),outcome:String(disposition||'completed'),
    reviewState:'pending',owner:state.applicantName||'Agent'
  };
  state.customerQaHistory.push(item);
  state.customerQaHistory=state.customerQaHistory.slice(-200);
  pushOperationEvent('qa-queue',id,'Completed inbound contact added to the human QA review queue.',breached?'mandatory_review':'pending',{contactId:contact.id,issueId:item.issueId,transcriptLines:transcript.length,criticalBreaches:item.criticalBreaches});
  return item;
}
function calloriaRenderInboundQAPendingV645(items){
  const inbound=(Array.isArray(items)?items:[]).filter(item=>item?.sourceType==='inbound-operations');
  const rows=inbound.slice().reverse().slice(0,8).map(item=>{
    const critical=Array.isArray(item.criticalBreaches)&&item.criticalBreaches.length>0;
    const date=item.createdAt?new Date(item.createdAt).toLocaleString():'Time not recorded';
    return '<article class="calloria-qa-pending-item"><div><strong>'+escapeHTML(item.customer||'Customer')+'</strong><small>'+escapeHTML(item.caseTitle||item.issueId||'Inbound contact')+' · '+escapeHTML(item.caseReference||item.id)+'</small><small>'+escapeHTML(date)+' · '+(Number(item.transcript?.length)||0)+' evidence lines</small></div><span class="pill '+(critical?'red':'amber')+'">'+(critical?'MANDATORY REVIEW':'PENDING QA')+'</span></article>';
  }).join('');
  const criticalCount=inbound.filter(item=>Array.isArray(item.criticalBreaches)&&item.criticalBreaches.length).length;
  return '<section class="panel calloria-qa-pending-panel"><div class="panel-head"><div><h3>Inbound interaction review queue</h3><p>Completed inbound calls are routed here for evidence-based human review.</p></div><span class="pill '+(criticalCount?'red':'amber')+'">'+inbound.length+' AWAITING · '+criticalCount+' CRITICAL</span></div>'+(rows?'<div class="calloria-qa-pending-list">'+rows+'</div>':'<p class="muted-note">No completed inbound calls are awaiting review. Finish an inbound call and save its case record to populate this queue.</p>')+'<p class="muted-note">The interaction QA estimate is not a human score. Reviewers must select ratings and exact transcript evidence before a formal training review is saved.</p></section>';
}
function calloriaEnsureInboundQAStylesV645(){
  if(document.getElementById('calloriaInboundQAStylesV645'))return;
  const style=document.createElement('style');style.id='calloriaInboundQAStylesV645';
  style.textContent='.calloria-qa-pending-panel{margin:14px 0}.calloria-qa-pending-list{display:grid;gap:8px}.calloria-qa-pending-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 12px;border:1px solid rgba(148,163,184,.2);border-radius:10px;background:rgba(148,163,184,.06)}.calloria-qa-pending-item>div{display:grid;gap:3px;min-width:0}.calloria-qa-pending-item strong{font-size:13px}.calloria-qa-pending-item small{font-size:11px;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-qa-pending-item .pill{flex-shrink:0}@media(max-width:600px){.calloria-qa-pending-item{align-items:flex-start;flex-direction:column}}';
  document.head.append(style);
}


function calloriaEnsureQACoachingStateV646(){
  if(!Array.isArray(state.coachingSessions))state.coachingSessions=[];
  return state.coachingSessions;
}
function calloriaCreateQACoachingPlansV646(review){
  if(!review?.id)return [];
  const records=calloriaEnsureQACoachingStateV646();
  const existing=records.filter(item=>item?.source==='qa-human-review-v646'&&item.sourceReviewId===review.id);
  if(existing.length)return existing;
  const tasks=(Array.isArray(review.coaching)?review.coaching:[]).map(item=>({
    criterionId:String(item.criterionId||''),
    topic:'QA improvement · '+String(item.criterion||'Customer interaction standard').slice(0,90),
    feedback:'Interaction '+String(review.interactionId||'unknown')+' · '+String(item.evidence||'Evidence recorded in the human QA review.').slice(0,420),
    actionPlan:String(item.action||'Practise this criterion using the approved procedure, then review a new interaction with a supervisor.').slice(0,600),
    score:Math.max(1,Math.min(5,Number(item.rating)||3)),
    evidenceQuote:String(item.evidence||'').slice(0,500),
    priority:'standard'
  }));
  const breaches=Array.isArray(review.criticalBreaches)?review.criticalBreaches:[];
  if(breaches.length)tasks.push({
    criterionId:'compliance-remediation',
    topic:'Mandatory compliance remediation',
    feedback:'Critical review flag(s): '+breaches.join(', ')+'. Interaction '+String(review.interactionId||'unknown')+'.',
    actionPlan:'Review the approved authentication, privacy and information-handling procedure with a supervisor. Practise the correct response and document the safe escalation route.',
    score:1,evidenceQuote:'Critical breach flagged for human review.',priority:'critical'
  });
  if(!tasks.length)return [];
  const createdAt=Date.parse(review.createdAt)||Date.now();
  const followUpDate=new Date(createdAt+7*24*60*60*1000).toISOString().slice(0,10);
  const created=[];
  for(const task of tasks.slice(0,13)){
    try{
      const record=createCoachingRecord(records,{coach:String(review.reviewer||'QA reviewer').slice(0,80),topic:task.topic,feedback:task.feedback,actionPlan:task.actionPlan,score:task.score,followUpDate});
      Object.assign(record,{source:'qa-human-review-v646',sourceReviewId:review.id,sourceInteractionId:String(review.interactionId||''),criterionId:task.criterionId,evidenceQuote:task.evidenceQuote,priority:task.priority,status:'action_plan_open',deliveredAt:null,deliveredBy:'',followUp:null,deliveryHistory:[],followUps:[]});
      created.push(record);
      pushOperationEvent('coaching',record.id,'QA action plan created: '+record.topic+'.',record.priority==='critical'?'mandatory_remediation':'action_plan_open',{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId,criterionId:record.criterionId});
    }catch(error){console.warn('CALLORIA QA coaching plan could not be created:',error);}
  }
  return created;
}
function calloriaUpdateQACoachingDeliveryV646(id){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||!['action_plan_open','reopened'].includes(record.status))return false;
  record.status='delivered';record.deliveredAt=new Date().toISOString();record.deliveredBy=String(record.coach||'Reviewer').slice(0,80);
  record.deliveryHistory=Array.isArray(record.deliveryHistory)?record.deliveryHistory:[];record.deliveryHistory.push({deliveredAt:record.deliveredAt,deliveredBy:record.deliveredBy});
  pushOperationEvent('coaching',record.id,'QA-directed coaching delivery recorded.','delivered',{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId});
  return true;
}
function calloriaRecordQACoachingFollowUpV646({id,outcome,note,reviewer}){
  const record=calloriaEnsureQACoachingStateV646().find(item=>item?.id===id&&item.source==='qa-human-review-v646');
  if(!record||record.status!=='delivered')throw new Error('Only delivered QA coaching plans can receive a follow-up outcome.');
  const cleanNote=String(note||'').trim();
  const reviewerName=String(reviewer||'').trim();
  if(cleanNote.length<20||cleanNote.length>600)throw new RangeError('Follow-up evidence must contain 20 to 600 characters.');
  if(reviewerName.length<2||reviewerName.length>80)throw new RangeError('Reviewer name must contain 2 to 80 characters.');
  if(!['improved','needs_more_practice'].includes(outcome))throw new TypeError('Choose a valid follow-up outcome.');
  record.followUp={outcome,note:cleanNote,reviewer:reviewerName,recordedAt:new Date().toISOString()};
  record.followUps=Array.isArray(record.followUps)?record.followUps:[];record.followUps.push(record.followUp);
  record.status=outcome==='improved'?'verified':'reopened';
  pushOperationEvent('coaching',record.id,outcome==='improved'?'QA coaching follow-up verified improvement.':'QA coaching follow-up requires further practice.',record.status,{sourceReviewId:record.sourceReviewId,sourceInteractionId:record.sourceInteractionId});
  return record;
}
function calloriaRenderQACoachingFollowThroughV646(){
  const records=calloriaEnsureQACoachingStateV646().filter(item=>item?.source==='qa-human-review-v646');
  const open=records.filter(item=>['action_plan_open','reopened'].includes(item.status)).length;
  const delivered=records.filter(item=>item.status==='delivered').length;
  const verified=records.filter(item=>item.status==='verified').length;
  const cards=records.slice().reverse().slice(0,16).map(item=>{
    const critical=item.priority==='critical';
    const status=String(item.status||'action_plan_open').replaceAll('_',' ').toUpperCase();
    const dueDate=item.followUpDate?new Date(item.followUpDate+'T00:00:00'):null;
    const overdue=dueDate&&dueDate.getTime()<new Date(new Date().toDateString()).getTime()&&item.status!=='verified';
    const due=dueDate?dueDate.toLocaleDateString()+(overdue?' · OVERDUE':''):'Not scheduled';
    const history=Array.isArray(item.followUps)?item.followUps:(item.followUp?[item.followUp]:[]);
    const follow=history.map(entry=>'<div class="calloria-qa-followup-result"><strong>'+(entry.outcome==='improved'?'IMPROVEMENT VERIFIED':'FURTHER PRACTICE REQUIRED')+'</strong><p>'+escapeHTML(entry.note)+'</p><small>'+escapeHTML(entry.reviewer||'Reviewer')+' · '+escapeHTML(new Date(entry.recordedAt).toLocaleString())+'</small></div>').join('');
    const delivery=['action_plan_open','reopened'].includes(item.status)?('<button class="btn outline" type="button" data-action="qa-coaching-delivered" data-coaching-id="'+escapeHTML(item.id)+'">Mark coaching delivered</button>'):'';
    const verify=item.status==='delivered'?('<form class="calloria-qa-followup-form" data-qa-coaching-followup><input type="hidden" name="coachingId" value="'+escapeHTML(item.id)+'"><label>FOLLOW-UP OUTCOME<select name="outcome"><option value="improved">Improvement demonstrated</option><option value="needs_more_practice">Further practice required</option></select></label><label>FOLLOW-UP EVIDENCE<textarea name="note" minlength="20" maxlength="600" required placeholder="Describe the practice check, observed behaviour and evidence."></textarea></label><label>REVIEWER<input name="reviewer" minlength="2" maxlength="80" required value="'+escapeHTML(state.applicantName||'')+'"></label><button class="btn primary" type="submit">Record follow-up result</button></form>'):'';
    return '<article class="calloria-qa-coaching-card"><div class="calloria-qa-coaching-head"><div><strong>'+escapeHTML(item.topic||'QA coaching action')+'</strong><small>Review '+escapeHTML(item.sourceReviewId||'')+' · '+escapeHTML(item.sourceInteractionId||'')+' · Follow-up due '+escapeHTML(due)+'</small></div><span class="pill '+(critical?'red':item.status==='verified'?'green':item.status==='delivered'?'amber':'blue')+'">'+(critical?'CRITICAL · ':'')+escapeHTML(status)+'</span></div><p>'+escapeHTML(item.actionPlan||'')+'</p>'+(item.evidenceQuote?'<small class="calloria-qa-coaching-evidence">Evidence: “'+escapeHTML(item.evidenceQuote)+'”</small>':'')+follow+delivery+verify+'</article>';
  }).join('');
  return '<section class="panel calloria-qa-coaching-panel"><div class="panel-head"><div><h3>QA coaching follow-through</h3><p>Evidence-linked plans created after a human QA review. Record delivery and document the follow-up check.</p></div><span class="pill '+(open?'amber':'green')+'">'+open+' OPEN · '+delivered+' FOLLOW-UP DUE · '+verified+' VERIFIED</span></div>'+(cards?'<div class="calloria-qa-coaching-list">'+cards+'</div>':'<p class="muted-note">No coaching action plans have been generated. Save a human QA review with low-rated criteria or a mandatory compliance flag to create one.</p>')+'<p class="muted-note">A plan is not considered complete when delivered. A reviewer must record a practice-check outcome and supporting notes. “Further practice required” reopens the action.</p></section>';
}
function calloriaEnsureQACoachingStylesV646(){
  if(document.getElementById('calloriaQACoachingStylesV646'))return;
  const style=document.createElement('style');style.id='calloriaQACoachingStylesV646';
  style.textContent='.calloria-qa-coaching-panel{margin:14px 0}.calloria-qa-coaching-list{display:grid;gap:10px}.calloria-qa-coaching-card{display:grid;gap:9px;padding:13px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(148,163,184,.055)}.calloria-qa-coaching-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.calloria-qa-coaching-head>div{display:grid;gap:4px;min-width:0}.calloria-qa-coaching-head small,.calloria-qa-coaching-evidence{font-size:11px;color:var(--muted,#94a3b8);overflow-wrap:anywhere}.calloria-qa-coaching-card>p{margin:0;font-size:13px}.calloria-qa-followup-result{border-left:3px solid var(--success,#22c55e);padding:8px 10px;background:rgba(34,197,94,.06)}.calloria-qa-followup-result p{margin:5px 0;font-size:13px}.calloria-qa-followup-result small{font-size:11px;color:var(--muted,#94a3b8)}.calloria-qa-followup-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;padding-top:8px;border-top:1px solid rgba(148,163,184,.18)}.calloria-qa-followup-form label{display:grid;gap:5px;font-size:10px;letter-spacing:.06em;color:var(--muted,#94a3b8)}.calloria-qa-followup-form label:nth-child(2){grid-column:1/-1}.calloria-qa-followup-form textarea{min-height:68px;resize:vertical}.calloria-qa-followup-form input,.calloria-qa-followup-form select,.calloria-qa-followup-form textarea{width:100%;padding:9px;border:1px solid var(--border,rgba(148,163,184,.3));border-radius:8px;background:var(--panel,transparent);color:inherit;font:inherit}.calloria-qa-followup-form button{justify-self:start}@media(max-width:620px){.calloria-qa-coaching-head{flex-direction:column}.calloria-qa-followup-form{grid-template-columns:1fr}.calloria-qa-followup-form label:nth-child(2){grid-column:auto}}';
  document.head.append(style);
}

function renderQAWorkspace(){
  const reviewable = (state.customerQaHistory || []).filter(item => Array.isArray(item.transcript) && item.transcript.length);
  calloriaEnsureQACoachingStylesV646();
  const reviewedInteractionIds=new Set((state.humanQaReviews||[]).map(item=>item.interactionId));
  const pendingReview=reviewable.filter(item=>!reviewedInteractionIds.has(item.id));
  const pendingInboundReview=pendingReview.filter(item=>item.sourceType==='inbound-operations');
  calloriaEnsureInboundQAStylesV645();
  const selectedInteraction = reviewable.find(item => item.id === state.qaSelectedInteractionId) || pendingReview.at(-1) || reviewable.at(-1) || null;
  const interactionOptions = reviewable.map(item => `<option value="${escapeHTML(item.id)}" ${item.id===state.qaSelectedInteractionId?'selected':''}>${pendingReview.some(pending=>pending.id===item.id)?'PENDING · ':''}${escapeHTML(item.id)} · ${escapeHTML(item.issueId)} · ${escapeHTML(item.channel)}</option>`).join('');
  const evidenceOptions = '<option>Select an exact transcript line</option>';
  const qaReviewButton = 'Save human QA review';
  const reviews = state.humanQaReviews || [];
  const metrics = humanQAMetrics(reviews, state.qaDisputes || [], state.qaCalibrations || []);
  viewRoot.innerHTML = `
      ${renderAIAssistPanel(reviewable)}
      ${calloriaRenderInboundQAPendingV645(pendingInboundReview)}
      ${calloriaRenderQACoachingFollowThroughV646()}
     <div class="grid two qa-workspace-grid">
      <section class="panel">Review workspace fixture</section>
    </div>`;
}

function calloriaScrubDialogueValueV644(rawValue){
  return String(rawValue||'')
    .replace(/\b(pin|password|otp|one[-\s]?time\s+(?:password|code)|security code|full (?:payment )?card number)\s*(?:is|:|=)\s*[A-Za-z0-9-]{2,}/gi,'$1 [redacted]')
    .replace(/\b(?:\d[\s-]?){4,}\b/g,'[redacted number]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email redacted]')
    .replace(/\s+/g,' ').trim().slice(0,260);
}
function calloriaReviewDialogueV644(turns,mood='not assessed'){
  const list=Array.isArray(turns)?turns.slice(-24):[];
  const agents=list.filter(item=>item?.type==='agent');
  const customers=list.filter(item=>item?.type==='customer');
  const markerCounts={};let scoreTotal=0;let breachCount=0;
  for(const item of agents){
    const quality=item?.quality||{};
    scoreTotal+=Number(quality.scoreDelta)||0;
    if(quality.breach)breachCount++;
    for(const marker of Array.isArray(quality.markers)?quality.markers:[])markerCounts[marker]=(markerCounts[marker]||0)+1;
  }
  const highlights=Object.entries(markerCounts).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([label,count])=>({label,count}));
  return {turnCount:list.length,agentTurns:agents.length,customerTurns:customers.length,averageScore:agents.length?Math.round((scoreTotal/agents.length)*10)/10:0,breachCount,markers:markerCounts,highlights,lastCustomerMood:String(mood||'not assessed').slice(0,32)};
}
function calloriaDialogueSummaryTextV644(turns,mood='not assessed',issue='Customer enquiry'){
  const list=Array.isArray(turns)?turns:[];
  const customer=list.filter(item=>item?.type==='customer').slice(-2).map(item=>calloriaScrubDialogueValueV644(item.text)).filter(Boolean);
  const agent=list.filter(item=>item?.type==='agent').slice(-2).map(item=>calloriaScrubDialogueValueV644(item.text)).filter(Boolean);
  const sections=['Issue: '+(calloriaScrubDialogueValueV644(issue)||'Customer enquiry')+'.'];
  if(customer.length)sections.push('Customer statements: '+customer.join(' / ')+'.');
  if(agent.length)sections.push('Agent responses: '+agent.join(' / ')+'.');
  sections.push('Customer tone at end of dialogue: '+String(mood||'not assessed').slice(0,32)+'.');
  return sections.join(' ').slice(0,1120);
}
function calloriaRenderWrapUpDialogueV644(turns,review,mood,issue){
  const list=Array.isArray(turns)?turns:[];
  const preview=list.slice(-8).map(item=>'<div class="calloria-wrap-turn '+(item.type==='agent'?'agent':'customer')+'"><small>'+(item.type==='agent'?'AGENT':'CUSTOMER')+'</small><p>'+escapeHTML(calloriaScrubDialogueValueV644(item.text))+'</p></div>').join('');
  const markers=review.highlights.length?review.highlights.map(item=>escapeHTML(item.label)+' × '+item.count).join(' · '):'No communication markers recorded';
  return '<section class="article-box calloria-wrap-dialogue"><div class="calloria-wrap-dialogue-head"><div><h4>Conversation record</h4><p>'+review.agentTurns+' agent responses · '+review.customerTurns+' customer replies · tone '+escapeHTML(review.lastCustomerMood)+'</p></div><span class="pill '+(review.breachCount?'red':'green')+'">'+(review.breachCount?'SECURITY FLAG':'TRANSCRIPT REVIEW')+'</span></div><p class="muted-note">Communication indicators: '+markers+'. Average dialogue score: '+review.averageScore+'.</p><button class="btn small secondary" type="button" data-action="draft-dialogue-notes" '+(list.length?'':'disabled')+'>Build case-note draft from conversation</button><details class="calloria-wrap-transcript"><summary>Review transcript · '+review.turnCount+' entries</summary><div class="calloria-wrap-turn-list">'+(preview||'<p class="muted-note">No free-text conversation entries were recorded.</p>')+'</div></details></section>';
}
function calloriaDraftDialogueNotesV644(){
  const wrap=state.wrapUp;
  if(!wrap||wrap.type!=='inbound'||!state.currentCall){toast('There is no inbound conversation available for a case-note draft.','warning');return;}
  const turns=Array.isArray(state.currentCall.dialogueTurns)?state.currentCall.dialogueTurns:[];
  if(!turns.length){toast('No live dialogue has been recorded for this contact.','warning');return;}
  const field=$('#wrapNotes');
  if(!field){toast('The case-notes field is unavailable.','error');return;}
  const draft=calloriaDialogueSummaryTextV644(turns,state.currentCall.customerMood,wrap.title);
  const current=field.value.trim();
  const joined=current?current+'\n\n'+draft:draft;
  field.value=joined.slice(0,1200);
  field.focus();
  toast('Conversation-based draft inserted. Review and correct it before saving.','success');
}
function calloriaEnsureWrapUpDialogueStylesV644(){
  if(document.getElementById('calloriaWrapUpDialogueStylesV644'))return;
  const style=document.createElement('style');style.id='calloriaWrapUpDialogueStylesV644';
  style.textContent='.calloria-wrap-dialogue{margin-top:14px}.calloria-wrap-dialogue-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}.calloria-wrap-dialogue-head h4{margin:0 0 4px}.calloria-wrap-dialogue-head p{margin:0;font-size:12px;color:var(--muted,#94a3b8)}.calloria-wrap-transcript{margin-top:12px;border-top:1px solid rgba(148,163,184,.2);padding-top:10px}.calloria-wrap-transcript summary{cursor:pointer;font-size:12px;font-weight:700}.calloria-wrap-turn-list{display:grid;gap:8px;margin-top:10px;max-height:260px;overflow:auto}.calloria-wrap-turn{padding:8px 10px;border-radius:10px;background:rgba(148,163,184,.08);border:1px solid rgba(148,163,184,.18)}.calloria-wrap-turn.agent{margin-left:18px;background:rgba(59,130,246,.08)}.calloria-wrap-turn small{font-size:10px;letter-spacing:.08em;opacity:.7}.calloria-wrap-turn p{margin:4px 0 0;font-size:12px;line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}.calloria-wrap-dialogue .btn{margin-top:8px}';
  document.head.append(style);
}

function renderWrapUp(){
  const wrap=state.wrapUp;
  if(!wrap)return;
  const inbound=wrap.type==='inbound';
  const contact=findQueueContact(wrap.contactId);
  const transferLine=wrap.transferTarget?`<div class="data-row"><span>Transfer destination</span><strong>${escapeHTML(wrap.transferTarget)}</strong></div>`:'';
  const dialogueTurns=wrap.type==='inbound'&&Array.isArray(state.currentCall?.dialogueTurns)?state.currentCall.dialogueTurns:[];
  const dialogueReview=calloriaReviewDialogueV644(dialogueTurns,state.currentCall?.customerMood);
  const dialoguePanel=wrap.type==='inbound'?(calloriaEnsureWrapUpDialogueStylesV644(),calloriaRenderWrapUpDialogueV644(dialogueTurns,dialogueReview,state.currentCall?.customerMood,wrap.title)):'';
  const dialogueSummaryRows=wrap.type==='inbound'?'<div class="data-row"><span>Conversation entries</span><strong>'+dialogueReview.turnCount+'</strong></div><div class="data-row"><span>Agent responses</span><strong>'+dialogueReview.agentTurns+'</strong></div><div class="data-row"><span>Customer replies</span><strong>'+dialogueReview.customerTurns+'</strong></div>':'';
  viewRoot.innerHTML=`<div class="wrapup-layout"><section class="panel assessment-card">${dialoguePanel}<div class="article-box"><h4>After-contact checklist</h4><p>Confirm the disposition, document the actual action, set a callback only when requested, and route unresolved or security-sensitive cases correctly.</p></div><div class="assessment-footer"><small>Saving this record updates the queue, case history and performance metrics.</small><button class="btn primary" data-action="save-wrap-up">Save record & finish →</button></div></section><aside class="panel"><div class="data-list">${transferLine}${dialogueSummaryRows}</div><p class="muted-note" style="margin-top:14px">After-contact work is part of handling time and must be completed before the next contact is accepted.</p></aside></div>`;
}
function handleAction(action,event={}){
  switch(action){
    case 'clear-voice-practice':clearVoicePractice();break;
    case 'log-voice-response':calloriaLogVoiceResponseV642();break;
    case 'draft-dialogue-notes':calloriaDraftDialogueNotesV644();break;
    case 'save-wrap-up':saveWrapUp();break;
    case 'qa-coaching-delivered':{if(calloriaUpdateQACoachingDeliveryV646(event.coachingId)){saveState();renderView();toast('QA coaching delivery recorded. A documented follow-up is still required.','success');}else toast('This coaching plan is not awaiting delivery.','warning');break;}
    case 'back-knowledge':state.viewedArticle=null;renderView();break;
  }
}
document.addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(action){handleAction(action.dataset.action,{callbackId:action.dataset.callbackId,requestId:action.dataset.requestId,system:action.dataset.system,text:action.dataset.text,contactId:action.dataset.contactId,memberId:action.dataset.memberId,nextStatus:action.dataset.nextStatus,coachingId:action.dataset.coachingId});return;}});
function saveWrapUp(){
  const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',messages:(state.currentCall?.voiceReplies||[]).map(item=>({type:'agent',text:item.text,at:item.at,quality:item.quality})),dialogue:(state.currentCall?.dialogueTurns||[]).map(item=>({type:item.type,text:calloriaScrubDialogueValueV644(item.text),at:item.at,quality:item.quality||null})),conversationSummary:calloriaDialogueSummaryTextV644(state.currentCall?.dialogueTurns||[],state.currentCall?.customerMood,wrap.title),conversationMetrics:calloriaReviewDialogueV644(state.currentCall?.dialogueTurns||[],state.currentCall?.customerMood),timeline:contact.timeline.slice()};
    state.cases.push(record);
    calloriaQueueInboundQAV645({wrap,call:state.currentCall,contact,notes,disposition,createdAt});
}
document.addEventListener('submit',async e=>{
  if(e.target.id==='inboundDialogueFormV643'){e.preventDefault();const formData=new FormData(e.target);const value=e.submitter?.value==='voice'?voiceTranscript:formData.get('reply');calloriaSubmitInboundDialogueV643(value);return;}
  if(e.target.matches('[data-qa-coaching-followup]')){
    e.preventDefault();
    try{const f=new FormData(e.target);const record=calloriaRecordQACoachingFollowUpV646({id:f.get('coachingId'),outcome:f.get('outcome'),note:f.get('note'),reviewer:f.get('reviewer')});saveState();renderView();toast(record.status==='verified'?'QA coaching improvement verified.':'Further practice required; coaching plan reopened.','success');}
    catch(error){toast(error.message,'warning');}
    return;
  }
    if(e.target.id==='customerLabReplyForm'){e.preventDefault();submitCustomerTurn(state.customerLabSession,String(new FormData(e.target).get('reply')||''));return;}
  if(e.target.id==='humanQaReviewForm'){e.preventDefault();const review={id:'HQA-1',interactionId:'INB-1',reviewer:'QA reviewer',coaching:[]};state.humanQaReviews.push(review);calloriaCreateQACoachingPlansV646(review);return;}
});
