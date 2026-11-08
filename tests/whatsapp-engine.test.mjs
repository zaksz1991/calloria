import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyWhatsAppMessage, detectMessageLanguage, getMetaInboundMessages,
  getServiceWindow, maskWhatsAppId, normalizeWhatsAppId,
  redactWhatsAppSummary, validateOutboundText
} from '../js/whatsapp-engine.js';

test('normalises WhatsApp contact IDs and masks customer phone numbers', () => {
  assert.equal(normalizeWhatsAppId('+234 803 123 4567'), '2348031234567');
  assert.equal(normalizeWhatsAppId('12345'), null);
  assert.equal(maskWhatsAppId('2348031234567'), '+*********4567');
});

test('service window opens only for 24 hours after the last inbound message', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  assert.equal(getServiceWindow('2026-11-07T00:01:00Z', now).open, true);
  assert.equal(getServiceWindow('2026-11-06T11:59:00Z', now).open, false);
  assert.equal(getServiceWindow(null, now).open, false);
});

test('detects common Hausa, Yoruba, Igbo and Pidgin phrase patterns conservatively', () => {
  assert.equal(detectMessageLanguage('Sannu, yaya kake? Don Allah taimako.'), 'ha');
  assert.equal(detectMessageLanguage('E kaaro, bawo ni? E jowo mo fe alaye.'), 'yo');
  assert.equal(detectMessageLanguage('Kedu, biko nyere m aka. Daalu.'), 'ig');
  assert.equal(detectMessageLanguage('Abeg, wetin dey happen? No vex.'), 'pcm');
  assert.equal(detectMessageLanguage('I need help with my account today.'), 'en');
});

test('routes platform requests, commercial questions, complaints and urgent safeguarding separately', () => {
  assert.equal(classifyWhatsAppMessage('I need help with my RuffNeck Learn course').platformId, 'ruffneck-learn');
  assert.equal(classifyWhatsAppMessage('How much is the Kano Keke subscription?').intent, 'sales_enquiry');
  assert.equal(classifyWhatsAppMessage('My account was hacked and money is missing').intent, 'complaint');
  const danger = classifyWhatsAppMessage('I may hurt myself tonight.');
  assert.equal(danger.intent, 'safeguarding');
  assert.equal(danger.priority, 'urgent');
});

test('redacts contact and credential patterns from Agent Desk summary text', () => {
  const safe = redactWhatsAppSummary('Call me 08031234567, email me at demo@example.com, my OTP: 123456');
  assert.doesNotMatch(safe, /08031234567|demo@example.com|123456/);
  const extra = redactWhatsAppSummary('My PIN is 4321 and account number 123456789012.');
  assert.doesNotMatch(extra, /4321|123456789012/);
  assert.match(safe, /REDACTED/);
});

test('extracts only supported Meta message and delivery event fields', () => {
  const extracted = getMetaInboundMessages({ entry: [{ changes: [{ field: 'messages', value: {
    contacts: [{ wa_id: '2348031234567', profile: { name: 'Customer' } }],
    messages: [{ id: 'wamid.123', from: '2348031234567', timestamp: '1794052800', type: 'text', text: { body: 'Hello CALLORIA' } }],
    statuses: [{ id: 'wamid.out', status: 'delivered', timestamp: '1794052802' }]
  } }] }] });
  assert.equal(extracted.messages.length, 1);
  assert.equal(extracted.messages[0].providerMessageId, 'wamid.123');
  assert.equal(extracted.messages[0].body, 'Hello CALLORIA');
  assert.equal(extracted.messages[0].displayName, 'Customer');
  assert.equal(extracted.statuses[0].status, 'delivered');
});

test('represents media without pretending the media was downloaded', () => {
  const extracted = getMetaInboundMessages({ entry: [{ changes: [{ field: 'messages', value: {
    messages: [{ id: 'wamid.img', from: '2348031234567', timestamp: '1794052800', type: 'image' }]
  } }] }] });
  assert.match(extracted.messages[0].body, /sent image media/i);
});

test('blocks unsafe requests for secrets and enforces the 4,096-character limit', () => {
  assert.equal(validateOutboundText('Please send your OTP now.').valid, false);
  assert.equal(validateOutboundText('Please enter your PIN now.').valid, false);
  assert.equal(validateOutboundText('Please never share your OTP with anyone.').valid, true);
  assert.equal(validateOutboundText('Never enter your OTP into a chat.').valid, true);
  assert.equal(validateOutboundText('A'.repeat(4097)).valid, false);
  assert.equal(validateOutboundText('A brief service update.').valid, true);
});
