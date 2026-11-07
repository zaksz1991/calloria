import test from 'node:test';
import assert from 'node:assert/strict';
import {
  speechRecognitionAvailable, mediaRecordingAvailable, sanitizeTranscript,
  createVoiceSession, appendVoiceTranscript, finishVoiceSession
} from '../js/voice-engine.js';

test('voice capability checks detect optional browser APIs without assuming support', () => {
  assert.equal(speechRecognitionAvailable({ SpeechRecognition: function () {} }), true);
  assert.equal(speechRecognitionAvailable({}), false);
  assert.equal(mediaRecordingAvailable({ mediaDevices: { getUserMedia() {} } }, { MediaRecorder: function () {} }), true);
  assert.equal(mediaRecordingAvailable({}, {}), false);
});

test('voice session requires explicit consent and a simulated interaction reference', () => {
  assert.throws(() => createVoiceSession({ interactionRef: 'CALL-1', consent: false }), /consent/);
  assert.throws(() => createVoiceSession({ consent: true }), /reference/);
  const session = createVoiceSession({ interactionRef: 'CALL-1', consent: true, startedAt: Date.UTC(2026, 10, 6) });
  assert.equal(session.storage, 'memory_only');
  assert.equal(session.transmission, 'no_calloria_upload');
  assert.equal(session.consented, true);
});

test('transcript sanitation redacts credentials, account details and payment-card numbers', () => {
  const safe = sanitizeTranscript('My PIN is 1234 and OTP: 456789. Card number 4111 1111 1111 1111. Reference 123456.');
  assert.doesNotMatch(safe, /1234|456789|4111|1111 1111/);
  assert.match(safe, /REDACTED CREDENTIAL/);
  assert.match(safe, /REDACTED FINANCIAL DETAIL|REDACTED PAYMENT CARD/);
  assert.match(safe, /REDACTED NUMBER/);
});

test('transcripts append only to a consented in-memory session and are bounded', () => {
  const session = createVoiceSession({ interactionRef: 'SIM-CALL-2', consent: true });
  assert.equal(appendVoiceTranscript(session, 'Hello customer.'), 'Hello customer.');
  assert.match(appendVoiceTranscript(session, 'PIN 1234'), /REDACTED CREDENTIAL/);
  assert.throws(() => appendVoiceTranscript(null, 'No session'), /consented voice session/);
  const finished = finishVoiceSession(session, Date.UTC(2026, 10, 6));
  assert.ok(finished.endedAt);
  assert.equal(finishVoiceSession(null), null);
});

test('voice session sanitiser limits transcript length', () => {
  const session = createVoiceSession({ interactionRef: 'SIM-CALL-3', consent: true });
  const result = appendVoiceTranscript(session, 'x'.repeat(13000));
  assert.ok(result.length <= 12000);
});
