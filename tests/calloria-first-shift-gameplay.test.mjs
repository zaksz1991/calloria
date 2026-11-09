import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FIRST_SHIFT_STEPS, transitionFirstShiftMission } from '../js/world-gameplay-mission.js';
import { __firstShiftPluginTest } from '../build/calloria-first-shift-gameplay-plugin.js';

function makeSource() {
  return [
    "function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;state.level=1;}",
    "  pushOperationEvent('shift','SHIFT-'+state.day,'Shift started; inbound routing opened.','active');",
    "  pushOperationEvent('call',contact.id,`Inbound contact connected · ${scenario.issue}`,'connected',{customer:scenario.customer,routeGroup:contact.routeGroup,priority:contact.priority,waitSeconds});",
    "    pushOperationEvent('case',wrap.reference,`Inbound case saved · ${status}`,'saved',{disposition,qa:wrap.qa,acwSeconds});",
    "      pushOperationEvent('briefing',briefing.id,`${briefing.title} attended and acknowledged.`);",
    "  if((view==='inbound'||view==='outbound'||view==='digital')&&!state.shiftActive)startShift();\n  state.currentView=view;\n  saveState();\n  exit3dFloor();",
    "function open3dStationPanel(station){\n  const panel=$('#stationPanel');",
    "      onAssetsReady:result=>{\n        const label=result.loaded?`${result.loaded} 3D STAFF ASSETS READY`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';\n        const status=$('#assetStatus');if(status)status.textContent=label;\n      },"
  ].join('\n');
}

const context = { error(message) { throw new Error(message); } };

test('first-shift mission exposes six ordered gameplay steps', () => {
  assert.equal(FIRST_SHIFT_STEPS.length, 6);
  assert.equal(FIRST_SHIFT_STEPS[0].id, 'reach-station');
  assert.equal(FIRST_SHIFT_STEPS[5].id, 'handle-customer');
});

test('station approach and workstation access advance the objective', () => {
  let state = transitionFirstShiftMission({}, 'nearest-station', { station: { id: 11, label: 'Agent Station 11' } });
  assert.equal(state.step, 1);
  assert.equal(state.stationId, 11);
  state = transitionFirstShiftMission(state, 'station-accessed', { id: 11, label: 'Agent Station 11' });
  assert.equal(state.step, 2);
});

test('workforce gates remain visible when shift has not started', () => {
  let state = transitionFirstShiftMission({ step: 2 }, 'operation-selected', { view: 'inbound', shiftActive: false });
  assert.equal(state.step, 3);
  state = transitionFirstShiftMission(state, 'briefing-attended', { slot: 'morning' });
  assert.equal(state.briefingAttended, true);
  state = transitionFirstShiftMission(state, 'shift-started', { day: 1 });
  assert.equal(state.step, 4);
  assert.equal(state.shiftStarted, true);
});

test('customer connection and case save complete using actual outcome data', () => {
  let state = transitionFirstShiftMission({ step: 4 }, 'call-connected', { customer: 'Synthetic customer' });
  assert.equal(state.step, 5);
  state = transitionFirstShiftMission(state, 'case-saved', { reference: 'CASE-1', disposition: 'escalated', qa: 82, resolved: false });
  assert.equal(state.step, 6);
  assert.equal(state.resolved, false);
  assert.equal(state.qa, 82);
  assert.equal(state.disposition, 'escalated');
});

test('GLB status remains truthful when zero models load', () => {
  const state = transitionFirstShiftMission({}, 'assets-ready', { staff: 0, office: 0, failures: 3, loading: false, tier: 'low' });
  assert.deepEqual(state.assetStatus, { staff: 0, office: 0, failures: 3, loading: false, tier: 'low' });
});

test('Vite bridge injects all gameplay signals and uses the real GLB-ready callback', () => {
  const result = __firstShiftPluginTest.transformMain(context, makeSource());
  assert.ok(result.code.includes(__firstShiftPluginTest.MARKER));
  for (const eventName of [
    'calloria:game-employment-accepted',
    'calloria:game-shift-started',
    'calloria:game-call-connected',
    'calloria:game-case-saved',
    'calloria:game-briefing-attended',
    'calloria:game-operation-selected',
    'calloria:game-station-panel-opened',
    'calloria:glb-assets-ready'
  ]) assert.equal(result.code.split(eventName).length - 1, 1, `${eventName} should be injected once`);
  assert.match(result.code, /result\?\.staffLoaded/);
  assert.match(result.code, /result\?\.officePlaced/);
  assert.doesNotMatch(result.code, /OPTIMISED LOCAL STAFF MODELS ACTIVE/);
});

test('Vite bridge is idempotent and refuses changed required source anchors', () => {
  const first = __firstShiftPluginTest.transformMain(context, makeSource());
  assert.equal(__firstShiftPluginTest.transformMain(context, first.code), null);
  assert.throws(() => __firstShiftPluginTest.transformMain(context, makeSource().replace("function acceptOffer(){state.stage='employee';state.hired=true;state.shiftActive=false;", 'function acceptOffer(){')), /employment accepted anchor/);
});

test('GLB status uses main.js onAssetsReady callback instead of production-world internals', () => {
  const rule = __firstShiftPluginTest.RULES.at(-1);
  assert.match(rule.anchor, /onAssetsReady:result/);
  assert.match(rule.anchor, /OPTIMISED LOCAL STAFF MODELS ACTIVE/);
  assert.doesNotMatch(rule.anchor, /furnitureErrors/);
  assert.match(rule.replacement, /calloria:glb-assets-ready/);
});

test('Vite registers the first-shift event bridge after existing integration plugins', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8').catch(() => '');
  // In the deployed v2.3 config, registration is already present. This fix intentionally
  // replaces only the failing bridge plugin and does not introduce a second registration.
  assert.match(config, /calloriaFirstShiftGameplayPlugin\(\)/);
});
