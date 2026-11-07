import test from 'node:test';
import assert from 'node:assert/strict';
import {
  redactCaseDescription,
  validateCasePayload,
  validateCaseLookup,
  validateCaseCreateResponse,
  validateCaseStatus
} from '../js/case-desk-engine.js';

test('case description redacts Nigerian phone, email, credentials and long numbers', () => {
  const result = redactCaseDescription('My phone is 08031234567, email me at person@example.com, PIN: 1234, account 123456789012.');
  assert.equal(result.redacted, true);
  assert.match(result.text, /REDACTED PHONE NUMBER/);
  assert.match(result.text, /REDACTED EMAIL/);
  assert.match(result.text, /REDACTED CREDENTIAL/);
  assert.match(result.text, /REDACTED ACCOUNT OR CARD NUMBER/);
  assert.doesNotMatch(result.text, /08031234567|person@example.com|123456789012/);
});

test('case payload validates consent and keeps optional contact out of the description', () => {
  const result = validateCasePayload({
    subject: 'Cannot access my course', description: 'I cannot access a lesson after signing in.',
    platformId: 'ruffneck-learn', customerName: 'A User', contactPreference: 'email',
    contact: 'user@example.com', consent: true
  });
  assert.equal(result.platformId, 'ruffneck-learn');
  assert.equal(result.contact, 'user@example.com');
  assert.equal(result.consent, true);
});

test('case payload rejects absent consent and invalid platform identifiers', () => {
  const base = { subject: 'A support request', description: 'A sufficiently detailed support issue.', platformId: '', contactPreference: 'none', contact: '', consent: false };
  assert.throws(() => validateCasePayload(base), /Consent is required/);
  assert.throws(() => validateCasePayload({ ...base, consent: true, platformId: 'unknown-product' }), /recognised RuffNeck platform/);
});

test('email and phone follow-up channels are validated', () => {
  const base = { subject: 'A support request', description: 'A sufficiently detailed support issue.', consent: true };
  assert.throws(() => validateCasePayload({ ...base, contactPreference: 'email', contact: 'invalid-address' }), /valid email/);
  assert.throws(() => validateCasePayload({ ...base, contactPreference: 'phone', contact: 'abc' }), /valid phone/);
  assert.throws(() => validateCasePayload({ ...base, contactPreference: 'none', contact: '+2348012345678' }), /Remove the contact detail/);
});

test('case lookup requires a valid reference and high-entropy access code', () => {
  const token = 'AbCdEf0123456789-_'.repeat(2) + 'ABCDE';
  const result = validateCaseLookup('cc-261107-AB234C', token);
  assert.equal(result.caseReference, 'CC-261107-AB234C');
  assert.equal(result.accessToken, token);
  assert.throws(() => validateCaseLookup('bad-reference', token), /case reference/);
  assert.throws(() => validateCaseLookup('CC-261107-AB234C', 'short'), /access code/);
});

test('case creation response accepts only a reference and 32-byte-style token', () => {
  const token = 'A'.repeat(43);
  const result = validateCaseCreateResponse({ caseReference: 'CC-261107-AB234C', accessToken: token, status: 'received' });
  assert.equal(result.accessToken, token);
  assert.throws(() => validateCaseCreateResponse({ caseReference: 'bad', accessToken: token }), /valid case reference/);
});

test('case status response allowlists statuses and sanitises public timeline', () => {
  const result = validateCaseStatus({
    caseReference: 'CC-261107-AB234C', status: 'in_progress', department: 'Technical Support and IT',
    publicMessage: 'A specialist is reviewing the issue.', createdAt: '2026-11-07T10:00:00Z', updatedAt: '2026-11-07T11:00:00Z',
    timeline: [{ status: 'received', message: 'Request received.', at: '2026-11-07T10:00:00Z' }]
  });
  assert.equal(result.status, 'in_progress');
  assert.equal(result.timeline.length, 1);
  assert.throws(() => validateCaseStatus(null), /invalid case status/);
});
