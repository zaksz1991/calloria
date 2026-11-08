import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyChatIntent, getProductHelp, redactChatText, validatePublicChatInput, WEB_CHAT_PRODUCTS } from '../js/web-chat-engine.js';

test('six RuffNeck product websites are covered by self-service catalogue', () => {
  assert.equal(WEB_CHAT_PRODUCTS.length, 6);
  for (const id of WEB_CHAT_PRODUCTS) {
    const help = getProductHelp(id);
    assert.ok(help?.url.startsWith('https://'));
    assert.ok(help.help.length > 0);
    assert.ok(help.help.every(row => row.steps.length > 0));
  }
});

test('guest chat requires explicit consent, valid topic, language and useful message', () => {
  const valid = validatePublicChatInput({ platformId: 'ruffneck-learn', intent: 'platform_support', language: 'en', message: 'I cannot locate my enrolled course.', consent: true });
  assert.equal(valid.platformId, 'ruffneck-learn');
  assert.throws(() => validatePublicChatInput({ platformId: 'ruffneck-learn', intent: 'platform_support', language: 'en', message: 'Course not found', consent: false }), /Consent/);
  assert.throws(() => validatePublicChatInput({ platformId: 'unknown', intent: 'general', language: 'en', message: 'I need support with my account.', consent: true }), /not configured/);
  assert.throws(() => validatePublicChatInput({ platformId: 'kano-keke', intent: 'general', language: 'fr', message: 'I need support with my shift.', consent: true }), /supported language/);
});

test('credentials, emails, phone numbers and long account-like numbers are redacted before storage', () => {
  const redacted = redactChatText('My password is secret123, OTP: 552911, email me at user@example.com or call +234 803 123 4567. Card 4111 1111 1111 1111');
  assert.doesNotMatch(redacted, /secret123|552911|user@example\.com|\+234|4111 1111/);
  assert.match(redacted, /removed for your safety/);
  assert.match(redacted, /email removed/);
});

test('safeguarding phrases override customer-selected topics and force urgent trained-human routing', () => {
  for (const message of ['I want to kill myself', 'I wan kill myself', 'zan kashe kaina']) {
    const result = classifyChatIntent('general', message);
    assert.equal(result.intent, 'safeguarding');
    assert.equal(result.priority, 'urgent');
    assert.equal(result.requiredSkill, 'safeguarding');
    assert.equal(result.safeguardingEscalation, true);
  }
});

test('ordinary complaint and sales enquiries retain the approved routing map', () => {
  assert.deepEqual(classifyChatIntent('complaint', 'My complaint has not been resolved.').priority, 'high');
  assert.equal(classifyChatIntent('sales_enquiry', 'I want to know about a service.').department, 'Sales and Service Enquiries');
});
