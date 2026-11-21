import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.dirname(here);
const sourcePlugin = path.join(packageRoot, 'build/calloria-ruffneck-service-operations-v6-86.mjs');
let sandbox;
let api;

const catalog = {
  'ruffneck-lms': {
    name: 'RuffNeck LMS', category: 'Learning platform', url: 'https://ruffneck-lms.vercel.app/',
    summary: 'Learning platform support.', requests: ['Login or account access'],
    selfService: ['Check the learner profile.'], agentSteps: ['Verify identity safely.'],
    escalate: 'Escalate repeated access problems.',
    scenario: { id: 'lms-login', prompt: 'A learner cannot sign in.', options: [
      { id: 'verify', label: 'Verify the account and status.', score: 100, feedback: 'Correct.' },
      { id: 'guess', label: 'Guess the cause.', score: 0, feedback: 'Do not guess.' },
    ] },
  },
  'ruffneck-prospector': { name: 'RuffNeck Prospector', category: 'Business tools', url: 'https://ruffneck-prospector.vercel.app/', summary: 'Prospect support.', requests: ['Cannot find a saved prospect'], selfService: ['Check filters.'], agentSteps: ['Check the workspace.'] },
  'ruffneck-connect': { name: 'RuffNeck Connect', category: 'Communication', url: 'https://ruffneck-connect.vercel.app/', summary: 'Messaging support.', requests: ['Messages are delayed or not delivered'], selfService: ['Check delivery state.'], agentSteps: ['Check recipient and timestamp.'] },
  'ruffneck-social-hub': { name: 'RuffNeck Social Hub', category: 'Social', url: 'https://ruffneck-social-hub.vercel.app/', summary: 'Social publishing support.', requests: ['Scheduled content did not publish'], selfService: ['Check schedule.'], agentSteps: ['Check publishing log.'] },
  'kano-run': { name: 'Kano Run', category: 'Game support', url: 'https://kano-run.vercel.app/', summary: 'Game support.', requests: ['Player progress appears missing'], selfService: ['Check save type.'], agentSteps: ['Collect safe reproduction details.'] },
  'kano-keke': { name: 'Kano Keke', category: 'Game support', url: 'https://kano-keke.vercel.app/', summary: 'Driving game support.', requests: ['Driving controls do not respond'], selfService: ['Check page focus.'], agentSteps: ['Confirm input method.'] },
};

before(async () => {
  sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v686-'));
  fs.copyFileSync(sourcePlugin, path.join(sandbox, 'calloria-ruffneck-service-operations-v6-86.mjs'));
  fs.writeFileSync(
    path.join(sandbox, 'calloria-ruffneck-platform-support-v6-51.mjs'),
    `export const PLATFORM_SUPPORT_CATALOG_V651 = Object.freeze(${JSON.stringify(catalog)});\n`,
  );
  const module = await import(pathToFileURL(path.join(sandbox, 'calloria-ruffneck-service-operations-v6-86.mjs')).href);
  api = module.__calloriaV686Test;
});

after(() => {
  if (sandbox) fs.rmSync(sandbox, { recursive: true, force: true });
});

function context() {
  return { error(message) { throw new Error(message); } };
}

function syntaxCheck(code, filename) {
  const target = path.join(sandbox, filename);
  fs.writeFileSync(target, code);
  const result = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('redacts passwords, one-time codes, email addresses, phone numbers and long numeric identifiers', () => {
  const safe = api.redact('Password is Secret123, OTP: 445566. Email name@example.com, phone +234 801 234 5678, card 4111 1111 1111 1111.');
  assert.doesNotMatch(safe, /Secret123|445566/);
  assert.doesNotMatch(safe, /name@example\.com/);
  assert.doesNotMatch(safe, /801 234 5678/);
  assert.doesNotMatch(safe, /4111 1111 1111 1111/);
  assert.match(safe, /REDACTED EMAIL/);
  assert.doesNotMatch(safe, /\+234|801 234 5678/);
  assert.match(safe, /REDACTED NUMBER/);
});

test('creates a critical synthetic service case with the 30-minute SLA and specialist routing', () => {
  const now = Date.parse('2026-11-21T00:00:00.000Z');
  const record = api.create({
    platformId: 'ruffneck-lms', requestType: 'Login or account access',
    customerReference: 'CUS-SIM-001', priority: 'critical',
    details: 'The learner cannot open the course dashboard after the authorised access check.',
  }, now);
  assert.equal(record.status, 'Escalated');
  assert.equal(record.slaMinutes, 30);
  assert.equal(Date.parse(record.slaDueAt) - now, 30 * 60_000);
  assert.equal(record.team, 'Learning Platform Support');
  assert.equal(record.customerReference, 'CUS-SIM-001');
  assert.equal(record.qaEligible, false);
  assert.equal(record.assignmentHistory.length, 1);
});

test('rejects real-looking customer identifiers and request types outside the service catalogue', () => {
  assert.throws(() => api.create({
    platformId: 'ruffneck-lms', requestType: 'Login or account access', customerReference: 'CUS-123456',
    priority: 'normal', details: 'Customer reports an access failure after a browser update.',
  }), /synthetic reference/i);
  assert.throws(() => api.create({
    platformId: 'ruffneck-lms', requestType: 'Refund money', customerReference: 'CUS-SIM-001',
    priority: 'normal', details: 'Customer reports an access failure after a browser update.',
  }), /request type/i);
});

test('scores a service practice response and rejects unknown options', () => {
  const right = api.score('ruffneck-lms', 'verify');
  assert.equal(right.score, 100);
  assert.equal(right.correct, true);
  assert.equal(api.score('ruffneck-lms', 'missing'), null);
});

test('records case status, reassignment and resolution history', () => {
  const record = api.create({
    platformId: 'ruffneck-lms', requestType: 'Login or account access', customerReference: 'CUS-SIM-002',
    priority: 'normal', details: 'The learner cannot open the course dashboard after the authorised access check.',
  }, Date.parse('2026-11-21T00:00:00.000Z'));
  api.update(record, { status: 'In Progress', assignedTo: 'Amina Yusuf', team: 'Learning Platform Support', note: 'Confirmed the account and course enrolment; routed the access fault to the platform queue.' }, Date.parse('2026-11-21T00:10:00.000Z'));
  assert.equal(record.assignedTo, 'Amina Yusuf');
  assert.equal(record.assignmentHistory.length, 2);
  assert.equal(record.history.length, 2);
  api.update(record, { status: 'Resolved', note: 'Access restored after the approved account status correction and learner confirmation.' }, Date.parse('2026-11-21T00:20:00.000Z'));
  assert.equal(record.status, 'Resolved');
  assert.ok(record.resolvedAt);
});

test('rebases the Workforce systems registry and removes Finacle', () => {
  const original = `export const SYSTEMS = [\n  { id:'icc', name:'ICC', purpose:'Interaction control' },\n  { id:'finacle', name:'Finacle', purpose:'Legacy banking' },\n  { id:'crm', name:'CRM', purpose:'Customer records' }\n];\nexport function createSystemEvent(events, id) { if (!SYSTEMS.some(item => item.id === id)) throw new Error('Unknown'); }\n`;
  const transformed = api.transformWorkforce(context(), original);
  assert.ok(transformed.code.includes('"id": "ruffneck-lms"'));
  assert.ok(!transformed.code.includes("id: \"finacle\""));
  syntaxCheck(transformed.code, 'workforce-engine.fixture.mjs');
});

test('rebases current main.js anchors, installs service operations and produces valid JavaScript', () => {
  const original = `
const SYSTEMS = [{id:'icc',name:'ICC',purpose:'Queue'}];
const state = { applicationSubmitted:false, stage:'applicant', hired:false, applicantName:'', systemEvents:[], cases:[], currentView:'workforce' };
const escapeHTML = value => String(value ?? '');
const toast = () => {};
const renderView = () => {};
const saveState = () => {};
const pushOperationEvent = () => {};
const createSystemEvent = (events, systemId) => events.push({systemId});
function initialState(){ return { selectedTrack: 'banking', department: 'Banking Operations', roleTitle: 'Customer Experience Associate', salary: 185000, }; }
function loadState(parsed){ const migrated = { ...initialState(), ...parsed }; return migrated; }
function renderWorkforce() {
  const markup = \`<div class="grid three">\${SYSTEMS.map(s=>\`<article>\${s.name}</article>\`).join('')}</div>
         <h4 style="margin-top:16px">System activity</h4>
         \${state.systemEvents.slice(-8).reverse().map(e=>e.systemId).join('')}
         Connected workflow practice using synthetic records only. No real banking systems or transactions.\`;
  return markup;
}
function launch(){ switch('launch-system'){ case 'launch-system': { const system=SYSTEMS.find(x=>x.id==='icc'); if(!system)break; return system; } } }
document.addEventListener('click',e=>{
  const template=e.target.closest('[data-digital-template]');
});
function renderCRM(c){ return \`<td>\${Number(c.qa)||0}%</td><p><strong>Issue:</strong> \${escapeHTML(c.title)}</p>\`; }
`;
  const transformed = api.transformMain(context(), original);
  assert.ok(transformed.code.includes(api.markers.MAIN_MARKER));
  assert.ok(transformed.code.includes("selectedTrack: 'service'"));
  assert.ok(transformed.code.includes("department: 'Customer Experience'"));
  assert.ok(transformed.code.includes("roleTitle: 'Customer Service Associate'"));
  assert.ok(transformed.code.includes('salary: 170000'));
  assert.ok(transformed.code.includes('calloriaRenderPlatformOperationsV686()'));
  assert.ok(transformed.code.includes('data-calloria-support-update-v686'));
  assert.ok(transformed.code.includes('function calloriaSupportNowV686()'));
  assert.ok(transformed.code.includes('simulationDateNow()'));
  assert.ok(transformed.code.includes('The SLA clock follows the in-game clock.'));
  assert.ok(transformed.code.includes('enabled cloud-employment sync'));
  assert.ok(!transformed.code.includes('Data is stored locally and mirrored into the CALLORIA CRM.'));
  assert.ok(transformed.code.includes("systemId!=='finacle'"));
  syntaxCheck(transformed.code, 'main.fixture.mjs');
  assert.equal(api.transformMain(context(), transformed.code), null, 'transformation should be idempotent');
});

test('tolerates upstream applicant-default changes and anchors service UI to the current Workforce heading', () => {
  const alreadyRebased = `
const SYSTEMS = [{id:'icc',name:'ICC',purpose:'Queue'}];
const state = { applicationSubmitted:false, stage:'applicant', hired:false, applicantName:'', systemEvents:[], cases:[], currentView:'workforce' };
const escapeHTML = value => String(value ?? '');
const toast = () => {};
const renderView = () => {};
const saveState = () => {};
const pushOperationEvent = () => {};
const createSystemEvent = (events, systemId) => events.push({systemId});
function initialState(){ return { selectedTrack: 'service', department: 'Customer Experience', roleTitle: 'Customer Experience Associate', salary: 185000, }; }
function loadState(parsed){ const migrated = { ...initialState(), ...parsed }; return migrated; }
function renderWorkforce() {
  const markup = \`<section class="panel"><div class="grid three">\${SYSTEMS.map(s=>\`<article>\${s.name}</article>\`).join('')}</div>
         <h4 style="margin-top:16px">System activity</h4>
         \${state.systemEvents.slice(-8).reverse().map(e=>e.systemId).join('')}
         Connected workflow practice using synthetic records only. No real banking systems or transactions.</section>\`;
  return markup;
}
function launch(){ switch('launch-system'){ case 'launch-system': { const system=SYSTEMS.find(x=>x.id==='icc'); if(!system)break; return system; } } }
document.addEventListener('click',e=>{
  const template=e.target.closest('[data-digital-template]');
});
function renderCRM(c){ return \`<td>\${Number(c.qa)||0}%</td><p><strong>Issue:</strong> \${escapeHTML(c.title)}</p>\`; }
`;
  const transformed = api.transformMain(context(), alreadyRebased);
  assert.ok(transformed.code.includes(api.markers.MAIN_MARKER));
  assert.ok(transformed.code.includes("selectedTrack: 'service'"));
  assert.ok(transformed.code.includes("department: 'Customer Experience'"));
  assert.ok(transformed.code.includes('calloriaRenderPlatformOperationsV686()'));
  assert.ok(transformed.code.includes('<h4 style="margin-top:16px">System activity</h4>'));
  assert.ok(transformed.code.indexOf('calloriaRenderPlatformOperationsV686()') < transformed.code.indexOf('<h4 style="margin-top:16px">System activity</h4>'));
  syntaxCheck(transformed.code, 'main-already-rebased.fixture.mjs');
});

test('fails closed when source anchors drift', () => {
  assert.throws(() => api.transformMain(context(), 'const initialState = () => ({ });'), /source rebase failed/i);
});
