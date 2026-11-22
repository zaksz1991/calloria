import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDigitalResponse, renderDigitalResponseCoach, installCalloriaDigitalResponseQualityCoach } from '../js/digital-response-quality-coach-v715.js';
import { transformCalloriaDigitalMainSource, CALLORIA_DIGITAL_COACH_MARKER } from '../build/calloria-digital-response-quality-coach-v715.mjs';

const strongReply = 'I understand your concern and I will review the transaction record. I will provide a case reference and update you through the secure channel after the checks are complete.';

test('strong digital reply satisfies all five coaching dimensions', () => {
  const result = analyzeDigitalResponse({ channel: 'email' }, strongReply);
  assert.equal(result.score, 100);
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test('reply missing acknowledgement and ownership receives coaching warnings, not a hard block', () => {
  const result = analyzeDigitalResponse({ channel: 'live_chat' }, 'The next step is a case reference and an update from the support team.');
  assert.equal(result.allowed, true);
  assert.equal(result.checks.acknowledgement, false);
  assert.equal(result.checks.ownership, false);
  assert.ok(result.warnings.length >= 2);
});

test('explicitly warning customers not to share secrets is not misclassified as a request', () => {
  const result = analyzeDigitalResponse({ channel: 'email' }, 'I understand the concern. I will check the record and provide an update. Never share your PIN or one-time passcode with anyone.');
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test('requesting OTP or password is blocked', () => {
  const result = analyzeDigitalResponse({ channel: 'live_chat' }, 'I understand. Please send your OTP and password so I can investigate and update you.');
  assert.equal(result.allowed, false);
  assert.match(result.blockers.join(' '), /OTP/);
});

test('public social reply requesting account or personal details is blocked', () => {
  const result = analyzeDigitalResponse({ channel: 'social' }, 'I am sorry and will investigate. Please post your account number here so I can trace it.');
  assert.equal(result.allowed, false);
  assert.match(result.blockers.join(' '), /public social response/);
});

test('social support request explicitly routed to a verified private channel is allowed', () => {
  const result = analyzeDigitalResponse({ channel: 'social' }, 'I understand and will investigate. Please send the account reference through our verified private support channel so we can review it safely.');
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test('public social reply without a private-channel route remains allowed but gets a warning', () => {
  const result = analyzeDigitalResponse({ channel: 'social' }, 'I understand the issue and will review it. The support team will provide an update on the case.');
  assert.equal(result.allowed, true);
  assert.equal(result.checks.privacy, false);
  assert.ok(result.warnings.some(item => /verified private channel/.test(item)));
});

test('unverified guarantees are flagged for factual review but not automatically blocked', () => {
  const result = analyzeDigitalResponse({ channel: 'email' }, 'I understand and will check the case. I guarantee the refund will be completed today.');
  assert.equal(result.allowed, true);
  assert.equal(result.checks.factual, false);
  assert.ok(result.warnings.some(item => /Verify any stated outcome/.test(item)));
});

test('unmasked card-number content is blocked', () => {
  const result = analyzeDigitalResponse({ channel: 'email' }, 'I understand and will check your card 4111 1111 1111 1111 and update you.');
  assert.equal(result.allowed, false);
  assert.match(result.blockers.join(' '), /payment-card numbers/);
});

test('rendered coach only emits controlled channel data', () => {
  const html = renderDigitalResponseCoach({ channel: 'social', customer: '<img src=x onerror=alert(1)>' });
  assert.match(html, /data-channel="social"/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-live="polite"/);
});

test('invalid channel falls back to email', () => {
  const html = renderDigitalResponseCoach({ channel: 'other' });
  assert.match(html, /data-channel="email"/);
});

const MULTICHANNEL_IMPORT = "import { DIGITAL_CHANNELS, DIGITAL_STATUS, DIGITAL_SCENARIOS, createDigitalQueue, sortDigitalQueue, findDigitalContact, acceptDigitalContact, recordDigitalReply, deliverDigitalFollowUp, completeDigitalContact, digitalQueueMetrics, appendDigitalEvent } from './multichannel-engine.js';";
const COMPOSER_ANCHOR = '        ${active.status === DIGITAL_STATUS.ACTIVE ? `<div class="digital-template-row">';
const fixtureSource = () => `${MULTICHANNEL_IMPORT}\nfunction render(){ return \`${COMPOSER_ANCHOR}\n\`; }`;

test('main transform injects coach import and panel once', () => {
  const transformed = transformCalloriaDigitalMainSource(fixtureSource());
  assert.equal(transformed.changed, true);
  assert.match(transformed.code, /renderDigitalResponseCoach\(active\)/);
  assert.match(transformed.code, new RegExp(CALLORIA_DIGITAL_COACH_MARKER));
});

test('main transform is idempotent', () => {
  const once = transformCalloriaDigitalMainSource(fixtureSource());
  const twice = transformCalloriaDigitalMainSource(once.code);
  assert.equal(twice.alreadyPatched, true);
  assert.equal(twice.changed, false);
  assert.equal(twice.code, once.code);
});

test('main transform refuses partial injection when anchors drift', () => {
  const result = transformCalloriaDigitalMainSource('const currentView = "digital";');
  assert.equal(result.changed, false);
  assert.match(result.reason, /anchors did not match exactly once/);
  assert.equal(result.code, 'const currentView = "digital";');
});

function fakeCoachDom(channel, draft) {
  const listeners = {};
  const field = { value: draft, focused: false, focus() { this.focused = true; } };
  const nodes = {
    score: { textContent: '' },
    feedback: { textContent: '' },
    blockers: { hidden: true, textContent: '' }
  };
  const rows = new Map();
  for (const key of ['acknowledgement','ownership','nextStep','privacy','factual']) {
    const children = { '.cdrq-check-icon': { textContent: '' }, strong: { textContent: '' } };
    rows.set(key, { classList: { toggle() {} }, querySelector(selector) { return children[selector]; } });
  }
  const list = { querySelector(selector) { const match = selector.match(/data-cdrq-check="([^"]+)"/); return match ? rows.get(match[1]) : null; } };
  const panel = {
    dataset: { channel },
    querySelector(selector) {
      if (selector === '[data-cdrq-score]') return nodes.score;
      if (selector === '[data-cdrq-feedback]') return nodes.feedback;
      if (selector === '[data-cdrq-checks]') return list;
      if (selector === '[data-cdrq-blockers]') return nodes.blockers;
      return null;
    }
  };
  const thread = { querySelector(selector) { return selector === '[data-digital-response-coach]' ? panel : null; } };
  const form = {
    matches(selector) { return selector === '#digitalReplyForm'; },
    closest(selector) { return selector === '.digital-thread-panel' ? thread : null; },
    querySelector(selector) { return selector === 'textarea[name="reply"]' ? field : null; }
  };
  const documentStub = { documentElement: { dataset: {} }, addEventListener(name, handler, capture) { listeners[name] = { handler, capture }; } };
  return { documentStub, listeners, form, field, nodes };
}

test('capture-phase submit guard stops an unsafe credential request before native submit handling', () => {
  const previous = globalThis.document;
  const fake = fakeCoachDom('live_chat', 'I understand. Please send your OTP so I can check this and update you.');
  try {
    globalThis.document = fake.documentStub;
    installCalloriaDigitalResponseQualityCoach();
    const listener = fake.listeners.submit;
    assert.equal(listener.capture, true);
    let prevented = false;
    let stopped = false;
    listener.handler({ target: fake.form, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.equal(prevented, true);
    assert.equal(stopped, true);
    assert.equal(fake.field.focused, true);
    assert.match(fake.nodes.blockers.textContent, /OTP/);
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('capture-phase submit guard leaves non-blocking coaching gaps sendable', () => {
  const previous = globalThis.document;
  const fake = fakeCoachDom('email', 'The case is under review. The support team will provide an update through the case reference.');
  try {
    globalThis.document = fake.documentStub;
    installCalloriaDigitalResponseQualityCoach();
    let prevented = false;
    let stopped = false;
    fake.listeners.submit.handler({ target: fake.form, preventDefault() { prevented = true; }, stopImmediatePropagation() { stopped = true; } });
    assert.equal(prevented, false);
    assert.equal(stopped, false);
    assert.equal(fake.nodes.score.textContent, '60 / 100');
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});
