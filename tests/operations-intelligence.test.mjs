import test from 'node:test';
import assert from 'node:assert/strict';
import {REPORT_RANGES,numberValue,nullableNumber,formatCount,formatPercent,formatMinutes,formatSeconds,normaliseSnapshot,metricTone,channelLabel} from '../js/operations-intelligence-engine.js';

test('only supported reporting windows are exposed',()=>assert.deepEqual(REPORT_RANGES,[7,30,90]));
test('numeric helpers reject non-finite values',()=>{assert.equal(numberValue('4'),4);assert.equal(numberValue('x'),0);assert.equal(nullableNumber(null),null);assert.equal(nullableNumber('8.5'),8.5);});
test('Nigerian count and percentage formatting is stable',()=>{assert.equal(formatCount(1200),'1,200');assert.equal(formatPercent(92.4),'92.4%');assert.equal(formatPercent(null),'—');});
test('duration display handles seconds, minutes and hours',()=>{assert.equal(formatMinutes(0.5),'30 sec');assert.equal(formatMinutes(65),'1h 5m');assert.equal(formatMinutes(null),'—');assert.equal(formatSeconds(125),'2m 5s');});
test('snapshot normalisation supplies empty safe collections',()=>{const s=normaliseSnapshot({overview:{},queue_risk:{}});assert.deepEqual(s.channels,[]);assert.deepEqual(s.departments,[]);assert.deepEqual(s.daily,[]);assert.deepEqual(s.provider_delivery,[]);});
test('snapshot normalisation rejects missing snapshot',()=>assert.throws(()=>normaliseSnapshot(null),/no snapshot/));
test('SLA and queue-risk tones are explicit',()=>{assert.equal(metricTone(95,'sla'),'good');assert.equal(metricTone(85,'sla'),'watch');assert.equal(metricTone(72,'sla'),'bad');assert.equal(metricTone(0,'risk'),'good');assert.equal(metricTone(4,'risk'),'bad');});
test('channel labels cover all provider channels',()=>{assert.equal(channelLabel('live_chat'),'Website live chat');assert.equal(channelLabel('sms'),'SMS');assert.equal(channelLabel('social'),'Instagram / Messenger');});
