import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const vite = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');

test('third-person player plugin is imported and registered exactly once', () => {
  assert.equal((vite.match(/calloriaThirdPersonPlayerPlugin/g) || []).length, 2);
  assert.match(vite, /import\s*\{\s*calloriaThirdPersonPlayerPlugin\s*\}\s*from\s*['"]\.\/build\/calloria-third-person-player-plugin\.mjs['"]/);
  assert.match(vite, /calloriaThirdPersonPlayerPlugin\(\)/);
});

test('third-person player plugin is registered after the existing gameplay bridge', () => {
  assert.match(vite, /calloriaFirstShiftGameplayPlugin\(\),\s*calloriaThirdPersonPlayerPlugin\(\)/);
});

test('all existing world, customer and supervisor plugins remain registered', () => {
  for (const name of [
    'calloriaGLBWorldPlugin()',
    'calloriaMeshoptRuntimePlugin()',
    'calloriaCustomerAvatarPlugin()',
    'calloriaCustomerWorldPlugin()',
    'calloriaSupervisorInterventionPlugin()',
    'calloriaSupervisorCaseBridgePlugin()',
    'calloriaFirstShiftGameplayPlugin()'
  ]) {
    assert.ok(vite.includes(name), `Missing existing plugin ${name}`);
  }
});

test('all existing Vite entry points and Three.js chunking remain present', () => {
  for (const entry of ['customerCare:', 'caseDesk:', 'customer360:', 'agentDesk:', 'workforce:', 'performance:', 'voiceSimulator:', 'assetInspector:', 'calloriaChatWidget:']) {
    assert.ok(vite.includes(entry), `Missing Vite entry ${entry}`);
  }
  assert.match(vite, /id\.includes\('\/node_modules\/three\/'\)/);
  assert.match(vite, /publicDir:\s*'public'/);
});
