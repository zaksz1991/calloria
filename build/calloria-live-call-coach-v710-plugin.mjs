const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_LIVE_CALL_COACH_V710__';
const IMPORT_ANCHOR = "} from './operations-engine.js';";
const VOICE_MONITOR_ANCHOR = '${voiceMonitor}${continuityPanel}';
const ENGINE_IMPORT = `/* ${MARKER} */\nimport { renderCallCoachPanelV710 } from './live-call-coach-v710.js';`;
const CSS_IMPORT = "import '../calloria-live-call-coach-v710.css';";

function count(source, text) { return source.split(text).length - 1; }
function addImport(source, statement) {
  if (source.includes(statement)) return { ok: true, source };
  if (count(source, IMPORT_ANCHOR) !== 1) return { ok: false, reason: `operations-engine import anchor occurred ${count(source, IMPORT_ANCHOR)} times` };
  return { ok: true, source: source.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${statement}`) };
}

export function transformCallCoachMain(source) {
  if (source.includes(MARKER)) return { ok: true, skipped: true, code: source };
  const checks = [
    ['inbound renderer', 'function renderInbound() {'],
    ['live customer monitor', 'const voiceMonitor=voiceBehaviour?'],
    ['live call panel insertion point', VOICE_MONITOR_ANCHOR]
  ];
  for (const [label, anchor] of checks) {
    const matches = count(source, anchor);
    if (matches !== 1) return { ok: false, reason: `${label} anchor occurred ${matches} times` };
  }
  let code = source;
  for (const statement of [ENGINE_IMPORT, CSS_IMPORT]) {
    const result = addImport(code, statement);
    if (!result.ok) return result;
    code = result.source;
  }
  const replacement = '${voiceMonitor}${renderCallCoachPanelV710({ call, scenario, step, voiceBehaviour, pendingDecision })}${continuityPanel}';
  code = code.replace(VOICE_MONITOR_ANCHOR, replacement);
  if (!code.includes(MARKER) || count(code, 'renderCallCoachPanelV710({ call, scenario, step, voiceBehaviour, pendingDecision })') !== 1) {
    return { ok: false, reason: 'coach panel insertion was not unique after transformation' };
  }
  return { ok: true, code };
}

export function calloriaLiveCallCoachV710Plugin() {
  return {
    name: 'calloria-live-call-coach-v7-10',
    enforce: 'post',
    transform(source, id) {
      const normalized = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalized.endsWith(MAIN_TARGET)) return null;
      const result = transformCallCoachMain(source);
      if (!result.ok) {
        this.warn(`CALLORIA v7.10 live-call coach skipped safely: ${result.reason}. No partial transform was applied.`);
        return null;
      }
      if (result.skipped) return null;
      return { code: result.code, map: null };
    }
  };
}

export const __liveCallCoachPluginV710Test = Object.freeze({ MAIN_TARGET, MARKER, IMPORT_ANCHOR, VOICE_MONITOR_ANCHOR, ENGINE_IMPORT, CSS_IMPORT, transformCallCoachMain });
