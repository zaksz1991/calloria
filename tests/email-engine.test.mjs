import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import {
  chooseThreadRoot, classifyEmailMessage, decodeSvixSecret, extractMessageReferences,
  getPlainEmailBody, htmlEmailToText, maskEmailAddress, normalizeEmailAddress,
  normalizeEmailSubject, parseMailbox, redactEmailSummary, validateOutboundEmail,
  verifySvixSignature
} from '../js/email-engine.js';

test('normalizes and validates email addresses without accepting header injection', () => {
  assert.equal(normalizeEmailAddress('Support@Example.com'), 'support@example.com');
  assert.equal(normalizeEmailAddress('support@example.com\r\nBcc:x@bad.com'), null);
  assert.equal(normalizeEmailAddress('not-an-email'), null);
  assert.deepEqual(parseMailbox('A Customer <Customer.One@example.com>'), { address:'customer.one@example.com', displayName:'A Customer' });
});

test('masks mailbox local parts while retaining enough domain context', () => {
  assert.equal(maskEmailAddress('hassan@example.com'), 'h****n@example.com');
  assert.equal(maskEmailAddress('x@example.com'), 'x*@example.com');
  assert.equal(maskEmailAddress('invalid'), 'Unknown email');
});

test('normalizes reply subject prefixes for stable thread correlation', () => {
  assert.equal(normalizeEmailSubject(' Re: Fwd:  Need help '), 'need help');
});

test('extracts safe RFC message IDs and chooses a stable conversation root', () => {
  const ids = extractMessageReferences({ 'Message-ID':'<abc@example.net>', 'In-Reply-To':'<prev@example.net>', References:'<root@example.net> <prev@example.net>' });
  assert.equal(ids.messageId, '<abc@example.net>');
  assert.equal(ids.inReplyTo, '<prev@example.net>');
  assert.deepEqual(ids.references, ['<root@example.net>', '<prev@example.net>']);
  assert.equal(chooseThreadRoot(ids, 'provider-id'), '<root@example.net>');
  assert.equal(chooseThreadRoot({}, 'abc123'), 'resend:abc123');
});

test('converts HTML to plain text and strips active content', () => {
  const text = htmlEmailToText('<h2>Help</h2><script>alert(1)</script><p>Need &amp; support<br>please.</p>');
  assert.match(text, /Help/);
  assert.match(text, /Need & support/);
  assert.doesNotMatch(text, /alert\(1\)|script/i);
  assert.equal(getPlainEmailBody({ text:'Plain body', html:'<p>Ignored</p>' }), 'Plain body');
});

test('classifies all portfolio services and customer-care topics', () => {
  assert.equal(classifyEmailMessage('Course access', 'I cannot open the RuffNeck Learn course.').platformId, 'ruffneck-learn');
  assert.equal(classifyEmailMessage('Prospector leads', 'The lead scoring is missing.').platformId, 'ruffneck-prospector');
  assert.equal(classifyEmailMessage('Connect', 'Our community invite is not working in RuffNeck Connect.').platformId, 'ruffneck-connect');
  assert.equal(classifyEmailMessage('Social Hub', 'I cannot schedule a social post.').platformId, 'ruffneck-social-hub');
  assert.equal(classifyEmailMessage('Kano Run', 'Kano Life route issue in Kano Run.').platformId, 'kano-run');
  assert.equal(classifyEmailMessage('Kano Keke', 'The Kano Keke simulator will not start.').platformId, 'kano-keke');
  assert.equal(classifyEmailMessage('urgent', 'I may hurt myself and need immediate help.').skill, 'safeguarding');
  assert.equal(classifyEmailMessage('price', 'How much is the subscription?').department, 'Sales and Service Enquiries');
  assert.equal(classifyEmailMessage('hello', 'Sannu, ina bukata taimako').language, 'ha');
});

test('redacts sensitive identifiers from routing summaries', () => {
  const safe = redactEmailSummary('Please call me 08012345678, email me at person@example.com. My OTP is 123456.');
  assert.doesNotMatch(safe, /08012345678|person@example.com|123456/);
  assert.match(safe, /REDACTED/);
});

test('outbound responses are plain text, length bounded and block secret requests', () => {
  assert.equal(validateOutboundEmail('Re: Help', 'Please send your OTP to continue.').valid, false);
  assert.equal(validateOutboundEmail('Re: Help', 'Never share your OTP or password with anyone.').valid, true);
  assert.equal(validateOutboundEmail('Subject', '<script>alert(1)</script>').valid, false);
  assert.equal(validateOutboundEmail('', 'Body').valid, false);
  assert.equal(validateOutboundEmail('x'.repeat(181), 'Body').valid, false);
});

test('decodes Resend Svix webhook signing secret format', () => {
  const secret = randomBytes(32);
  const encoded = `whsec_${secret.toString('base64')}`;
  assert.deepEqual(Buffer.from(decodeSvixSecret(encoded)), secret);
  assert.equal(decodeSvixSecret('whsec_invalid'), null);
});

test('verifies exact Svix raw-body signature and rejects tampering or stale deliveries', async () => {
  const key = randomBytes(32);
  const secret = `whsec_${key.toString('base64')}`;
  const payload = '{"type":"email.received","data":{"email_id":"mail_12345678"}}';
  const id = 'evt_12345678-abcd';
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  const args = { secret, id, timestamp, signature:`v1,${signature}`, payload };
  assert.equal(await verifySvixSignature(args), true);
  assert.equal(await verifySvixSignature({ ...args, payload:payload+' ' }), false);
  assert.equal(await verifySvixSignature({ ...args, timestamp:String(Number(timestamp)-1000) }), false);
  assert.equal(await verifySvixSignature({ ...args, signature:'v2,invalid' }), false);
});
