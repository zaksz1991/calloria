import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditCalloriaNavigation, extractNavigationContract, extractViteHtmlEntries } from '../tools/calloria-navigation-integrity-audit.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v705-'));
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'widgets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify({ cleanUrls: true }));
  fs.writeFileSync(path.join(root, 'vite.config.js'), `import { resolve } from 'node:path';\nexport default { build: { rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), care: resolve(process.cwd(), 'customer-care.html'), widget: resolve(process.cwd(), 'widgets/calloria-chat.js') } } } };`);
  fs.writeFileSync(path.join(root, 'index.html'), `<!doctype html><html><head><link rel="stylesheet" href="/styles.css"></head><body><button data-view="overview">Home</button><button data-view="inbound">Inbound</button><section id="viewRoot"></section><a href="/customer-care">Care</a><img src="/assets/calloria.svg"><script type="module" src="/js/main.js"></script></body></html>`);
  fs.writeFileSync(path.join(root, 'customer-care.html'), `<!doctype html><html><body><a href="/">Home</a><a href="https://example.com" target="_blank" rel="noopener noreferrer">External</a></body></html>`);
  fs.writeFileSync(path.join(root, 'styles.css'), 'body{margin:0}');
  fs.writeFileSync(path.join(root, 'public', 'assets', 'calloria.svg'), '<svg/>');
  fs.writeFileSync(path.join(root, 'js', 'main.js'), `const viewRoot = $('#viewRoot');\nfunction renderView()\n{\n const config = {\n  overview: [],\n  inbound: [],\n };\n switch(state.currentView){\n  case 'overview': renderOverview(); break;\n  case 'inbound': renderInbound(); break;\n }\n saveState();\n}\nnav.closest('.nav-item[data-view]'); state.currentView = nav.dataset.view; state.currentView = 'overview';`);
  fs.writeFileSync(path.join(root, 'widgets', 'calloria-chat.js'), 'export {};');
  return root;
}

test('extracts all configured HTML entry pages but skips JS widget entries', () => {
  const entries = extractViteHtmlEntries(`main: resolve(process.cwd(), 'index.html'),\ncare: resolve(process.cwd(), 'customer-care.html'),\nwidget: resolve(process.cwd(), 'widgets/calloria-chat.js')`);
  assert.deepEqual(entries.map((entry) => entry.source), ['index.html', 'customer-care.html']);
});

test('extracts navigation buttons, metadata, switch cases and literal view assignments', () => {
  const index = `<button data-view="overview"></button><button data-view="inbound"></button><section id="viewRoot"></section>`;
  const main = `const viewRoot = $('#viewRoot');\nfunction renderView(){\n const config = {\n overview: [],\n inbound: [],\n };\n switch(state.currentView){\n  case 'overview': break;\n  case 'inbound': break;\n }\n saveState();\n}\nnav.closest('.nav-item[data-view]'); state.currentView = nav.dataset.view; state.currentView='overview';`;
  const contract = extractNavigationContract(index, main);
  assert.deepEqual(contract.navViews, ['overview', 'inbound']);
  assert.deepEqual(contract.configViews, ['overview', 'inbound']);
  assert.deepEqual(contract.switchViews, ['overview', 'inbound']);
  assert.deepEqual(contract.literalAssignments, ['overview']);
  assert.equal(contract.mainHasNavClickBinding, true);
});

test('passes a valid multi-page route and application-view graph', () => {
  const root = fixture();
  try {
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.equal(report.htmlEntries.length, 2);
    assert.equal(report.navigation.navViews.length, 2);
    assert.equal(report.checkedLocalReferences, 5);
    assert.equal(report.brokenReferences.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when a local route or asset is missing', () => {
  const root = fixture();
  try {
    fs.writeFileSync(path.join(root, 'customer-care.html'), `<html><body><a href="/missing-route">Bad route</a><img src="/assets/missing.svg"></body></html>`);
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.ok, false);
    assert.equal(report.brokenReferences.length, 2);
    assert.match(report.errors.join(' '), /missing-route/);
    assert.match(report.errors.join(' '), /missing\.svg/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when a home navigation view is absent from the render configuration', () => {
  const root = fixture();
  try {
    const mainFile = path.join(root, 'js', 'main.js');
    fs.writeFileSync(mainFile, fs.readFileSync(mainFile, 'utf8').replace("inbound: [],", ''));
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(' '), /inbound.*metadata/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('fails when a render switch case has no corresponding page metadata', () => {
  const root = fixture();
  try {
    const mainFile = path.join(root, 'js', 'main.js');
    fs.writeFileSync(mainFile, fs.readFileSync(mainFile, 'utf8').replace("case 'inbound': renderInbound(); break;", "case 'legacy': renderLegacy(); break;"));
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.ok, false);
    assert.match(report.errors.join(' '), /legacy.*metadata/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('honours Vercel cleanUrls when resolving extensionless HTML routes', () => {
  const root = fixture();
  try {
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.cleanUrls, true);
    assert.equal(report.brokenReferences.length, 0);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('tolerates ordinary whitespace changes around the view switch', () => {
  const index = `<button data-view="home"></button><section id="viewRoot"></section>`;
  const main = `const viewRoot = $('#viewRoot');
function renderView() {
 const config = {
  home: [],
 };
 switch ( state.currentView ) {
  case 'home': renderHome(); break;
 }
 saveState();
}`;
  const contract = extractNavigationContract(index, main);
  assert.deepEqual(contract.switchViews, ['home']);
});
