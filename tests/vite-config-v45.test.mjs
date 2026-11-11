import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(resolve(root, 'vite.config.js'), 'utf8');

test('keeps v4.4 live inbound transforms before v4.5 outbound transforms', () => {
  const inbound = config.indexOf('calloriaFirstWorkingShiftV44Plugin()');
  const outbound = config.indexOf('calloriaOutboundCampaignV45Plugin()');
  assert.ok(inbound >= 0, 'v4.4 plugin registration missing');
  assert.ok(outbound > inbound, 'v4.5 must run after the v4.4 post-transform');
});

test('preserves the existing Vite multi-page inputs and plugin chain', () => {
  for (const token of [
    'calloriaGLBWorldPlugin()',
    'calloriaOJTGLBActivationPlugin()',
    "main: resolve(process.cwd(), 'index.html')",
    "agentDesk: resolve(process.cwd(), 'agent-desk.html')",
    "voiceConsole: resolve(process.cwd(), 'voice-console.html')",
    "operationsIntelligence: resolve(process.cwd(), 'operations-intelligence.html')",
  ]) assert.ok(config.includes(token), `missing preserved Vite entry: ${token}`);
});
