import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCapacityOutlook } from '../js/operations-capacity-outlook-v6-99.js';
import { calloriaOperationsCapacityOutlookPluginV699 } from '../build/calloria-operations-capacity-outlook-v6-99.mjs';

function days(count, received, resolved, start='2026-11-01'){
  const base=new Date(`${start}T00:00:00Z`);
  return Array.from({length:count},(_,index)=>{
    const date=new Date(base.getTime()+index*86400000).toISOString().slice(0,10);
    return {day:date,received:typeof received==='function'?received(index):received,resolved:typeof resolved==='function'?resolved(index):resolved};
  });
}

test('computes demand, throughput, net backlog drift and seven-day target',()=>{
  const result=buildCapacityOutlook({overview:{active_work:70},daily:days(7,20,15)});
  assert.equal(result.ready,true);
  assert.equal(result.averageReceivedPerDay,20);
  assert.equal(result.averageResolvedPerDay,15);
  assert.equal(result.netBacklogChangePerDay,5);
  assert.equal(result.requiredResolutionsPerDay,30);
  assert.equal(result.dailyResolutionGap,15);
  assert.equal(result.status,'growing');
  assert.deepEqual(result.projectedBacklog.map(row=>row.work),[75,85,105]);
});

test('keeps zero-volume days in the baseline',()=>{
  const result=buildCapacityOutlook({overview:{active_work:0},daily:days(7,0,0)});
  assert.equal(result.ready,true);
  assert.equal(result.averageReceivedPerDay,0);
  assert.equal(result.averageResolvedPerDay,0);
  assert.equal(result.status,'clear');
});

test('requires at least three valid daily observations',()=>{
  const result=buildCapacityOutlook({overview:{active_work:3},daily:days(2,4,4)});
  assert.equal(result.ready,false);
  assert.equal(result.observations,2);
});

test('ignores invalid dates and de-duplicates days deterministically',()=>{
  const rows=[...days(4,12,12),{day:'not-a-date',received:900,resolved:0},{day:'2026-11-04',received:30,resolved:20}];
  const result=buildCapacityOutlook({overview:{active_work:20},daily:rows});
  assert.equal(result.ready,true);
  assert.equal(result.observations,4);
  assert.equal(result.averageReceivedPerDay,16.5);
});

test('calculates demand trend only when a prior seven-day comparison exists',()=>{
  const result=buildCapacityOutlook({overview:{active_work:0},daily:[...days(7,10,10),...days(7,20,20,'2026-11-08')]});
  assert.equal(result.demandTrendPercent,100);
  const short=buildCapacityOutlook({overview:{active_work:0},daily:days(7,10,10)});
  assert.equal(short.demandTrendPercent,null);
});

test('reports recovery and estimates clearance only when net movement is negative',()=>{
  const result=buildCapacityOutlook({overview:{active_work:60},daily:days(7,10,20)});
  assert.equal(result.status,'recovering');
  assert.equal(result.estimatedClearDays,6);
  assert.equal(result.projectedBacklog.at(-1).work,0);
});

test('bounds the horizon and prevents negative or non-finite counts',()=>{
  const result=buildCapacityOutlook({overview:{active_work:-4},daily:days(7,NaN,-2)},{horizonDays:100});
  assert.equal(result.horizonDays,30);
  assert.equal(result.backlog,0);
  assert.equal(result.averageReceivedPerDay,0);
  assert.equal(result.averageResolvedPerDay,0);
  assert.equal(result.projectedBacklog.at(-1).day,30);
});

test('uses seven most recent observations from longer reporting ranges',()=>{
  const result=buildCapacityOutlook({overview:{active_work:0},daily:days(30,i=>i+1,i=>i+1)});
  assert.equal(result.firstObservedDay,'2026-11-24');
  assert.equal(result.lastObservedDay,'2026-11-30');
  assert.equal(result.averageReceivedPerDay,27);
});

test('HTML transform inserts panel and stylesheet once',()=>{
  const plugin=calloriaOperationsCapacityOutlookPluginV699();
  const source='<!doctype html><html><head></head><body><footer class="oi-footer">Done</footer></body></html>';
  const transformed=plugin.transformIndexHtml.call({warn(){}},source);
  assert.match(transformed,/CALLORIA_V699_OPERATIONS_CAPACITY_OUTLOOK/);
  assert.match(transformed,/operations-capacity-outlook-v6-99\.css/);
  assert.equal(plugin.transformIndexHtml.call({warn(){}},transformed),transformed);
});

test('JS transform patches exactly the intended workbench anchors and is idempotent',()=>{
  const plugin=calloriaOperationsCapacityOutlookPluginV699();
  const source=[
    "import { createClient } from '@supabase/supabase-js';",
    'function render(snapshot){const s=normaliseSnapshot(snapshot);renderChannels(s.channels);renderDaily(s.daily);}',
    'async function refresh(){}'
  ].join('\n');
  const result=plugin.transform.call({warn(message){throw new Error(message);}},source,'/project/js/operations-intelligence-workbench.js');
  assert.ok(result?.code);
  assert.match(result.code,/buildCapacityOutlook/);
  assert.match(result.code,/renderCapacityOutlook\(s\)/);
  assert.match(result.code,/CALLORIA_V699_OPERATIONS_CAPACITY_OUTLOOK_RUNTIME/);
  assert.equal(plugin.transform(result.code,'/project/js/operations-intelligence-workbench.js'),null);
});

test('JS transform skips safely when source has drifted',()=>{
  const plugin=calloriaOperationsCapacityOutlookPluginV699();
  let warning='';
  const result=plugin.transform.call({warn(message){warning=message;}},'export const changed=true;','/project/js/operations-intelligence-workbench.js');
  assert.equal(result,null);
  assert.match(warning,/skipped safely/);
});
