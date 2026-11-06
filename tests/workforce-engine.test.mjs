import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEPARTMENTS, SYSTEMS, briefingFor, recordBriefingAttendance,
  promotionScore, promotionEligibility, recordPromotionExam,
  recordCrossSell, recordCommendation, createSystemEvent
} from '../js/workforce-engine.js';

test('department catalogue keeps specialist units under customer-care standards', () => {
  assert.ok(DEPARTMENTS.some(x => x.id === 'email'));
  assert.ok(DEPARTMENTS.some(x => x.id === 'social'));
  assert.ok(DEPARTMENTS.some(x => x.id === 'it'));
  assert.ok(DEPARTMENTS.some(x => x.id === 'qa'));
});

test('briefing schedule identifies morning and afternoon sessions using local time', () => {
  assert.equal(briefingFor(new Date(2026, 10, 6, 7, 45)).slot, 'morning');
  assert.equal(briefingFor(new Date(2026, 10, 6, 14, 10)).slot, 'afternoon');
  assert.equal(briefingFor(new Date(2026, 10, 6, 8, 45)), null);
  assert.equal(briefingFor(new Date(2026, 10, 6, 14, 45)).slot, 'afternoon');
  assert.equal(briefingFor(new Date(2026, 10, 6, 19, 0)), null);
});

test('briefing attendance is idempotent for an employee and briefing', () => {
  const rows = [], briefing = {id:'2026-11-06-morning',slot:'morning',scheduled:'07:30'};
  recordBriefingAttendance(rows, briefing, 'EMP-A', 1000);
  recordBriefingAttendance(rows, briefing, 'EMP-A', 2000);
  assert.equal(rows.length, 1);
});

test('promotion score uses the published weighted KPI formula', () => {
  assert.equal(promotionScore({kpi:100,qa:100,csat:100,knowledge:100,compliance:100,leadership:100}),100);
  assert.equal(promotionScore({kpi:0,qa:0,csat:0,knowledge:0,compliance:0,leadership:0}),0);
});

test('promotion permits at most one exam per year and three attempts overall', () => {
  const attempts = [];
  const metrics = {kpi:90,qa:90,csat:90,knowledge:90,compliance:90,leadership:90};
  assert.equal(promotionEligibility({metrics,attempts,year:2026}).eligible,true);
  recordPromotionExam(attempts,{metrics,examScore:80},new Date(2026,5,1).getTime());
  assert.equal(promotionEligibility({metrics,attempts,year:2026}).eligible,false);
  recordPromotionExam(attempts,{metrics,examScore:60},new Date(2027,5,1).getTime());
  recordPromotionExam(attempts,{metrics,examScore:85},new Date(2028,5,1).getTime());
  assert.equal(promotionEligibility({metrics,attempts,year:2029}).attemptsRemaining,0);
  assert.throws(()=>recordPromotionExam(attempts,{metrics,examScore:90},new Date(2029,5,1).getTime()),/not currently available/);
});

test('cross-selling records only qualified interest when relevance, eligibility and consent all hold', () => {
  const rows=[];
  const good=recordCrossSell(rows,{customerId:'CUS-1',product:'Savings',relevant:true,eligible:true,consent:true},1000);
  const bad=recordCrossSell(rows,{customerId:'CUS-2',product:'Card',relevant:true,eligible:true,consent:false},2000);
  assert.equal(good.outcome,'qualified_interest');
  assert.equal(bad.outcome,'not_converted');
});

test('commendations are routed through official review and never record private benefit acceptance', () => {
  const rows=[];
  const item=recordCommendation(rows,{customerId:'CUS-1',message:'Excellent service'},1000);
  assert.equal(item.route,'official_customer_relations');
  assert.equal(item.privateBenefitAccepted,false);
});

test('enterprise system events are synthetic and reject unknown systems', () => {
  const rows=[];
  const event=createSystemEvent(rows,'finacle','Account inquiry','SIM-ACC-1',1000);
  assert.equal(event.dataClass,'synthetic');
  assert.equal(event.status,'simulated_only');
  assert.throws(()=>createSystemEvent(rows,'real-core-bank','Transfer','X',1000),/Unknown simulated system/);
});

test('People and systems workspace is reachable and existing recruitment gate remains in place', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const here = path.dirname(new URL(import.meta.url).pathname);
  const main = await fs.readFile(path.join(here, '../js/main.js'), 'utf8');
  const html = await fs.readFile(path.join(here, '../index.html'), 'utf8');
  assert.match(html, /data-view="workforce"/);
  assert.match(main, /case 'workforce': renderWorkforce\(\)/);
  assert.match(main, /if\(!state\.hired\)/);
  assert.match(main, /recordPromotionExam/);
  assert.match(main, /recordCommendation/);
  assert.match(main, /createSystemEvent/);
});
