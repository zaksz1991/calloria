import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySocialMessage, cleanSocialText, normalizeWebhookMessage, redactSocialText, validateSocialReply } from '../js/social-inbox-engine.js';

test('classifies ordinary enquiries into the social media support skill', () => {
  assert.deepEqual(classifySocialMessage('Hello, I need more information about your platform.'), {
    intent: 'social_media', department: 'Social Media Support', requiredSkills: ['social_support'], priority: 'normal', language: 'en'
  });
});

test('escalates complaint, technical and sales requests to suitable departments', () => {
  assert.equal(classifySocialMessage('I was charged twice and want a refund.').department, 'Complaints and Service Recovery');
  assert.equal(classifySocialMessage('The app crashes and does not load.').department, 'Technical Support and IT');
  assert.equal(classifySocialMessage('How much is the course subscription?').department, 'Sales and Service Enquiries');
});

test('safeguarding has urgent priority and a specialist safeguarding skill', () => {
  const result = classifySocialMessage('I am not safe and I want to hurt myself.');
  assert.equal(result.priority, 'urgent');
  assert.equal(result.requiredSkills[0], 'safeguarding');
});

test('detects supported Nigerian languages conservatively', () => {
  assert.equal(classifySocialMessage('Sannu, na gode').language, 'ha');
  assert.equal(classifySocialMessage('Bawo ni, mo dupe').language, 'yo');
  assert.equal(classifySocialMessage('Kedu, biko').language, 'ig');
  assert.equal(classifySocialMessage('Abeg, how far?').language, 'pcm');
});

test('redacts secrets, emails, phone numbers and long card-like numbers', () => {
  const value = redactSocialText('OTP: 883911, me@example.com, +234 801 234 5678, card 4111 1111 1111 1111');
  assert.match(value, /OTP: \[removed for your safety\]/);
  assert.doesNotMatch(value, /me@example.com|801 234 5678|4111 1111/);
});

test('normalizes valid Messenger message webhook and refuses echo events', () => {
  const event = { sender: { id: '10001' }, recipient: { id: '20002' }, timestamp: Date.now(), message: { mid: 'm_123', text: 'Hello there' } };
  const parsed = normalizeWebhookMessage('messenger', { id: '20002' }, event);
  assert.equal(parsed.providerMessageId, 'm_123');
  assert.equal(parsed.text, 'Hello there');
  assert.equal(normalizeWebhookMessage('messenger', { id: '20002' }, { ...event, message: { ...event.message, is_echo: true } }), null);
});

test('normalizes attachment-only event without downloading attachment data', () => {
  const parsed = normalizeWebhookMessage('instagram', { id: 'ig-1' }, {
    sender: { id: 'sender-1' }, recipient: { id: 'ig-1' }, message: { mid: 'ig-mid', attachments: [{ type: 'image', payload: { url: 'https://private.example/file' } }] }
  });
  assert.match(parsed.text, /does not download attachments/);
  assert.doesNotMatch(parsed.text, /private\.example/);
});

test('validates short plain text and blocks long or guarantee-heavy replies', () => {
  assert.equal(validateSocialReply('Thank you. We will review this and update you.'), 'Thank you. We will review this and update you.');
  assert.throws(() => validateSocialReply('x'.repeat(1001)), /1,000 characters/);
  assert.throws(() => validateSocialReply('Your account is fixed.'), /unverified guarantee/);
});

test('bounds control characters and length in input normalization', () => {
  assert.equal(cleanSocialText('a\u0000b\n', 3), 'a b');
});
