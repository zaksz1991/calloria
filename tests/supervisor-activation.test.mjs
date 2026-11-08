import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { calloriaSupervisorCaseBridgePlugin } from '../build/calloria-supervisor-case-bridge-plugin.js';

const execFileAsync = promisify(execFile);
const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('Vite config registers supervisor world and case bridge plugins', () => {
  assert.match(config, /import\s*\{\s*calloriaSupervisorInterventionPlugin\s*\}\s*from\s*['"]\.\/build\/calloria-supervisor-intervention-plugin\.js['"]/);
  assert.match(config, /import\s*\{\s*calloriaSupervisorCaseBridgePlugin\s*\}\s*from\s*['"]\.\/build\/calloria-supervisor-case-bridge-plugin\.js['"]/);
  assert.match(config, /calloriaCustomerWorldPlugin\(\),[\s\S]*calloriaSupervisorInterventionPlugin\(\),[\s\S]*calloriaSupervisorCaseBridgePlugin\(\)/);
});

test('Vite config preserves public assets and all existing multi-page entries', () => {
  assert.match(config, /publicDir:\s*['"]public['"]/);
  for (const entry of ['index.html', 'customer-care.html', 'case-desk.html', 'customer-360.html', 'agent-desk.html', 'workforce.html', 'performance.html', 'operations-intelligence.html', 'knowledge-operations.html', 'asset-inspector.html']) {
    assert.ok(config.includes(entry), `Missing existing build entry: ${entry}`);
  }
});

test('case bridge transforms main.js once and preserves escaped newline in generated dialogue', async () => {
  const source = [
    'let state = loadState();',
    'function saveState() {}',
    "function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {}",
    'function renderView() {}',
    'function toast(message, type) {}'
  ].join('\n');
  const context = { error(message) { throw new Error(message); } };
  const result = calloriaSupervisorCaseBridgePlugin().transform.call(context, source, '/repo/js/main.js');
  assert.ok(result?.code);
  assert.match(result.code, /SUP-' \+ Date\.now\(\)/);
  assert.match(result.code, /Supervisor review recorded\.\\nMandatory QA review remains open/);
  assert.doesNotMatch(result.code, /Supervisor review recorded\.\nMandatory QA review remains open/);

  const path = join(tmpdir(), `calloria-supervisor-bridge-${process.pid}.mjs`);
  try {
    await writeFile(path, result.code, 'utf8');
    await execFileAsync(process.execPath, ['--check', path]);
  } finally {
    await rm(path, { force: true });
  }
});

test('case bridge is idempotent and ignores unrelated modules', () => {
  const plugin = calloriaSupervisorCaseBridgePlugin();
  const source = [
    'let state = loadState();',
    'function saveState() {}',
    "function pushOperationEvent(type, reference, message, status = 'recorded', details = {}) {}"
  ].join('\n');
  const context = { error(message) { throw new Error(message); } };
  const first = plugin.transform.call(context, source, '/repo/js/main.js');
  assert.equal(plugin.transform.call(context, first.code, '/repo/js/main.js'), null);
  assert.equal(plugin.transform.call(context, source, '/repo/js/other.js'), null);
});

test('case bridge refuses unsafe partial main.js transforms', () => {
  const context = { error(message) { throw new Error(message); } };
  assert.throws(
    () => calloriaSupervisorCaseBridgePlugin().transform.call(context, 'let state = loadState();', '/repo/js/main.js'),
    /expected exactly one saveState function anchor/
  );
});


