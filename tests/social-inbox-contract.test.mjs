import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('Meta webhook validates the raw request body using X-Hub-Signature-256', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  assert.match(source, /x-hub-signature-256/i);
  assert.match(source, /crypto\.subtle\.importKey\('raw'.*HMAC/s);
  assert.match(source, /verifyMetaSignature\(raw/);
});

test('Meta webhook verification token is independent from the app secret', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  assert.match(source, /CALLORIA_META_VERIFY_TOKEN/);
  assert.match(source, /hub\.verify_token/);
  assert.match(source, /CALLORIA_META_APP_SECRET/);
});

test('provider account tokens and Graph API hosts remain server-side', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  const page = await read('social-inbox.html');
  assert.match(source, /CALLORIA_META_SOCIAL_ACCOUNTS_JSON/);
  assert.match(source, /graph\.facebook\.com/);
  assert.match(source, /graph\.instagram\.com/);
  assert.doesNotMatch(page, /accessToken|META_APP_SECRET|SOCIAL_INBOX_DATA_KEY/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(accessToken|META_APP_SECRET)/i);
});

test('staff inbox requires explicit social channel and assignment checks', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  assert.match(source, /grant\.channels\.includes\('social'\)/);
  assert.match(source, /route\.assigned_to!==user\.id/);
  assert.match(source, /route\.required_skills\|\|\[\]\)\.every/);
  assert.match(source, /required_skills/);
  assert.match(source, /CALLORIA_ROUTING_ACCESS/);
});

test('outbound social messaging enforces the standard 24-hour window', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  const migration = await read('supabase/migrations/202611080017_calloria_social_inbox.sql');
  assert.match(source, /reply_window_expires_at/);
  assert.match(source, /24-hour messaging window has expired/i);
  assert.match(migration, /last_customer_message_at <= now\(\) - interval '24 hours'/i);
});

test('replies reserve a unique idempotency key before provider send', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  const migration = await read('supabase/migrations/202611080017_calloria_social_inbox.sql');
  assert.match(source, /calloria_social_prepare_reply/);
  assert.match(source, /calloria_social_finish_reply/);
  assert.match(source, /state:'uncertain'/);
  assert.match(migration, /calloria_social_client_message_unique/);
  assert.match(migration, /calloria_social_one_pending_outbound/);
  assert.match(migration, /previous social reply has an unresolved delivery result/i);
  assert.match(migration, /delivery_state = 'sending'/);
});

test('migration creates only isolated social tables and restricts browser privileges', async () => {
  const sql = await read('supabase/migrations/202611080017_calloria_social_inbox.sql');
  assert.match(sql, /create table if not exists public\.calloria_social_conversations/i);
  assert.match(sql, /create table if not exists public\.calloria_social_messages/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /revoke all on public\.calloria_social_conversations, public\.calloria_social_messages from public, anon, authenticated/i);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.profiles|alter table public\.profiles/i);
  assert.match(sql, /create table if not exists public\.calloria_social_conversations/i);
  assert.match(sql, /create table if not exists public\.calloria_social_messages/i);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.(?:profiles|organizations|organization_memberships|organization_invitations|organization_policies|organization_audit)/i);
});

test('incoming events are deduplicated before opening or updating a route', async () => {
  const sql = await read('supabase/migrations/202611080017_calloria_social_inbox.sql');
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(p_provider \|\| ':' \|\| p_provider_message_id/i);
  assert.match(sql, /calloria_social_provider_message_unique/);
  assert.match(sql, /calloria_route_create_request/);
});

test('Meta messaging integration excludes comments, publishing and marketing broadcasts', async () => {
  const source = await read('supabase/functions/calloria-social-inbox/index.ts');
  assert.match(source, /messagePayload/);
  assert.doesNotMatch(source, /feed_post|comment_id|marketing_messages|publish\b/i);
  assert.match(source, /message:\{text\}/);
  assert.match(source, /calloria_route_consume_limit/);
  assert.match(source, /p_limit:20/);
  assert.match(source, /another reply has an unresolved delivery result/i);
});

test('new page is included in multi-page build, TypeScript checks and Supabase config', async () => {
  const vite = await read('vite.config.js');
  const packageJson = JSON.parse(await read('package.json'));
  const config = await read('supabase/config.toml');
  const tsconfig = JSON.parse(await read('tsconfig.edge.json'));
  assert.match(vite, /socialInbox: resolve\(process\.cwd\(\), 'social-inbox\.html'\)/);
  assert.match(packageJson.scripts.check, /js\/social-inbox-workbench\.js/);
  assert.match(config, /\[functions\.calloria-social-inbox\][\s\S]*?verify_jwt = false/);
  assert.ok(tsconfig.include.includes('supabase/functions/calloria-social-inbox/**/*.ts'));
});

test('all channel pages provide a path to the Social Inbox', async () => {
  for (const page of ['agent-desk.html','whatsapp-inbox.html','email-inbox.html','live-chat-inbox.html']) {
    assert.match(await read(page), /href="\/social-inbox\.html"/);
  }
});
