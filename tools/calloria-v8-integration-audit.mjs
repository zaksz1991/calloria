#!/usr/bin/env node
/**
 * CALLORIA v8.2 source-level integration audit.
 * Verifies the Vite plugin dependency chain, multi-page entry map, package/build hooks,
 * Node 22 pin and Vercel output contract using Node built-ins only.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const EXPECTED_PREBUILD = 'node tools/calloria-build-preflight.mjs --build && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs';
const EXPECTED_CHECK = 'node tools/calloria-build-preflight.mjs --manifest && node tools/calloria-navigation-integrity-audit.mjs && node tools/calloria-v8-integration-audit.mjs';
const REQUIRED_MODULES = Object.freeze([
  { file: 'build/calloria-digital-experience-suite-v722.mjs', exported: 'calloriaDigitalExperienceSuitePluginV722', plugin: 'calloria-digital-experience-suite-v7-22' },
  { file: 'build/calloria-digital-followup-supervisor-v723.mjs', exported: 'calloriaDigitalFollowUpSupervisorPluginV723', plugin: 'calloria-digital-followup-supervisor-v7-23' },
  { file: 'build/calloria-digital-followup-performance-v724.mjs', exported: 'calloriaDigitalFollowUpPerformancePluginV724', plugin: 'calloria-digital-followup-performance-v7-24' },
  { file: 'build/calloria-digital-followup-coaching-v725.mjs', exported: 'calloriaDigitalFollowUpCoachingPluginV725', plugin: 'calloria-digital-followup-coaching-v7-25' },
  { file: 'build/calloria-digital-followup-coaching-outcomes-v726.mjs', exported: 'calloriaDigitalFollowUpCoachingOutcomesPluginV726', plugin: 'calloria-digital-followup-coaching-outcomes-v7-26' },
  { file: 'build/calloria-digital-followup-coaching-checkpoints-v727.mjs', exported: 'calloriaDigitalFollowUpCoachingCheckpointsPluginV727', plugin: 'calloria-digital-followup-coaching-checkpoints-v7-27' },
  { file: 'build/calloria-digital-career-evidence-v728.mjs', exported: 'calloriaDigitalCareerEvidencePluginV728', plugin: 'calloria-digital-career-evidence-v7-28' },
  { file: 'build/calloria-workforce-intelligence-v729.mjs', exported: 'calloriaWorkforceIntelligencePluginV729', plugin: 'calloria-workforce-intelligence-v7-29' },
  { file: 'build/calloria-workforce-command-centre-v730.mjs', exported: 'calloriaWorkforceCommandCentrePluginV730', plugin: 'calloria-workforce-command-centre-v7-30' },
  { file: 'build/calloria-workforce-trend-history-v731.mjs', exported: 'calloriaWorkforceTrendHistoryPluginV731', plugin: 'calloria-workforce-trend-history-v7-31' },
  { file: 'build/calloria-workforce-trend-cloud-sync-v801.mjs', exported: 'calloriaWorkforceTrendCloudSyncPluginV801', plugin: 'calloria-workforce-trend-cloud-sync-v8-1' }
]);
const REQUIRED_CLOUD_HISTORY_FILES = Object.freeze([
  'js/workforce-trend-cloud-sync-engine-v801.js',
  'styles/calloria-workforce-trend-cloud-sync-v801.css',
  'supabase/migrations/202611220001_calloria_workforce_trend_cloud_history.sql',
  'tests/workforce-trend-cloud-sync-v801.test.mjs',
  'tests/workforce-trend-cloud-sync-v801-ui.test.mjs',
  'tests/workforce-trend-cloud-sync-v801-contract.test.mjs',
  'js/workforce-trend-cloud-sync-engine-v802.js',
  'supabase/migrations/202611220002_calloria_workforce_trend_conflict_guard.sql',
  'tests/workforce-trend-cloud-sync-v802.test.mjs',
  'js/workforce-trend-cloud-sync-engine-v803.js',
  'supabase/migrations/202611220003_calloria_workforce_trend_conflict_archive.sql',
  'tests/workforce-trend-cloud-sync-v803.test.mjs'
]);
const REQUIRED_HTML_INPUTS = Object.freeze([
  'main', 'customerCare', 'caseDesk', 'customer360', 'agentDesk', 'workforce',
  'performance', 'salesDesk', 'supportRouter', 'routingControl', 'voiceSimulator',
  'whatsappInbox', 'emailInbox', 'liveChatInbox', 'socialInbox', 'voiceConsole',
  'smsInbox', 'operationsIntelligence', 'knowledgeOperations', 'assetInspector'
]);
const REQUIRED_ENTRY_MAP = Object.freeze({
  main: 'index.html', customerCare: 'customer-care.html', caseDesk: 'case-desk.html',
  customer360: 'customer-360.html', agentDesk: 'agent-desk.html', workforce: 'workforce.html',
  performance: 'performance.html', salesDesk: 'sales-desk.html', supportRouter: 'support-router.html',
  routingControl: 'routing-control.html', voiceSimulator: 'voice-simulator.html',
  whatsappInbox: 'whatsapp-inbox.html', emailInbox: 'email-inbox.html',
  liveChatInbox: 'live-chat-inbox.html', socialInbox: 'social-inbox.html',
  voiceConsole: 'voice-console.html', smsInbox: 'sms-inbox.html',
  operationsIntelligence: 'operations-intelligence.html', knowledgeOperations: 'knowledge-operations.html',
  assetInspector: 'asset-inspector.html', calloriaChatWidget: 'widgets/calloria-chat.js'
});
const REQUIRED_TOOLS = [
  'tools/calloria-build-preflight.mjs',
  'tools/calloria-navigation-integrity-audit.mjs',
  'tools/calloria-build-artifact-audit.mjs',
  'tools/calloria-v8-integration-audit.mjs',
  'build/calloria-workforce-development-suite-v8.mjs',
  'build/calloria-production-integration-gate-v8.mjs',
  'build/calloria-workforce-trend-cloud-sync-v801.mjs'
];

function readText(root, relative, failures) {
  try { return fs.readFileSync(path.join(root, relative), 'utf8'); }
  catch (error) { failures.push(`Cannot read ${relative}: ${error.message}`); return ''; }
}
function readJson(root, relative, failures) {
  const source = readText(root, relative, failures);
  if (!source) return null;
  try { return JSON.parse(source); }
  catch (error) { failures.push(`${relative} is invalid JSON: ${error.message}`); return null; }
}
function extractEntries(viteConfig) {
  const pattern = /([A-Za-z_$][\w$]*)\s*:\s*resolve\(process\.cwd\(\),\s*['"]([^'"]+)['"]\)/g;
  return [...viteConfig.matchAll(pattern)].map((match) => ({ name: match[1], file: match[2] }));
}
/**
 * Read actual module-level static import/export declarations only.
 *
 * Build plugins in this project intentionally keep future import statements in
 * string constants (for example `const IMPORTS = "import ... from './x.js'"`)
 * and inject those statements into another source file during Vite transforms.
 * Their paths are relative to that transformed file, not to the build-plugin
 * module. A raw text regex incorrectly treats those strings as imports relative
 * to `build/` and produces false missing-file failures before Vite can run.
 *
 * This small lexer skips comments, quoted strings and template literals, then
 * follows only real top-level static `import` declarations and `export ... from`
 * re-exports. Vite/Rollup remains responsible for resolving imports introduced
 * by transforms against the transformed module's actual path.
 */
export function collectRelativeImports(source) {
  const tokens = [];
  const text = String(source ?? '');
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];
    if (/\s/.test(char)) { index += 1; continue; }
    if (char === '/' && next === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index = Math.min(text.length, index + 2);
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      const start = index++;
      let value = '';
      while (index < text.length) {
        const current = text[index++];
        if (current === '\\' && index < text.length) {
          value += text[index++];
          continue;
        }
        if (current === quote) break;
        value += current;
      }
      tokens.push({ type: 'string', value, start, end: index });
      continue;
    }
    if (char === '`') {
      // Template literals are generated-code containers in the build plugins.
      // Skip the complete template; import declarations in its text are not
      // module dependencies of the file containing the template.
      index += 1;
      while (index < text.length) {
        const current = text[index++];
        if (current === '\\' && index < text.length) { index += 1; continue; }
        if (current === '`') break;
      }
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      const start = index++;
      while (index < text.length && /[A-Za-z0-9_$]/.test(text[index])) index += 1;
      tokens.push({ type: 'identifier', value: text.slice(start, index), start, end: index });
      continue;
    }
    tokens.push({ type: 'punctuation', value: char, start: index, end: index + 1 });
    index += 1;
  }

  const values = [];
  let braces = 0;
  let brackets = 0;
  let parentheses = 0;
  for (let cursor = 0; cursor < tokens.length; cursor += 1) {
    const token = tokens[cursor];
    if (braces === 0 && brackets === 0 && parentheses === 0
      && token.type === 'identifier' && (token.value === 'import' || token.value === 'export')) {
      const isImport = token.value === 'import';
      const nextToken = tokens[cursor + 1];
      if (isImport && (nextToken?.value === '(' || nextToken?.value === '.')) continue;
      if (!isImport && nextToken?.value !== '*' && nextToken?.value !== '{') continue;

      let statementEnd = cursor + 1;
      while (statementEnd < tokens.length && tokens[statementEnd].value !== ';') statementEnd += 1;
      let specifier = null;
      if (isImport && nextToken?.type === 'string') {
        specifier = nextToken.value; // side-effect import
      } else {
        for (let scan = cursor + 1; scan + 1 < statementEnd; scan += 1) {
          if (tokens[scan].type === 'identifier' && tokens[scan].value === 'from'
            && tokens[scan + 1].type === 'string') {
            specifier = tokens[scan + 1].value;
            break;
          }
        }
      }
      if (specifier && (specifier.startsWith('./') || specifier.startsWith('../'))) values.push(specifier);
      cursor = statementEnd;
      continue;
    }
    if (token.value === '{') braces += 1;
    else if (token.value === '}') braces = Math.max(0, braces - 1);
    else if (token.value === '[') brackets += 1;
    else if (token.value === ']') brackets = Math.max(0, brackets - 1);
    else if (token.value === '(') parentheses += 1;
    else if (token.value === ')') parentheses = Math.max(0, parentheses - 1);
  }
  return values;
}
function auditLocalImportGraph(root, entryFiles, failures) {
  const visited = new Set();
  const pending = [...entryFiles];
  while (pending.length) {
    const relative = pending.pop();
    const absolute = path.resolve(root, relative);
    if (visited.has(absolute)) continue;
    visited.add(absolute);
    let source;
    try { source = fs.readFileSync(absolute, 'utf8'); }
    catch (error) { failures.push(`Missing Vite import graph file ${relative}: ${error.message}`); continue; }
    for (const specifier of collectRelativeImports(source)) {
      const dependency = path.resolve(path.dirname(absolute), specifier);
      const rel = path.relative(root, dependency).split(path.sep).join('/');
      if (!rel || rel.startsWith('../') || path.isAbsolute(rel)) {
        failures.push(`${relative} imports a path outside the repository: ${specifier}`);
        continue;
      }
      if (!fs.existsSync(dependency)) failures.push(`${relative} imports missing local file ${rel}`);
      else pending.push(rel);
    }
  }
  return visited.size;
}

export function auditCalloriaV8Integration({ root = process.cwd() } = {}) {
  const projectRoot = path.resolve(root);
  const failures = [];
  const warnings = [];
  const pkg = readJson(projectRoot, 'package.json', failures);
  const viteConfig = readText(projectRoot, 'vite.config.js', failures);
  const suite = readText(projectRoot, 'build/calloria-workforce-development-suite-v8.mjs', failures);
  const gate = readText(projectRoot, 'build/calloria-production-integration-gate-v8.mjs', failures);
  const cloudPlugin = readText(projectRoot, 'build/calloria-workforce-trend-cloud-sync-v801.mjs', failures);

  if (pkg) {
    if (pkg.private !== true || pkg.type !== 'module') failures.push('package.json must remain private and use ES modules.');
    if (pkg.engines?.node !== '22.x') failures.push('package.json engines.node must remain 22.x.');
    if (pkg.scripts?.prebuild !== EXPECTED_PREBUILD) failures.push('package.json prebuild must run preflight, navigation audit and v8 integration audit in that order.');
    if (pkg.scripts?.check !== EXPECTED_CHECK) failures.push('package.json check must run the manifest, navigation and v8 integration audits.');
    if (pkg.scripts?.['verify:integration'] !== 'node tools/calloria-v8-integration-audit.mjs') failures.push('package.json must expose verify:integration.');
    if (pkg.scripts?.['verify:workforce-cloud-history'] !== 'node --test tests/workforce-trend-cloud-sync-v801.test.mjs tests/workforce-trend-cloud-sync-v801-ui.test.mjs tests/workforce-trend-cloud-sync-v801-contract.test.mjs tests/workforce-trend-cloud-sync-v802.test.mjs tests/workforce-trend-cloud-sync-v803.test.mjs') failures.push('package.json must expose the v8.4 workforce cloud-history regression check.');
    if (!/tests\/\*\.test\.mjs/.test(pkg.scripts?.test || '')) failures.push('package.json test script must include the complete .test.mjs regression suite.');
    if (pkg.scripts?.build !== 'vite build' || pkg.scripts?.postbuild !== 'node tools/calloria-build-artifact-audit.mjs') {
      failures.push('The Vite build and post-build artifact audit hooks must remain unchanged.');
    }
    for (const [section, name, version] of [
      ['dependencies', '@supabase/supabase-js', '2.119.0'], ['dependencies', 'three', '0.170.0'],
      ['devDependencies', 'esbuild', '0.25.12'], ['devDependencies', 'vite', '6.4.5']
    ]) if (pkg[section]?.[name] !== version) failures.push(`Dependency ${section}.${name} must stay pinned to ${version}.`);
    if (pkg.allowScripts?.['esbuild@0.25.12'] !== true) failures.push('The version-pinned esbuild lifecycle approval is missing.');
  }

  const nvmrc = readText(projectRoot, '.nvmrc', failures).trim();
  if (!/^22(?:\.|$)/.test(nvmrc)) failures.push(`.nvmrc must pin Node 22; found ${nvmrc || '(empty)'}.`);
  const vercel = readJson(projectRoot, 'vercel.json', failures);
  if (vercel && (vercel.buildCommand !== 'npm run build' || vercel.outputDirectory !== 'dist')) {
    failures.push('vercel.json must retain npm run build and dist output.');
  }

  for (const file of REQUIRED_TOOLS) {
    if (!fs.existsSync(path.join(projectRoot, file))) failures.push(`Required build/integration tool is missing: ${file}.`);
  }
  for (const file of REQUIRED_CLOUD_HISTORY_FILES) {
    if (!fs.existsSync(path.join(projectRoot, file))) failures.push(`Required workforce cloud-history file is missing: ${file}.`);
  }

  if (!viteConfig.includes("from './build/calloria-workforce-development-suite-v8.mjs'")) failures.push('vite.config.js does not import the v8 workforce suite.');
  if (!viteConfig.includes("from './build/calloria-production-integration-gate-v8.mjs'")) failures.push('vite.config.js does not import the v8 production integration gate.');
  if (viteConfig.includes("from './build/calloria-workforce-trend-cloud-sync-v801.mjs'") || viteConfig.includes('calloriaWorkforceTrendCloudSyncPluginV801()')) failures.push('vite.config.js must not register the cloud-history plugin separately; it must be part of the central workforce suite.');
  if ((viteConfig.match(/\.\.\.calloriaWorkforceDevelopmentSuitePluginsV8\(\)/g) || []).length !== 1) failures.push('vite.config.js must spread the v8 suite exactly once.');
  if ((viteConfig.match(/calloriaProductionIntegrationGatePluginV8\(\)/g) || []).length !== 1) failures.push('vite.config.js must register the v8 integration gate exactly once.');
  const suiteRegistration = viteConfig.indexOf('...calloriaWorkforceDevelopmentSuitePluginsV8()');
  const gateRegistration = viteConfig.indexOf('calloriaProductionIntegrationGatePluginV8()');
  if (suiteRegistration < 0 || gateRegistration <= suiteRegistration) failures.push('The v8 integration gate must be registered after the workforce suite.');
  for (const item of REQUIRED_MODULES) {
    if (viteConfig.includes(`${item.exported}()`)) failures.push(`vite.config.js still registers ${item.exported} directly; use the central v8 suite only.`);
    if (!suite.includes(`from './${path.basename(item.file)}'`) && !suite.includes(`from './${item.file.replace(/^build\//, '')}'`)) {
      failures.push(`v8 suite is missing the import for ${item.file}.`);
    }
    const moduleText = readText(projectRoot, item.file, failures);
    if (!moduleText.includes(`export function ${item.exported}(`)) failures.push(`${item.file} is missing export ${item.exported}.`);
    if (!moduleText.includes(`name: '${item.plugin}'`)) failures.push(`${item.file} does not expose the expected plugin name ${item.plugin}.`);
    if (!suite.includes(`${item.exported}()`)) failures.push(`v8 suite does not register ${item.exported}().`);
  }
  if (!cloudPlugin.includes("from '../js/workforce-trend-cloud-sync-engine-v803.js'")) failures.push('The organisation cloud-sync plugin must load the v8.4 durable conflict-review engine.');
  if (!cloudPlugin.includes('calloria_sync_workforce_trend_snapshots_v802')) failures.push('The organisation cloud-sync plugin must use the non-destructive v8.3 sync RPC.');
  if (!cloudPlugin.includes('inspectWorkforceTrendCloudConflictsV802')) failures.push('The organisation cloud-sync plugin must report same-capture-time conflicts before merging.');
  if (!cloudPlugin.includes('calloria_record_workforce_trend_conflicts_v803') || !cloudPlugin.includes('calloria_resolve_workforce_trend_conflict_v803')) failures.push('The organisation cloud-sync plugin must archive both conflict variants and support explicit canonical-copy resolution.');
  if (!cloudPlugin.includes('data-workforce-cloud-conflict-review') || !cloudPlugin.includes('data-workforce-cloud-conflict-resolve')) failures.push('The organisation cloud-sync plugin is missing its conflict review and explicit-resolution UI.');
  const expectedOrder = REQUIRED_MODULES.map((item) => item.plugin);
  for (let i = 1; i < expectedOrder.length; i += 1) {
    if (suite.indexOf(`${REQUIRED_MODULES[i].exported}()`) <= suite.indexOf(`${REQUIRED_MODULES[i - 1].exported}()`)) {
      failures.push(`v8 suite order is invalid between ${expectedOrder[i - 1]} and ${expectedOrder[i]}.`);
    }
  }
  if (!suite.includes("name: 'calloria-production-integration-gate-v8'") && !gate.includes("name: 'calloria-production-integration-gate-v8'")) {
    failures.push('v8 production integration gate plugin has no stable name.');
  }
  if (!gate.includes('REQUIRED_WORKFORCE_PLUGIN_NAMES')) failures.push('v8 gate does not verify the central plugin order.');

  const entries = extractEntries(viteConfig);
  const entryMap = new Map(entries.map((entry) => [entry.name, entry.file]));
  const missingNames = Object.keys(REQUIRED_ENTRY_MAP).filter((name) => !entryMap.has(name));
  if (missingNames.length) failures.push(`vite.config.js is missing Rollup input name(s): ${missingNames.join(', ')}.`);
  for (const [name, expectedFile] of Object.entries(REQUIRED_ENTRY_MAP)) {
    const actual = entryMap.get(name);
    if (actual && actual !== expectedFile) failures.push(`Vite entry ${name} must resolve to ${expectedFile}; found ${actual}.`);
    if (actual && !fs.existsSync(path.join(projectRoot, actual))) failures.push(`Vite entry ${name} source file is missing: ${actual}.`);
  }
  const htmlEntryCount = entries.filter((entry) => entry.file.toLowerCase().endsWith('.html')).length;
  if (htmlEntryCount !== REQUIRED_HTML_INPUTS.length) failures.push(`Expected ${REQUIRED_HTML_INPUTS.length} HTML application entries; found ${htmlEntryCount}.`);

  const preflight = readText(projectRoot, 'tools/calloria-build-preflight.mjs', failures);
  if (!preflight.includes(`prebuild: EXPECTED_PREBUILD`) || !preflight.includes('calloria-v8-integration-audit.mjs')) {
    failures.push('Build preflight does not enforce the v8 prebuild audit sequence.');
  }

  const traversed = auditLocalImportGraph(projectRoot, ['vite.config.js', 'build/calloria-workforce-development-suite-v8.mjs', 'build/calloria-production-integration-gate-v8.mjs'], failures);
  if (!fs.existsSync(path.join(projectRoot, 'public'))) warnings.push('public/ is absent from this source tree; static asset availability cannot be verified here.');

  return {
    ok: failures.length === 0,
    projectRoot,
    workforcePlugins: REQUIRED_MODULES.length,
    htmlEntries: htmlEntryCount,
    totalEntries: entries.length,
    importGraphFiles: traversed,
    failures,
    warnings
  };
}

function runCli() {
  const report = auditCalloriaV8Integration();
  if (report.ok) {
    console.log(`CALLORIA v8 integration audit passed: ${report.workforcePlugins} ordered workforce plugins, ${report.htmlEntries} HTML pages, ${report.totalEntries} total build entries, ${report.importGraphFiles} import-graph files, Node/Vercel/package contracts.`);
  } else {
    console.error(`CALLORIA v8 integration audit failed (${report.failures.length} issue${report.failures.length === 1 ? '' : 's'}):`);
    for (const failure of report.failures) console.error(`- ${failure}`);
  }
  for (const warning of report.warnings) console.warn(`CALLORIA v8 integration audit warning: ${warning}`);
  if (!report.ok) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) runCli();
