import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { transformCalloriaPublicExperienceHtml } from '../build/calloria-public-experience-hub-v6-55.mjs';
import { transformCalloriaRuffNeckDiscoveryHtml } from '../build/calloria-ruffneck-discovery-guide-v6-56.mjs';
import { transformCalloriaSeamlessProductHandoffHtml } from '../build/calloria-seamless-product-handoff-v6-57.mjs';
import assert from 'node:assert/strict';
import {
  CALLORIA_TRY_IT_DEMOS,
  transformCalloriaTryItStudioHtml,
  calloriaTryItStudioPlugin
} from '../build/calloria-try-it-studio-v6-58.mjs';

const fixture = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<section class="calloria-discovery" id="calloria-discovery-guide" data-calloria-discovery-guide="v6.56">
  <div class="calloria-discovery-heading"><h2>Find the right place to start</h2></div>
  <fieldset class="calloria-discovery-goals"><legend>What brings you here?</legend></fieldset>
  <section class="calloria-discovery-results"><div class="calloria-discovery-product-grid"></div></section>
  <div class="calloria-discovery-footer">No sign-up.</div>
</section>
<script>
(() => {
  const card = document.createElement('article');
  const actions = document.createElement('div');
  const productId = 'learn';
  const product = { name: 'RuffNeck Learn' };
  const open = document.createElement('a');
  const ask = document.createElement('button');
  const request = document.createElement('a');
  const help = document.createElement('a');
      actions.append(open, ask, request, help);
      card.append(actions);
})();
</script>
</body></html>`;

test('v6.58 adds the guest Try-It progress strip and preview control to product cards', () => {
  const output = transformCalloriaTryItStudioHtml(fixture);
  assert.notEqual(output, fixture);
  assert.match(output, /data-calloria-try-it-studio="v6\.58"/);
  assert.match(output, /Try before you choose/);
  assert.match(output, /Explore all previews/);
  assert.match(output, /preview\.dataset\.calloriaPreview = productId/);
  assert.match(output, /Try a quick preview/);
  assert.match(output, /calloria-try-it-studio-script-v658/);
});

test('v6.58 transforms the injected browser script into valid JavaScript', () => {
  const output = transformCalloriaTryItStudioHtml(fixture);
  const match = output.match(/<script id="calloria-try-it-studio-script-v658">([\s\S]*?)<\/script>/);
  assert.ok(match, 'preview script should be injected');
  assert.doesNotThrow(() => new Function(match[1]));
});

test('all six previews contain two answerable sample tasks with one best response each', () => {
  assert.deepEqual(Object.keys(CALLORIA_TRY_IT_DEMOS), ['learn', 'prospector', 'connect', 'social', 'kanoRun', 'kanoKeke']);
  for (const [id, demo] of Object.entries(CALLORIA_TRY_IT_DEMOS)) {
    assert.ok(demo.name && demo.url && demo.platformId, `${id} has product routing metadata`);
    assert.equal(demo.tasks.length, 2, `${id} has two short tasks`);
    for (const task of demo.tasks) {
      assert.equal(task.options.length, 3, `${id} task has three choices`);
      assert.equal(task.options.filter(option => option.correct).length, 1, `${id} task has one best answer`);
      assert.ok(task.options.every(option => option.feedback), `${id} options explain the outcome`);
    }
  }
});

test('preview progress is explicitly device-local and does not post learner results to a server', () => {
  const output = transformCalloriaTryItStudioHtml(fixture);
  assert.match(output, /calloria\.public\.tryit\.v1/);
  assert.match(output, /kept in this browser/);
  assert.match(output, /window\.localStorage\.setItem/);
  assert.doesNotMatch(output, /fetch\s*\(|XMLHttpRequest|sendBeacon/);
  assert.doesNotMatch(output, /type\s*=\s*['"](?:password|email)['"]/i);
});

test('v6.58 preview completion offers official product and reviewed access-enquiry routes', () => {
  const output = transformCalloriaTryItStudioHtml(fixture);
  assert.match(output, /Open '\s*\+ demo\.name/);
  assert.match(output, /demo\.url/);
  assert.match(output, /demo\.intentUrl/);
  assert.match(output, /Nothing is sent or submitted from this preview/);
  assert.match(output, /fictional learning sample/);
});

test('v6.58 is idempotent and leaves unrelated documents unchanged', () => {
  const once = transformCalloriaTryItStudioHtml(fixture);
  assert.equal(transformCalloriaTryItStudioHtml(once), once);
  const unrelated = '<!doctype html><html><head></head><body>Public page without discovery section</body></html>';
  assert.equal(transformCalloriaTryItStudioHtml(unrelated), unrelated);
});

test('v6.58 skips safely when the previous product-card renderer anchor has changed', () => {
  const changed = fixture.replace('actions.append(open, ask, request, help);', 'actions.append(open, ask);');
  assert.equal(transformCalloriaTryItStudioHtml(changed), changed);
});

test('Vite plugin registers as a post HTML transform', () => {
  const plugin = calloriaTryItStudioPlugin();
  assert.equal(plugin.name, 'calloria-try-it-studio-v6-58');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transformIndexHtml.order, 'post');
  assert.equal(plugin.transformIndexHtml.handler(fixture), transformCalloriaTryItStudioHtml(fixture));
});


test('v6.55 through v6.58 compose on the existing customer-care page fixture', async () => {
  const source = await readFile(new URL('./fixtures/customer-care.html', import.meta.url), 'utf8');
  let output = transformCalloriaPublicExperienceHtml(source, '/customer-care.html');
  output = transformCalloriaRuffNeckDiscoveryHtml(output);
  output = transformCalloriaSeamlessProductHandoffHtml(output);
  output = transformCalloriaTryItStudioHtml(output);
  for (const marker of ['v6.55', 'v6.56', 'v6.57', 'v6.58']) assert.ok(output.includes(marker), `missing ${marker}`);
  assert.match(output, /Try a quick preview/);
  assert.match(output, /Replay preview/);
  const scripts = [...output.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 3, 'discovery, handoff and try-it scripts should be present');
  for (const script of scripts) assert.doesNotThrow(() => new Function(script[1]));
});


test('cumulative Vite configuration registers the Try-It Studio after product handoff', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  const handoff = config.indexOf('calloriaSeamlessProductHandoffPlugin()');
  const studio = config.indexOf('calloriaTryItStudioPlugin()');
  assert.ok(handoff >= 0, 'v6.57 handoff registration exists');
  assert.ok(studio > handoff, 'v6.58 runs after the handoff product-card renderer');
  assert.match(config, /import \{ calloriaTryItStudioPlugin \} from '\.\/build\/calloria-try-it-studio-v6-58\.mjs';/);
});
