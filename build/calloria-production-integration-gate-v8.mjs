/**
 * CALLORIA v8.0 — fail-fast Vite integration gate.
 * Validates the digital/workforce plugin order and every configured application entry.
 */
import fs from 'node:fs';
import path from 'node:path';
const REQUIRED_WORKFORCE_PLUGIN_NAMES = Object.freeze([
  'calloria-digital-experience-suite-v7-22',
  'calloria-digital-followup-supervisor-v7-23',
  'calloria-digital-followup-performance-v7-24',
  'calloria-digital-followup-coaching-v7-25',
  'calloria-digital-followup-coaching-outcomes-v7-26',
  'calloria-digital-followup-coaching-checkpoints-v7-27',
  'calloria-digital-career-evidence-v7-28',
  'calloria-workforce-intelligence-v7-29',
  'calloria-workforce-command-centre-v7-30',
  'calloria-workforce-trend-history-v7-31'
]);

const REQUIRED_HTML_ENTRIES = Object.freeze([
  'main', 'customerCare', 'caseDesk', 'customer360', 'agentDesk', 'workforce',
  'performance', 'salesDesk', 'supportRouter', 'routingControl', 'voiceSimulator',
  'whatsappInbox', 'emailInbox', 'liveChatInbox', 'socialInbox', 'voiceConsole',
  'smsInbox', 'operationsIntelligence', 'knowledgeOperations', 'assetInspector'
]);
const REQUIRED_ALL_ENTRIES = Object.freeze([...REQUIRED_HTML_ENTRIES, 'calloriaChatWidget']);
const WIDGET_OUTPUT = 'widgets/calloria-chat.js';

function fail(message) {
  throw new Error(`[CALLORIA v8.0 integration gate] ${message}`);
}

function toEntries(input) {
  if (input && typeof input === 'object' && !Array.isArray(input)) return Object.entries(input);
  if (Array.isArray(input)) return input.map((value, index) => [String(index), value]);
  if (typeof input === 'string') return [['main', input]];
  return [];
}

export function calloriaProductionIntegrationGatePluginV8() {
  let expectedHtmlOutputs = [];
  return {
    name: 'calloria-production-integration-gate-v8',
    enforce: 'post',
    configResolved(config) {
      const names = (config.plugins || []).map((plugin) => plugin?.name).filter(Boolean);
      const positions = [];
      for (const requiredName of REQUIRED_WORKFORCE_PLUGIN_NAMES) {
        const found = [];
        names.forEach((name, index) => { if (name === requiredName) found.push(index); });
        if (found.length !== 1) {
          fail(`Expected plugin ${requiredName} exactly once; found ${found.length}.`);
        }
        positions.push(found[0]);
      }
      for (let index = 1; index < positions.length; index += 1) {
        if (positions[index] <= positions[index - 1]) {
          fail(`Workforce plugins are out of order: ${REQUIRED_WORKFORCE_PLUGIN_NAMES[index - 1]} must precede ${REQUIRED_WORKFORCE_PLUGIN_NAMES[index]}.`);
        }
      }

      const entries = toEntries(config.build?.rollupOptions?.input);
      const entryMap = new Map(entries);
      const missing = REQUIRED_ALL_ENTRIES.filter((key) => !entryMap.has(key));
      if (missing.length) fail(`Missing configured application entry point(s): ${missing.join(', ')}.`);

      const root = config.root || process.cwd();
      expectedHtmlOutputs = [];
      for (const key of REQUIRED_HTML_ENTRIES) {
        const source = entryMap.get(key);
        if (typeof source !== 'string' || !source.toLowerCase().endsWith('.html')) {
          fail(`Entry ${key} must resolve to an HTML file; received ${String(source)}.`);
        }
        const absolute = path.isAbsolute(source) ? source : path.resolve(root, source);
        if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
          fail(`HTML entry ${key} does not exist: ${source}.`);
        }
        expectedHtmlOutputs.push(path.basename(source));
      }

      const widgetSource = entryMap.get('calloriaChatWidget');
      if (typeof widgetSource !== 'string' || !widgetSource.replaceAll('\\', '/').endsWith('/widgets/calloria-chat.js') && widgetSource !== 'widgets/calloria-chat.js') {
        fail(`calloriaChatWidget must point to widgets/calloria-chat.js; received ${String(widgetSource)}.`);
      }
      const widgetAbsolute = path.isAbsolute(widgetSource) ? widgetSource : path.resolve(root, widgetSource);
      if (!fs.existsSync(widgetAbsolute) || !fs.statSync(widgetAbsolute).isFile()) {
        fail(`Chat widget entry does not exist: ${widgetSource}.`);
      }
    },
    generateBundle(_options, bundle) {
      const emitted = new Set(Object.keys(bundle));
      const missingHtml = expectedHtmlOutputs.filter((fileName) => !emitted.has(fileName));
      if (missingHtml.length) fail(`Production bundle omitted HTML page(s): ${missingHtml.join(', ')}.`);
      if (!emitted.has(WIDGET_OUTPUT)) fail(`Production bundle omitted ${WIDGET_OUTPUT}.`);
    }
  };
}

export const CALLORIA_V8_REQUIRED_WORKFORCE_PLUGIN_NAMES = REQUIRED_WORKFORCE_PLUGIN_NAMES;
export const CALLORIA_V8_REQUIRED_HTML_ENTRIES = REQUIRED_HTML_ENTRIES;
export const CALLORIA_V8_REQUIRED_ALL_ENTRIES = REQUIRED_ALL_ENTRIES;
