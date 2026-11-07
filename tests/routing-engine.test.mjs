import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENTS, CHANNELS, LANGUAGES, PLATFORMS, INTENTS,
  validateCustomerRequest, redactSensitive, effectivePriority,
  scoreAgentForRoute, selectBestAgent, queueMetrics
} from '../js/routing-engine.js';

test('routing catalogue covers all six RuffNeck products and games', () => {
  assert.equal(PLATFORMS.length, 6);
  assert.deepEqual(PLATFORMS.map(p => p.id), ['ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke']);
});

test('every configured request intent routes to a known department and skill', () => {
  for (const intent of Object.values(INTENTS)) {
    assert.ok(DEPARTMENTS.includes(intent.department));
    assert.ok(typeof intent.skill === 'string' && intent.skill.length > 2);
  }
});

test('customer request validates language, category, summary and selected platform', () => {
  const result = validateCustomerRequest({
    platformId:'kano-keke', intent:'technical_support', language:'ha',
    subject:'Kano Keke loading issue', summary:'The game stops loading after I select a vehicle.'
  });
  assert.equal(result.department, 'Technical Support and IT');
  assert.equal(result.channel, 'game');
  assert.deepEqual(result.requiredSkills, ['technical_support']);
  assert.throws(() => validateCustomerRequest({intent:'unknown',language:'en',subject:'Help',summary:'Please help me today.'}));
  assert.throws(() => validateCustomerRequest({intent:'general',language:'xx',subject:'Help',summary:'Please help me today.'}));
});

test('safeguarding requests are routed as urgent to trained human support', () => {
  const result = validateCustomerRequest({intent:'safeguarding',language:'en',subject:'I need a safe person',summary:'I need a trained person to help me understand what to do next.'});
  assert.equal(result.priority,'urgent');
  assert.equal(result.department,'Safeguarding and Trained Human Support');
  assert.deepEqual(result.requiredSkills,['safeguarding']);
});

test('complaints route to service recovery with high priority', () => {
  const result = validateCustomerRequest({intent:'complaint',language:'en',subject:'Unresolved complaint',summary:'My previous complaint has not received a clear response.'});
  assert.equal(result.priority,'high');
  assert.equal(result.department,'Complaints and Service Recovery');
});

test('request text removes email, Nigerian phone and credential values', () => {
  const redacted = redactSensitive('Call 08031234567 or email test@example.com. Password: Secret123.');
  assert.doesNotMatch(redacted,/08031234567|test@example\.com|Secret123/);
  assert.match(redacted,/REDACTED PHONE/);
  assert.match(redacted,/REDACTED EMAIL/);
  assert.match(redacted,/REDACTED/);
});

test('game platforms create game-channel work while other products use portal', () => {
  const game = validateCustomerRequest({platformId:'kano-run',intent:'platform_support',language:'en',subject:'Game support',summary:'I cannot access my saved game progress.'});
  const platform = validateCustomerRequest({platformId:'ruffneck-learn',intent:'platform_support',language:'en',subject:'Course help',summary:'I cannot find the course I enrolled in.'});
  assert.equal(game.channel,'game'); assert.equal(platform.channel,'portal');
});

test('wait aging never allows non-urgent work to outrank safeguarding priority', () => {
  const now = Date.parse('2026-11-07T12:00:00Z');
  assert.equal(effectivePriority('urgent','2026-11-07T08:00:00Z',now),0);
  assert.equal(effectivePriority('high','2026-11-06T12:00:00Z',now),1);
  assert.equal(effectivePriority('normal','2026-11-07T11:00:00Z',now),1);
  assert.equal(effectivePriority('low','2026-11-07T09:00:00Z',now),1);
});

test('agent requires the matching department, required skills, channel, language and capacity', () => {
  const route = {department:DEPARTMENTS[0],required_skills:['platform_support'],channel:'portal',language:'ha'};
  const eligible = {id:'agent-1',enabled:true,departments:[DEPARTMENTS[0]],skills:['platform_support'],channels:['portal'],languages:['ha'],maxConcurrency:2};
  const noSkill = {...eligible,skills:['sales']};
  const noLanguage = {...eligible,languages:['en']};
  assert.ok(scoreAgentForRoute(eligible,route,0));
  assert.equal(scoreAgentForRoute(noSkill,route,0),null);
  assert.equal(scoreAgentForRoute(noLanguage,route,0),null);
  assert.equal(scoreAgentForRoute(eligible,route,2),null);
});

test('best eligible agent is selected and ineligible agents are ignored', () => {
  const route = {department:DEPARTMENTS[1],required_skills:['sales'],channel:'voice',language:'en'};
  const agents = [
    {id:'busy',departments:[DEPARTMENTS[1]],skills:['sales'],channels:['voice'],languages:['en'],maxConcurrency:1},
    {id:'free',departments:[DEPARTMENTS[1]],skills:['sales'],channels:['voice'],languages:['en'],maxConcurrency:2}
  ];
  const selected=selectBestAgent(route,agents,{busy:1,free:0});
  assert.equal(selected.agentId,'free');
});

test('queue metrics reports real queue counts by priority and channel', () => {
  const now=Date.now();
  const result=queueMetrics([
    {status:'queued',priority:'urgent',channel:'portal',created_at:new Date(now-60000).toISOString()},
    {status:'queued',priority:'normal',channel:'game',created_at:new Date(now-120000).toISOString()},
    {status:'assigned',priority:'high',channel:'voice',created_at:new Date(now-300000).toISOString()}
  ],now);
  assert.equal(result.queued,2);
  assert.equal(result.counts.urgent,1);
  assert.equal(result.counts.normal,1);
  assert.equal(result.channels.portal,1);
  assert.equal(result.oldestWaitSeconds,120);
});
