import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const css = readFileSync(resolve(root, 'public/calloria-mobile-runtime-v6-80.css'), 'utf8');
const guard = readFileSync(resolve(root, 'public/js/calloria-mobile-world-guard-v6-80.js'), 'utf8');

test('mobile runtime stylesheet loads after the existing performance stylesheet', () => {
  const performanceIndex = html.indexOf('href="/performance-mobile.css"');
  const runtimeIndex = html.indexOf('href="/calloria-mobile-runtime-v6-80.css"');
  assert.ok(performanceIndex >= 0, 'existing performance stylesheet remains linked');
  assert.ok(runtimeIndex > performanceIndex, 'v6.80 overrides load after existing mobile styles');
});

test('mobile viewport guard loads before the main application module', () => {
  const guardIndex = html.indexOf('src="/js/calloria-mobile-world-guard-v6-80.js"');
  const mainIndex = html.indexOf('type="module" src="/js/main.js"');
  assert.ok(guardIndex >= 0, 'v6.80 runtime guard is present');
  assert.ok(mainIndex > guardIndex, 'guard executes before production-world is imported');
});

test('launch screen is hidden whenever launch mode is not the active app state', () => {
  assert.match(css, /body:not\(\.calloria-game-launch\)\s+#gameLaunchScreen/);
  assert.match(css, /body\.calloria-assessment-mode\s+#gameLaunchScreen/);
  assert.match(css, /body\.calloria-game-playing\s+#gameLaunchScreen/);
});

test('mobile immersive canvas uses the visual viewport and safe-area controls', () => {
  assert.match(css, /--calloria-v680-visible-height:\s*100dvh/);
  assert.match(css, /body\.calloria-immersive\s+\.world-panel\.is-immersive\s+#worldCanvas/);
  assert.match(css, /env\(safe-area-inset-bottom/);
  assert.match(css, /touch-game-button\.interact/);
});

test('mobile gameplay no longer displays the blocking GLB diagnostics card', () => {
  assert.match(css, /body\.calloria-immersive\s+#calloriaGlbAudit\s*\{\s*display:\s*none\s*!important;/);
  assert.match(css, /\/asset-inspector\.html/);
});

test('IntersectionObserver correction is scoped to the immersive world canvas', () => {
  assert.match(guard, /entry\.target\?\.id\s*!==\s*'worldCanvas'/);
  assert.match(guard, /classList\.contains\('calloria-immersive'\)/);
  assert.match(guard, /notifyWorldIntersection\(host\)/);
  assert.match(guard, /__calloriaTargets\?\.has\(host\)/);
});

test('viewport guard listens for mobile browser viewport and visibility changes', () => {
  assert.match(guard, /visualViewport\?\.addEventListener\('resize'/);
  assert.match(guard, /visualViewport\?\.addEventListener\('scroll'/);
  assert.match(guard, /addEventListener\('orientationchange'/);
  assert.match(guard, /addEventListener\('visibilitychange'/);
});
