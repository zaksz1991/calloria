import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CALLORIA_PLATFORMS,
  redactCustomerMessage,
  getCustomerCareVisitorId,
  validateCustomerCareResponse,
  askCustomerCare
} from '../js/customer-care-engine.js';

test('Customer Care message redaction removes credentials, account numbers and email addresses', () => {
  const result = redactCustomerMessage('My OTP: 998877, account number 123456789012 and email sample@example.com are relevant.');
  assert.equal(result.redacted, true);
  assert.match(result.text, /REDACTED CREDENTIAL/);
  assert.match(result.text, /REDACTED ACCOUNT OR CARD NUMBER/);
  assert.match(result.text, /REDACTED EMAIL/);
  assert.throws(() => redactCustomerMessage('x'), /at least four/);
  assert.throws(() => redactCustomerMessage('a'.repeat(1801)), /under 1,800/);
});

test('Guest visitor ID is a UUID and persists without storing enquiries', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  const cryptoApi = { randomUUID: () => '123e4567-e89b-42d3-a456-426614174000' };
  const first = getCustomerCareVisitorId(storage, cryptoApi);
  const second = getCustomerCareVisitorId(storage, cryptoApi);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f-]{36}$/i);
  assert.equal(values.size, 1);
  assert.equal(values.has('calloria.customer-care.messages'), false);
});

test('Customer Care response validation constrains departments and platform cross-sells', () => {
  const result = validateCustomerCareResponse({
    answer: 'Here are verified steps.', department: 'Unknown Department', urgency: 'severe',
    requiresHuman: true, sources: [{ id: 'learn-1', title: 'Course discovery', url: 'https://ruffneck-lms.vercel.app/' }],
    crossSellPlatformIds: ['ruffneck-learn', 'unknown']
  });
  assert.equal(result.department, 'General Customer Care');
  assert.equal(result.urgency, 'normal');
  assert.equal(result.requiresHuman, true);
  assert.deepEqual(result.crossSellPlatformIds, ['ruffneck-learn']);
  assert.equal(result.sources.length, 1);
  assert.equal(CALLORIA_PLATFORMS.length, 6);
});

test('Customer Care request invokes only the server-side function with locally redacted content', async () => {
  let sentBody;
  const client = { functions: { invoke: async (name, args) => {
    assert.equal(name, 'calloria-customer-care');
    sentBody = args.body;
    return { data: { answer: 'Do not share credentials with anyone.', department: 'RuffNeck Products and Platform Support' }, error: null };
  } } };
  const result = await askCustomerCare(client, {
    message: 'My password: letmein123 is not working.',
    visitorId: '123e4567-e89b-42d3-a456-426614174000'
  });
  assert.match(sentBody.message, /REDACTED CREDENTIAL/);
  assert.doesNotMatch(sentBody.message, /letmein123/);
  assert.equal(result.redacted, true);
  assert.match(result.answer, /Do not share credentials/);
});


test('Sensitive-data redaction removes Nigerian-style international phone numbers before transmission', () => {
  const result = redactCustomerMessage('Call me on +234 803 380 7856 about my issue.');
  assert.equal(result.redacted, true);
  assert.doesNotMatch(result.text, /803 380 7856/);
});

test('Safeguarding handoff department is retained by response validation', () => {
  const result = validateCustomerCareResponse({
    answer: 'Immediate human support is required.',
    department: 'Safeguarding and Trained Human Support',
    urgency: 'critical',
    requiresHuman: true
  });
  assert.equal(result.department, 'Safeguarding and Trained Human Support');
  assert.equal(result.urgency, 'critical');
  assert.equal(result.requiresHuman, true);
});
