import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaCustomerWorldPlugin } from '../build/calloria-customer-world-plugin.js';

const root = new URL('../', import.meta.url);
const context = { error(message) { throw new Error(message); } };
const readRepo = (path) => readFile(new URL(path, root), 'utf8');
const count = (source, anchor) => source.split(anchor).length - 1;

const WORLD_READY = "  callbacks.onRenderStatus?.({ state: 'ready', tier, stations: stations.length, staff: staff.length });";
const WORLD_UPDATE = '    updatePlayer(delta);';
const WORLD_DISPOSE = 'scene.traverse((object) => {';
const ENGINE_CREATE = '  const id = `CIL-${Math.abs(Math.floor(Number(seed) || Date.now())).toString(36).toUpperCase()}`;';
const ENGINE_SUBMIT = '  return { result, scenario };';

test('Vite registers the reception customer plugin after the customer-avatar plugin', async () => {
  const config = await readRepo('vite.config.js');
  assert.match(config, /import\s*\{\s*calloriaCustomerWorldPlugin\s*\}\s*from\s*['"]\.\/build\/calloria-customer-world-plugin\.js['"]/);
  assert.match(config, /calloriaCustomerAvatarPlugin\(\)[\s\S]*calloriaCustomerWorldPlugin\(\)/);
  assert.match(config, /publicDir:\s*['"]public['"]/);
});

test('current production-world source still exposes each required integration anchor exactly once', async () => {
  const source = (await readRepo('js/production-world.js')).replace(/\r\n?/g, '\n');
  assert.equal(count(source, WORLD_READY), 1, 'ready callback anchor');
  assert.equal(count(source, WORLD_UPDATE), 1, 'animation update anchor');
  assert.equal(count(source, WORLD_DISPOSE), 1, 'disposal anchor');
});

test('current customer-intelligence engine still exposes both reaction bridge anchors exactly once', async () => {
  const source = (await readRepo('js/customer-intelligence-engine.js')).replace(/\r\n?/g, '\n');
  assert.equal(count(source, ENGINE_CREATE), 1, 'scenario creation anchor');
  assert.equal(count(source, ENGINE_SUBMIT), 1, 'customer turn result anchor');
});

test('production-world transform attaches customers, updates them and disposes them', async () => {
  const plugin = calloriaCustomerWorldPlugin();
  const source = await readRepo('js/production-world.js');
  const result = plugin.transform.call(context, source.replaceAll('\n', '\r\n'), '/repo/js/production-world.js');
  assert.ok(result?.code);
  assert.match(result.code, /import \{ attachCalloriaWorldCustomers \} from '\.\/customer-world-integration\.js';/);
  assert.match(result.code, /attachCalloriaWorldCustomers\(\{ scene, tier \}\)/);
  assert.match(result.code, /customerWorldLayer\?\.update\?\.\(delta\)/);
  assert.match(result.code, /customerWorldLayer\?\.dispose\?\.\(\)/);
  assert.match(result.code, /__CALLORIA_RECEPTION_CUSTOMER_WORLD_V16__/);
});

test('customer-intelligence transform emits the event consumed by the reception avatars', async () => {
  const plugin = calloriaCustomerWorldPlugin();
  const source = await readRepo('js/customer-intelligence-engine.js');
  const result = plugin.transform.call(context, source, '/repo/js/customer-intelligence-engine.js');
  assert.ok(result?.code);
  assert.equal((result.code.match(/calloria:customer-reaction/g) || []).length, 2);
  assert.match(result.code, /personaId: persona\.id/);
  assert.match(result.code, /reaction: result\.customerReaction/);
  assert.match(result.code, /__CALLORIA_CUSTOMER_REACTION_BRIDGE_V16__/);
});

test('customer-world transform is idempotent', async () => {
  const plugin = calloriaCustomerWorldPlugin();
  const source = await readRepo('js/production-world.js');
  const first = plugin.transform.call(context, source, '/repo/js/production-world.js');
  assert.ok(first?.code);
  assert.equal(plugin.transform.call(context, first.code, '/repo/js/production-world.js'), null);
});

test('changed source anchors fail safely instead of applying a partial transform', () => {
  const plugin = calloriaCustomerWorldPlugin();
  assert.throws(
    () => plugin.transform.call(context, 'export function initProductionWorld() {}', '/repo/js/production-world.js'),
    /expected exactly one production-world ready callback anchor \(0 found\)/
  );
});
