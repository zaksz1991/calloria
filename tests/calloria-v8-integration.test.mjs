import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calloriaProductionIntegrationGatePluginV8,
  CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES,
  CALLORIA_V8_REQUIRED_HTML_ENTRIES,
  CALLORIA_V8_REQUIRED_ALL_ENTRIES
} from '../build/calloria-production-integration-gate-v8.mjs';
import { auditCalloriaV8Integration, collectRelativeImports } from '../tools/calloria-v8-integration-audit.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const expectedFiles = {
  main: 'index.html', customerCare: 'customer-care.html', caseDesk: 'case-desk.html',
  customer360: 'customer-360.html', agentDesk: 'agent-desk.html', workforce: 'workforce.html',
  performance: 'performance.html', salesDesk: 'sales-desk.html', supportRouter: 'support-router.html',
  routingControl: 'routing-control.html', voiceSimulator: 'voice-simulator.html',
  whatsappInbox: 'whatsapp-inbox.html', emailInbox: 'email-inbox.html',
  liveChatInbox: 'live-chat-inbox.html', socialInbox: 'social-inbox.html', voiceConsole: 'voice-console.html',
  smsInbox: 'sms-inbox.html', operationsIntelligence: 'operations-intelligence.html',
  knowledgeOperations: 'knowledge-operations.html', assetInspector: 'asset-inspector.html',
  calloriaChatWidget: 'widgets/calloria-chat.js'
};

function makeEntryFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v8-gate-'));
  const input = {};
  for (const [name, relative] of Object.entries(expectedFiles)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, relative.endsWith('.html') ? '<!doctype html><html></html>' : 'export {};');
    input[name] = relative;
  }
  return { root, input };
}

function resolvedConfig(root, input, names = CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES) {
  return {
    root,
    plugins: [...names.map((name) => ({ name })), { name: 'calloria-production-integration-gate-v8' }],
    build: { rollupOptions: { input } }
  };
}

function makeAuditFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v8-audit-'));
  const copy = (relative) => {
    const source = path.join(projectRoot, relative);
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  };
  copy('build/calloria-workforce-development-suite-v8.mjs');
  copy('build/calloria-production-integration-gate-v8.mjs');
  copy('tools/calloria-v8-integration-audit.mjs');
  const suite = fs.readFileSync(path.join(root, 'build/calloria-workforce-development-suite-v8.mjs'), 'utf8');
  const moduleDefinitions = [
    ['calloria-digital-experience-suite-v722.mjs', 'calloriaDigitalExperienceSuitePluginV722', 'calloria-digital-experience-suite-v7-22'],
    ['calloria-digital-followup-supervisor-v723.mjs', 'calloriaDigitalFollowUpSupervisorPluginV723', 'calloria-digital-followup-supervisor-v7-23'],
    ['calloria-digital-followup-performance-v724.mjs', 'calloriaDigitalFollowUpPerformancePluginV724', 'calloria-digital-followup-performance-v7-24'],
    ['calloria-digital-followup-coaching-v725.mjs', 'calloriaDigitalFollowUpCoachingPluginV725', 'calloria-digital-followup-coaching-v7-25'],
    ['calloria-digital-followup-coaching-outcomes-v726.mjs', 'calloriaDigitalFollowUpCoachingOutcomesPluginV726', 'calloria-digital-followup-coaching-outcomes-v7-26'],
    ['calloria-digital-followup-coaching-checkpoints-v727.mjs', 'calloriaDigitalFollowUpCoachingCheckpointsPluginV727', 'calloria-digital-followup-coaching-checkpoints-v7-27'],
    ['calloria-digital-career-evidence-v728.mjs', 'calloriaDigitalCareerEvidencePluginV728', 'calloria-digital-career-evidence-v7-28'],
    ['calloria-workforce-intelligence-v729.mjs', 'calloriaWorkforceIntelligencePluginV729', 'calloria-workforce-intelligence-v7-29'],
    ['calloria-workforce-command-centre-v730.mjs', 'calloriaWorkforceCommandCentrePluginV730', 'calloria-workforce-command-centre-v7-30'],
    ['calloria-workforce-trend-history-v731.mjs', 'calloriaWorkforceTrendHistoryPluginV731', 'calloria-workforce-trend-history-v7-31'],
    ['calloria-workforce-trend-cloud-sync-v801.mjs', 'calloriaWorkforceTrendCloudSyncPluginV801', 'calloria-workforce-trend-cloud-sync-v8-1']
  ];
  for (const [file, exported, name] of moduleDefinitions) {
    const cloudStub = file === 'calloria-workforce-trend-cloud-sync-v801.mjs'
      ? `import { WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802 } from '../js/workforce-trend-cloud-sync-engine-v802.js';\nimport { WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 } from '../js/workforce-trend-cloud-sync-engine-v803.js';\nimport { WORKFORCE_TREND_BACKUP_VERSION_V805 } from '../js/workforce-trend-backup-engine-v805.js';\nexport function ${exported}() { const rpc = 'calloria_sync_workforce_trend_snapshots_v802'; const inspect = 'inspectWorkforceTrendCloudConflictsV802'; const archive = 'calloria_record_workforce_trend_conflicts_v803'; const resolve = 'calloria_resolve_workforce_trend_conflict_v803'; const backup = 'from ../js/workforce-trend-backup-engine-v805.js'; const verifyBackup = 'verifyWorkforceTrendBackupV805'; const fingerprint = 'workforceTrendBackupOrgFingerprintV805'; const ui = 'data-workforce-cloud-conflict-review data-workforce-cloud-conflict-resolve data-workforce-trend-backup-export data-workforce-trend-backup-import data-workforce-trend-backup-file'; return { name: '${name}', version: WORKFORCE_TREND_BACKUP_VERSION_V805, legacy: WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802, rpc, inspect, archive, resolve, backup, verifyBackup, fingerprint, ui }; }\n`
      : `export function ${exported}() { return { name: '${name}' }; }\n`;
    fs.writeFileSync(path.join(root, 'build', file), cloudStub);
  }
  const importLines = [
    "import { defineConfig } from 'vite';",
    "import { resolve } from 'node:path';",
    "import { calloriaWorkforceDevelopmentSuitePluginsV8 } from './build/calloria-workforce-development-suite-v8.mjs';",
    "import { calloriaProductionIntegrationGatePluginV8 } from './build/calloria-production-integration-gate-v8.mjs';"
  ];
  const entryLines = Object.entries(expectedFiles).map(([name, file]) => `        ${name}: resolve(process.cwd(), '${file}')`).join(',\n');
  fs.writeFileSync(path.join(root, 'vite.config.js'), `${importLines.join('\n')}\nexport default defineConfig({ plugins: [...calloriaWorkforceDevelopmentSuitePluginsV8(), calloriaProductionIntegrationGatePluginV8()], build: { rollupOptions: { input: {\n${entryLines}\n} } } });\n`);
  const scripts = {
    preinstall: 'node tools/calloria-build-preflight.mjs --install',
    prebuild: 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs',
    build: 'vite build', postbuild: 'node tools/calloria-build-artifact-audit.mjs',
    'verify:build-manifest': 'node tools/calloria-build-preflight.mjs --manifest',
    'verify:build-artifacts': 'node tools/calloria-build-artifact-audit.mjs',
    'verify:integration': 'node tools/calloria-v8-integration-audit.mjs',
    'verify:workforce-cloud-history': 'node --test tests/workforce-trend-cloud-sync-v801.test.mjs tests/workforce-trend-cloud-sync-v801-ui.test.mjs tests/workforce-trend-cloud-sync-v801-contract.test.mjs tests/workforce-trend-cloud-sync-v802.test.mjs tests/workforce-trend-cloud-sync-v803.test.mjs tests/workforce-trend-backup-v805.test.mjs',
    'verify:workforce-backup': 'node --test tests/workforce-trend-backup-v805.test.mjs',
    check: 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs',
    dev: 'vite --host 0.0.0.0', preview: 'vite preview --host 0.0.0.0', test: 'node --test tests/*.test.mjs',
    'verify:navigation': 'node tools/calloria-navigation-integrity-audit.mjs'
  };
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
    private: true, type: 'module', engines: { node: '22.x' }, scripts,
    dependencies: { '@supabase/supabase-js': '2.119.0', three: '0.170.0' },
    devDependencies: { esbuild: '0.25.12', vite: '6.4.5' },
    allowScripts: { 'esbuild@0.25.12': true }
  }, null, 2));
  fs.writeFileSync(path.join(root, '.nvmrc'), '22.12.0\n');
  fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify({ buildCommand: 'npm run build', outputDirectory: 'dist' }));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  const preflightSource = fs.readFileSync(path.join(projectRoot, 'tools/calloria-build-preflight.mjs'), 'utf8');
  fs.writeFileSync(path.join(root, 'tools/calloria-build-preflight.mjs'), preflightSource);
  for (const tool of ['calloria-navigation-integrity-audit.mjs', 'calloria-build-artifact-audit.mjs']) {
    fs.writeFileSync(path.join(root, 'tools', tool), '// fixture placeholder\n');
  }
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.writeFileSync(path.join(root, 'js/workforce-trend-cloud-sync-engine-v801.js'), 'export const WORKFORCE_TREND_CLOUD_SYNC_VERSION = \"8.1.0\";\n');
  fs.writeFileSync(path.join(root, 'js/workforce-trend-cloud-sync-engine-v802.js'), 'export const WORKFORCE_TREND_CLOUD_SYNC_VERSION_V802 = \"8.3.0\";\n');
  fs.writeFileSync(path.join(root, 'js/workforce-trend-cloud-sync-engine-v803.js'), 'export const WORKFORCE_TREND_CLOUD_CONFLICT_VERSION_V803 = \"8.4.0\";\n');
  fs.writeFileSync(path.join(root, 'js/workforce-trend-backup-engine-v805.js'), 'export const WORKFORCE_TREND_BACKUP_VERSION_V805 = "8.5.0";\n');
  for (const relative of [
    'styles/calloria-workforce-trend-cloud-sync-v801.css',
    'supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql',
    'tests/workforce-trend-cloud-sync-v801.test.mjs',
    'tests/workforce-trend-cloud-sync-v801-ui.test.mjs',
    'tests/workforce-trend-cloud-sync-v801-contract.test.mjs',
    'supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql',
    'tests/workforce-trend-cloud-sync-v802.test.mjs',
    'supabase/migrations/202611220003_calloria_workforce_trend_conflict_archive.sql',
    'tests/workforce-trend-cloud-sync-v803.test.mjs',
    'tests/workforce-trend-backup-v805.test.mjs'
  ]) { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, '/* fixture */\n'); }
  for (const [name, file] of Object.entries(expectedFiles)) {
    const absolute = path.join(root, file);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, file.endsWith('.html') ? '<!doctype html><html></html>' : 'export {};');
  }
  return root;
}


test('source import scanner ignores transform-anchor strings, templates, comments and dynamic imports', () => {
  const source = [
    "import { realModule } from './real-module.js';",
    "import './side-effect.js';",
    "export { shared } from '../shared.js';",
    "const injectedAnchor = \"import { injected } from './injected-module.js';\";",
    "const generatedSource = `import { generated } from './generated-module.js';`;",
    "// import { commented } from './commented-module.js';",
    "function later() { return import('./dynamic-module.js'); }"
  ].join('\n');
  assert.deepEqual(collectRelativeImports(source), ['./real-module.js', './side-effect.js', '../shared.js']);
});

test('v8 suite centralises eleven plugins including cloud-history sync and records deterministic order', () => {
  const source = fs.readFileSync(path.join(projectRoot, 'build/calloria-workforce-development-suite-v8.mjs'), 'utf8');
  assert.equal(CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES.length, 11);
  for (const name of CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES) assert.ok(source.includes(name));
  const calls = source.match(/\b(?:calloria\w+PluginV\d+|calloriaDigitalExperienceSuitePluginV722)\(\)/g) || [];
  assert.equal(calls.length, 11);
  assert.ok(source.includes('return plugins;'));
});

test('v8 gate accepts all expected plugins and every application entry', () => {
  const fixture = makeEntryFixture();
  try {
    const plugin = calloriaProductionIntegrationGatePluginV8();
    plugin.configResolved(resolvedConfig(fixture.root, fixture.input));
    const bundle = {};
    for (const key of CALLORIA_V8_REQUIRED_HTML_ENTRIES) bundle[expectedFiles[key]] = { type: 'asset', fileName: expectedFiles[key] };
    bundle['widgets/calloria-chat.js'] = { type: 'chunk', fileName: 'widgets/calloria-chat.js' };
    assert.doesNotThrow(() => plugin.generateBundle({}, bundle));
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('v8 gate rejects a missing or duplicated workforce plugin', () => {
  const fixture = makeEntryFixture();
  try {
    const missing = CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES.slice(1);
    assert.throws(() => calloriaProductionIntegrationGatePluginV8().configResolved(resolvedConfig(fixture.root, fixture.input, missing)), /exactly once; found 0/);
    const duplicated = [...CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES, CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES[0]];
    assert.throws(() => calloriaProductionIntegrationGatePluginV8().configResolved(resolvedConfig(fixture.root, fixture.input, duplicated)), /exactly once; found 2/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('v8 gate rejects an out-of-order plugin chain', () => {
  const fixture = makeEntryFixture();
  try {
    const wrong = CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES.slice();
    [wrong[2], wrong[3]] = [wrong[3], wrong[2]];
    assert.throws(() => calloriaProductionIntegrationGatePluginV8().configResolved(resolvedConfig(fixture.root, fixture.input, wrong)), /out of order/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('v8 gate rejects missing HTML/widget input entries', () => {
  const fixture = makeEntryFixture();
  try {
    const broken = { ...fixture.input };
    delete broken.emailInbox;
    assert.throws(() => calloriaProductionIntegrationGatePluginV8().configResolved(resolvedConfig(fixture.root, broken)), /emailInbox/);
    const noWidget = { ...fixture.input };
    delete noWidget.calloriaChatWidget;
    assert.throws(() => calloriaProductionIntegrationGatePluginV8().configResolved(resolvedConfig(fixture.root, noWidget)), /calloriaChatWidget/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('v8 gate rejects production bundles that omit a configured page or widget', () => {
  const fixture = makeEntryFixture();
  try {
    const plugin = calloriaProductionIntegrationGatePluginV8();
    plugin.configResolved(resolvedConfig(fixture.root, fixture.input));
    const incomplete = { 'index.html': { type: 'asset', fileName: 'index.html' } };
    assert.throws(() => plugin.generateBundle({}, incomplete), /omitted HTML page/);
    const allPages = {};
    for (const key of CALLORIA_V8_REQUIRED_HTML_ENTRIES) allPages[expectedFiles[key]] = { type: 'asset', fileName: expectedFiles[key] };
    assert.throws(() => plugin.generateBundle({}, allPages), /widgets\/calloria-chat.js/);
  } finally { fs.rmSync(fixture.root, { recursive: true, force: true }); }
});

test('v8 source integration audit ignores transform import anchors and passes a complete isolated fixture', () => {
  const fixtureRoot = makeAuditFixture();
  try {
    // This import is intentionally inserted into /js/main.js by the Vite plugin.
    // It must not be resolved relative to /build/calloria-digital-followup-supervisor-v723.mjs.
    const pluginFile = path.join(fixtureRoot, 'build/calloria-digital-followup-supervisor-v723.mjs');
    fs.writeFileSync(pluginFile, [
      `const importAnchor = "import { engine } from './digital-response-cycle-engine-v721.js';";`,
      "export function calloriaDigitalFollowUpSupervisorPluginV723() { return { name: 'calloria-digital-followup-supervisor-v7-23' }; }"
    ].join('\n'));
    fs.mkdirSync(path.join(fixtureRoot, 'js'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRoot, 'js/digital-response-cycle-engine-v721.js'), 'export const engine = true;\n');
    const report = auditCalloriaV8Integration({ root: fixtureRoot });
    assert.equal(report.ok, true, report.failures.join('\n'));
    assert.equal(report.workforcePlugins, 11);
    assert.equal(report.htmlEntries, 20);
    assert.equal(report.totalEntries, 21);
    assert.ok(report.importGraphFiles >= 14);
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});

test('v8 source integration audit identifies missing entries and script drift', () => {
  const fixtureRoot = makeAuditFixture();
  try {
    const vitePath = path.join(fixtureRoot, 'vite.config.js');
    fs.writeFileSync(vitePath, fs.readFileSync(vitePath, 'utf8').replace("emailInbox: resolve(process.cwd(), 'email-inbox.html'),\n", ''));
    const pkgPath = path.join(fixtureRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts.prebuild = 'vite build';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg));
    const report = auditCalloriaV8Integration({ root: fixtureRoot });
    assert.equal(report.ok, false);
    assert.ok(report.failures.some((item) => item.includes('emailInbox')));
    assert.ok(report.failures.some((item) => item.includes('prebuild')));
  } finally { fs.rmSync(fixtureRoot, { recursive: true, force: true }); }
});
