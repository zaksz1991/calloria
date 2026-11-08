import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaGLBWorldPlugin } from '../build/calloria-glb-world-plugin.js';

const worldFixture = `
  const player = { x: 0, z: 15.0, yaw: 0, pitch: -0.04, speed: 4.35 };
  function useNearestStation() {
    if (!immersive || !nearestStation) return;
    callbacks.onStation?.({ id: nearestStation.id, label: nearestStation.label, department: nearestStation.department });
  }
  function setImmersive(value) {
    immersive = Boolean(value);
    if (immersive) {
      player.x = 0; player.z = 15.0; player.yaw = 0; player.pitch = -0.04;
    }
    callbacks.onImmersiveChange?.(immersive);
  }
  function updatePlayer() {
      callbacks.onNearestStation?.(nearestStation ? { id: nearestStation.id, label: nearestStation.label, department: nearestStation.department } : null);
  }
  function animate() {
      updateStaff(delta, timestamp / 1000); animate.lastStaffAt = timestamp;
  }
  const ready = true;
  callbacks.onAssetsReady?.({ loaded: 0, fallback: staff.length, mode: 'merged-articulated-local-staff', tier });
  const world = {
    get assetMessage() { return 'CALLORIA 3D workplace and draw-call-merged articulated staff ready'; },
    dispose() {
      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
    }
  };
`;

const staffFixture = `
const RIG = true;
      const humanScale = metrics.size.y >= 1.0 && metrics.size.y <= 2.6
        && metrics.size.x >= 0.2 && metrics.size.x <= 1.35
        && metrics.size.z >= 0.12 && metrics.size.z <= 1.35;
      const rigValid = metrics.skinnedMeshCount > 0 && metrics.skeletonCount > 0 && metrics.boneCount >= 15;
      if (!humanScale || !rigValid || !geometryValid || !texturesValid || !extensionsValid) {
        if (!rigValid) reasons.push('usable character skeleton not detected');
      }
    let useProceduralIdle = false;
      const candidateClip = chooseClip(candidate.gltf.animations, Boolean(person.seated));
      if (candidateClip) {
        selected = candidate;
        clip = candidateClip;
        break;
      }
      // A standing supervisor/support character may use a subtle bone-aware
      // idle loop. A seated employee is never shown without a seated clip.
      if (!person.seated) {
        const idleAvailable = Boolean(createProceduralIdlePose(candidate.gltf.scene));
        if (idleAvailable) {
          selected = candidate;
          useProceduralIdle = true;
          break;
        }
      }
    if (!clip && !idleProfile) {
      idleProfile,
      phase: Number(person.phase) || 0,
        if (entry.idleProfile) updateProceduralIdlePose(entry.idleProfile, elapsed, entry.phase);
`;

const mainFixture = `
        const label=result.loaded?\`${'${result.loaded}'} 3D STAFF ASSETS READY\`:'OPTIMISED LOCAL STAFF MODELS ACTIVE';
`;

test('production world now starts within USE range of a workstation', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, worldFixture, '/repo/js/production-world.js');
  assert.ok(result.code.includes('x: 2.9, z: 7.65'));
  assert.ok(result.code.includes('player.x = 2.9; player.z = 7.65'));
  assert.ok(result.code.includes('USE is active immediately'));
  assert.ok(result.code.includes('calloria:world-nearest-station'));
  assert.ok(result.code.includes('calloria:world-station-accessed'));
  assert.ok(result.code.includes('integrateCalloriaGLBOfficeAssets'));
  assert.ok(result.code.includes('createCalloriaWorldMission'));
});

test('status no longer claims optimized local staff when no GLB has loaded', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, mainFixture, '/repo/js/main.js');
  assert.ok(result.code.includes('NO GLB MODELS CONFIRMED'));
  assert.ok(result.code.includes('activeParts.push'));
  assert.ok(result.code.includes('ASSET LOAD FAILURES'));
  assert.ok(!result.code.includes('OPTIMISED LOCAL STAFF MODELS ACTIVE'));
});

test('GLB character integration permits static standing models but not seated T-poses', () => {
  const plugin = calloriaGLBWorldPlugin();
  const result = plugin.transform.call({ error(message) { throw new Error(message); } }, staffFixture, '/repo/js/glb-world-integration.js');
  assert.ok(result.code.includes('humanScale = metrics.size.y >= 0.08'));
  assert.ok(result.code.includes('staticCharacterValid'));
  assert.ok(result.code.includes('if (candidate.metrics.meshCount > 0 && candidate.metrics.skinnedMeshCount === 0)'));
  assert.ok(result.code.includes('!idleProfile && !useStaticIdle'));
  assert.ok(result.code.includes('staticIdle: useStaticIdle'));
});

test('office asset plan limits full GLB furniture replacement by device tier', async () => {
  const source = await readFile(new URL('../js/glb-office-world-integration.js', import.meta.url), 'utf8');
  assert.match(source, /safeTier === 'low' \? \[10\]/);
  assert.match(source, /safeTier === 'high' \? \[8, 9, 10, 11\]/);
  assert.match(source, /setMeshoptDecoder\(MeshoptDecoder\)/);
  assert.match(source, /agent-desk-surfaces/);
  assert.match(source, /flatMap\(\(index\) =>/);
  assert.match(source, /calloria-glb-computer-station-\$\{station.id\}-\$\{screenIndex \+ 1\}/);
  assert.match(source, /reception-counter-top/);
});

test('world mission tells mobile players what to do and reacts to station events', async () => {
  const source = await readFile(new URL('../js/world-gameplay-mission.js', import.meta.url), 'utf8');
  assert.match(source, /Report to your workstation/);
  assert.match(source, /calloria:world-nearest-station/);
  assert.match(source, /calloria:world-station-accessed/);
  assert.match(source, /Tap USE/);
});
