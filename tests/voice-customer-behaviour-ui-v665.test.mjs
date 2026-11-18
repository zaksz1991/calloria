import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('main application imports every engine operation used by the v6.65 voice workflow', () => {
  for (const name of ['VOICE_CUSTOMER_BEHAVIOUR_POLICY','ensureVoiceCustomerBehaviour','evaluateVoiceCustomerTurn','evaluateVoiceAgentUtterance','resolveVoiceCustomerDecision','voiceCustomerBehaviourSnapshot','voiceCustomerOutcome','sanitizeVoiceCustomerText']) {
    assert.match(main, new RegExp(`\\b${name}\\b`));
  }
  assert.match(main, /from '\.\/voice-customer-behaviour-engine\.js'/);
});

test('accepted inbound calls create and retain the same voice behaviour state as the active call', () => {
  assert.match(main, /ensureVoiceCustomerBehaviour\(state\.currentCall,contact,scenario,queueAcceptedAt\)/);
  assert.match(main, /ensureVoiceCustomerBehaviour\(call,contact,scenario,queueSimulationNowMs\(\)\)/);
  assert.match(main, /voiceCustomerBehaviourSnapshot\(call\.voiceBehaviour\)/);
  assert.match(main, /const transcript=voiceBehaviour\?\.transcript\|\|\[\]/);
});

test('guided and free-form agent responses update the same persisted customer dialogue', () => {
  assert.match(main, /evaluateVoiceAgentUtterance\(call\.voiceBehaviour,utterance/);
  assert.match(main, /evaluateVoiceCustomerTurn\(call\.voiceBehaviour/);
  assert.match(main, /recordInboundVoiceTurn\(call,contact,safe,'free_response'\)/);
  assert.match(main, /call\.voiceReplyRequired=!!result\.pendingDecision/);
});

test('customer interruptions and negotiation decisions pause the call until resolved', () => {
  assert.match(main, /CUSTOMER RESPONSE REQUIRED/);
  assert.match(main, /data-action="resolve-voice-decision"/);
  assert.match(main, /case 'resolve-voice-decision':resolveInboundVoiceDecision\(event\.optionId\)/);
  assert.match(main, /state\.currentCall\?\.voiceBehaviour\?\.pendingDecision/);
  assert.match(main, /Resolve the customer interruption or outstanding service-recovery question/);
});

test('the active voice customer behaviour monitor displays sentiment, patience and quality flags', () => {
  assert.match(main, /Live customer behaviour/);
  assert.match(main, /Customer interruptions/);
  assert.match(main, /Service-recovery requests/);
  assert.match(main, /voiceBehaviour\.qualityFlags\.length/);
});

test('supervisor command centre receives active voice risk, interruption and security indicators', () => {
  assert.match(main, /const activeVoiceBehaviour=state\.currentCall\?\.voiceBehaviour\?voiceCustomerBehaviourSnapshot/);
  assert.match(main, /VOICE SECURITY BREACHES/);
  assert.match(main, /VOICE INTERRUPTIONS/);
  assert.match(main, /ensureVoiceSupervisorRequest\(call,contact,snapshot\.supervisorReason/);
});

test('wrap-up outcome and CRM case preserve sanitised voice transcript and review flags', () => {
  assert.match(main, /voiceCustomerOutcome\(call\.voiceBehaviour\)/);
  assert.match(main, /voiceTranscript:wrap\.voiceBehaviour\?\.transcript/);
  assert.match(main, /voiceQualityFlags:voiceFlags/);
  assert.match(main, /voiceNegotiationStatus:wrap\.voiceBehaviour\?\.negotiationResolved/);
  assert.match(main, /voiceOutcome:wrap\.voiceOutcome\?\.outcome/);
  assert.match(main, /wrap\.voiceRequiresEscalation/);
});

test('voice response controls enforce the bounded turn count', () => {
  assert.match(main, /const turnLimitReached=\(Number\(voiceBehaviour\?\.turns\)\|\|0\)>=VOICE_CUSTOMER_BEHAVIOUR_POLICY\.maxAgentTurns/);
  assert.match(main, /voice conversation reached its turn limit/i);
  assert.match(main, /const wrapUpReady=call\.stepIndex===scenario\.steps\.length-1\|\|turnLimitReached/);
  assert.match(main, /Conversation turn limit reached/);
});

test('microphone capture remains explicit-consent and local to the current browser session', () => {
  assert.match(main, /I consent to microphone use/);
  assert.match(main, /createVoiceSession\(\{ interactionRef:[^}]*consent: true/);
  assert.match(main, /CALLORIA does not upload the recording or transcript to a telephone provider/);
});

test('syntax checks include the new voice customer behaviour engine', () => {
  assert.match(pkg.scripts.check, /node --check js\/voice-customer-behaviour-engine\.js/);
});

test('voice transcript and decision panels have responsive styling', () => {
  assert.match(css, /\.voice-dialogue-line\.interruption/);
  assert.match(css, /\.voice-decision-panel/);
  assert.match(css, /@media\(max-width:600px\)\{\.voice-live-dialogue/);
});
