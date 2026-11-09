import test from 'node:test';
import assert from 'node:assert/strict';
import { __staticGLBStaffTest, calloriaStaticGLBStaffPlugin } from '../build/calloria-static-glb-staff-plugin.mjs';

const t = __staticGLBStaffTest;
const fixture = [
  t.RIG_LINE,
  t.REJECT_LINE,
  t.RIG_REASON,
  t.IDLE_FLAG,
  t.CANDIDATE_CLIP_GUARD,
  t.STATIC_BRANCH,
  t.IDLE_PROFILE,
  t.FINAL_GUARD,
  t.REPLACEMENT_RECORD,
  t.STATUS_ANIMATIONS
].join('\n');

test('static GLB plugin is registered for the staff integration module', () => {
  const plugin = calloriaStaticGLBStaffPlugin();
  assert.equal(plugin.name, 'calloria-static-standing-glb-staff-v2-7');
  assert.equal(plugin.enforce, 'post');
});

test('allows a compatible static GLB to replace standing staff', () => {
  const result = t.transformStaff({ error(message) { throw new Error(message); } }, fixture);
  assert.ok(result.code.includes('useStaticDisplay = false'));
  assert.ok(result.code.includes("renderMode: clip ? 'embedded-animation'"));
  assert.ok(result.code.includes("useStaticDisplay = true"));
  assert.ok(result.code.includes("'static-glb-display'"));
  assert.ok(result.code.includes('staticModelsInUse: replacements.filter'));
});

test('does not allow static-only models to replace seated agents', () => {
  const result = t.transformStaff({ error(message) { throw new Error(message); } }, fixture);
  assert.ok(result.code.includes('Never use this path for a seated agent'));
  assert.ok(result.code.includes('useStaticDisplay && !person.seated'));
  assert.ok(result.code.includes('if (!clip && !idleProfile && !staticDisplay)'));
});

test('preserves embedded animation and skeletal idle preference', () => {
  const result = t.transformStaff({ error(message) { throw new Error(message); } }, fixture);
  assert.ok(result.code.includes('if (candidateClip)'));
  assert.ok(result.code.includes('useProceduralIdle = true'));
  assert.ok(result.code.includes("clip ? 'embedded-animation' : idleProfile ? 'procedural-skeletal-idle'"));
});

test('is idempotent and does not transform a second time', () => {
  const first = t.transformStaff({ error(message) { throw new Error(message); } }, fixture);
  assert.equal(t.transformStaff({ error(message) { throw new Error(message); } }, first.code), null);
});

test('refuses a stale or ambiguous integration source instead of partially patching', () => {
  assert.throws(
    () => t.transformStaff({ error(message) { throw new Error(message); } }, fixture.replace(t.STATIC_BRANCH, '')),
    /standing-character animation branch anchor \(0 found\)/
  );
});
