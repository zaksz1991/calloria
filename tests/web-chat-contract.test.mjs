import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('website widget supports all six exact first-party origins through a public origin allowlist', () => {
  const source = read('supabase/functions/calloria-web-chat/index.ts');
  for (const host of ['ruffneck-lms.vercel.app','ruffneck-prospector.vercel.app','ruffneck-connect.vercel.app','ruffneck-social-hub.vercel.app','kano-run.vercel.app','kano-keke.vercel.app']) assert.ok(source.includes(host));
  assert.match(source, /CALLORIA_WEB_CHAT_ALLOWED_ORIGINS/);
  assert.match(source, /ANON_ORIGINS\.includes\(origin\)/);
});

test('public chat is guest-first but requires random visitor token and origin-bound session validation', () => {
  const source = read('supabase/functions/calloria-web-chat/index.ts');
  assert.match(source, /randomHex\(32\)/);
  assert.match(source, /visitor_token_hash/);
  assert.match(source, /conversation\.origin !== origin/);
  assert.match(source, /safeEqual\(conversation\.visitor_token_hash, await sha256\(token\)\)/);
  assert.match(source, /action === 'start_chat'/);
  assert.match(source, /return await publicHistory\(admin, origin!, body\)/);
  assert.match(source, /action === 'send_message'/);
});

test('all message content is encrypted at rest and initial Agent Desk summary uses the existing key derivation', () => {
  const source = read('supabase/functions/calloria-web-chat/index.ts');
  assert.match(source, /CALLORIA_WEB_CHAT_DATA_KEY/);
  assert.match(source, /CALLORIA_WEB_CHAT_LOOKUP_SECRET/);
  assert.match(source, /CALLORIA_AGENT_DESK_ENCRYPTION_SECRET/);
  assert.match(source, /CALLORIA-AGENT-DESK-v1/);
  assert.match(source, /encryptData\(input\.message\)/);
  assert.match(source, /encryptData\(text\)/);
});

test('new conversations create a live_chat routing item atomically with the first encrypted message', () => {
  const sql = read('supabase/migrations/202611080016_calloria_web_chat.sql');
  assert.match(sql, /calloria_route_create_request\(/);
  assert.match(sql, /'live_chat'/);
  assert.match(sql, /calloria_webchat_create_conversation/);
  assert.match(sql, /insert into public\.calloria_webchat_messages/);
  assert.match(sql, /set search_path = ''/);
});

test('web chat tables have RLS enabled and browser privileges revoked', () => {
  const sql = read('supabase/migrations/202611080016_calloria_web_chat.sql');
  for (const table of ['calloria_webchat_conversations','calloria_webchat_messages','calloria_webchat_rate_limits']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(sql, new RegExp(table));
  }
  assert.match(sql, /revoke all on public\.calloria_webchat_conversations, public\.calloria_webchat_messages, public\.calloria_webchat_rate_limits from public, anon, authenticated/);
});

test('agents cannot open an unassigned chat and replies are blocked until route assignment', () => {
  const source = read('supabase/functions/calloria-web-chat/index.ts');
  assert.match(source, /grant\.channels\.includes\('live_chat'\)/);
  assert.match(source, /grant\.role === 'agent' && route\.assigned_to !== user\.id/);
  assert.match(source, /route\.required_skills/);
  assert.match(source, /permission\.route\.status !== 'assigned'/);
});

test('message handling is rate-limited and bounded, without file upload endpoints', () => {
  const source = read('supabase/functions/calloria-web-chat/index.ts');
  assert.match(source, /consumeLimit\(admin, fingerprint, 5, 10 \* 60\)/);
  assert.match(source, /consumeLimit\(admin, fingerprint, 15, 60\)/);
  assert.match(source, /calloria_webchat_add_message/);
  assert.doesNotMatch(source, /upload\(|storage\.from\(/);
});

test('customer and staff UI render customer text with textContent rather than injecting HTML', () => {
  const widget = read('widgets/calloria-chat.js');
  const workbench = read('js/live-chat-inbox-workbench.js');
  assert.match(widget, /bubble\.append\(node\('div', '', message\.text\)\)/);
  assert.match(workbench, /body\.textContent = message\.text/);
  assert.doesNotMatch(widget, /innerHTML\s*=/);
  assert.doesNotMatch(workbench, /innerHTML\s*=/);
});

test('Vite emits an embeddable stable widget URL and adds the live chat inbox page', () => {
  const vite = read('vite.config.js');
  assert.match(vite, /liveChatInbox: resolve\(process\.cwd\(\), 'live-chat-inbox\.html'\)/);
  assert.match(vite, /calloriaChatWidget: resolve\(process\.cwd\(\), 'widgets\/calloria-chat\.js'\)/);
  assert.match(vite, /chunk\.name === 'calloriaChatWidget' \? 'widgets\/calloria-chat\.js'/);
  for (const file of ['agent-desk.html','email-inbox.html','whatsapp-inbox.html']) assert.match(read(file), /live-chat-inbox\.html/);
});


test('public and staff message writes use a service-role-only atomic database function', () => {
  const handler = read('supabase/functions/calloria-web-chat/index.ts');
  const sql = read('supabase/migrations/202611080016_calloria_web_chat.sql');
  assert.equal((handler.match(/rpc\('calloria_webchat_add_message'/g) || []).length, 2);
  assert.match(sql, /create or replace function public\.calloria_webchat_add_message\(/);
  assert.match(sql, /from public\.calloria_webchat_conversations[\s\S]*?for update/);
  assert.match(sql, /from public\.calloria_route_requests[\s\S]*?for update/);
  assert.match(sql, /v_message_count >= 300/);
  assert.match(sql, /set last_message_at = pg_catalog\.now\(\)/);
  assert.match(sql, /revoke all on function public\.calloria_webchat_add_message\(uuid,text,text,text,uuid,text,boolean\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.calloria_webchat_add_message\(uuid,text,text,text,uuid,text,boolean\) to service_role/);
});


test('visitor and staff replies retain idempotency IDs through retries and expose the complete capped history', () => {
  const widget = read('widgets/calloria-chat.js');
  const workbench = read('js/live-chat-inbox-workbench.js');
  const handler = read('supabase/functions/calloria-web-chat/index.ts');
  assert.match(widget, /if \(!pendingMessageId\) pendingMessageId = crypto\.randomUUID\(\)/);
  assert.match(workbench, /pendingReplyIds\.get\(replyConversationId\) \|\| crypto\.randomUUID\(\)/);
  assert.match(workbench, /pendingReplyIds\.clear\(\)/);
  assert.match(handler, /clientMessageId = UUID\.test\(rawClientMessageId\)/);
  assert.match(handler, /\.limit\(300\)/);
  assert.match(handler, /error\.code === '23505'.*duplicate/);
});
