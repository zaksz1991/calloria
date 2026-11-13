/**
 * CALLORIA v6.43 — scripted live customer dialogue for active inbound calls.
 * Adds a free-text exchange to the existing inbound call screen, accepts the
 * optional voice transcript as an agent reply, evaluates a small deterministic
 * communication rubric, and records both sides of the simulated exchange in
 * the active contact timeline. This is local scripted simulation, not AI or
 * a real telephony integration.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_INBOUND_CUSTOMER_DIALOGUE_V643__';

const APPLY_CALL_CHOICE_ANCHOR = 'function applyCallChoice(index){';
const SUPERVISOR_ANCHOR = "const supervisorOpen=state.supervisorRequests.some(item=>item.contactId===call.queueContactId&&item.status==='open');";
const RENDER_ANCHOR = '</p><div class="panel-head" style="margin:16px 0 11px">';
const SUBMIT_ANCHOR = "document.addEventListener('submit',async e=>{\n  if(e.target.id==='customerLabReplyForm')";
const CRM_MESSAGES_ANCHOR = "messages:(state.currentCall?.voiceReplies||[]).map(item=>({type:'agent',text:item.text,at:item.at,quality:item.quality})),timeline:contact.timeline.slice()";

const HELPERS = String.raw`
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
`;

function count(source, needle) { return source.split(needle).length - 1; }
function checkedReplace(context, source, anchor, replacement, label) {
  const found=count(source,anchor);
  if(found!==1){context.warn(`CALLORIA v6.43 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);return null;}
  return source.replace(anchor,replacement);
}

export function transformMain(context,input){
  const original=String(input||'').replace(/\r\n?/g,'\n');
  if(original.includes(MARKER))return null;
  const required=[
    [APPLY_CALL_CHOICE_ANCHOR,'inbound call decision workflow'],
    [SUPERVISOR_ANCHOR,'active inbound call rendering'],
    [RENDER_ANCHOR,'inbound call conversation placement'],
    [SUBMIT_ANCHOR,'global form submission workflow'],
    [CRM_MESSAGES_ANCHOR,'inbound CRM case transcript']
  ];
  const missing=required.filter(([anchor])=>count(original,anchor)!==1);
  if(missing.length){context.warn(`CALLORIA v6.43 skipped safely: ${missing.map(([,label])=>label).join(', ')} did not match current main.js. No partial transform was applied.`);return null;}
  let code=original;
  code=checkedReplace(context,code,APPLY_CALL_CHOICE_ANCHOR,`${HELPERS}\nfunction applyCallChoice(index){`,'inbound call decision workflow');
  if(code===null)return null;
  code=checkedReplace(context,code,SUPERVISOR_ANCHOR,`${SUPERVISOR_ANCHOR}\n   const liveDialogueMarkup=calloriaRenderInboundDialogueV643(call,scenario);`,'active inbound call rendering');
  if(code===null)return null;
  code=checkedReplace(context,code,RENDER_ANCHOR,`</p>\${liveDialogueMarkup}<div class="panel-head" style="margin:16px 0 11px">`,'inbound call conversation placement');
  if(code===null)return null;
  code=checkedReplace(context,code,SUBMIT_ANCHOR,`document.addEventListener('submit',async e=>{\n  if(e.target.id==='inboundDialogueFormV643'){e.preventDefault();const formData=new FormData(e.target);const value=e.submitter?.value==='voice'?voiceTranscript:formData.get('reply');calloriaSubmitInboundDialogueV643(value);return;}\n  if(e.target.id==='customerLabReplyForm')`,'global form submission workflow');
  if(code===null)return null;
  code=checkedReplace(context,code,CRM_MESSAGES_ANCHOR,"messages:(state.currentCall?.voiceReplies||[]).map(item=>({type:'agent',text:item.text,at:item.at,quality:item.quality})),dialogue:(state.currentCall?.dialogueTurns||[]).map(item=>({type:item.type,text:item.text,at:item.at,quality:item.quality||null})),timeline:contact.timeline.slice()",'inbound CRM case transcript');
  if(code===null)return null;
  return {code:`/* ${MARKER} */\n${code}`,map:null};
}

export function calloriaInboundCustomerDialoguePlugin(){
  return {name:'calloria-inbound-customer-dialogue-v6-43',enforce:'post',transform(source,id){
    const target=String(id||'').split('?')[0].replaceAll('\\','/');
    if(target.endsWith(TARGET))return transformMain(this,source);
    return null;
  }};
}

export const __calloriaV643Test={transformMain,MARKER,calloriaDialogueReviewV643:undefined};
