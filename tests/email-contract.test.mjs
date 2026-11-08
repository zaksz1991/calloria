import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('provider webhook validates Svix signature over raw body before parsing', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /await request\.text\(\)/);
  assert.match(source, /verifySvixSignature\(/);
  assert.ok(source.indexOf('verifySvixSignature(') < source.indexOf('event=JSON.parse(raw)'));
  assert.match(source, /svix-id/);
  assert.match(source, /svix-timestamp/);
  assert.match(source, /svix-signature/);
});

test('inbound payload body is retrieved from Resend API, not expected in webhook metadata', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /\/emails\/receiving\//);
  assert.match(source, /Authorization:`Bearer \$\{RESEND_API_KEY\}`/);
  assert.match(source, /getPlainEmailBody\(email\)/);
  assert.match(source, /result\?\.data&&typeof result\.data==='object'\?result\.data:result/);
});

test('inbound email is limited to configured aliases and encrypted before persistence', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /CALLORIA_EMAIL_INBOUND_ADDRESSES/);
  assert.match(source, /destinations\.find\(address=>INBOUND_ADDRESSES\.includes\(address\)\)/);
  assert.match(source, /encryptData\(sender\.address\)/);
  assert.match(source, /encryptData\(body\)/);
  assert.match(source, /encryptAgentSummary\(summary\)/);
});

test('route creation binds inbound messages to the email channel and existing router', () => {
  const sql = read('supabase/migrations/202611080015_calloria_email_channel.sql');
  assert.match(sql, /calloria_route_create_request\(/);
  assert.match(sql, /p_route_ref,p_department,'email'/);
  assert.match(sql, /calloria_email_create_or_attach_route/);
});

test('staff permissions require explicit email channel and department assignment checks', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /grant\.channels\.includes\('email'\)/);
  assert.match(source, /route\.channel!=='email'/);
  assert.match(source, /grant\.role==='agent'&&route\.assigned_to!==user\.id/);
});

test('outbound replies use Resend, include threading headers and block ambiguous retries', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /https:\/\/api\.resend\.com\/emails/);
  assert.match(source, /headers\['In-Reply-To'\]/);
  assert.match(source, /headers\['References'\]/);
  assert.match(source, /provider_status:'unknown'/);
  assert.match(source, /CALLORIA will not retry it automatically/);
});

test('SQL isolates all sensitive channel tables behind RLS and service-role-only grants', () => {
  const sql = read('supabase/migrations/202611080015_calloria_email_channel.sql');
  for (const table of ['calloria_email_threads','calloria_email_messages','calloria_email_webhook_events','calloria_email_send_limits']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'));
    assert.match(sql, new RegExp(`grant all on public\\.${table} to service_role`, 'i'));
  }
  assert.match(sql, /revoke all on function public\.calloria_email_purge_expired\(\) from public, anon, authenticated/i);
});

test('Email Inbox HTML contains all browser workbench selectors and no duplicate IDs', () => {
  const html = read('email-inbox.html');
  const script = read('js/email-inbox-workbench.js');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const referenced = [...script.matchAll(/\$\('#([^']+)'\)/g)].map(match=>match[1]);
  for (const id of new Set(referenced)) assert.ok(ids.includes(id), `Missing HTML id: ${id}`);
});

test('multi-page Vite build includes Email Inbox and prior WhatsApp entry', () => {
  const vite = read('vite.config.js');
  assert.match(vite, /emailInbox: resolve\(process\.cwd\(\), 'email-inbox\.html'\)/);
  assert.match(vite, /whatsappInbox: resolve\(process\.cwd\(\), 'whatsapp-inbox\.html'\)/);
});

test('Agent Desk and WhatsApp Inbox link to the Email Inbox', () => {
  assert.match(read('agent-desk.html'), /href="\/email-inbox\.html"/);
  assert.match(read('whatsapp-inbox.html'), /href="\/email-inbox\.html"/);
});

test('Supabase function config keeps WhatsApp and adds public webhook entry with internal auth', () => {
  const config = read('supabase/config.toml');
  assert.match(config, /\[functions\.calloria-whatsapp\]\s*verify_jwt = false/);
  assert.match(config, /\[functions\.calloria-email\]\s*verify_jwt = false/);
  assert.match(read('tsconfig.edge.json'), /calloria-email/);
});

test('email replies persist provider Message-ID values for future inbound thread matching', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  const sql = read('supabase/migrations/202611080015_calloria_email_channel.sql');
  assert.match(source, /https:\/\/api\.resend\.com\/emails\/\$\{encodeURIComponent\(emailId\)\}/);
  assert.match(source, /fetchSentMessageId\(result\.id\)/);
  assert.match(source, /contains\('reference_ids',\[referenceId\]\)/);
  assert.match(source, /calloria_email_add_thread_reference/);
  assert.match(sql, /create or replace function public\.calloria_email_add_thread_reference/);
  assert.match(sql, /limit 40/);
});

test('email inbox metric label does not claim every assigned thread belongs to the current agent', () => {
  const html = read('email-inbox.html');
  assert.match(html, /Assigned threads in scope/);
  assert.doesNotMatch(html, /Assigned to you/);
});


test('outbound Reply-To is validated as a mailbox before being sent to the provider', () => {
  const source = read('supabase/functions/calloria-email/index.ts');
  assert.match(source, /const replyTo=EMAIL_REPLY_TO\?parseMailbox\(EMAIL_REPLY_TO\)\?\.address:null/);
  assert.match(source, /if\(EMAIL_REPLY_TO&&!replyTo\)return/);
  assert.match(source, /if\(replyTo\)payload\.reply_to=replyTo/);
});
