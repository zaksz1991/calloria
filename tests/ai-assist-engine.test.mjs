import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_MODEL_OPTIONS, validateAIAssistSettings, redactTranscriptForAI,
  validateAIAssistResult, requestAIAssist, loadTenantAIAssistSettings,
  saveTenantAIAssistSettings, isSyntheticCustomerLabInteraction
} from '../js/ai-assist-engine.js';

test('AI tenant settings accept only supported models and bounded daily quotas', () => {
  assert.deepEqual(validateAIAssistSettings({ enabled: true, model: 'gpt-6-luna', dailyRequestLimit: 100 }), {
    enabled: true, model: 'gpt-6-luna', dailyRequestLimit: 100, redactionRequired: true
  });
  assert.equal(AI_MODEL_OPTIONS.length, 2);
  assert.throws(() => validateAIAssistSettings({ model: 'unknown-model', dailyRequestLimit: 100 }), /supported/);
  assert.throws(() => validateAIAssistSettings({ model: 'gpt-6-luna', dailyRequestLimit: 5001 }), /between 1 and 5,000/);
});

test('AI transcript preparation bounds the content and redacts credential-like identifiers', () => {
  const safe = redactTranscriptForAI([
    { speaker: 'agent', text: 'Please do not share your PIN 1234 or OTP: 998877.' },
    { speaker: 'customer', text: 'My account number 123456789012 was charged twice. Email me at sample@example.com.' }
  ]);
  assert.match(safe[0].text, /REDACTED CREDENTIAL/);
  assert.match(safe[1].text, /REDACTED ACCOUNT OR CARD NUMBER/);
  assert.match(safe[1].text, /REDACTED EMAIL/);
  assert.throws(() => redactTranscriptForAI([]), /1 to 40/);
  assert.throws(() => redactTranscriptForAI(Array.from({ length: 41 }, () => ({ text: 'line' }))), /1 to 40/);
});

test('AI QA suggestions mark only quotes present in the redacted transcript as verified', () => {
  const transcript = [{ speaker: 'agent', text: 'I understand the duplicate debit and will investigate it.' }];
  const result = validateAIAssistResult({
    sentiment: 'negative', customerIntent: 'Report a duplicate debit', interactionSummary: 'The agent acknowledged a duplicate debit.',
    riskFlags: ['Verify transaction status before confirming an outcome.'],
    qaSuggestions: [
      { criterion: 'Ownership', suggestedRating: 4, rationale: 'Agent stated an investigation action.', evidenceQuote: 'I understand the duplicate debit and will investigate it.' },
      { criterion: 'Accuracy', suggestedRating: 5, rationale: 'No actual proof.', evidenceQuote: 'A refund is guaranteed tomorrow.' }
    ],
    coachingRecommendations: ['State what will be checked and when an update is due.'],
    followUpChecklist: ['Confirm the transaction reference.']
  }, transcript);
  assert.equal(result.sentiment, 'negative');
  assert.equal(result.qaSuggestions[0].evidenceVerified, true);
  assert.equal(result.qaSuggestions[1].evidenceVerified, false);
  assert.equal(result.humanApprovalRequired, true);
  assert.match(result.disclaimer, /Not an official QA score/);
});

test('AI source gate accepts only completed Customer Lab records and known synthetic scenario metadata', () => {
  const valid = { id: 'CIL-123ABC', status: 'completed', issueId: 'duplicate-debit', personaId: 'calm', channel: 'Voice', transcript: [{ speaker: 'agent', text: 'I will review this.' }] };
  assert.equal(isSyntheticCustomerLabInteraction(valid), true);
  assert.equal(isSyntheticCustomerLabInteraction({ ...valid, id: 'CRM-REAL-123' }), false);
  assert.equal(isSyntheticCustomerLabInteraction({ ...valid, issueId: 'external-case' }), false);
  assert.equal(isSyntheticCustomerLabInteraction({ ...valid, personaId: 'unknown' }), false);
  assert.equal(isSyntheticCustomerLabInteraction({ ...valid, status: 'active' }), false);
});

test('AI request requires an organisation and sends only the redacted synthetic transcript', async () => {
  let sent = null;
  const client = { functions: { invoke: async (_name, options) => {
    sent = options.body;
    return { data: { model: 'gpt-6-luna', analysis: {
      sentiment: 'neutral', customerIntent: 'Enquire', interactionSummary: 'A short practice exchange.', riskFlags: [], qaSuggestions: [], coachingRecommendations: [], followUpChecklist: []
    } }, error: null };
  } } };
  const interaction = { id: 'CIL-ABC123', status: 'completed', issueId: 'duplicate-debit', personaId: 'calm', channel: 'Voice', transcript: [{ speaker: 'agent', text: 'Do not share your PIN 1234.' }], aiTranscript: [{ speaker: 'customer', text: 'I was charged twice.' }, { speaker: 'agent', text: 'Do not share your PIN 1234.' }] };
  const result = await requestAIAssist(client, { organizationId: 'org-1', interaction });
  assert.equal(result.interactionId, 'CIL-ABC123');
  assert.match(sent.interaction.transcript[1].text, /REDACTED CREDENTIAL/);
  assert.equal(sent.interaction.transcript[0].speaker, 'customer');
  assert.equal(sent.interaction.status, 'completed');
  assert.equal(sent.organizationId, 'org-1');
  assert.equal(sent.interaction.dataOrigin, 'calloria_customer_lab_synthetic');
  await assert.rejects(() => requestAIAssist(client, { interaction }), /organisation/);
});

test('tenant AI settings read and save through the scoped Supabase client', async () => {
  const existing = { organization_id:'org-1', enabled:true, model:'gpt-6-luna', daily_request_limit:20, redaction_required:true, updated_at:'2026-11-07T00:00:00Z' };
  const client = { from(table) {
    assert.equal(table, 'calloria_ai_settings');
    return {
      select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: existing, error: null }),
      upsert(payload) { this.payload = payload; return this; }, single: async function() { return { data: { ...existing, ...this.payload }, error: null }; }
    };
  } };
  assert.equal((await loadTenantAIAssistSettings(client, 'org-1')).enabled, true);
  const saved = await saveTenantAIAssistSettings(client, 'org-1', 'user-1', { enabled:false, model:'gpt-6.1-terra', dailyRequestLimit:25 });
  assert.equal(saved.enabled, false);
  assert.equal(saved.model, 'gpt-6.1-terra');
  assert.equal(saved.dailyRequestLimit, 25);
});
