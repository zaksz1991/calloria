import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOICE_LANGUAGES, VOICE_DEPARTMENTS, validNigeriaE164, validE164Nigeria, maskVoiceNumber,
  voiceLanguage, voiceDepartment, xmlEscape, buildLanguageMenu, buildDepartmentMenu,
  buildDialResponse, normalizeCallStatus, validateCallbackEvidence, buildSignalsSignaturePayload,
  computeSignalsSignature
} from '../js/voice-telephony-engine.js';

test('supports the five configured Nigerian customer languages', () => {
  assert.deepEqual(VOICE_LANGUAGES, ['en','ha','yo','ig','pcm']);
  assert.equal(voiceLanguage('1'),'en'); assert.equal(voiceLanguage('2'),'ha');
  assert.equal(voiceLanguage('3'),'yo'); assert.equal(voiceLanguage('4'),'ig');
  assert.equal(voiceLanguage('5'),'pcm'); assert.equal(voiceLanguage('9'),null);
});

test('maps every IVR department to a distinct intent, skill and priority', () => {
  assert.equal(VOICE_DEPARTMENTS.length,6);
  assert.equal(voiceDepartment('1').skill,'platform_support');
  assert.equal(voiceDepartment('2').skill,'sales');
  assert.equal(voiceDepartment('3').priority,'high');
  assert.equal(voiceDepartment('4').skill,'personal_guidance');
  assert.equal(voiceDepartment('5').skill,'general_customer_care');
  assert.equal(voiceDepartment('6').priority,'urgent');
  assert.equal(voiceDepartment('x'),null);
});

test('accepts Nigeria E.164 PSTN DIDs and mobile numbers, rejects malformed inputs', () => {
  assert.equal(validNigeriaE164('+2342013300117'),'+2342013300117');
  assert.equal(validE164Nigeria('+2348031234567'),'+2348031234567');
  assert.throws(()=>validNigeriaE164('08031234567'),/\+234/);
  assert.throws(()=>validE164Nigeria('+2342013300117'),/mobile/);
  assert.throws(()=>validE164Nigeria('+15551234567'),/Nigerian/);
});

test('masks caller IDs and does not return the original number', () => {
  const masked=maskVoiceNumber('+2348031234567');
  assert.match(masked,/\+234/); assert.match(masked,/4567$/);
  assert.ok(!masked.includes('803123'));
});

test('escapes XML control characters and does not permit injected elements', () => {
  assert.equal(xmlEscape(`<Say a="b">Ruff & Neck</Say>`),'&lt;Say a=&quot;b&quot;&gt;Ruff &amp; Neck&lt;/Say&gt;');
});

test('language IVR emits one bounded Gather and a signed-action URL location', () => {
  const xml=buildLanguageMenu('https://calloria.example/voice?flow=language&callSid=CA123');
  assert.match(xml,/<Gather numDigits="1" timeout="8"/);
  assert.match(xml,/For Hausa, press 2/);
  assert.match(xml,/<Hangup\/>/);
  assert.ok(!xml.includes('<Record'));
});

test('department IVR renders language prompts with escaped callback URL', () => {
  const xml=buildDepartmentMenu('ha','https://example.test/voice?a="x"');
  assert.match(xml,/Don samun taimakon dandamali/);
  assert.match(xml,/&quot;x&quot;/);
  assert.match(xml,/press 6|danna 6/);
});

test('dial flow can call only one explicitly configured agent handset', () => {
  const xml=buildDialResponse('+2348031234567','https://example.test/voice?flow=dial-result','en');
  assert.match(xml,/<Dial timeout="22"/);
  assert.match(xml,/<Number>\+2348031234567<\/Number>/);
  assert.ok(!xml.includes('<Record'));
});

test('missing on-call handset produces a safe fallback and ends the call', () => {
  const xml=buildDialResponse('', 'https://example.test/voice?flow=dial-result');
  assert.match(xml,/not available/); assert.match(xml,/<Hangup\/>/); assert.ok(!xml.includes('<Dial'));
});

test('provider status normalization is allow-listed', () => {
  for (const status of ['queued','ringing','in-progress','completed','busy','no-answer','failed','canceled']) assert.equal(normalizeCallStatus(status),status);
  assert.equal(normalizeCallStatus('IN-PROGRESS'),'in-progress');
  assert.equal(normalizeCallStatus('arbitrary-control'),'failed');
});

test('callback evidence requires a traceable bounded reference', () => {
  assert.equal(validateCallbackEvidence('CRM:CONSENT-2026-001'),'CRM:CONSENT-2026-001');
  assert.throws(()=>validateCallbackEvidence('x'),/traceable/);
  assert.throws(()=>validateCallbackEvidence('<script>alert(1)</script>'),/traceable/);
});

test('Signals request signature payload sorts fields and de-duplicates repeated values', () => {
  const params=new URLSearchParams();params.append('To','+2348031');params.append('From','+234201');params.append('To','+2348031');
  assert.equal(buildSignalsSignaturePayload('https://example.test/v?flow=status',params),'https://example.test/v?flow=statusFrom+234201To+2348031');
});

test('computes an HMAC-SHA1 base64 provider signature', async () => {
  const params=new URLSearchParams('CallSid=CA123&SequenceNumber=2');
  const signature=await computeSignalsSignature('voice-auth-token','https://example.test/voice?flow=status',params);
  assert.match(signature,/^[A-Za-z0-9+/]+=*$/);
  assert.equal(signature,await computeSignalsSignature('voice-auth-token','https://example.test/voice?flow=status',params));
  assert.notEqual(signature,await computeSignalsSignature('different-token','https://example.test/voice?flow=status',params));
});
