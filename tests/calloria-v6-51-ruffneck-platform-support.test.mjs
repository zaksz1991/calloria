import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { __calloriaV651Test as v651 } from '../build/calloria-ruffneck-platform-support-v6-51.mjs';

const context=()=>({warnings:[],warn(message){this.warnings.push(message);}});
const fixturePath=new URL('./fixtures/v6-51-platform-support.fixture.js',import.meta.url);

test('platform registry removes Finacle and retains internal operations systems',async()=>{
  const source=`export const SYSTEMS = [\n  { id:'icc', name:'ICC', purpose:'Interaction control, queue events and customer satisfaction' },\n  { id:'crm', name:'CRM', purpose:'Customer profile, interaction history and cases' },\n  { id:'finacle', name:'Finacle', purpose:'Simulated account and transaction inquiry' }\n];\nexport function createSystemEvent(events, systemId) { if (!SYSTEMS.some(x => x.id === systemId)) throw new TypeError('Unknown'); }`;
  const result=v651.transformWorkforce(context(),source);
  assert.ok(result);
  assert.doesNotMatch(result.code,/finacle|Finacle/);
  assert.match(result.code,/ruffneck-lms/);
  assert.match(result.code,/ruffneck-prospector/);
  assert.match(result.code,/ruffneck-connect/);
  assert.match(result.code,/ruffneck-social-hub/);
  assert.match(result.code,/kano-run/);
  assert.match(result.code,/kano-keke/);
  assert.match(result.code,/\"id\": \"icc\"/);
  assert.match(result.code,/\"id\": \"crm\"/);
  assert.equal(v651.transformWorkforce(context(),result.code),null);
});

test('catalog contains all six RuffNeck service platforms with URLs and support routes',()=>{
  assert.equal(Object.keys(v651.catalog).length,6);
  for(const [id,guide] of Object.entries(v651.catalog)){
    assert.ok(guide.url.startsWith('https://'));
    assert.ok(guide.requests.length>=3);
    assert.ok(guide.selfService.length>=2);
    assert.ok(guide.agentSteps.length>=3);
    assert.ok(guide.escalate.length>20);
    assert.ok(guide.scenario.options.some(option=>option.score===100));
  }
});

test('scores only valid product-support choices and returns the scenario rationale',()=>{
  assert.equal(v651.score('ruffneck-lms','verify').score,100);
  assert.equal(v651.score('ruffneck-prospector','new-record').score,0);
  assert.match(v651.score('kano-run','guest-save').feedback,/Correct/);
  assert.equal(v651.score('unknown','verify'),null);
  assert.equal(v651.score('ruffneck-lms','not-a-choice'),null);
});

test('transforms the current Workforce page with support guides and local practice recording',async()=>{
  const source=await readFile(fixturePath,'utf8');
  const result=v651.transformMain(context(),source);
  assert.ok(result);
  assert.match(result.code,new RegExp(v651.MARKER));
  assert.match(result.code,/RuffNeck services & operations systems/);
  assert.match(result.code,/calloriaRenderPlatformGuideV651\(\)/);
  assert.match(result.code,/data-platform-choice/);
  assert.match(result.code,/platformTrainingRecords/);
  assert.match(result.code,/platform-practice/);
  assert.match(result.code,/state\.activePlatformId=system\.id/);
  assert.match(result.code,/systemEvents\.filter\(e=>e\.systemId!=='finacle'\)/);
  assert.doesNotMatch(result.code,/Enterprise systems sandbox/);
  assert.equal(v651.transformMain(context(),result.code),null);
  const dir=await mkdtemp(join(tmpdir(),'calloria-v651-'));const out=join(dir,'main-v651.mjs');
  try{await writeFile(out,result.code);const check=spawnSync(process.execPath,['--check',out],{encoding:'utf8'});assert.equal(check.status,0,check.stderr||check.stdout);}
  finally{await rm(dir,{recursive:true,force:true});}
});

test('new applicant defaults to general customer experience and migrates only empty legacy applicants',async()=>{
  const source=await readFile(fixturePath,'utf8');
  const result=v651.transformMain(context(),source);
  assert.match(result.code,/selectedTrack: 'service'/);
  assert.match(result.code,/department: 'Customer Experience'/);
  assert.match(result.code,/!migrated\.applicationSubmitted && migrated\.stage === 'applicant' && !migrated\.hired && !String\(migrated\.applicantName \|\| ''\)\.trim\(\)/);
  assert.match(result.code,/migrated\.selectedTrack='service'/);
  assert.match(result.code,/migrated\.stage === 'applicant' && !migrated\.hired/);
  assert.match(result.code,/migrated\.department='Customer Experience'/);
});

test('fails closed when a required UI anchor has drifted',async()=>{
  const source=await readFile(fixturePath,'utf8');
  const changed=context();
  assert.equal(v651.transformMain(changed,source.replace('Open simulated system','Open service')) ,null);
  assert.match(changed.warnings.join(' '),/workforce platform cards/);
});

test('registers v6.51 after the cumulative v6.42–v6.50 plugin chain',async()=>{
  const config=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');
  assert.match(config,/calloria-ruffneck-platform-support-v6-51\.mjs/);
  assert.ok(config.indexOf('calloriaScenarioBasedPromotionExamPlugin()')<config.indexOf('calloriaRuffNeckPlatformSupportPlugin()'));
  for(const item of ['calloriaVoiceResponseWorkflowPlugin()','calloriaInboundQAReviewBridgePlugin()','calloriaQACoachingFollowThroughPlugin()','calloriaCareerCompetencyPassportPlugin()','calloriaPromotionReadinessDossierPlugin()'])assert.match(config,new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
});
