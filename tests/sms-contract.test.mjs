import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const read = path => readFile(resolve(process.cwd(), path), 'utf8');

test('SMS inbox is registered as a multi-page app entry and function', async () => {
  const vite = await read('vite.config.js');
  const config = await read('supabase/config.toml');
  const html = await read('sms-inbox.html');
  assert.match(vite, /smsInbox:\s*resolve\(process\.cwd\(\),\s*'sms-inbox\.html'\)/);
  assert.match(config, /\[functions\.calloria-sms\][\s\S]*?verify_jwt\s*=\s*false/);
  assert.match(html, /\/js\/sms-inbox-workbench\.js/);
  assert.match(html, /\/routing-control\.html/);
});

test('routing and agent workbench channel contracts include SMS', async () => {
  const agentEngine = await read('js/agent-desk-engine.js');
  const routingEngine = await read('js/routing-engine.js');
  const agentHtml = await read('agent-desk.html');
  const routing = await read('supabase/functions/calloria-contact-routing/index.ts');
  const agentDesk = await read('supabase/functions/calloria-agent-desk/index.ts');
  assert.match(agentEngine, /'whatsapp',\s*'sms'/);
  assert.match(routingEngine, /'whatsapp',\s*'sms'/);
  assert.match(agentHtml, /<option value="sms">SMS<\/option>/);
  assert.match(agentHtml, /href="\/sms-inbox\.html">SMS Inbox/);
  assert.match(routing, /'whatsapp','sms'/);
  assert.match(agentDesk, /'whatsapp','sms'/);
});

test('every included channel permission validator accepts the SMS grant', async () => {
  const files = [
    'supabase/functions/calloria-agent-desk/index.ts',
    'supabase/functions/calloria-contact-routing/index.ts',
    'supabase/functions/calloria-whatsapp/index.ts',
    'supabase/functions/calloria-email/index.ts',
    'supabase/functions/calloria-web-chat/index.ts',
    'supabase/functions/calloria-social-inbox/index.ts',
    'supabase/functions/calloria-voice-telephony/index.ts'
  ];
  for (const file of files) {
    const source = await read(file);
    assert.match(source, /'whatsapp'\s*,\s*'sms'/, `${file} must accept sms in staff grants`);
  }
});

test('database migration isolates SMS storage and locks browser access', async () => {
  const sql = await read('supabase/migrations/202611080019_calloria_sms_channel.sql');
  for (const table of ['calloria_sms_threads','calloria_sms_messages','calloria_sms_suppressions','calloria_sms_preferences','calloria_sms_webhook_events','calloria_sms_send_limits']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
  assert.match(sql, /p_command='STOP'/);
  assert.match(sql, /p_command='START'/);
  assert.match(sql, /requiresNewCustomerMessage/);
  assert.match(sql, /last_inbound <= v_last_start/);
  assert.match(sql, /calloria_sms_purge_expired/);
  assert.match(sql, /retention_due_at <= now\(\)/);
});

test('STOP blocks incoming messages and START never grants marketing consent', async () => {
  const sql = await read('supabase/migrations/202611080019_calloria_sms_channel.sql');
  assert.match(sql, /if exists\(select 1 from public\.calloria_sms_suppressions where phone_hash=p_phone_hash\) then[\s\S]*?outcome='ignored'/);
  assert.match(sql, /'marketingConsent',false/);
  assert.match(sql, /suppression_source='staff_action'/);
});

test('provider delivery and send paths never fall back to generic or bulk messaging', async () => {
  const edge = await read('supabase/functions/calloria-sms/index.ts');
  const engine = await read('js/sms-engine.js');
  assert.match(edge, /channel:'dnd'/);
  assert.match(edge, /TERMII_DND_ROUTE_ENABLED/);
  assert.doesNotMatch(edge, /api\/sms\/send\/bulk/);
  assert.doesNotMatch(edge, /channel\s*:\s*'generic'/);
  assert.match(engine, /channel: 'dnd'/);
  assert.doesNotMatch(engine, /channel: 'generic'/);
});

test('Termii webhook verification uses the signed raw payload and HMAC-SHA512', async () => {
  const engine = await read('js/sms-engine.js');
  const edge = await read('supabase/functions/calloria-sms/index.ts');
  assert.match(engine, /hash: 'SHA-512'/);
  assert.match(edge, /X-Termii-Signature/);
  assert.match(edge, /verifyTermiiWebhookSignature\(raw/);
});

test('SMS permission extensions do not touch Prospector-specific database objects', async () => {
  const sql = await read('supabase/migrations/202611080019_calloria_sms_channel.sql');
  assert.doesNotMatch(sql, /public\.(profiles|organizations|organization_memberships|organization_policies)/i);
  assert.match(sql, /alter table public\.calloria_ops_work_items/);
  assert.match(sql, /alter table public\.calloria_route_requests/);
});

test('SMS inbox reconciles crashed sends into an unknown state before exposing the queue', async () => {
  const sql = await read('supabase/migrations/202611080019_calloria_sms_channel.sql');
  const edge = await read('supabase/functions/calloria-sms/index.ts');
  assert.match(sql, /calloria_sms_reconcile_stale_sends/);
  assert.match(sql, /status='unknown'[\s\S]*?stale_send_requires_provider_check/);
  assert.match(sql, /created_at < now\(\) - interval '3 minutes'/);
  assert.match(sql, /calloria_sms_messages_stale_sends_idx/);
  assert.match(sql, /grant execute on function public\.calloria_sms_reconcile_stale_sends\(\) to service_role/);
  assert.match(edge, /admin\.rpc\('calloria_sms_reconcile_stale_sends'\)/);
  assert.match(edge, /avoid unsafe retries/);
});

test('Termii delivery reports that arrive before the send response are reconciled later', async () => {
  const sql = await read('supabase/migrations/202611080019_calloria_sms_channel.sql');
  assert.match(sql, /provider_message_id text,[\s\S]*?delivery_status text/);
  assert.match(sql, /where event_kind='delivery_report' and provider_message_id=p_provider_message_id and delivery_status is not null/);
  assert.match(sql, /update public\.calloria_sms_webhook_events set outcome='processed',processed_at=now\(\)[\s\S]*?provider_message_id=p_provider_message_id/);
  assert.match(sql, /outcome=case when v_updated>0 then 'processed' else 'received' end/);
});

test('SMS inbox displays a character encoding and message-segment estimate before sending', async () => {
  const html = await read('sms-inbox.html');
  const workbench = await read('js/sms-inbox-workbench.js');
  const engine = await read('js/sms-engine.js');
  assert.match(html, /id="sms-length-info"/);
  assert.match(workbench, /estimateSmsSegments/);
  assert.match(workbench, /longer messages may cost more/);
  assert.match(engine, /GSM7_EXTENDED/);
  assert.match(engine, /UCS-2/);
});
