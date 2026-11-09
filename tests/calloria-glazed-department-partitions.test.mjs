import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  calloriaGlazedDepartmentPartitionsPlugin,
  __partitionPluginTest
} from '../build/calloria-glazed-department-partitions-plugin.mjs';

const syntheticWorld = `
const __CALLORIA_GREENERY_STATUS_V32__ = true;
export async function initProductionWorld(THREE, host, callbacks = {}) {
  const scene = {};
  const tier = 'balanced';
  let immersive = false;
  let disposed = false;
  function renderStill() {}
  function stopLoop() {}
  const visibilityObserver = { disconnect() {} };
  const resizeObserver = { disconnect() {} };
  return {
    get assetMessage() { return 'CALLORIA 3D workplace and draw-call-merged articulated staff ready'; },
    dispose() {
      disposed = true; stopLoop(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
    }
  };
}
`;

function runPlugin(source, id = '/repo/js/production-world.js') {
  const warnings = [];
  const plugin = calloriaGlazedDepartmentPartitionsPlugin();
  const result = plugin.transform.call({ warn: (message) => warnings.push(String(message)) }, source, id);
  return { result, warnings };
}

test('world transform inserts the runtime import and loads validated partitions asynchronously', () => {
  const { result, warnings } = runPlugin(syntheticWorld);
  assert.equal(warnings.length, 0);
  assert.ok(result.code.includes(__partitionPluginTest.WORLD_MARKER));
  assert.ok(result.code.includes(__partitionPluginTest.IMPORT));
  assert.ok(result.code.includes('integrateCalloriaGlazedDepartmentPartitions(scene'));
  assert.ok(result.code.includes("window.dispatchEvent(new CustomEvent('calloria:glazed-partitions-ready'"));
  assert.ok(result.code.includes('renderStill();'));
});

test('world transform exposes partition state and disposes a completed lease with the world', () => {
  const { result } = runPlugin(syntheticWorld);
  assert.ok(result.code.includes('get glazedDepartmentPartitionStatus() { return glazedDepartmentPartitionStatus; }'));
  assert.ok(result.code.includes('glazedDepartmentPartitionLease?.dispose?.();'));
  assert.ok(result.code.includes('glazedDepartmentPartitionDisposed = true;'));
  assert.ok(result.code.includes('isActive: () => !disposed && !glazedDepartmentPartitionDisposed'));
});

test('world transform fails closed without the v3.2 baseline marker', () => {
  const { result, warnings } = runPlugin('export async function initProductionWorld() {}');
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /v3\.2 greenery baseline marker is missing/);
});

test('world transform fails closed if any disposal or API anchor has drifted', () => {
  const changed = syntheticWorld.replace('let disposed = false;', 'let worldDisposed = false;');
  const { result, warnings } = runPlugin(changed);
  assert.equal(result, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /anchors changed: disposedDeclaration/);
});

test('world transform is idempotent and ignores unrelated files', () => {
  const first = runPlugin(syntheticWorld).result;
  assert.ok(first);
  assert.equal(runPlugin(first.code).result, null);
  const unrelated = runPlugin(syntheticWorld, '/repo/js/agent-desk-workbench.js');
  assert.equal(unrelated.result, null);
  assert.equal(unrelated.warnings.length, 0);
});

test('runtime module uses the published CC0 1.2 m partition GLB and published geometry budget', async () => {
  const source = await readFile(new URL('../js/cc0-glazed-department-partitions.js', import.meta.url), 'utf8');
  assert.match(source, /cdn\.3dassets\.dev\/assets\/17051\/v1\/model\.glb/);
  assert.match(source, /CC0 1\.0 Universal/);
  assert.match(source, /triangles:\s*564/);
  assert.match(source, /materials:\s*4/);
  assert.match(source, /sizeMeters:\s*Object\.freeze\(\[1\.2, 2\.6, 0\.08\]\)/);
});

test('low tier upgrades only QA glass while balanced/high tiers upgrade QA and supervisor glazing', async () => {
  const source = await readFile(new URL('../js/cc0-glazed-department-partitions.js', import.meta.url), 'utf8');
  assert.match(source, /if \(tier === 'low'\) return \[PANEL_SPECS\.qa\]/);
  assert.match(source, /PANEL_SPECS\.supervisorLeft, PANEL_SPECS\.supervisorRight/);
  assert.match(source, /maxPartitionsLow:\s*6/);
  assert.match(source, /maxPartitionsStandard:\s*16/);
});

test('only named, measured QA and supervisor panes are eligible for replacement', async () => {
  const source = await readFile(new URL('../js/cc0-glazed-department-partitions.js', import.meta.url), 'utf8');
  for (const name of ['qa-glass-front', 'supervisor-left-glass', 'supervisor-right-glass']) assert.ok(source.includes(name));
  assert.match(source, /validateAnchor\(anchor, spec\)/);
  assert.match(source, /anchor\.visible = false/);
  assert.match(source, /for \(const anchor of hiddenAnchors\) anchor\.visible = true/);
  assert.match(source, /original glass retained/);
  assert.doesNotMatch(source, /Math\.random\(/);
});

test('the previous project plugin sequence and build inputs remain intact', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  for (const name of [
    'calloriaGLBWorldPlugin()',
    'calloriaMeshoptRuntimePlugin()',
    'calloriaStaticGLBStaffPlugin()',
    'calloriaCustomerAvatarPlugin()',
    'calloriaCustomerWorldPlugin()',
    'calloriaSupervisorInterventionPlugin()',
    'calloriaSupervisorCaseBridgePlugin()',
    'calloriaFirstShiftGameplayPlugin()',
    'calloriaThirdPersonPlayerPlugin()',
    'calloriaWorkstationExperiencePlugin()',
    'calloriaCC0OfficeLobbyPlugin()',
    'calloriaErgonomicOfficeChairsPlugin()',
    'calloriaCC0LobbyGreeneryPlugin()',
    'calloriaGlazedDepartmentPartitionsPlugin()'
  ]) assert.ok(config.includes(name), `Missing Vite plugin ${name}`);
  assert.ok(config.indexOf('calloriaCC0LobbyGreeneryPlugin()') < config.indexOf('calloriaGlazedDepartmentPartitionsPlugin()'));
  for (const input of ['main:', 'customerCare:', 'workforce:', 'voiceSimulator:', 'calloriaChatWidget:']) assert.ok(config.includes(input));
});
