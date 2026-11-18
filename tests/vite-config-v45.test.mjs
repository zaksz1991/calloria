import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = readFileSync(resolve(root, 'vite.config.js'), 'utf8');

test('outbound live dialogue is integrated directly in the application rather than relying on the obsolete v4.5 transform', () => {
  const main = readFileSync(resolve(root, 'js/main.js'), 'utf8');
  assert.ok(config.includes('calloriaFirstWorkingShiftV44Plugin()'), 'existing live-shift integration must remain registered');
  assert.ok(main.includes("from './outbound-campaign-engine.js'"), 'main application must import the live outbound conversation engine');
  assert.ok(main.includes('outboundCampaignReplyForm'), 'main application must render the live outbound response workflow');
  assert.ok(!config.includes('calloriaOutboundCampaignV45Plugin()'), 'obsolete outbound transform must not be registered against incompatible source anchors');
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
