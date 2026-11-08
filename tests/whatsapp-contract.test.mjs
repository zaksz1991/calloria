import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('WhatsApp Edge Function verifies Meta signature before parsing raw request body', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  const verify = source.indexOf("verifyMetaSignature(raw,request.headers.get('x-hub-signature-256')||'')");
  const parse = source.indexOf('const payload=JSON.parse(raw);');
  assert.ok(verify >= 0 && parse > verify);
  assert.match(source, /x-hub-signature-256/);
  assert.match(source, /CALLORIA_META_APP_SECRET/);
});

test('staff operations require Supabase Auth plus an approved WhatsApp channel grant', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  assert.match(source, /admin\.auth\.getUser\(token\)/);
  assert.match(source, /grant\.channels\.includes\('whatsapp'\)/);
  assert.match(source, /route\.assigned_to!==user\.id/);
  assert.match(source, /People administrators do not have access to customer message content/);
});

test('free-form sends are blocked outside Meta 24-hour service window and on opt-out', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  assert.match(source, /getServiceWindow\(conversation\.last_inbound_at,Date\.now\(\)\)/);
  assert.match(source, /The 24-hour WhatsApp customer-service window is closed/);
  assert.match(source, /conversation\.messaging_opt_out/);
});

test('message and contact payloads use encrypted fields, not plaintext body columns', async () => {
  const migration = await read('supabase/migrations/202611070014_calloria_whatsapp_channel.sql');
  assert.match(migration, /contact_ciphertext text not null/);
  assert.match(migration, /body_ciphertext text not null/);
  assert.doesNotMatch(migration, /\bbody_text\s+text/i);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /revoke all on public\.calloria_wa_messages from public, anon, authenticated/);
});

test('inbound messages are linked to existing skills routing and Agent Desk flow', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  const migration = await read('supabase/migrations/202611070014_calloria_whatsapp_channel.sql');
  assert.match(source, /calloria_wa_create_or_attach_route/);
  assert.match(migration, /public\.calloria_route_create_request/);
  assert.match(migration, /p_department,'whatsapp',p_platform_id/);
  assert.match(source, /CALLORIA_AGENT_DESK_ENCRYPTION_SECRET/);
});

test('the Vite page input, Agent Desk link and restricted function config are present', async () => {
  const vite = await read('vite.config.js');
  const desk = await read('agent-desk.html');
  const config = await read('supabase/config.toml');
  assert.match(vite, /whatsappInbox: resolve\(process\.cwd\(\), 'whatsapp-inbox\.html'\)/);
  assert.match(desk, /\/whatsapp-inbox\.html/);
  assert.match(config, /\[functions\.calloria-whatsapp\]\s+verify_jwt = false/);
});

test('public UI has no secret input and renders message bodies through textContent', async () => {
  const html = await read('whatsapp-inbox.html');
  const workbench = await read('js/whatsapp-inbox-workbench.js');
  assert.doesNotMatch(html, /Meta access token|App Secret|CALLORIA_WHATSAPP_DATA_KEY|type="password"[^>]*name="api/i);
  assert.match(workbench, /content\.textContent = message\.body/);
  assert.match(workbench, /Select the source of the customer/);
});


test('webhooks are scoped to the configured Meta phone number', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  assert.match(source, /value\?\.metadata\?\.phone_number_id/);
  assert.match(source, /===metaPhoneNumberId/);
  assert.match(source, /!metaPhoneNumberId/);
});

test('STOP and START are treated as messaging controls rather than support tickets', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  assert.match(source, /const optOutCommand=/);
  assert.match(source, /const resumeCommand=/);
  assert.match(source, /if\(!optOutCommand&&!resumeCommand&&!messageRow\.route_ref\) await ensureRoute/);
});

test('consent opt-ins require a staff-attributed non-sensitive evidence reference', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  const html = await read('whatsapp-inbox.html');
  const migration = await read('supabase/migrations/202611070014_calloria_whatsapp_channel.sql');
  assert.match(source, /evidenceRef\.length<3/);
  assert.match(html, /consent-evidence-reference/);
  assert.match(migration, /marketing_consent_evidence_ref text/);
  assert.match(migration, /service_followup_consent_evidence_ref text/);
});

test('WhatsApp retention has an explicit, service-role-only purge entry point', async () => {
  const migration = await read('supabase/migrations/202611070014_calloria_whatsapp_channel.sql');
  assert.match(migration, /retention_due_at timestamptz not null default \(now\(\) \+ interval '180 days'\)/);
  assert.match(migration, /calloria_wa_purge_expired/);
  assert.match(migration, /grant execute on function public\.calloria_wa_purge_expired\(\) to service_role/);
});


test('WhatsApp Edge Function bundles its helper inside its own deployable function directory', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  const helper = await read('supabase/functions/calloria-whatsapp/whatsapp-engine.ts');
  assert.match(source, /from '\.\/whatsapp-engine\.ts'/);
  assert.match(helper, /WHATSAPP_SERVICE_WINDOW_MS/);
  assert.match(helper, /getMetaInboundMessages/);
  assert.match(helper, /classifyWhatsAppMessage/);
});


test('staff permission map validates WhatsApp channels, departments, general skill and language scopes', async () => {
  const source = await read('supabase/functions/calloria-whatsapp/index.ts');
  assert.match(source, /STAFF_CHANNELS/);
  assert.match(source, /STAFF_SKILLS/);
  assert.match(source, /general_customer_care/);
  assert.match(source, /SUPPORTED_LANGUAGES\.includes/);
});
