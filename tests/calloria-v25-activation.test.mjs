import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const config = readFileSync(resolve(root, 'vite.config.js'), 'utf8');
const thirdPerson = resolve(root, 'build/calloria-third-person-player-plugin.mjs');
const workstation = resolve(root, 'build/calloria-workstation-experience-plugin.mjs');
const firstShift = config.indexOf('calloriaFirstShiftGameplayPlugin()');
const thirdPersonRegistration = config.indexOf('calloriaThirdPersonPlayerPlugin()');
const workstationRegistration = config.indexOf('calloriaWorkstationExperiencePlugin()');

test('third-person and workstation plugin modules exist', () => {
  assert.equal(existsSync(thirdPerson), true);
  assert.equal(existsSync(workstation), true);
});

test('Vite imports the existing integration modules', () => {
  assert.match(config, /import\s*\{\s*calloriaThirdPersonPlayerPlugin\s*\}\s*from\s*['"]\.\/build\/calloria-third-person-player-plugin\.mjs['"]/);
  assert.match(config, /import\s*\{\s*calloriaWorkstationExperiencePlugin\s*\}\s*from\s*['"]\.\/build\/calloria-workstation-experience-plugin\.mjs['"]/);
});

test('gameplay event bridge runs before workstation console subscriber', () => {
  assert.ok(firstShift >= 0);
  assert.ok(workstationRegistration > firstShift);
});

test('GLB third-person adapter is registered after first-shift event bridge', () => {
  assert.ok(thirdPersonRegistration > firstShift);
});

test('existing application build entries and public asset delivery are preserved', () => {
  assert.match(config, /publicDir:\s*['"]public['"]/);
  for (const entry of ['index.html', 'customer-care.html', 'case-desk.html', 'workforce.html', 'performance.html', 'asset-inspector.html']) {
    assert.ok(config.includes(entry), `Missing Vite entry: ${entry}`);
  }
  assert.match(config, /manualChunks\(id\)[\s\S]*three-engine/);
});

test('plugin modules expose the expected factories and post-transform contracts', () => {
  const thirdText = readFileSync(thirdPerson, 'utf8');
  const workstationText = readFileSync(workstation, 'utf8');
  assert.match(thirdText, /export function calloriaThirdPersonPlayerPlugin\(\)/);
  assert.match(thirdText, /enforce:\s*['"]post['"]/);
  assert.match(thirdText, /combinedAssetStatus/);
  assert.match(thirdText, /worldMissionLayer\?\.dispose/);
  assert.match(workstationText, /export function calloriaWorkstationExperiencePlugin\(\)/);
  assert.match(workstationText, /calloria:game-operation-selected/);
  assert.match(workstationText, /calloria:workstation-resumed/);
});
