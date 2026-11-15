import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { transformCalloriaPublicExperienceHtml } from '../build/calloria-public-experience-hub-v6-55.mjs';
import { transformCalloriaRuffNeckDiscoveryHtml } from '../build/calloria-ruffneck-discovery-guide-v6-56.mjs';
import {
  SUPPORT_PLATFORM_IDS,
  transformCalloriaSeamlessProductHandoffHtml,
  transformCalloriaSupportRouterWorkbench,
  calloriaSeamlessProductHandoffPlugin
} from '../build/calloria-seamless-product-handoff-v6-57.mjs';

const careFixture = await readFile(new URL('./fixtures/customer-care.html', import.meta.url), 'utf8');
const routerFixture = await readFile(new URL('./fixtures/support-router-workbench.js', import.meta.url), 'utf8');
const v655Care = transformCalloriaPublicExperienceHtml(careFixture, '/customer-care.html');
const v656Care = transformCalloriaRuffNeckDiscoveryHtml(v655Care);

 test('product discovery cards receive direct access/pricing and existing-user support routes', () => {
  const result = transformCalloriaSeamlessProductHandoffHtml(v656Care);
  assert.match(result, /data-calloria-seamless-handoff="v6\.57"/);
  assert.match(result, /Access \/ pricing/);
  assert.match(result, /Product support/);
  assert.match(result, /intent=sales_enquiry/);
  assert.match(result, /intent=platform_support/);
  assert.match(result, /Ask CALLORIA/);
  assert.match(result, /Open official destination/);
});

test('all six discovery products map to the exact IDs supported by CALLORIA routing', () => {
  assert.deepEqual(Object.values(SUPPORT_PLATFORM_IDS).sort(), [
    'kano-keke','kano-run','ruffneck-connect','ruffneck-learn','ruffneck-prospector','ruffneck-social-hub'
  ].sort());
  const result = transformCalloriaSeamlessProductHandoffHtml(v656Care);
  for (const id of Object.values(SUPPORT_PLATFORM_IDS)) assert.ok(result.includes(`'${id}'`) || result.includes(`"${id}"`));
});

test('formal handoff is explicit and is never automatically submitted', () => {
  const result = transformCalloriaSeamlessProductHandoffHtml(v656Care);
  assert.match(result, /nothing is submitted automatically/i);
  assert.match(result, /intent=sales_enquiry/);
  assert.doesNotMatch(result, /requestSubmit\(|\.submit\(\)/);
});

test('support-router prefill selects only a known platform and an allowlisted intent', () => {
  const result = transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/support-router-workbench.js');
  assert.match(result, /URLSearchParams\(window\.location\.search\)/);
  assert.match(result, /PLATFORMS\.find\(item => item\.id === platformId\)/);
  assert.match(result, /sales_enquiry/);
  assert.match(result, /platform_support/);
  assert.match(result, /account_access/);
  assert.match(result, /technical_support/);
  assert.match(result, /selectedPlatform = product\.id/);
  assert.match(result, /renderPlatforms\(\)/);
  assert.match(result, /intentSelect\.value = intent/);
});

test('prefill templates are product-specific, credential-safe and length-bounded', () => {
  const result = transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/support-router-workbench.js');
  assert.match(result, /product\.name \+ ' access and pricing enquiry'/);
  assert.match(result, /Do not ask me to share a password, PIN, OTP or recovery code/);
  assert.match(result, /\.slice\(0, 140\)/);
  assert.match(result, /\.slice\(0, 600\)/);
});

test('prefill tells the visitor to review and consent, and contains no automatic submit action', () => {
  const result = transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/support-router-workbench.js');
  assert.match(result, /Nothing is submitted until you give consent and press Submit/);
  assert.match(result, /storage-consent/);
  assert.match(result, /Consent is required to store and route this support request/);
  assert.match(result, /Review and edit the details/);
  assert.doesNotMatch(result, /requestSubmit\(|route-form.*\.submit\(/);
});

test('unknown module paths are not transformed', () => {
  assert.equal(transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/customer-care-workbench.js'), null);
  assert.equal(transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/other.js'), null);
});

test('missing v6.56 or source anchors fail loudly rather than silently dropping the handoff', () => {
  assert.throws(() => transformCalloriaSeamlessProductHandoffHtml('<section id="calloria-discovery-guide"></section>'), /v6.56 product-card action block/);
  assert.throws(() => transformCalloriaSupportRouterWorkbench('const unrelated = true;', '/repo/js/support-router-workbench.js'), /support-router initial render call/);
});

test('HTML and module transformations are idempotent', () => {
  const once = transformCalloriaSeamlessProductHandoffHtml(v656Care);
  assert.equal(transformCalloriaSeamlessProductHandoffHtml(once), once);
  const moduleOnce = transformCalloriaSupportRouterWorkbench(routerFixture, '/repo/js/support-router-workbench.js');
  assert.equal(transformCalloriaSupportRouterWorkbench(moduleOnce, '/repo/js/support-router-workbench.js'), moduleOnce);
});

test('unrelated HTML remains unchanged', () => {
  const unrelated = '<html><head></head><body><main>Operations</main></body></html>';
  assert.equal(transformCalloriaSeamlessProductHandoffHtml(unrelated), unrelated);
});

test('CSS preserves mobile wrapping and accessible focus indication', () => {
  const result = transformCalloriaSeamlessProductHandoffHtml(v656Care);
  assert.match(result, /max-width:740px/);
  assert.match(result, /focus-visible/);
  assert.match(result, /aria-label/);
});

test('Vite plugin registers both the customer-care handoff and support-router module bridge', () => {
  const plugin = calloriaSeamlessProductHandoffPlugin();
  assert.equal(plugin.name, 'calloria-seamless-product-handoff-v6-57');
  assert.equal(plugin.enforce, 'post');
  assert.equal(plugin.transformIndexHtml.order, 'post');
  assert.equal(typeof plugin.transform, 'function');
});

test('replacement Vite configuration registers v6.57 after the v6.56 discovery guide', async () => {
  const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(config, /calloria-seamless-product-handoff-v6-57\.mjs/);
  assert.ok(config.indexOf('calloriaRuffNeckDiscoveryGuidePlugin()') < config.indexOf('calloriaSeamlessProductHandoffPlugin()'));
});
