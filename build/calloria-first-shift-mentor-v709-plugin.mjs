import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MAIN_TARGET = '/js/main.js';
const MARKER = '__CALLORIA_FIRST_SHIFT_MENTOR_V709__';
const REQUIRED_MARKERS = [
  '__CALLORIA_FIRST_SHIFT_GAMEPLAY_EVENTS_V231__',
  '__CALLORIA_OJT_CROSS_INDUSTRY_V37__'
];
const IMPORT_ANCHOR = "} from './operations-engine.js';";
const RENDER_ANCHOR = '  saveState();\n}\nfunction openModal(html) {';
const ENGINE_IMPORT = "import { createFirstShiftMentorRecord, normalizeFirstShiftMentorRecord, recordMentorCallConnected, recordMentorCaseSaved, acknowledgeMentorCoaching, requestMentorReview, approveMentorReview, firstShiftMentorSnapshot } from './first-shift-mentor-engine-v709.js';";
const CSS_IMPORT = "import '../calloria-first-shift-mentor-v709.css';";

function count(source, needle) { return source.split(needle).length - 1; }
function warn(context, message) { context?.warn?.(message); }

function addImport(source, statement, label) {
  if (source.includes(statement)) return { ok: true, source };
  const matches = count(source, IMPORT_ANCHOR);
  if (matches !== 1) return { ok: false, reason: `${label} import anchor occurred ${matches} times` };
  return { ok: true, source: source.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\n${statement}`) };
}

function transformMain(context, source, runtimeSnippet) {
  if (source.includes(MARKER)) return null;
  const missing = REQUIRED_MARKERS.filter(marker => !source.includes(marker));
  if (missing.length) {
    warn(context, `CALLORIA v7.09 first-shift mentor skipped safely: required upstream transform markers are missing (${missing.join(', ')}). No partial transform was applied.`);
    return null;
  }
  if (count(source, RENDER_ANCHOR) !== 1) {
    warn(context, `CALLORIA v7.09 first-shift mentor skipped safely: expected one final renderView anchor, found ${count(source, RENDER_ANCHOR)}. No partial transform was applied.`);
    return null;
  }
  if (!runtimeSnippet || !runtimeSnippet.includes('calloriaRenderFirstShiftMentorPanel')) {
    warn(context, 'CALLORIA v7.09 first-shift mentor skipped safely: runtime snippet is missing or incomplete. No partial transform was applied.');
    return null;
  }
  let code = source;
  for (const [statement, label] of [[ENGINE_IMPORT, 'engine'], [CSS_IMPORT, 'stylesheet']]) {
    const result = addImport(code, statement, label);
    if (!result.ok) {
      warn(context, `CALLORIA v7.09 first-shift mentor skipped safely: ${result.reason}. No partial transform was applied.`);
      return null;
    }
    code = result.source;
  }
  // Runtime and render hook are applied only after every precondition passes.
  code = code.replace('function renderView() {', `/* ${MARKER} */\n${runtimeSnippet}\nfunction renderView() {`);
  code = code.replace(RENDER_ANCHOR, '  saveState();\n  calloriaRenderFirstShiftMentorPanel();\n}\nfunction openModal(html) {');
  return { code, map: null };
}

export function calloriaFirstShiftMentorV709Plugin() {
  return {
    name: 'calloria-first-shift-mentor-v7-09',
    enforce: 'post',
    transform(source, id) {
      const normalizedId = String(id || '').split('?')[0].replaceAll('\\', '/');
      if (!normalizedId.endsWith(MAIN_TARGET)) return null;
      const runtimePath = resolve(process.cwd(), 'build/calloria-first-shift-mentor-v709-runtime.js');
      if (!existsSync(runtimePath)) {
        warn(this, 'CALLORIA v7.09 first-shift mentor skipped safely: build/calloria-first-shift-mentor-v709-runtime.js is missing.');
        return null;
      }
      let runtimeSnippet = '';
      try { runtimeSnippet = readFileSync(runtimePath, 'utf8'); }
      catch (error) {
        warn(this, `CALLORIA v7.09 first-shift mentor skipped safely: could not read runtime snippet (${error.message}).`);
        return null;
      }
      return transformMain(this, source, runtimeSnippet);
    }
  };
}

export const __firstShiftMentorPluginTest = Object.freeze({ MAIN_TARGET, MARKER, REQUIRED_MARKERS, IMPORT_ANCHOR, RENDER_ANCHOR, ENGINE_IMPORT, CSS_IMPORT, transformMain });
