import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV648Test as v648 } from '../build/calloria-career-competency-passport-v6-48.mjs';
import { __calloriaV649Test as v649 } from '../build/calloria-promotion-readiness-dossier-v6-49.mjs';
import { __calloriaV650Test as v650 } from '../build/calloria-scenario-based-promotion-exam-v6-50.mjs';

const fixturePath = new URL('./fixtures/v6-50-workforce-promotion-exam.fixture.js', import.meta.url);
const context = () => ({ warnings: [], warn(message) { this.warnings.push(message); } });
const bestAnswers = () => Object.fromEntries(v650.questions.map(question => [question.id, 10]));

test('contains twelve scenario questions across seven operational competency areas', () => {
  assert.equal(v650.questions.length, 12);
  assert.deepEqual(new Set(v650.questions.map(q => q.category)), new Set([
    'Security & privacy','Customer communication','Operational judgement','Case ownership','CRM & documentation','Ethical sales','Leadership & teamwork'
  ]));
  assert.ok(v650.questions.every(q => q.options.length === 4 && q.options.some(o => o.score === 10) && q.options.some(o => o.score === 0)));
});

test('scores all best-practice responses at 100 and records category breakdown', () => {
  const result = v650.score(bestAnswers());
  assert.equal(result.score, 100);
  assert.equal(result.answered, 12);
  assert.equal(result.total, 12);
  assert.equal(result.responses.length, 12);
  assert.equal(result.breakdown['Security & privacy'].score, 100);
});

test('scores the lowest-scored response set at zero', () => {
  const answers = Object.fromEntries(v650.questions.map(question => [question.id, 0]));
  assert.equal(v650.score(answers).score, 0);
});

test('calculates the actual weighted percentage from mixed response quality', () => {
  const answers = Object.fromEntries(v650.questions.map((question, index) => [question.id, [10,7,3,0][index % 4]]));
  const expected = 50;
  assert.equal(v650.score(answers).score, expected);
});

test('rejects missing or invalid answers so incomplete exams cannot be submitted', () => {
  const partial = bestAnswers(); delete partial.q12;
  assert.equal(v650.score(partial), null);
  const invalid = bestAnswers(); invalid.q04 = 9;
  assert.equal(v650.score(invalid), null);
  assert.equal(v650.score(null), null);
});

test('readiness KPI and QA calculations include completed digital contacts and scored digital QA', () => {
  const state = { callsHandled:2,outboundCalls:1,qaCount:2,totalQA:160,csatCount:0,totalCSAT:0,incidents:0,experience:0,level:1,promotionAttempts:[],digitalQueue:[{qaScore:90},{qaScore:80},{status:'open'}] };
  const model = v649.buildReadiness({state,year:2026,digitalMetrics:{resolved:2,escalated:1,averageQA:85}});
  assert.equal(model.metrics.kpi,30); // (2 inbound + 1 outbound + 3 digital) * 5
  assert.equal(model.metrics.qa,83);  // round((160 + 85 * 2) / 4)
});

test('readiness uses the live digital score helper when an injected runtime function exists', () => {
  const state = { callsHandled:0,outboundCalls:0,qaCount:0,totalQA:0,csatCount:0,totalCSAT:0,incidents:0,experience:0,level:1,promotionAttempts:[],digitalQueue:[] };
  const model = v649.buildReadiness({state,year:2026,digitalMetrics:{resolved:4,escalated:0,averageQA:null}});
  assert.equal(model.metrics.kpi,20);
});

test('transforms v6.48 and v6.49 before adding the scenario exam, then remains idempotent', async () => {
  const fixture = await readFile(fixturePath,'utf8');
  const c48=context(); const r48=v648.transformMain(c48,fixture); assert.ok(r48); assert.deepEqual(c48.warnings,[]);
  const c49=context(); const r49=v649.transformMain(c49,r48.code); assert.ok(r49); assert.deepEqual(c49.warnings,[]);
  const c50=context(); const r50=v650.transformMain(c50,r49.code); assert.ok(r50); assert.deepEqual(c50.warnings,[]);
  assert.match(r50.code,new RegExp(v650.MARKER));
  assert.match(r50.code,/function calloriaRenderPromotionExamV650\(eligible\)/);
  assert.match(r50.code,/Submit annual promotion examination/);
  assert.match(r50.code,/examBreakdown:examEvaluation\.breakdown/);
  assert.match(r50.code,/View scenario competency breakdown/);
  assert.match(r50.code,/completedDigital/);
  assert.doesNotMatch(r50.code,/Simulated examination score \(0–100\)/);
  assert.equal(v650.transformMain(context(),r50.code),null);
  const dir=await mkdtemp(join(tmpdir(),'calloria-v650-')); const out=join(dir,'main-v650-fixture.mjs');
  try { await writeFile(out,r50.code); const check=spawnSync(process.execPath,['--check',out],{encoding:'utf8'}); assert.equal(check.status,0,check.stderr||check.stdout); }
  finally { await rm(dir,{recursive:true,force:true}); }
});

test('fails closed when the v6.49 prerequisite or any required main.js anchor is missing', async () => {
  const fixture=await readFile(fixturePath,'utf8');
  const missingPrerequisite=context(); assert.equal(v650.transformMain(missingPrerequisite,fixture),null); assert.match(missingPrerequisite.warnings.join(' '),/v6\.49.*missing/i);
  const r48=v648.transformMain(context(),fixture); const r49=v649.transformMain(context(),r48.code);
  const changed=context(); assert.equal(v650.transformMain(changed,r49.code.replace(v650.RECORD_ANCHOR,'')),null); assert.match(changed.warnings.join(' '),/existing promotion exam recording call/i);
});

test('records scenario evidence but leaves promotion decision and policy to existing Workforce engine', async () => {
  const fixture=await readFile(fixturePath,'utf8');
  const r48=v648.transformMain(context(),fixture); const r49=v649.transformMain(context(),r48.code); const r50=v650.transformMain(context(),r49.code);
  assert.match(r50.code,/recordPromotionExam\(state\.promotionAttempts/);
  assert.match(r50.code,/examVersion:'scenario-based-v6\.50'/);
  assert.match(r50.code,/minimumScore:getActiveOrganization\(state\.organizationWorkspace\)/);
  assert.match(r50.code,/examScore:Number\(new FormData\(e\.target\)\.get\('examScore'\)\)/);
});

test('registers the new exam plugin after the readiness dossier and retains earlier plugins', async () => {
  const config=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');
  assert.match(config,/calloria-scenario-based-promotion-exam-v6-50\.mjs/);
  assert.ok(config.indexOf('calloriaPromotionReadinessDossierPlugin()')<config.indexOf('calloriaScenarioBasedPromotionExamPlugin()'));
  for (const required of ['calloriaVoiceResponseWorkflowPlugin()','calloriaInboundQAReviewBridgePlugin()','calloriaQACoachingFollowThroughPlugin()','calloriaCareerCompetencyPassportPlugin()']) assert.match(config,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
