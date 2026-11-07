import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanText, normalizeEmail, normalizePhone, normalizeNameTokens,
  validateNewContact, validateInteraction, canShowRecommendation,
  maskEmail, maskPhone, statusLabel
} from '../js/customer-360-engine.js';

test('cleanText strips control characters and bounds field length', () => {
  assert.equal(cleanText('  A\n\t  B\u0000 ', 20), 'A B');
  assert.equal(cleanText('abcdefgh', 4), 'abcd');
});

test('normalizes email and phone without losing international prefix', () => {
  assert.equal(normalizeEmail(' USER@Example.COM '), 'user@example.com');
  assert.equal(normalizePhone('+234 803-123-4567'), '+2348031234567');
  assert.throws(() => normalizeEmail('not-an-email'), /valid email/);
  assert.throws(() => normalizePhone('123'), /valid phone/);
});

test('name tokens are normalized, unique and bounded', () => {
  assert.deepEqual(normalizeNameTokens('Amina Bello Bello Musa'), ['amina','bello','musa']);
  assert.deepEqual(normalizeNameTokens('A B'), []);
});

test('new contact requires at least one contact method and explicit service consent', () => {
  const input = { name: 'Amina', email: 'amina@example.com', phone: '', preferredChannel: 'email', serviceConsent: true, marketingConsent: false, personalizationConsent: false };
  assert.equal(validateNewContact(input).email, 'amina@example.com');
  assert.throws(() => validateNewContact({ ...input, serviceConsent: false }), /consent/);
  assert.throws(() => validateNewContact({ ...input, email: '', preferredChannel: 'none' }), /at least one/);
  assert.throws(() => validateNewContact({ ...input, marketingConsent: undefined }), /explicitly yes or no/);
});

test('marketing consent is independent from requested product information', () => {
  assert.equal(canShowRecommendation({ mode: 'requested', marketingConsent: false }), true);
  assert.equal(canShowRecommendation({ mode: 'proactive', marketingConsent: false }), false);
  assert.equal(canShowRecommendation({ mode: 'proactive', marketingConsent: true }), true);
  assert.equal(canShowRecommendation({ mode: 'proactive', marketingConsent: true, recentPersonalGuidance: true }), false);
});

test('interaction record validates channel, direction and case reference', () => {
  const record = validateInteraction({ channel: 'voice', direction: 'inbound', type: 'platform_support', summary: 'Customer cannot access the learning dashboard.', caseReference: 'CC-261107-ABC234' });
  assert.equal(record.caseReference, 'CC-261107-ABC234');
  assert.throws(() => validateInteraction({ channel: 'fax', direction: 'inbound', type: 'complaint', summary: 'Something happened.' }), /channel/);
  assert.throws(() => validateInteraction({ channel: 'voice', direction: 'inbound', type: 'complaint', summary: 'An issue.', caseReference: 'bad' }), /case reference/);
});

test('personal guidance never stores customer narrative', () => {
  const record = validateInteraction({ channel: 'voice', direction: 'inbound', type: 'personal_guidance', summary: 'My private relationship details and mental health history.' });
  assert.doesNotMatch(record.summary, /relationship details|mental health history/i);
  assert.match(record.summary, /Sensitive personal details are intentionally not retained/);
});

test('masked contact methods never return full customer identifiers', () => {
  assert.equal(maskEmail('amina.bello@example.com'), 'a•••@example.com');
  assert.equal(maskPhone('+2348031234567'), '+234••••567');
  assert.equal(statusLabel('not_granted'), 'Not granted');
});
