const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../public/social-messaging-engine.js');

const at = new Date('2026-11-12T08:00:00.000Z');
const social = (id = 'so-1') => ({ id, reference: 'SO-1001', channel: 'Social', subject: 'Public complaint about account access' });
const sms = (id = 'sm-1', consent = false) => ({ id, reference: 'SM-1001', channel: 'SMS', subject: 'Service update request', smsMarketingConsent: consent });
const inApp = (id = 'ia-1') => ({ id, reference: 'IA-1001', channel: 'In-app', subject: 'Unable to find course settings' });

function complete(session, replies, baseTime = at) {
  for (let stage = 0; stage < 3; stage += 1) {
    const prepared = S.prepareReply(session, stage, replies[stage], new Date(baseTime.getTime() + stage * 30000 + 5000));
    assert.equal(prepared.canSend, true, prepared.feedback);
    assert.equal(prepared.prepared, true);
    S.commitReply(session, stage, new Date(baseTime.getTime() + stage * 30000 + 10000));
    if (stage < 2) S.advanceStage(session, stage + 1, new Date(baseTime.getTime() + (stage + 1) * 30000));
  }
}

test('engine exports v6.7 channel-handling contract', () => {
  assert.equal(S.VERSION, '6.7.0');
  for (const name of ['createSession', 'normaliseSession', 'reviewReply', 'saveDraft', 'prepareReply', 'hasPreparedReply', 'commitReply', 'advanceStage', 'finalise', 'smsSegments']) assert.equal(typeof S[name], 'function');
});

test('only Social, SMS and In-app create messaging sessions', () => {
  assert.equal(S.isSupported(social()), true);
  assert.equal(S.isSupported(sms()), true);
  assert.equal(S.isSupported(inApp()), true);
  assert.equal(S.createSession({ channel: 'Voice' }, at), null);
  assert.equal(S.createSession({ channel: 'Email' }, at), null);
  assert.equal(S.createSession({ channel: 'Live Chat' }, at), null);
});

test('channel aliases normalise to the correct workspace', () => {
  assert.equal(S.channelOf('social-media'), 'Social');
  assert.equal(S.channelOf('text message'), 'SMS');
  assert.equal(S.channelOf('In App'), 'In-app');
  assert.equal(S.channelOf('In_app'), 'In-app');
});

test('Social first response is public and later stages are private', () => {
  assert.equal(S.visibilityFor('Social', 0), 'PUBLIC');
  assert.equal(S.visibilityFor('Social', 1), 'PRIVATE');
  assert.equal(S.visibilityFor('Social', 2), 'PRIVATE');
  assert.equal(S.characterLimit('Social', 0), 280);
  assert.equal(S.characterLimit('Social', 1), 700);
});

test('public social replies block email addresses, phone numbers and case references', () => {
  const session = S.createSession(social(), at);
  for (const text of [
    'We have found your record. Email jane@example.com so we can assist you.',
    'Please call us on +234 803 123 4567 and we will check this issue.',
    'Your case reference is CASE-908172 and our team is checking it now.'
  ]) {
    const result = S.reviewReply('Social', 0, text, false);
    assert.equal(result.canSend, false);
    assert.equal(result.critical, true);
    assert.match(result.feedback, /privacy/i);
  }
  assert.equal(session.channel, 'Social');
});

test('safe public social acknowledgment can be prepared before internal service decision', () => {
  const session = S.createSession(social(), at);
  const response = 'Thanks for raising this with us. Please send us a private message so we can check the details securely.';
  const result = S.prepareReply(session, 0, response, at);
  assert.equal(result.canSend, true);
  assert.equal(result.visibility, 'PUBLIC');
  assert.equal(S.hasPreparedReply(session, 0), true);
});

test('social private follow-up supports longer response without exposing public identifiers', () => {
  const result = S.reviewReply('Social', 1, 'We have checked the service status. Please open the app again and tell us whether the sign-in message has cleared.', false);
  assert.equal(result.canSend, true);
  assert.equal(result.visibility, 'PRIVATE');
  assert.equal(result.limit, 700);
});

test('credential requests are critical failures for all channel types', () => {
  for (const channel of ['Social', 'SMS', 'In-app']) {
    const result = S.reviewReply(channel, 1, 'Please send me your password and one-time code so I can verify the account.', false);
    assert.equal(result.canSend, false, channel);
    assert.equal(result.critical, true, channel);
    assert.match(result.feedback, /never ask/i);
  }
});

test('SMS support response is limited to service handling and estimated segments', () => {
  const response = 'We have checked the service status. Please restart the app and try again. Reply here with the result.';
  const result = S.reviewReply('SMS', 0, response, false);
  assert.equal(result.canSend, true);
  assert.equal(result.visibility, 'SMS');
  assert.equal(result.sms.encoding, 'GSM-compatible');
  assert.equal(result.sms.segments, 1);
  assert.equal(S.smsSegments('A'.repeat(160)).segments, 1);
  assert.equal(S.smsSegments('A'.repeat(161)).segments, 2);
});

test('SMS uses Unicode segment estimates when non-GSM symbols are present', () => {
  assert.equal(S.smsSegments('🙂'.repeat(35)).segments, 1);
  assert.equal(S.smsSegments('🙂'.repeat(36)).segments, 2);
  assert.equal(S.smsSegments('🙂'.repeat(36)).encoding, 'Unicode');
  assert.equal(S.characterLimit('SMS', 0, '🙂'), 201);
  assert.equal(S.characterLimit('SMS', 0, 'A'), 459);
});

test('promotional SMS is blocked without explicit verified marketing consent', () => {
  const text = 'We have a special discount and promotional offer available. Reply here for the details.';
  const blocked = S.reviewReply('SMS', 0, text, false);
  assert.equal(blocked.canSend, false);
  assert.equal(blocked.critical, true);
  assert.match(blocked.feedback, /consent/i);
  const allowed = S.reviewReply('SMS', 0, text, true);
  assert.equal(allowed.canSend, true);
});

test('an SMS session only treats explicit consent as verified', () => {
  assert.equal(S.createSession(sms(), at).marketingConsent, false);
  assert.equal(S.createSession(sms('sm-2', true), at).marketingConsent, true);
  assert.equal(S.createSession({ ...sms(), consent: { smsMarketing: true } }, at).marketingConsent, true);
});

test('In-app response requires clear in-product action after the opening stage', () => {
  const opener = S.reviewReply('In-app', 0, 'I understand the issue. I will guide you through the next step here.', false);
  assert.equal(opener.canSend, true);
  const missingAction = S.reviewReply('In-app', 1, 'I have checked the information and will continue helping you with this.', false);
  assert.equal(missingAction.canSend, false);
  const action = S.reviewReply('In-app', 1, 'Open Settings, select Account and choose Recovery. Tell us which screen appears next.', false);
  assert.equal(action.canSend, true);
});

test('short, empty or over-limit responses cannot be prepared', () => {
  const session = S.createSession(social(), at);
  assert.equal(S.prepareReply(session, 0, 'Thanks', at).canSend, false);
  assert.equal(S.prepareReply(session, 0, 'A'.repeat(281), at).canSend, false);
  assert.equal(S.hasPreparedReply(session, 0), false);
});

test('unsent drafts persist but cannot unlock the service decision', () => {
  const session = S.createSession(social(), at);
  const draft = S.saveDraft(session, 0, 'Thanks for reporting this. Please send us a private message so we can help.');
  assert.equal(draft.characterCount > 20, true);
  assert.equal(S.hasPreparedReply(session, 0), false);
  const restored = S.normaliseSession(JSON.parse(JSON.stringify(session)), social(), new Date(at.getTime() + 1000));
  assert.equal(restored.stageDrafts[0], session.stageDrafts[0]);
});

test('a response can be committed only once per stage', () => {
  const session = S.createSession(social(), at);
  const text = 'Thanks for contacting us. Please send a private message so we can review this safely.';
  S.prepareReply(session, 0, text, at);
  const result = S.commitReply(session, 0, new Date(at.getTime() + 12000));
  assert.equal(result.visibility, 'PUBLIC');
  assert.equal(result.responseSeconds, 12);
  assert.throws(() => S.commitReply(session, 0, at), /prepare a safe/i);
});

test('stage advancement requires the preceding reply to be recorded', () => {
  const session = S.createSession(inApp(), at);
  assert.equal(S.advanceStage(session, 1, at), null);
  S.prepareReply(session, 0, 'I understand the issue and will guide you through the app.', at);
  S.commitReply(session, 0, new Date(at.getTime() + 1000));
  assert.equal(S.advanceStage(session, 1, new Date(at.getTime() + 1500)), 1);
  assert.equal(S.hasPreparedReply(session, 1), false);
});

test('all three Social replies finalise with visibility and quality measures', () => {
  const session = S.createSession(social(), at);
  complete(session, [
    'Thanks for raising this. Please send us a private message so we can check the details securely.',
    'We have checked the service status. Please reopen the app and tell us whether the error remains.',
    'The issue has been recorded for follow-up. We will update you through this private message thread.'
  ]);
  const result = S.finalise(session, new Date(at.getTime() + 100000));
  assert.equal(result.channel, 'Social');
  assert.equal(result.replies, 3);
  assert.equal(result.publicReplies, 1);
  assert.equal(result.privateReplies, 2);
  assert.equal(result.responseSeconds.length, 3);
  assert.equal(result.averageQuality, 100);
});

test('all three SMS replies finalise with segment totals', () => {
  const session = S.createSession(sms(), at);
  complete(session, [
    'We have received your service request. Please restart the app and try again.',
    'Open Settings and check the service status. Reply with the result you see.',
    'The case is recorded for follow-up. We will send a service update when available.'
  ]);
  const result = S.finalise(session, new Date(at.getTime() + 100000));
  assert.equal(result.channel, 'SMS');
  assert.equal(result.replies, 3);
  assert.equal(result.smsSegments, 3);
});

test('all three In-app replies finalise with recorded response timings', () => {
  const session = S.createSession(inApp(), at);
  complete(session, [
    'I understand the issue. I will guide you through the in-app settings.',
    'Open Settings, select Course Access and choose Refresh. Tell us what appears.',
    'Select Help in the app and open the access status. We will review the result you report.'
  ]);
  const result = S.finalise(session, new Date(at.getTime() + 100000));
  assert.equal(result.channel, 'In-app');
  assert.equal(result.replies, 3);
  assert.equal(result.responseSeconds.length, 3);
});

test('finalisation is blocked until every channel response has been recorded', () => {
  const session = S.createSession(sms(), at);
  assert.throws(() => S.finalise(session, at), /all three/i);
});

test('session restoration rejects another contact and preserves valid prepared state', () => {
  const session = S.createSession(social(), at);
  const safe = 'Thanks for contacting us. Please send a private message so we can help securely.';
  S.prepareReply(session, 0, safe, at);
  const restored = S.normaliseSession(JSON.parse(JSON.stringify(session)), social(), new Date(at.getTime() + 30000));
  assert.equal(S.hasPreparedReply(restored, 0), true);
  const other = S.normaliseSession(session, social('so-other'), new Date(at.getTime() + 30000));
  assert.equal(other.contactId, 'so-other');
  assert.equal(other.totalReplies, 0);
});
