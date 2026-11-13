import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformStaffRuntimeIntegration } from '../build/calloria-cc0-staff-glb-bundle-plugin.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = await readFile(path.join(here, 'fixtures/glb-world-integration-v12.fixture.js'), 'utf8');
const ids = ['female-agent', 'male-agent', 'gp5-woman'];
const modes = { 'female-agent': 'static-mesh', 'male-agent': 'skinned-static-pose', 'gp5-woman': 'animated-skinned' };
const transformed = transformStaffRuntimeIntegration(fixture, ids, modes);

test('v6.36 transforms the checked staff runtime without warnings', () => {
  assert.ok(transformed.code);
  assert.deepEqual(transformed.warnings || [], []);
  assert.equal(transformed.staffSpeechMorphSupportAdded, true);
});

test('speech morph discovery is limited to explicit jaw and standard viseme names', () => {
  assert.match(transformed.code, /\^\(\?:jawopen\|mouthopen\|mouthopening\)\$/);
  assert.match(transformed.code, /\^\(\?:viseme\)\?\(aa\|oh\|oo\|ee\|eh\)\$/);
  assert.match(transformed.code, /kind: isJawOpenMorph \? 'jaw' : 'viseme'/);
});

test('jaw morphs take precedence over visemes to avoid double-driven mouth geometry', () => {
  assert.match(transformed.code, /speechUsesVisemes: !idleSpeechMorphTargets\.some\(\(target\) => target\.kind === 'jaw'\)/);
  assert.match(transformed.code, /target\.kind === 'jaw'\s*\? true\s*:\s*idle\.speechUsesVisemes && target\.viseme === activeViseme/);
});

test('speech animation requires a targeted staff asset identifier', () => {
  assert.match(transformed.code, /window\.addEventListener\('calloria:staff-speaking', handleCalloriaStaffSpeaking\)/);
  assert.match(transformed.code, /const assetId = String\(detail\.assetId \|\| detail\.agentId \|\| ''\)\.trim\(\)/);
  assert.match(transformed.code, /if \(idle\.assetId !== assetId \|\| !idle\.speechMorphTargets\?\.length\) continue/);
});

test('speech intensity is clamped and the mouth envelope eases in and out', () => {
  assert.match(transformed.code, /Math\.max\(0, Math\.min\(1, rawIntensity\)\)/);
  assert.match(transformed.code, /1 - Math\.exp\(-Math\.max\(0, idleStep\) \* 13\)/);
  assert.match(transformed.code, /idle\.speechWeight \+= \(speechTarget - idle\.speechWeight\) \* speechEase/);
});

test('speech morph amplitudes remain small and bounded to authored morph ranges', () => {
  assert.match(transformed.code, /Math\.min\(isJawOpenMorph \? 0\.19 : 0\.14, 1 - clampedBase\)/);
  assert.match(transformed.code, /Math\.max\(0, Math\.min\(1, target\.baseInfluence \+ speechInfluence\)\)/);
});

test('authored animated GLBs are excluded from procedural speech morphs', () => {
  assert.match(transformed.code, /const proceduralIdle = !clip && \['skinned-static-pose', 'static-mesh'\]\.includes\(selectedRenderMode\)/);
  assert.match(transformed.code, /if \(proceduralIdle && clonedRoot\?\.traverse\)/);
  assert.match(transformed.code, /if \(clip\) \{\s*mixer = new T\.AnimationMixer\(clonedRoot\)/);
});

test('the voice event listener is removed during staff runtime disposal', () => {
  const removeAt = transformed.code.indexOf("window.removeEventListener('calloria:staff-speaking', handleCalloriaStaffSpeaking)");
  const clearAt = transformed.code.indexOf('proceduralIdleControllers.length = 0;', removeAt);
  assert.ok(removeAt >= 0);
  assert.ok(clearAt > removeAt);
});

test('runtime diagnostics report speech-capable staff and morph counts', () => {
  assert.match(transformed.code, /speechMorphStaffPlaced/);
  assert.match(transformed.code, /speechMorphTargets: replacements\.reduce/);
  assert.match(transformed.code, /proceduralIdleSpeechTargets: idleSpeechMorphTargets\.length/);
});

test('event-driven speech support composes with prior blink, expression and eye-gaze features', () => {
  assert.match(transformed.code, /blinkMorphTargets: idleBlinkMorphTargets/);
  assert.match(transformed.code, /expressionMorphTargets: idleExpressionMorphTargets/);
  assert.match(transformed.code, /gazeMorphTargets: idleGazeMorphTargets/);
  assert.match(transformed.code, /calloria:staff-speaking/);
});

test('v6.36 transformation is idempotent and fails closed on a changed runtime contract', () => {
  const second = transformStaffRuntimeIntegration(transformed.code, ids, modes);
  assert.ok(second.code);
  assert.equal(second.code, transformed.code);
  assert.equal(second.alreadyPatched, true);
  const invalid = transformStaffRuntimeIntegration('export function integrateCalloriaGLBStaff(){ return null; }', ids, modes);
  assert.equal(invalid.code, null);
  assert.ok(invalid.warnings?.length);
});
