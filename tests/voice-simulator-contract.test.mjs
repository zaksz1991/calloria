import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../voice-simulator.html',import.meta.url),'utf8');
const agentHtml = await readFile(new URL('../agent-desk.html',import.meta.url),'utf8');
const vite = await readFile(new URL('../vite.config.js',import.meta.url),'utf8');
const workbench = await readFile(new URL('../js/voice-simulator-workbench.js',import.meta.url),'utf8');
const engine = await readFile(new URL('../js/voice-simulator-engine.js',import.meta.url),'utf8');

test('voice simulator is an explicit Vite multi-page build entry',()=>{
  assert.match(vite,/voiceSimulator:\s*resolve\(process\.cwd\(\),\s*'voice-simulator\.html'\)/);
});
test('Agent Desk navigation links to the new practice page',()=>{
  assert.match(agentHtml,/href="\/voice-simulator\.html"/);
});
test('voice simulator authenticates through existing Agent Desk whoami endpoint',()=>{
  assert.match(workbench,/functions\/v1\/calloria-agent-desk/);
  assert.match(workbench,/action:'whoami'/);
});
test('browser-only practice history is scoped to the authenticated staff UUID',()=>{
  assert.match(workbench,/STORE_PREFIX \+ staff\.id/);
  assert.match(engine,/export function buildPracticeRecord/);
  assert.doesNotMatch(engine,/messages:\s*state\.messages/);
});
test('page clearly discloses simulation-only and no recording/provider connection',()=>{
  assert.match(html,/SIMULATION ONLY/);
  assert.match(html,/No telephone carrier/);
  assert.match(html,/No audio is recorded or uploaded/);
  assert.doesNotMatch(workbench,/getUserMedia|MediaRecorder|SpeechRecognition/);
});
test('practice scores are explicitly excluded from official scorecards',()=>{
  assert.match(html,/excluded from official KPI scorecards/);
});
