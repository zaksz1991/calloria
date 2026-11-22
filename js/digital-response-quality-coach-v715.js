const CHANNELS = new Set(['email', 'live_chat', 'social']);
const CHECK_LABELS = Object.freeze({
  acknowledgement: 'Acknowledge the customer concern',
  ownership: 'Show ownership and an action you will take',
  nextStep: 'Explain the next step or update route',
  privacy: 'Protect customer information',
  factual: 'Avoid unsupported guarantees or outcomes'
});

function safeChannel(contact) {
  const channel = String(contact?.channel || 'email');
  return CHANNELS.has(channel) ? channel : 'email';
}

function stripExplicitSafetyWarnings(text) {
  return String(text || '').toLowerCase().replace(
    /\b(?:never|do not|don't|will not|won't)\s+(?:ask(?: you to)?|request|share|send|provide|disclose|tell|give)\b[^.!?]{0,120}/gi,
    ' '
  );
}

function requestsCredentials(text) {
  const safeText = stripExplicitSafetyWarnings(text);
  const credential = '(?:pin|password|otp|one[- ]time (?:password|passcode)|cvv|cvc|security code)';
  const action = '(?:send|share|provide|tell me|type|enter|confirm|disclose|reply with)';
  return new RegExp(`\\b${action}\\b.{0,50}\\b${credential}\\b|\\b${credential}\\b.{0,50}\\b${action}\\b`, 'i').test(safeText);
}

function requestsSensitiveSocialDetails(text) {
  const safeText = stripExplicitSafetyWarnings(text);
  const explicitPrivateRoute = /\b(?:verified|official|secure|private)\b.{0,40}\b(?:channel|message|dm|direct message)\b|\b(?:channel|message|dm|direct message)\b.{0,40}\b(?:verified|official|secure|private)\b/i.test(safeText);
  if (explicitPrivateRoute) return false;
  const action = '(?:send|share|post|publish|reply with|provide|tell me|type|enter)';
  const detail = '(?:account number|card number|full card details|phone number|email address|home address|date of birth|national identification number|nin)';
  return new RegExp(`\\b${action}\\b.{0,60}\\b${detail}\\b|\\b${detail}\\b.{0,60}\\b${action}\\b`, 'i').test(safeText);
}

function containsUnmaskedCardNumber(text) {
  return /\b(?:card|pan|payment card)\b[^.!?]{0,35}\b(?:\d[ -]?){13,19}\b/i.test(String(text || ''));
}

function containsUnsupportedOutcome(text) {
  const safeText = String(text || '').toLowerCase();
  const promises = /\b(?:guarantee(?:d)?|promise you|will definitely|definitely (?:be )?(?:fixed|resolved|refunded|credited)|refund (?:has been|was|is) approved|we have (?:refunded|reversed|credited)|case (?:is )?closed|will be fixed today)\b/i;
  if (!promises.test(safeText)) return false;
  return !/\b(?:cannot|can't|won't|will not|not able to)\b.{0,35}\b(?:guarantee|promise)\b/i.test(safeText);
}

export function analyzeDigitalResponse(contact, message) {
  const channel = safeChannel(contact);
  const text = String(message ?? '').trim();
  const blockers = [];
  const warnings = [];

  if (requestsCredentials(text)) blockers.push('Do not request a PIN, password, OTP, CVV or security code.');
  if (containsUnmaskedCardNumber(text)) blockers.push('Remove unmasked payment-card numbers from the reply.');
  if (channel === 'social' && requestsSensitiveSocialDetails(text)) {
    blockers.push('Do not request account or personal identifiers in a public social response. Move the customer to an approved verified private channel.');
  }

  const checks = {
    acknowledgement: /\b(understand|sorry|apolog|appreciate|thank you|acknowledge|recognise|recognize|concern)\b/i.test(text),
    ownership: /\b(i will|i'll|let me|i can|we can|we will|we'll|i am going to|i'm going to|i have asked|i have referred)\b/i.test(text)
      && /\b(check|review|trace|investigate|assist|help|look into|support|confirm|refer|follow up)\b/i.test(text),
    nextStep: /\b(next step|update|reference|case|follow up|follow-up|within|contact you|process|team|secure channel|private message|direct message|dm)\b/i.test(text),
    privacy: !requestsCredentials(text) && !containsUnmaskedCardNumber(text)
      && (channel !== 'social' || /\b(private|direct message|dm|verified|official channel|secure channel)\b/i.test(text)),
    factual: !containsUnsupportedOutcome(text)
  };

  if (text.length > 0 && !checks.acknowledgement) warnings.push('Add a brief acknowledgement of the customer’s concern.');
  if (text.length > 0 && !checks.ownership) warnings.push('Make ownership explicit and name an action you will take.');
  if (text.length > 0 && !checks.nextStep) warnings.push('Explain the next step, reference or update route.');
  if (channel === 'social' && text.length > 0 && !checks.privacy && blockers.length === 0) {
    warnings.push('Move account-specific support to an approved verified private channel.');
  }
  if (containsUnsupportedOutcome(text)) warnings.push('Verify any stated outcome or commitment against the simulated record before sending.');

  const passed = Object.values(checks).filter(Boolean).length;
  return {
    channel,
    score: Math.round((passed / Object.keys(checks).length) * 100),
    checks,
    blockers,
    warnings,
    allowed: blockers.length === 0,
    method: 'deterministic-coaching-prompt-not-a-human-qa-score'
  };
}

export function renderDigitalResponseCoach(contact) {
  const channel = safeChannel(contact);
  const channelGuidance = channel === 'social'
    ? 'Public reply: acknowledge the issue only. Do not request identifiers; use an approved verified private channel for account-specific support.'
    : channel === 'live_chat'
      ? 'Live chat: keep the response concise, explain one clear action at a time and never request authentication secrets.'
      : 'Email: acknowledge the issue, state what will be checked and explain the next update route without promising an unverified outcome.';

  return `<section class="panel calloria-digital-response-coach" data-digital-response-coach data-channel="${channel}" aria-label="Digital response quality coach">
    <div class="cdrq-head"><div><span class="subtle-label">LIVE RESPONSE COACH</span><h4>Digital reply quality check</h4><p>${channelGuidance}</p></div><span class="cdrq-score" data-cdrq-score>— / 100</span></div>
    <ul class="cdrq-checks" data-cdrq-checks aria-live="polite">
      ${Object.entries(CHECK_LABELS).map(([key, label]) => `<li data-cdrq-check="${key}"><span class="cdrq-check-icon">○</span><span>${label}</span><strong>Pending</strong></li>`).join('')}
    </ul>
    <p class="cdrq-feedback" data-cdrq-feedback role="status" aria-live="polite">Draft your reply to receive live guidance. This is a coaching aid, not a replacement for human QA.</p>
    <div class="cdrq-blockers" data-cdrq-blockers hidden></div>
  </section>`;
}

function updateCoach(panel, review, hasDraft) {
  const score = panel.querySelector('[data-cdrq-score]');
  const feedback = panel.querySelector('[data-cdrq-feedback]');
  const list = panel.querySelector('[data-cdrq-checks]');
  const blockers = panel.querySelector('[data-cdrq-blockers]');
  if (!score || !feedback || !list || !blockers) return;

  score.textContent = hasDraft ? `${review.score} / 100` : '— / 100';
  for (const [key, passed] of Object.entries(review.checks)) {
    const row = list.querySelector(`[data-cdrq-check="${key}"]`);
    if (!row) continue;
    row.classList.toggle('is-passed', Boolean(passed));
    row.classList.toggle('is-pending', !hasDraft);
    row.querySelector('.cdrq-check-icon').textContent = !hasDraft ? '○' : passed ? '✓' : '•';
    row.querySelector('strong').textContent = !hasDraft ? 'Pending' : passed ? 'Checked' : 'Review';
  }

  blockers.hidden = review.blockers.length === 0;
  blockers.textContent = review.blockers.join(' ');
  if (!hasDraft) feedback.textContent = 'Draft your reply to receive live guidance. This is a coaching aid, not a replacement for human QA.';
  else if (review.blockers.length) feedback.textContent = 'Sending is blocked until the safety issue is removed.';
  else if (review.warnings.length) feedback.textContent = review.warnings.join(' ');
  else if (review.score === 100) feedback.textContent = 'All five coaching checks are present. Confirm the facts in the record before sending.';
  else feedback.textContent = 'Review the highlighted checks. These are coaching prompts; they do not change the native practice QA score.';
}

export function installCalloriaDigitalResponseQualityCoach() {
  if (typeof document === 'undefined' || document.documentElement.dataset.calloriaDigitalCoachInstalled === 'true') return;
  document.documentElement.dataset.calloriaDigitalCoachInstalled = 'true';

  const findPanel = form => form?.closest('.digital-thread-panel')?.querySelector('[data-digital-response-coach]') || null;
  const reviewForm = form => {
    const panel = findPanel(form);
    if (!panel) return null;
    const field = form.querySelector('textarea[name="reply"]');
    const draft = String(field?.value || '');
    const review = analyzeDigitalResponse({ channel: panel.dataset.channel }, draft);
    updateCoach(panel, review, draft.trim().length > 0);
    return { panel, field, review };
  };

  document.addEventListener('input', event => {
    if (!event.target?.matches?.('#digitalReplyForm textarea[name="reply"]')) return;
    reviewForm(event.target.form);
  });

  // Capture runs before the application's delegated submit handler. Only hard
  // safety blockers stop the send; missing coaching dimensions remain advisory.
  document.addEventListener('submit', event => {
    const form = event.target?.matches?.('#digitalReplyForm') ? event.target : null;
    if (!form) return;
    const result = reviewForm(form);
    if (!result || result.review.allowed) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    result.field?.focus();
  }, true);
}

if (typeof document !== 'undefined') installCalloriaDigitalResponseQualityCoach();
