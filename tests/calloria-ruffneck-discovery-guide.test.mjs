import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformCalloriaPublicExperienceHtml } from '../build/calloria-public-experience-hub-v6-55.mjs';
import {
  CALLORIA_DISCOVERY_GOALS,
  CALLORIA_DISCOVERY_PRODUCTS,
  transformCalloriaRuffNeckDiscoveryHtml,
  calloriaRuffNeckDiscoveryGuidePlugin
} from '../build/calloria-ruffneck-discovery-guide-v6-56.mjs';

const care = await readFile(new URL('./fixtures/customer-care.html', import.meta.url), 'utf8');
const landing = await readFile(new URL('./fixtures/index.html', import.meta.url), 'utf8');
const v655Landing = transformCalloriaPublicExperienceHtml(landing, '/index.html');
const v655Care = transformCalloriaPublicExperienceHtml(care, '/customer-care.html');

 test('adds a guided destination finder to the existing public customer-care product directory', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  assert.match(result, /id="calloria-discovery-guide"/);
  assert.match(result, /Find the right place to start/);
  assert.match(result, /What brings you here\?/);
  assert.match(result, /id="ruffneck-platforms"/);
  assert.ok(result.indexOf('id="calloria-discovery-guide"') < result.indexOf('id="ruffneck-platforms"'));
});


test('landing-page product discovery opens the guided chooser instead of skipping directly to product cards', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Landing);
  assert.match(result, /href="\/customer-care\.html#calloria-discovery-guide"/);
  assert.doesNotMatch(result, /href="\/customer-care\.html#ruffneck-platforms"/);
  assert.match(result, /id="launchPlayButton"/);
});

test('offers clear choices for entertainment, learning, business, community, social media and full exploration', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  for (const goal of ['play', 'learn', 'business', 'community', 'social', 'explore']) {
    assert.match(result, new RegExp(`data-calloria-goal="${goal}"`));
    assert.ok(CALLORIA_DISCOVERY_GOALS[goal]);
  }
});

test('each recommendation points to current official RuffNeck destinations', () => {
  const urls = Object.values(CALLORIA_DISCOVERY_PRODUCTS).map(product => product.url);
  assert.deepEqual(urls.sort(), [
    'https://kano-keke.vercel.app/',
    'https://kano-run.vercel.app/',
    'https://ruffneck-connect.vercel.app/',
    'https://ruffneck-lms.vercel.app/',
    'https://ruffneck-prospector.vercel.app/',
    'https://ruffneck-social-hub.vercel.app/'
  ].sort());
  assert.deepEqual(CALLORIA_DISCOVERY_GOALS.play.products, ['kanoRun', 'kanoKeke']);
  assert.deepEqual(CALLORIA_DISCOVERY_GOALS.business.products, ['prospector', 'social']);
  assert.deepEqual(CALLORIA_DISCOVERY_GOALS.explore.products.length, 6);
});

test('visitor can ask CALLORIA about a recommendation before opening an external product', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  assert.match(result, /data-calloria-ask-about/);
  assert.match(result, /document\.querySelector\('#question'\)/);
  assert.match(result, /questionInput\.value = askPrompt\(product\)/);
  assert.match(result, /questionInput\.focus\(\)/);
  assert.doesNotMatch(result, /questionInput\.form\.requestSubmit/);
});

test('dynamic destination links use new tabs with opener protections', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  assert.match(result, /open\.target = '_blank'/);
  assert.match(result, /open\.rel = 'noopener noreferrer'/);
  assert.match(result, /Open official destination/);
});

test('the discovery guide does not collect personal details, create accounts or simulate payment', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  assert.match(result, /No sign-up\. No contact details/);
  assert.match(result, /Product access, registration, plans and payment are handled by the official product site/);
  assert.doesNotMatch(result, /localStorage|sessionStorage|navigator\.sendBeacon|fetch\(/);
  assert.doesNotMatch(result, /price\s*[:=]\s*['"`]?\d/i);
});

test('the guide supports screen readers and keyboard users', () => {
  const result = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  assert.match(result, /aria-labelledby="calloria-discovery-title"/);
  assert.match(result, /aria-live="polite"/);
  assert.match(result, /aria-pressed="false"/);
  assert.match(result, /:focus-visible/);
  assert.match(result, /prefers-reduced-motion:reduce/);
});

test('transformation is idempotent', () => {
  const once = transformCalloriaRuffNeckDiscoveryHtml(v655Care);
  const twice = transformCalloriaRuffNeckDiscoveryHtml(once);
  assert.equal(twice, once);
});

test('unrelated pages and pages without the v6.55 product anchor remain unchanged', () => {
  const other = '<!doctype html><html><head></head><body><main>Staff sign-in</main></body></html>';
  assert.equal(transformCalloriaRuffNeckDiscoveryHtml(other), other);
  assert.equal(transformCalloriaRuffNeckDiscoveryHtml(care), care);
});

test('plugin is a post-order HTML transform', () => {
  const plugin = calloriaRuffNeckDiscoveryGuidePlugin();
  assert.equal(plugin.name, 'calloria-ruffneck-discovery-guide-v6-56');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transformIndexHtml.order, 'post');
  assert.equal(typeof plugin.transformIndexHtml.handler, 'function');
});

test('Vite registers the discovery guide after the public experience hub', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-ruffneck-discovery-guide-v6-56\.mjs/);
  assert.ok(config.indexOf('calloriaPublicExperienceHubPlugin()') < config.indexOf('calloriaRuffNeckDiscoveryGuidePlugin()'));
});
