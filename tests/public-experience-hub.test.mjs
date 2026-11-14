import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformCalloriaPublicExperienceHtml, calloriaPublicExperienceHubPlugin } from '../build/calloria-public-experience-hub-v6-55.mjs';

const main = await readFile(new URL('./fixtures/index.html', import.meta.url), 'utf8');
const care = await readFile(new URL('./fixtures/customer-care.html', import.meta.url), 'utf8');

test('main landing page positions CALLORIA for play, learning and product discovery', () => {
  const result = transformCalloriaPublicExperienceHtml(main);
  assert.match(result, /Play for fun\./);
  assert.match(result, /CHOOSE WHAT YOU WANT TO DO NEXT/);
    assert.match(result, /Learn &amp; get guidance/);
  assert.match(result, /Discover RuffNeck/);
  assert.match(result, /Ready to enquire\?/);
  assert.match(result, /id="launchPlayButton"/);
  assert.match(result, /No registration required/);
});

test('public links preserve the existing game launch and lightweight-mode controls', () => {
  const result = transformCalloriaPublicExperienceHtml(main);
  assert.match(result, /id="launchPlayButton"/);
  assert.match(result, /id="launchDeskButton"[^>]*>LIGHTWEIGHT MODE/);
  assert.match(result, /id="enterFloorButton"/);
});

test('immersive users can reach guidance and product destinations without leaving the game tab', () => {
  const result = transformCalloriaPublicExperienceHtml(main);
  assert.match(result, /class="immersive-guide-link" href="\/customer-care\.html" target="_blank"/);
  assert.match(result, /id="exitFloorButton"/);
});

test('customer care page exposes stable learning and product anchors', () => {
  const result = transformCalloriaPublicExperienceHtml(care, '/customer-care.html');
  assert.match(result, /id="learning-and-guidance"/);
  assert.match(result, /id="services-and-quotations"/);
  assert.match(result, /id="ready-to-start"/);
  assert.match(result, /id="ruffneck-platforms"/);
  assert.match(result, /Explore, learn and get help with RuffNeck/);
  assert.match(result, /Browse first\. Decide when ready\./);
  assert.match(result, /Staff sign-in/);
});

test('all six current RuffNeck product destinations remain in the directory', () => {
  const result = transformCalloriaPublicExperienceHtml(care);
  for (const domain of ['ruffneck-lms.vercel.app', 'ruffneck-prospector.vercel.app', 'ruffneck-connect.vercel.app', 'ruffneck-social-hub.vercel.app', 'kano-run.vercel.app', 'kano-keke.vercel.app']) {
    assert.ok(result.includes(domain), `Missing destination ${domain}`);
  }
});

test('transformation is idempotent', () => {
  const once = transformCalloriaPublicExperienceHtml(main);
  const twice = transformCalloriaPublicExperienceHtml(once);
  assert.equal(twice, once);
});

test('unrelated HTML pages are unchanged', () => {
  const other = '<!doctype html><html><head></head><body><main>Staff only</main></body></html>';
  assert.equal(transformCalloriaPublicExperienceHtml(other, '/workforce.html'), other);
});

test('plugin exposes a post-order HTML transform hook', () => {
  const plugin = calloriaPublicExperienceHubPlugin();
  assert.equal(plugin.name, 'calloria-public-experience-hub-v6-55');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transformIndexHtml.order, 'post');
  assert.equal(typeof plugin.transformIndexHtml.handler, 'function');
});
