import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditCalloriaNavigation } from '../tools/calloria-navigation-integrity-audit.mjs';

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'calloria-v706-'));
  fs.mkdirSync(path.join(root, 'js'), { recursive: true });
  fs.mkdirSync(path.join(root, 'public'), { recursive: true });
  fs.writeFileSync(path.join(root, 'vercel.json'), JSON.stringify({ cleanUrls: true }));
  fs.writeFileSync(path.join(root, 'vite.config.js'), `export default { publicDir: 'public', build: { outDir: 'dist', rollupOptions: { input: { main: resolve(process.cwd(), 'index.html'), support: resolve(process.cwd(), 'support-router.html') } } } };`);
  fs.writeFileSync(path.join(root, 'index.html'), `<html><body><button data-view="home"></button><main id="viewRoot"></main><script type="module" src="/js/main.js"></script></body></html>`);
  fs.writeFileSync(path.join(root, 'support-router.html'), `<html><body><a href="/privacy.html">Privacy information</a></body></html>`);
  fs.writeFileSync(path.join(root, 'js', 'main.js'), `const viewRoot = $('#viewRoot');\nfunction renderView() {\n const config = {\n  home: [],\n };\n switch(state.currentView) {\n  case 'home': break;\n }\n saveState();\n}\nnav.closest('.nav-item[data-view]'); state.currentView = nav.dataset.view;`);
  return root;
}

test('the reported /privacy.html link resolves from public/privacy.html', () => {
  const root = makeFixture();
  try {
    const sourcePrivacy = fs.readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
    fs.writeFileSync(path.join(root, 'public', 'privacy.html'), sourcePrivacy);
    const report = auditCalloriaNavigation({ root });
    assert.equal(report.ok, true, report.errors.join('\n'));
    assert.equal(report.brokenReferences.length, 0);
    assert.ok(fs.statSync(path.join(root, 'public', 'privacy.html')).isFile());
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('Vite public directory is configured to publish the privacy file at the site root', () => {
  const root = makeFixture();
  try {
    const config = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
    assert.match(config, /publicDir:\s*['\"]public['\"]/);
    assert.match(config, /outDir:\s*['\"]dist['\"]/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('privacy page links back to real public support and simulator routes', () => {
  const html = fs.readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  for (const route of ['/support-router.html', '/customer-care.html', '/']) {
    assert.ok(html.includes(`href="${route}"`), `privacy page should link to ${route}`);
  }
});

test('privacy page explains separate AI and formal support data flows', () => {
  const html = fs.readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
  assert.match(html, /Groq/);
  assert.match(html, /Zero Data Retention/);
  assert.match(html, /storage-consent|storage-consent/i);
  assert.match(html, /AES-GCM/);
  assert.match(html, /one-time access code/i);
});
