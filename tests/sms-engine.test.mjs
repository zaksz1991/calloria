import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanSmsText, redactSmsText, normalizeNigeriaSmsNumber, maskSmsNumber,
  parseSmsCommand, detectSmsLanguage, detectSmsPlatform, classifySmsIntent,
  normalizeTermiiDeliveryStatus, validateSmsSupportReply, isValidTermiiBaseUrl,
  buildTermiiSmsPayload, buildTermiiWebhookEvent, verifyTermiiWebhookSignature, estimateSmsSegments
} from '../js/sms-engine.js';

const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');

 test('normalizes Nigerian MSISDNs and rejects malformed numbers', () => {
  assert.equal(normalizeNigeriaSmsNumber('08012345678'), '2348012345678');
  assert.equal(normalizeNigeriaSmsNumber('+234 801 234 5678'), '2348012345678');
  assert.equal(maskSmsNumber('2348012345678'), '+234 •••• 5678');
  assert.throws(() => normalizeNigeriaSmsNumber('08012345'));
  assert.throws(() => normalizeNigeriaSmsNumber('12345678901'));
});

test('cleans input and redacts credentials, contact details and financial numbers', () => {
  assert.equal(cleanSmsText('  Hello\n  CALLORIA  '), 'Hello CALLORIA');
  const safe = redactSmsText('OTP is 123456; PIN 1234; email demo@example.com; call +2348012345678; card 4111 1111 1111 1111');
  assert.doesNotMatch(safe, /123456|1234|demo@example|2348012345678|4111/);
  assert.match(safe, /REDACTED/);
});

test('recognizes STOP, START and HELP without treating ordinary text as a command', () => {
  assert.equal(parseSmsCommand('STOP'), 'STOP');
  assert.equal(parseSmsCommand('unsubscribe'), 'STOP');
  assert.equal(parseSmsCommand('START'), 'START');
  assert.equal(parseSmsCommand('HELP'), 'HELP');
  assert.equal(parseSmsCommand('please stop the app from crashing'), null);
});

test('classifies RuffNeck portfolio and support intent', () => {
  assert.equal(detectSmsPlatform('I need support for RuffNeck Learn courses'), 'ruffneck-learn');
  assert.equal(detectSmsPlatform('My Kano Keke simulator crashes'), 'kano-keke');
  assert.equal(classifySmsIntent('I want to know the price of Prospector').intent, 'sales_enquiry');
  assert.equal(classifySmsIntent('I have a complaint about Kano Run').intent, 'complaint');
  assert.equal(classifySmsIntent('I cannot log in to Connect').intent, 'account_access');
  assert.equal(classifySmsIntent('I feel unsafe and need help').intent, 'safeguarding');
  assert.equal(classifySmsIntent('I need relationship advice').intent, 'personal_guidance');
});

test('detects supported language preferences conservatively', () => {
  assert.equal(detectSmsLanguage('Sannu, ina bukata'), 'ha');
  assert.equal(detectSmsLanguage('Ẹ jọ̀ọ́, ẹ ṣe'), 'yo');
  assert.equal(detectSmsLanguage('Biko, kedu'), 'ig');
  assert.equal(detectSmsLanguage('Abeg, wetin happen'), 'pcm');
  assert.equal(detectSmsLanguage('Good morning'), 'en');
});

test('maps Termii delivery reports without losing final status vocabulary', () => {
  assert.equal(normalizeTermiiDeliveryStatus('DELIVERED'), 'delivered');
  assert.equal(normalizeTermiiDeliveryStatus('Message Sent'), 'sent');
  assert.equal(normalizeTermiiDeliveryStatus('DND Active on Phone Number'), 'dnd_blocked');
  assert.equal(normalizeTermiiDeliveryStatus('Rejected'), 'rejected');
  assert.equal(normalizeTermiiDeliveryStatus('Expired'), 'expired');
  assert.equal(normalizeTermiiDeliveryStatus('Message Failed'), 'failed');
});

test('validates single-recipient service replies and rejects sensitive or promotional content', () => {
  assert.equal(validateSmsSupportReply('Your support request is being reviewed.'), 'Your support request is being reviewed.');
  assert.throws(() => validateSmsSupportReply('Send us your OTP 123456'), /Do not send passwords/);
  assert.throws(() => validateSmsSupportReply('Buy now for a limited time offer'), /not promotional campaigns/);
  assert.throws(() => validateSmsSupportReply('x'.repeat(481)), /480 characters/);
});

test('validates Termii base URLs and constructs DND-only one-to-one payloads', () => {
  assert.equal(isValidTermiiBaseUrl('https://api.ng.termii.com'), true);
  assert.equal(isValidTermiiBaseUrl('http://api.ng.termii.com'), false);
  assert.equal(isValidTermiiBaseUrl('https://evil.example.com'), false);
  assert.equal(isValidTermiiBaseUrl('https://api.ng.termii.com/other'), false);
  const payload = buildTermiiSmsPayload({ apiKey: '0123456789abcdef', to: '08012345678', from: 'RuffNeck', sms: 'Your support case has been received.' });
  assert.equal(payload.to, '2348012345678');
  assert.equal(payload.channel, 'dnd');
  assert.equal(payload.type, 'plain');
  assert.equal('generic' in payload, false);
  assert.throws(() => buildTermiiSmsPayload({ apiKey: '0123456789abcdef', to: '08012345678', from: 'RN', sms: 'Support' }), /Sender ID/);
});

test('parses inbound SMS and delivery webhook events', () => {
  const inbound = buildTermiiWebhookEvent({ type: 'incoming_sms', from: '2348012345678', message: 'Help me', timestamp: '2026-11-08T01:00:00Z' });
  assert.equal(inbound.kind, 'incoming');
  assert.equal(inbound.from, '2348012345678');
  assert.equal(inbound.message, 'Help me');
  const delivery = buildTermiiWebhookEvent({ type: 'message', id: 'evt-1', message_id: 'msg-1', status: 'DELIVERED' });
  assert.equal(delivery.kind, 'delivery');
  assert.equal(delivery.providerMessageId, 'msg-1');
  assert.equal(delivery.status, 'delivered');
  assert.throws(() => buildTermiiWebhookEvent({ type: 'incoming_sms', from: 'bad', message: 'hello' }));
});

test('validates Termii HMAC-SHA512 signatures against the unmodified body', async () => {
  const secret = 'termii-webhook-secret-123456';
  const body = '{"type":"incoming_sms","from":"2348012345678","message":"Hello"}';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']);
  const signature = hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  assert.equal(await verifyTermiiWebhookSignature(body, signature, secret), true);
  assert.equal(await verifyTermiiWebhookSignature(`${body} `, signature, secret), false);
  assert.equal(await verifyTermiiWebhookSignature(body, 'bad', secret), false);
});

test('estimates GSM-7 and Unicode SMS billing segments including extension characters', () => {
  assert.deepEqual(estimateSmsSegments('Hello'), { encoding: 'GSM-7', units: 5, segments: 1, remaining: 155, limit: 480 });
  assert.equal(estimateSmsSegments('^').units, 2);
  assert.equal(estimateSmsSegments('a'.repeat(161)).segments, 2);
  assert.equal(estimateSmsSegments('a'.repeat(161)).remaining, 145);
  assert.equal(estimateSmsSegments('Ẹ káàbọ̀').encoding, 'UCS-2');
  assert.equal(estimateSmsSegments('Ẹ'.repeat(71)).segments, 2);
  assert.equal(estimateSmsSegments('😀').units, 2);
});
