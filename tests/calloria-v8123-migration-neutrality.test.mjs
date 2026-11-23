import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const verifierPath = 'tests/calloria-v811-recovery-handover-verification-integration.test.mjs';
const requiredFixtureFiles = [
  'package.json',
  'build/calloria-workforce-cloud-recovery-portability-v809.mjs',
  'js/workforce-trend-cloud-recovery-handover-engine-v810.js',
  'js/workforce-trend-cloud-recovery-handover-verification-engine-v811.js',
  verifierPath
];

function createFixture({ migrations = [] } = {}) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v8123-migration-'));
  const fixtureRoot = path.join(temp, 'repo');
  fs.mkdirSync(fixtureRoot, { recursive: true });
  try {
    for (const relative of requiredFixtureFiles) {
      const source = path.join(root, relative);
      const destination = path.join(fixtureRoot, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
    if (migrations.length) {
      const migrationDirectory = path.join(fixtureRoot, 'supabase', 'migrations');
      fs.mkdirSync(migrationDirectory, { recursive: true });
      for (const migration of migrations) {
        fs.writeFileSync(path.join(migrationDirectory, migration.name), migration.content, 'utf8');
      }
    }
    return { temp, fixtureRoot };
  } catch (error) {
    fs.rmSync(temp, { recursive: true, force: true });
    throw error;
  }
}

function runVerifier(fixtureRoot) {
  const childEnv = { ...process.env };
  delete childEnv.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test', verifierPath], {
    cwd: fixtureRoot,
    encoding: 'utf8',
    env: childEnv,
    timeout: 15000
  });
  assert.equal(result.error, undefined, result.error?.message || 'The copied v8.11 verifier could not start.');
  assert.equal(result.status, 0, `The copied v8.11 verifier failed.\n${result.stdout || ''}\n${result.stderr || ''}`);
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

test('v8.11 verifier passes when the repository has no Supabase migrations directory', () => {
  const fixture = createFixture();
  try {
    const output = runVerifier(fixture.fixtureRoot);
    assert.match(output, /# pass 4/);
    assert.equal(fs.existsSync(path.join(fixture.fixtureRoot, 'supabase', 'migrations')), false);
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('v8.11 verifier tolerates pre-existing CALLORIA and shared-product migrations without changing them', () => {
  const migrations = [
    { name: '202611010001_existing_calloria.sql', content: '-- existing CALLORIA schema\nselect 1;\n' },
    { name: '202610150001_shared_product.sql', content: '-- existing shared project schema\nselect 2;\n' }
  ];
  const fixture = createFixture({ migrations });
  try {
    const migrationDirectory = path.join(fixture.fixtureRoot, 'supabase', 'migrations');
    const before = new Map(migrations.map((item) => [item.name, fs.readFileSync(path.join(migrationDirectory, item.name), 'utf8')]));
    const output = runVerifier(fixture.fixtureRoot);
    assert.match(output, /# pass 4/);
    const afterNames = fs.readdirSync(migrationDirectory).sort();
    assert.deepEqual(afterNames, migrations.map((item) => item.name).sort());
    for (const [name, content] of before) {
      assert.equal(fs.readFileSync(path.join(migrationDirectory, name), 'utf8'), content);
    }
  } finally {
    fs.rmSync(fixture.temp, { recursive: true, force: true });
  }
});

test('migration neutrality is enforced by the cumulative production integration gate', () => {
  const audit = fs.readFileSync(path.join(root, 'tools', 'calloria-v812-recovery-integration-audit.mjs'), 'utf8');
  assert.match(audit, /calloria-v8123-migration-neutrality\.test\.mjs/);
  assert.match(audit, /CALLORIA v8\.12\.3/);
});
