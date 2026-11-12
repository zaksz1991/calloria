const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../public/digital-channel-engine.js');

const at = new Date('2026-11-12T08:00:00.000Z');
const emailContact = (priority = 'P3 - Normal') => ({ id: 'e-1', reference: 'EM-1001', channel: 'Email', priority, subject: 'Course access issue' });
const chatContact = () => ({ id: 'c-1', reference: 'CH-1001', channel: 'Live chat', priority: 'P2 - High', subject: 'Account access help' });
const goodEmail = `Dear customer, Thank you for contacting us. I understand the concern about the missing course. I have reviewed the details and recorded the enrolment reference for investigation. Next step: the support team will check the record and we will update you within one business day. Kind regards, Customer Care`;

test('engine exports the expected v6.6 contract', () => {
  assert.equal(G.VERSION, '6.6.0');
  for (const key of ['createSession', 'normaliseSession', 'emailReview', 'sendEmail', 'prepareChatReply', 'hasPreparedChatReply', 'commitChatReply', 'advanceChatStage', 'finalise']) assert.equal(typeof G[key], 'function');
});

test('only Email and Live chat create channel sessions', () => {
  assert.equal(G.createSession(emailContact(), 450, at).channel, 'Email');
  assert.equal(G.createSession(chatContact(), 450, at).channel, 'Live chat');
  assert.equal(G.createSession({ channel: 'Voice', id: 'v1' }, 450, at), null);
  assert.equal(G.createSession({ channel: 'Social', id: 's1' }, 450, at), null);
});

test('email priority determines the simulated response target', () => {
  assert.equal(G.createSession(emailContact('P1 - Urgent'), 450, at).emailTargetMinutes, 60);
  assert.equal(G.createSession(emailContact('P2 - High'), 450, at).emailTargetMinutes, 120);
  assert.equal(G.createSession(emailContact('P3 - Normal'), 450, at).emailTargetMinutes, 240);
  assert.equal(G.createSession(emailContact('P4 - Low'), 450, at).emailTargetMinutes, 360);
});

test('email quality review checks the response standards and placeholder control', () => {
  const review = G.emailReview('Re: Course access issue', goodEmail);
  assert.equal(review.canSend, true);
  assert.equal(review.score, 100);
  assert.equal(review.checks.length, 8);
  assert.ok(review.checks.every((item) => item.passed));
});

test('email response with missing next step does not pass the quality gate', () => {
  const review = G.emailReview('Re: Course access issue', 'Dear customer, thank you for contacting us. I understand your concern. I have reviewed the details and recorded your request. Kind regards, Agent');
  assert.equal(review.canSend, false);
  assert.equal(review.checks.find((item) => item.id === 'next-step').passed, false);
});

test('email response scaffold cannot be sent while bracketed placeholders remain', () => {
  const draft = `${goodEmail} [Add the confirmed finding or action]`;
  const review = G.emailReview('Re: Course access issue', draft);
  assert.equal(review.canSend, false);
  assert.equal(review.checks.find((item) => item.id === 'placeholders').passed, false);
  assert.match(review.feedback, /placeholders/i);
});

test('email body preserves paragraph breaks for the interaction transcript', () => {
  const preserved = G.cleanBody('Dear customer,\n\nThank you for contacting us.\nKind regards, Agent');
  assert.equal(preserved, 'Dear customer,\n\nThank you for contacting us.\nKind regards, Agent');
});

test('email review blocks unsafe requests for passwords and one-time codes', () => {
  const bad = 'Dear customer, send me your password and one-time code so I can check the issue. Kind regards, Agent. I will update you tomorrow.';
  const review = G.emailReview('Re: Account access', bad);
  assert.equal(review.critical, true);
  assert.equal(review.canSend, false);
  assert.match(review.feedback, /never ask/i);
});

test('email review does not mistake a customer-safety warning for a credential request', () => {
  assert.equal(G.unsafeCredentialRequest('Never send me your password or one-time code.'), false);
  assert.equal(G.unsafeCredentialRequest("Do not share your PIN with anyone in this chat."), false);
  assert.equal(G.unsafeCredentialRequest('Please send me your password.'), true);
});

test('email response requires a valid subject and complete draft', () => {
  const session = G.createSession(emailContact(), 450, at);
  assert.throws(() => G.sendEmail(session, { subject: 'Hi', body: goodEmail }, 480, at), /subject/i);
  assert.throws(() => G.sendEmail(session, { subject: 'Re: Course access issue', body: 'Thanks' }, 480, at), /60 characters/i);
  assert.equal(session.status, 'AWAITING_REPLY');
});

test('email send records quality, time and SLA status', () => {
  const session = G.createSession(emailContact(), 450, at);
  const sent = G.sendEmail(session, { subject: 'Re: Course access issue', body: goodEmail }, 490, new Date(at.getTime() + 60000));
  assert.equal(session.status, 'SENT');
  assert.equal(sent.quality.score, 100);
  assert.equal(sent.sla.status, 'SENT · WITHIN TARGET');
  assert.equal(session.sentAtShiftMinute, 490);
});

test('email SLA miss is recorded and cannot be hidden after the reply is sent', () => {
  const session = G.createSession(emailContact('P1 - Urgent'), 450, at);
  const sent = G.sendEmail(session, { subject: 'Re: Course access issue', body: goodEmail }, 520, at);
  assert.equal(sent.sla.breached, true);
  assert.equal(G.emailSlaSnapshot(session, 520).status, 'SENT · TARGET MISSED');
  assert.throws(() => G.sendEmail(session, { subject: 'Re: Duplicate', body: goodEmail }, 521, at), /already been sent/i);
});

test('email finalise returns a compact audit record', () => {
  const session = G.createSession(emailContact(), 450, at);
  G.sendEmail(session, { subject: 'Re: Course access issue', body: goodEmail }, 490, at);
  const result = G.finalise(session, 490, at);
  assert.equal(result.channel, 'Email');
  assert.equal(result.sent, true);
  assert.equal(result.qualityScore, 100);
  assert.equal(result.slaBreached, false);
});

test('chat requires a useful message before a service action can be committed', () => {
  const session = G.createSession(chatContact(), 480, at);
  assert.equal(G.hasPreparedChatReply(session, 0), false);
  assert.throws(() => G.commitChatReply(session, 0, at), /prepare/i);
  assert.throws(() => G.prepareChatReply(session, 0, 'Hi', at), /12 characters/i);
  assert.ok(G.prepareChatReply(session, 0, 'I understand the access issue. Let me check the account status.', at));
  assert.equal(G.hasPreparedChatReply(session, 0), true);
});

test('chat prevents a password or one-time-code request', () => {
  const session = G.createSession(chatContact(), 480, at);
  assert.throws(() => G.prepareChatReply(session, 0, 'Please send me your password and OTP so I can sign in.', at), /never ask/i);
  assert.equal(G.hasPreparedChatReply(session, 0), false);
});

test('chat reply can be committed once per stage with response timing', () => {
  const session = G.createSession(chatContact(), 480, at);
  G.prepareChatReply(session, 0, 'I understand the access issue. Let me check the account status.', new Date(at.getTime() + 30000));
  const sent = G.commitChatReply(session, 0, new Date(at.getTime() + 45000));
  assert.equal(sent.stage, 0);
  assert.equal(sent.responseSeconds, 45);
  assert.equal(session.totalReplies, 1);
  assert.throws(() => G.commitChatReply(session, 0, at), /prepare/i);
});

test('chat advances to a fresh response window after each service decision', () => {
  const session = G.createSession(chatContact(), 480, at);
  G.prepareChatReply(session, 0, 'I understand the access issue. Let me check the account status.', at);
  G.commitChatReply(session, 0, new Date(at.getTime() + 10000));
  G.advanceChatStage(session, 1, new Date(at.getTime() + 12000));
  assert.equal(session.currentStage, 1);
  assert.equal(G.hasPreparedChatReply(session, 1), false);
  G.prepareChatReply(session, 1, 'I have checked the details. Please confirm the error message you can see.', new Date(at.getTime() + 13000));
  G.commitChatReply(session, 1, new Date(at.getTime() + 20000));
  G.advanceChatStage(session, 2, new Date(at.getTime() + 22000));
  G.prepareChatReply(session, 2, 'I will guide the approved recovery steps and record the outcome for follow-up.', new Date(at.getTime() + 25000));
  G.commitChatReply(session, 2, new Date(at.getTime() + 40000));
  assert.equal(session.totalReplies, 3);
  const result = G.finalise(session, 500, new Date(at.getTime() + 45000));
  assert.equal(result.allStagesAnswered, true);
  assert.equal(result.replies, 3);
  assert.equal(result.responseSeconds.length, 3);
});

test('chat session normalisation preserves drafts and sent turns', () => {
  const session = G.createSession(chatContact(), 480, at);
  G.prepareChatReply(session, 0, 'I understand the access issue. Let me check the account status.', at);
  const restored = G.normaliseSession(JSON.parse(JSON.stringify(session)), chatContact(), 999, new Date(at.getTime() + 1000));
  assert.equal(restored.acceptedShiftMinute, 480);
  assert.equal(G.hasPreparedChatReply(restored, 0), true);
  assert.equal(restored.stageDrafts[0], session.stageDrafts[0]);
});

test('a digital session cannot be reused by a different contact', () => {
  const session = G.createSession(emailContact(), 450, at);
  const other = { ...emailContact(), id: 'e-2', reference: 'EM-2002' };
  const restored = G.normaliseSession(session, other, 450, at);
  assert.equal(restored.channel, 'Email');
  assert.equal(restored.contactId, 'e-2');
  assert.equal(restored.status, 'AWAITING_REPLY');
});
