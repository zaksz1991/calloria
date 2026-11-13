/**
 * CALLORIA v6.42 — connect the existing microphone/text voice practice panel
 * to the active inbound contact, interaction timeline and CRM case transcript.
 *
 * The patch is designed against the current main-branch js/main.js workflow.
 * It stores only an explicitly logged, sanitised transcript; raw audio remains
 * in page memory under the application's existing voice-consent flow.
 */
const TARGET = '/js/main.js';
const MARKER = '__CALLORIA_VOICE_RESPONSE_WORKFLOW_V642__';

const CONSENT_ANCHOR = `    <label class="voice-consent"><input type="checkbox" id="voiceConsent" \${voiceConsent?'checked':''}> I consent to microphone use for this practice interaction. I understand browser speech recognition may be processed by the browser's speech service.</label>`;
const PRIVACY_ANCHOR = `    <div class="voice-privacy-note">Recording stays in this page's memory and is not uploaded or written to the employment save. Clear it before leaving a shared device. Never speak or enter a PIN, password, one-time code or full payment-card number.</div>`;
const APPLY_CALL_CHOICE_ANCHOR = 'function applyCallChoice(index){';
const ACTION_ANCHOR = "    case 'clear-voice-practice':clearVoicePractice();break;";
const CRM_RECORD_ANCHOR = "const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',timeline:contact.timeline.slice()};";

const HELPERS = String.raw`
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
`;

function count(source, needle) {
  return source.split(needle).length - 1;
}
function checkedReplace(context, source, anchor, replacement, label) {
  const found = count(source, anchor);
  if (found !== 1) {
    context.warn(`CALLORIA v6.42 skipped safely: expected one ${label} anchor, found ${found}. No partial transform was applied.`);
    return null;
  }
  return source.replace(anchor, replacement);
}

export function transformMain(context, input) {
  const original = String(input || '').replace(/\r\n?/g, '\n');
  if (original.includes(MARKER)) return null;
  const required = [
    [CONSENT_ANCHOR, 'voice-consent explanation'],
    [PRIVACY_ANCHOR, 'voice privacy notice'],
    [APPLY_CALL_CHOICE_ANCHOR, 'inbound call decision workflow'],
    [ACTION_ANCHOR, 'voice response action route'],
    [CRM_RECORD_ANCHOR, 'inbound CRM case record']
  ];
  const missing = required.filter(([anchor]) => count(original, anchor) !== 1);
  if (missing.length) {
    context.warn(`CALLORIA v6.42 skipped safely: ${missing.map(([, label]) => label).join(', ')} did not match current main.js. No partial transform was applied.`);
    return null;
  }

  let code = original;
  code = checkedReplace(context, code, CONSENT_ANCHOR,
    `    <label class="voice-consent"><input type="checkbox" id="voiceConsent" \${voiceConsent?'checked':''}> I consent to microphone use for this interaction. Browser speech recognition may be processed by the browser service. A transcript is saved to this contact's case history only when I explicitly log it and may sync with enabled cloud save.</label>`,
    'voice-consent explanation');
  if (code === null) return null;

  code = checkedReplace(context, code, PRIVACY_ANCHOR,
    `    <button class="btn primary" type="button" data-action="log-voice-response" \${!voiceTranscript.trim()||busy||call.held?'disabled':''}>Log agent response to contact</button>
    \${calloriaRenderVoiceHistoryV642(call)}
    <div class="voice-privacy-note">Microphone audio stays in this page's memory and is not saved. Only transcripts you explicitly log are added to the contact case history and may sync with enabled cloud save. Never capture PINs, passwords, one-time codes or full card numbers.</div>`,
    'voice response logging control and privacy notice');
  if (code === null) return null;

  code = checkedReplace(context, code, APPLY_CALL_CHOICE_ANCHOR,
    `${HELPERS}\nfunction applyCallChoice(index){`, 'inbound call decision workflow');
  if (code === null) return null;

  code = checkedReplace(context, code, ACTION_ANCHOR,
    `${ACTION_ANCHOR}\n    case 'log-voice-response':calloriaLogVoiceResponseV642();break;`,
    'voice response action route');
  if (code === null) return null;

  code = checkedReplace(context, code, CRM_RECORD_ANCHOR,
    `const record={reference:wrap.reference,contactId:wrap.contactId,customer:wrap.customer,title:wrap.title,channel:'Inbound',status,disposition,notes,qa:wrap.qa,acwSeconds,createdAt,owner:state.applicantName||'Agent',messages:(state.currentCall?.voiceReplies||[]).map(item=>({type:'agent',text:item.text,at:item.at,quality:item.quality})),timeline:contact.timeline.slice()};`,
    'inbound CRM case record');
  if (code === null) return null;

  return { code: `/* ${MARKER} */\n${code}`, map: null };
}

export function calloriaVoiceResponseWorkflowPlugin() {
  return {
    name: 'calloria-voice-response-workflow-v6-42',
    enforce: 'post',
    transform(source, id) {
      const target = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (target.endsWith(TARGET)) return transformMain(this, source);
      return null;
    }
  };
}

export const __calloriaV642Test = { transformMain, MARKER };
