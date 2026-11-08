import test from 'node:test';
import assert from 'node:assert/strict';
import { calloriaCustomerWorldPlugin } from '../build/calloria-customer-world-plugin.js';

const WORLD = `
export async function initProductionWorld(THREE, host, callbacks = {}) {
  const scene = new THREE.Scene();
  const tier = 'balanced';
  const stations = [];
  const staff = [];
  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });
  function animate() {
    updatePlayer(delta);
  }
  function dispose() {
    disposed = true; stopLoop(); glbWorldLayer?.dispose?.(); visibilityObserver?.disconnect(); resizeObserver?.disconnect();
    scene.traverse((object) => {
  }
}`;
const ENGINE = `
export function createCustomerScenario({ seed = Date.now() } = {}) {
  const persona = { id: 'angry', emotion: 'angry', patience: 20 };
  const id = \`CIL-\${Math.abs(Math.floor(Number(seed) || Date.now())).toString(36).toUpperCase()}\`;
  return { id, persona };
}
export function submitCustomerTurn(scenario) {
  const result = { customerReaction: 'improving', customerPatience: 65 };
  scenario.turn = 1; scenario.status = 'active';
  return { result, scenario };
}`;

function runTransform(source, path) {
  const plugin = calloriaCustomerWorldPlugin();
  return plugin.transform.call({ error(message) { throw new Error(message); } }, source, path);
}

test('injects approved customer layer into production scene lifecycle', () => {
  const result = runTransform(WORLD, '/repo/js/production-world.js');
  assert.ok(result.code.includes("import { attachCalloriaWorldCustomers }"));
  assert.ok(result.code.includes('attachCalloriaWorldCustomers({ scene, tier })'));
  assert.ok(result.code.includes('customerWorldLayer?.update?.(delta)'));
  assert.ok(result.code.includes('customerWorldLayer?.dispose?.()'));
  assert.equal((result.code.match(/customerWorldLayer\?\.dispose/g) || []).length, 1);
});

test('forwards new customer scenario emotion into the world', () => {
  const result = runTransform(ENGINE, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result.code.includes("'calloria:customer-reaction'"));
  assert.ok(result.code.includes("reaction: 'steady'"));
  assert.ok(result.code.includes('personaId: persona.id'));
});

test('forwards evaluated reaction after each simulated agent response', () => {
  const result = runTransform(ENGINE, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result.code.includes('reaction: result.customerReaction'));
  assert.ok(result.code.includes('patience: result.customerPatience'));
  assert.ok(result.code.includes('status: scenario.status'));
});

test('normalizes CRLF without requiring whitespace-specific newlines', () => {
  const result = runTransform(WORLD.replaceAll('\n', '\r\n'), '/repo/js/production-world.js');
  assert.ok(result.code.includes('customerWorldLayer?.update?.(delta)'));
});

test('fails closed if production source anchors have drifted', () => {
  assert.throws(() => runTransform(WORLD.replace('updatePlayer(delta);', 'updatePlayer(frameDelta);'), '/repo/js/production-world.js'), /animation update anchor/);
});

test('ignores unrelated source files', () => {
  assert.equal(runTransform('export const value = 1;', '/repo/js/other.js'), null);
});

test('transformation is idempotent', () => {
  const first = runTransform(WORLD, '/repo/js/production-world.js');
  const second = runTransform(first.code, '/repo/js/production-world.js');
  assert.equal(second, null);
});

test('world integration loads asynchronously and cannot attach after disposal', () => {
  const result = runTransform(WORLD, '/repo/js/production-world.js');
  assert.ok(result.code.includes('let customerWorldDisposed = false'));
  assert.ok(result.code.includes('if (customerWorldDisposed) { layer?.dispose?.(); return; }'));
  assert.ok(result.code.includes('void attachCalloriaWorldCustomers'));
  assert.ok(result.code.includes('    renderStill();'));
  assert.ok(!result.code.includes('await attachCalloriaWorldCustomers'));
});

test('engine transform declares its idempotency marker safely', () => {
  const result = runTransform(ENGINE, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result.code.startsWith('const __CALLORIA_CUSTOMER_REACTION_BRIDGE_V16__ = true;'));
});
