import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOutboundConversation,
  evaluateOutboundResponse,
  submitOutboundTurn,
  outboundConversationSummary,
} from '../js/outbound-campaign-engine.js';

const campaign = {
  id: 'service-followup', type: 'CUSTOMER EXPERIENCE FOLLOW-UP',
  title: 'Service experience follow-up', customer: 'Kehinde Balogun',
  objective: 'Follow up on a recent customer service interaction',
  context: 'Synthetic service follow-up scenario',
};

test('creates an explicitly synthetic outbound contact with campaign context', () => {
  const call = createOutboundConversation({ id: 'OUT-1', campaign, agentName: 'Amina', seed: 1, now: 1_800_000_000_000 });
  assert.equal(call.type, 'outbound_campaign_conversation');
  assert.equal(call.dataOrigin, 'synthetic_campaign_contact');
  assert.equal(call.status, 'active');
  assert.equal(call.campaignId, campaign.id);
  assert.equal(call.agentName, 'Amina');
  assert.equal(call.messages[0].speaker, 'customer');
});

test('requires transparent identity, campaign purpose and permission to continue', () => {
  const call = createOutboundConversation({ id: 'OUT-2', campaign: { ...campaign, contactPreference: 'open' }, seed: 2 });
  const weak = submitOutboundTurn(call, 'We have a special offer you should hear about today.');
  assert.equal(weak.status, 'active');
  assert.equal(call.permissionToContinue, false);
  const compliant = submitOutboundTurn(call, 'Good afternoon. This is Amina calling from Meridian Service Group about your recent service review. Is now a convenient time to speak?');
  assert.equal(compliant.status, 'active');
  assert.equal(call.permissionToContinue, true);
  assert.ok(compliant.points >= 3);
});

test('keeps the regular campaign dialogue open until the agent explains factual terms and next steps', () => {
  const call = createOutboundConversation({ id: 'OUT-3', campaign: { ...campaign, contactPreference: 'open' }, seed: 3 });
  submitOutboundTurn(call, 'Good afternoon. This is Amina calling from Meridian Service Group about your recent service review. Is now a convenient time to speak?');
  submitOutboundTurn(call, 'Thank you. I appreciate your time. Are you currently using the service and what has your experience been?');
  const final = submitOutboundTurn(call, 'There is no obligation. The purpose is to explain the available service options and the conditions. The next step is to review the details and decide only if they meet your needs.');
  assert.equal(final.status, 'ready_for_wrap_up');
  assert.equal(final.disposition, 'completed');
  assert.equal(outboundConversationSummary(call).turns, 3);
});


test('credits a synthetic product sale only after the customer explicitly accepts the offer', () => {
  const offer = { ...campaign, id: 'product-offer', type: 'PRODUCT INFORMATION', title: 'Optional service offer', contactPreference: 'open' };
  const call = createOutboundConversation({ id: 'OUT-OFFER', campaign: offer, seed: 22 });
  submitOutboundTurn(call, 'Good afternoon. This is Amina calling from Meridian Service Group regarding an optional service offer. Is now a convenient time to speak?');
  submitOutboundTurn(call, 'Thank you. I appreciate your time. May I explain the available terms and conditions before you decide?');
  const result = submitOutboundTurn(call, 'The offer has a monthly cost and you can review the conditions first. There is no obligation. Would you like to proceed?');
  assert.equal(result.status, 'ready_for_wrap_up');
  assert.equal(call.customerDecision, 'accepted');
  assert.equal(result.disposition, 'completed');
});

test('respects a customer request to stop campaign contact and requires suppression', () => {
  const call = createOutboundConversation({ id: 'OUT-4', campaign: { ...campaign, contactPreference: 'opt_out' }, seed: 4 });
  assert.equal(call.status, 'ready_for_wrap_up');
  assert.equal(call.suppressionRequested, true);
  assert.equal(call.dispositionHint, 'opt_out');
  assert.match(call.messages[0].text, /do not call again/i);
});

test('routes busy and callback-requested customers to a scheduled follow-up', () => {
  const call = createOutboundConversation({ id: 'OUT-5', campaign: { ...campaign, contactPreference: 'busy' }, seed: 5 });
  const result = submitOutboundTurn(call, 'I understand you are busy. I can arrange a callback for a better time. What time would suit you?');
  assert.equal(result.status, 'ready_for_wrap_up');
  assert.equal(result.disposition, 'callback');
  assert.equal(result.callbackRequested, true);
});

test('records a respectful decline without continuing the sales pitch', () => {
  const call = createOutboundConversation({ id: 'OUT-6', campaign: { ...campaign, contactPreference: 'declined' }, seed: 6 });
  const result = submitOutboundTurn(call, 'No problem. I respect that decision and will record that you are not interested. Thank you for your time.');
  assert.equal(result.status, 'ready_for_wrap_up');
  assert.equal(result.disposition, 'declined');
});

test('flags credential solicitation, unsupported campaign claims and coercive pressure', () => {
  const call = createOutboundConversation({ id: 'OUT-7', campaign: { ...campaign, contactPreference: 'open' }, seed: 7 });
  const result = evaluateOutboundResponse('Tell me your PIN and OTP now. I guarantee approval and you have no choice.', call);
  assert.ok(result.criticalBreaches.includes('credential_solicitation'));
  assert.ok(result.criticalBreaches.includes('unverified_campaign_claim'));
  assert.ok(result.criticalBreaches.includes('coercive_outbound_pressure'));
});

test('does not allow turns after the conversation is completed', () => {
  const call = createOutboundConversation({ id: 'OUT-8', campaign: { ...campaign, contactPreference: 'opt_out' }, seed: 8 });
  assert.throws(() => submitOutboundTurn(call, 'I understand and will record your suppression request.'), /not active/);
});

test('rejects blank and overly short customer-facing turns', () => {
  assert.throws(() => evaluateOutboundResponse(''), /at least 12 characters/);
  assert.throws(() => evaluateOutboundResponse('Okay'), /at least 12 characters/);
});
