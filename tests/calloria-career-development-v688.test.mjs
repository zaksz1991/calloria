import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAREER_COMPETENCIES_V688,
  PROMOTION_SCENARIOS_V688,
  GUIDED_PRACTICE_V688,
  evaluatePromotionScenarioV688,
  mapInboundCaseToQAInteractionV688,
  calculateCompetencyPassportV688,
  createCoachingActionsV688,
  evaluateGuidedPracticeV688,
  transformMainV688,
  calloriaCareerDevelopmentPluginV688,
} from '../build/calloria-career-development-v6-88.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, 'fixtures', 'main-v6.88-anchor-snapshot.js');
const fixture = fs.readFileSync(fixturePath, 'utf8');

function allCorrectAnswers() {
  return Object.fromEntries(PROMOTION_SCENARIOS_V688.map(question => [question.id, question.options.find(option => option.correct).id]));
}

test('promotion scenario exam scores all five correct answers at 100%', () => {
  const result = evaluatePromotionScenarioV688(allCorrectAnswers());
  assert.equal(result.score, 100);
  assert.equal(result.correct, 5);
  assert.equal(result.total, 5);
});

test('promotion scenario exam scores one incorrect answer at 80%', () => {
  const answers = allCorrectAnswers();
  answers.identity = 'accept';
  assert.equal(evaluatePromotionScenarioV688(answers).score, 80);
});

test('missing answers are not treated as correct', () => {
  const result = evaluatePromotionScenarioV688({});
  assert.equal(result.score, 0);
  assert.equal(result.details.every(item => item.correct === false), true);
});

test('inbound transcript is mapped to the human QA workspace without empty lines', () => {
  const item = mapInboundCaseToQAInteractionV688({
    reference: 'CALL-SIM-001', title: 'Access issue', customerPersona: 'frustrated_customer', createdAt: '2026-11-21T00:00:00.000Z',
    voiceTranscript: [
      { speaker: 'customer', text: '  My account access failed twice.  ' },
      { speaker: 'agent', text: 'I will verify the case and own the next step.' },
      { speaker: 'customer', text: '   ' },
    ],
  });
  assert.equal(item.id, 'CALL-SIM-001');
  assert.equal(item.channel, 'Inbound Voice');
  assert.equal(item.transcript.length, 2);
  assert.equal(item.transcript[0].text, 'My account access failed twice.');
  assert.deepEqual(item.criticalBreaches, []);
});

test('inbound transcripts are credential-redacted before entering the QA workspace', () => {
  const item = mapInboundCaseToQAInteractionV688({
    reference: 'CALL-SIM-REDACT',
    voiceTranscript: [{ speaker: 'customer', text: 'My PIN is 1234 and card number is 4111 1111 1111 1111.' }],
  });
  assert.ok(item.transcript[0].text.includes('[REDACTED CREDENTIAL]'));
  assert.ok(item.transcript[0].text.includes('[REDACTED FINANCIAL DETAIL]'));
  assert.equal(item.transcript[0].text.includes('1234'), false);
  assert.equal(item.transcript[0].text.includes('4111 1111 1111 1111'), false);
});

test('inbound security breach produces a mandatory human QA flag', () => {
  const item = mapInboundCaseToQAInteractionV688({
    reference: 'CALL-SIM-002', voiceSecurityBreach: true,
    voiceQualityFlags: ['prohibited_secret_request'],
    voiceTranscript: [{ speaker: 'agent', text: 'Tell me your one-time code.' }],
  });
  assert.ok(item.criticalBreaches.includes('prohibited_secret_request'));
  assert.ok(item.criticalBreaches.includes('inbound_voice_security_review'));
});

test('case without a completed transcript does not enter the QA queue', () => {
  assert.equal(mapInboundCaseToQAInteractionV688({ reference: 'CALL-SIM-003', voiceTranscript: [] }), null);
  assert.equal(mapInboundCaseToQAInteractionV688(null), null);
});

test('competency passport calculates average human QA scores and practice evidence', () => {
  const rows = calculateCompetencyPassportV688([
    { criteria: [{ criterionId: 'opening', rating: 4 }, { criterionId: 'listening', rating: 2 }] },
    { criteria: [{ criterionId: 'opening', rating: 5 }, { criterionId: 'listening', rating: 3 }] },
  ], [
    { criterionId: 'opening', passed: true },
    { criterionId: 'opening', passed: false },
  ]);
  const opening = rows.find(item => item.id === 'opening');
  const listening = rows.find(item => item.id === 'listening');
  const accuracy = rows.find(item => item.id === 'accuracy');
  assert.equal(opening.score, 90);
  assert.equal(opening.level, 'demonstrated');
  assert.equal(opening.practiceAttempts, 2);
  assert.equal(opening.practicePasses, 1);
  assert.equal(listening.score, 50);
  assert.equal(listening.level, 'development required');
  assert.equal(accuracy.score, null);
  assert.equal(accuracy.level, 'awaiting evidence');
  assert.equal(rows.length, CAREER_COMPETENCIES_V688.length);
});

test('low-rated QA criteria create evidence-linked coaching actions once', () => {
  const review = {
    id: 'HQA-1', interactionId: 'CALL-1',
    coaching: [
      { criterionId: 'listening', criterion: 'Listening & acknowledgement', rating: 2, evidence: 'I understand the disruption.', action: 'Summarise and confirm the customer concern.' },
      { criterionId: 'accuracy', criterion: 'Accuracy & policy', rating: 4, evidence: 'I checked the approved article.', action: 'Keep using approved sources.' },
    ],
  };
  const existing = [];
  const first = createCoachingActionsV688(review, existing, Date.parse('2026-11-21T00:00:00Z'));
  const second = createCoachingActionsV688(review, existing, Date.parse('2026-11-21T00:00:00Z'));
  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(existing[0].criterionId, 'listening');
  assert.equal(existing[0].status, 'open');
  assert.equal(existing[0].evidence, 'I understand the disruption.');
});

test('guided practice records pass and repeat outcomes deterministically', () => {
  const correct = GUIDED_PRACTICE_V688.opening.options.find(option => option.correct).id;
  const incorrect = GUIDED_PRACTICE_V688.opening.options.find(option => !option.correct).id;
  assert.equal(evaluateGuidedPracticeV688('opening', correct, 1000).passed, true);
  assert.equal(evaluateGuidedPracticeV688('opening', incorrect, 1000).passed, false);
  assert.throws(() => evaluateGuidedPracticeV688('unknown', 'a', 1000), /supported competency/);
  assert.throws(() => evaluateGuidedPracticeV688('opening', 'missing', 1000), /Choose one response/);
});

test('current main.js anchor fixture receives the complete career-development transform', () => {
  const output = transformMainV688(fixture);
  assert.ok(output.startsWith('/* __CALLORIA_CAREER_DEVELOPMENT_V688__ */'));
  assert.ok(output.includes('careerScenarioExamFormV688'));
  assert.ok(output.includes('calloriaAddInboundCaseToQAV688(record)'));
  assert.ok(output.includes('calloriaRecordQADevelopmentActionsV688(review)'));
  assert.ok(output.includes('Career competency passport'));
  assert.ok(output.includes('careerPracticeFormV688'));
  assert.ok(output.includes('careerActionSignoffFormV688'));
  assert.equal(output.includes('id="promotionExamForm"'), false);
  assert.equal(output.includes("if(e.target.id==='promotionExamForm')"), false);
});

test('transform is idempotent and does not duplicate the career panel', () => {
  const once = transformMainV688(fixture);
  const twice = transformMainV688(once);
  assert.equal(twice, once);
  assert.equal((twice.match(/__CALLORIA_CAREER_DEVELOPMENT_V688__/g) || []).length, 1);
});

test('missing required source anchor fails closed without returning a partial transform', () => {
  assert.throws(() => transformMainV688(fixture.replace("state.cases.push(record);recordCustomerContinuityFromCase(record,{customerRef:contact?.customerRef});", 'state.cases.push(record);')), /completed inbound case \/ QA bridge/);
});

test('Vite plugin ignores unrelated files and strips query strings from the main.js ID', () => {
  const plugin = calloriaCareerDevelopmentPluginV688();
  assert.equal(plugin.transform.call({ error(message) { throw new Error(message); } }, fixture, '/repo/js/other.js'), null);
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, fixture, '/repo/js/main.js?import');
  assert.ok(result.code.includes('__CALLORIA_CAREER_DEVELOPMENT_V688__'));
});

test('promotion scenario exam has five non-empty, keyed operational scenarios', () => {
  assert.equal(PROMOTION_SCENARIOS_V688.length, 5);
  assert.equal(new Set(PROMOTION_SCENARIOS_V688.map(item => item.id)).size, 5);
  for (const question of PROMOTION_SCENARIOS_V688) {
    assert.ok(question.prompt.length > 20);
    assert.equal(question.options.filter(option => option.correct).length, 1);
  }
});
