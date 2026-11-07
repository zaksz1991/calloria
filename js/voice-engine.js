const MAX_TRANSCRIPT_LENGTH = 12000;

export function speechRecognitionAvailable(windowRef = globalThis.window) {
  return !!(windowRef?.SpeechRecognition || windowRef?.webkitSpeechRecognition);
}

export function mediaRecordingAvailable(navigatorRef = globalThis.navigator, windowRef = globalThis.window) {
  return !!(navigatorRef?.mediaDevices?.getUserMedia && windowRef?.MediaRecorder);
}

export function sanitizeTranscript(value = '') {
  return String(value)
    .replace(/\b(?:pin|otp|one[- ]time password|password|passcode)\s*[:=-]?\s*[a-z0-9]{3,12}\b/gi, '[REDACTED CREDENTIAL]')
    .replace(/\b(?:account|card|cvv|cvc|security code)\s*(?:number)?\s*[:#=-]?\s*(?:\d[ -]?){3,19}\b/gi, '[REDACTED FINANCIAL DETAIL]')
    .replace(/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED PAYMENT CARD]')
    .replace(/\b\d{4,8}\b/g, '[REDACTED NUMBER]')
    .slice(0, MAX_TRANSCRIPT_LENGTH);
}

export function createVoiceSession({ interactionRef, consent = false, startedAt = Date.now() } = {}) {
  if (!consent) throw new Error('Explicit microphone consent is required.');
  if (!interactionRef) throw new TypeError('A simulated interaction reference is required.');
  return {
    id: `VOICE-${startedAt}-${String(interactionRef).replace(/[^a-z0-9-]/gi, '').slice(0, 40)}`,
    interactionRef: String(interactionRef),
    startedAt: new Date(startedAt).toISOString(),
    endedAt: null,
    consented: true,
    storage: 'memory_only',
    transmission: 'no_calloria_upload',
    transcript: ''
  };
}

export function appendVoiceTranscript(session, text) {
  if (!session || !session.consented) throw new Error('A consented voice session is required.');
  const safe = sanitizeTranscript(text);
  session.transcript = `${session.transcript}${session.transcript ? '\n' : ''}${safe}`.slice(0, MAX_TRANSCRIPT_LENGTH);
  return session.transcript;
}

export function finishVoiceSession(session, endedAt = Date.now()) {
  if (!session) return null;
  session.endedAt = new Date(endedAt).toISOString();
  return session;
}
