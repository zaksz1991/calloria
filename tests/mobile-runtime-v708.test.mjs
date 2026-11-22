import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '..', 'calloria-mobile-runtime-v6-80.css');
const indexPath = resolve(here, '..', 'index.html');
const fixtureIndexPath = resolve(here, '..', 'fixtures', 'index-head-v708.html');
const css = readFileSync(cssPath, 'utf8');
const html = readFileSync(existsSync(indexPath) ? indexPath : fixtureIndexPath, 'utf8');

function balancedCss(source) {
  let depth = 0;
  let quote = null;
  let comment = false;
  let escaped = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (comment) {
      if (ch === '*' && next === '/') { comment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '*') { comment = true; i += 1; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0 && quote === null && !comment;
}

test('index already references the restored mobile runtime stylesheet', () => {
  assert.match(html, /href=["']\/calloria-mobile-runtime-v6-80\.css["']/i);
});

test('restored stylesheet is non-empty and structurally balanced', () => {
  assert.ok(css.length > 2500);
  assert.equal(balancedCss(css), true);
});

test('global shell and view containers cannot force a wider mobile viewport', () => {
  for (const selector of ['.app-shell', '.main-area', '.content-wrap', '.view-root', '#viewRoot']) {
    assert.ok(css.includes(selector), `Missing responsive guard for ${selector}`);
  }
  assert.match(css, /overflow-x:\s*clip/);
  assert.match(css, /max-width:\s*100%/);
});

test('assessment workspace is constrained to one mobile column', () => {
  assert.match(css, /\.assessment-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/s);
  assert.match(css, /\.assessment-footer\s*\.btn\s*\{[^}]*min-height:\s*50px/s);
  assert.match(css, /\.answer-option\s*\{[^}]*width:\s*100%/s);
});

test('mobile inputs use readable sizing and full-width containment', () => {
  assert.match(css, /font-size:\s*16px/);
  assert.match(css, /min-height:\s*46px/);
  assert.match(css, /box-sizing:\s*border-box/);
});

test('wide tables scroll within their own wrappers', () => {
  assert.match(css, /\.table-wrap[^}]*overflow-x:\s*auto/s);
  assert.match(css, /\.promise-control-table[^}]*overflow-x:\s*auto/s);
});

test('command centre launcher clears the mobile bottom navigation', () => {
  assert.match(css, /body:not\(\.calloria-game-launch\):not\(\.calloria-game-playing\) \.calloria-command-launcher[\s\S]*?bottom:\s*calc\(var\(--calloria-mobile-nav-clearance\) \+ 8px\)\s*!important/);
});

test('command centre panel fits dynamic mobile viewport and safe areas', () => {
  assert.match(css, /\.calloria-command-panel[\s\S]*?height:\s*100dvh/);
  assert.match(css, /padding-bottom:\s*max\(12px,\s*env\(safe-area-inset-bottom/);
  assert.match(css, /\.calloria-command-panel \.calloria-command-metrics\s*\{[^}]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
});

test('modal and toast layers remain clear of device safe areas', () => {
  assert.match(css, /\.modal-backdrop[\s\S]*?env\(safe-area-inset-top/);
  assert.match(css, /\.modal\s*\{[\s\S]*?max-height:\s*calc\(100dvh/);
  assert.match(css, /\.toast-host[\s\S]*?bottom:\s*calc\(var\(--calloria-mobile-nav-clearance\)/);
});

test('narrow phones receive a one-column metric fallback', () => {
  assert.match(css, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.ops-summary-grid,[\s\S]*?\.calloria-command-panel \.calloria-command-metrics[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test('short landscape touch devices receive dedicated layout constraints', () => {
  assert.match(css, /@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*520px\)\s*and\s*\(pointer:\s*coarse\)/);
});

test('reduced-motion preference is respected', () => {
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /animation-duration:\s*\.01ms/);
});
