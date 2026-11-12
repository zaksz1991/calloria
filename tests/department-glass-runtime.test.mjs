import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { calloriaGlazedDepartmentPartitionsPlugin } from '../build/calloria-glazed-department-partitions-plugin.mjs';

const integration = await readFile(new URL('../js/cc0-office-lobby-integration.js', import.meta.url), 'utf8');
const partitions = await readFile(new URL('../js/cc0-glazed-department-partitions.js', import.meta.url), 'utf8');

test('Vite compatibility plugin preserves its export and disables stale source rewriting', () => {
  const plugin = calloriaGlazedDepartmentPartitionsPlugin();
  assert.equal(plugin.name, 'calloria-glazed-department-partitions-v6-19-runtime');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transform('export const scene = {};', '/repo/js/production-world.js'), null);
});

test('production lobby lifecycle calls the partition runtime directly', () => {
  assert.match(integration, /import \{ integrateCalloriaGlazedDepartmentPartitions \} from '\.\/cc0-glazed-department-partitions\.js'/);
  assert.match(integration, /integrateCalloriaGlazedDepartmentPartitions\(scene,\s*\{\s*tier,/s);
  assert.match(integration, /calloria:glazed-partitions-ready/);
  assert.match(integration, /partitionLease\?\.dispose\?\./);
  assert.match(integration, /partitions: partitionStatus/);
});

test('partition integration waits for authored anchors with a bounded timeout', () => {
  assert.match(partitions, /export async function waitForCC0GlazedPartitionAnchors/);
  assert.match(partitions, /timeoutMs = 7000/);
  assert.match(partitions, /intervalMs = 200/);
  assert.match(partitions, /authored department glass anchors were not available/);
  assert.match(partitions, /anchor\.visible = false/);
});

test('existing fallback panes and cleanup are retained', () => {
  assert.match(partitions, /for \(const \{ anchor \} of anchors\)\s*\{\s*anchor\.visible = false;/s);
  assert.match(partitions, /for \(const anchor of hiddenAnchors\) anchor\.visible = true/);
  assert.match(integration, /export const integrateCalloriaCC0Lobby = integrateCalloriaCC0OfficeLobby/);
});
