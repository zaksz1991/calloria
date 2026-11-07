import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('AI assistance is linked to the human QA workspace and requires explicit per-request consent', async () => {
  const main = await read('js/main.js');
  assert.match(main, /renderAIAssistPanel\(reviewable\)/);
  assert.match(main, /name="consent" required/);
  assert.match(main, /explicit transcript-transfer consent is required/i);
  assert.match(main, /human approval required/i);
  assert.match(main, /aiQaSuggestions/);
  assert.match(main, /saveTenantAIAssistSettings/);
  assert.match(main, /requestAIAssist/);
});

test('provider secrets are absent from browser config and only accepted by server-side function', async () => {
  const env = await read('.env.example');
  const client = await read('js/ai-assist-engine.js');
  const edge = await read('supabase/functions/calloria-ai-assist/index.ts');
  assert.doesNotMatch(env, /GROQ_API_KEY|SERVICE_ROLE|SUPABASE_SECRET_KEY|OPENAI_API_KEY/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|api\.openai\.com|Bearer\s*\+?\s*apiKey/i);
  assert.match(edge, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.match(edge, /api\.groq\.com\/openai\/v1\/chat\/completions/);
  assert.match(edge, /response_format:[\s\S]*json_schema/);
  assert.doesNotMatch(edge, /OPENAI_API_KEY|api\.openai\.com/);
  assert.match(edge, /originIsAllowed/);
  assert.match(edge, /CALLORIA_ALLOWED_ORIGINS must contain the exact permitted application origins/);
  assert.doesNotMatch(edge, /Access-Control-Allow-Origin':\s*'\*'/);
});

test('tenant AI migration applies member RLS, owner/admin settings policy and atomic daily quota checks', async () => {
  const sql = await read('supabase/migrations/202611070003_calloria_ai_assistance.sql');
  assert.match(sql, /create table if not exists public\.calloria_ai_settings/i);
  assert.match(sql, /create table if not exists public\.calloria_ai_usage/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /has_calloria_org_permission\(organization_id, 'policies:manage'\)/i);
  assert.match(sql, /consume_calloria_ai_quota/i);
  assert.match(sql, /Active organisation membership required/i);
  assert.match(sql, /where public\.calloria_ai_usage\.request_count < v_limit/i);
  assert.match(sql, /redaction_required is true/i);
  assert.match(sql, /ai-assistance-policy-updated/i);
  assert.match(sql, /updated_by = \(select auth\.uid\(\)\)/i);
  assert.match(sql, /values \([\s\S]*auth\.uid\(\),/i);
});

test('Edge Function validates a Supabase user, active tenant membership and quota before provider analysis', async () => {
  const edge = await read('supabase/functions/calloria-ai-assist/index.ts');
  assert.match(edge, /supabase\.auth\.getUser\(token\)/);
  assert.match(edge, /organization_memberships/);
  assert.match(edge, /status', 'active'/);
  assert.match(edge, /consume_calloria_ai_quota/);
  assert.match(edge, /redactText/);
  assert.match(edge, /CALLORIA_ALLOWED_ORIGINS/);
  assert.match(edge, /dataOrigin !== 'calloria_customer_lab_synthetic'/);
  assert.match(edge, /valid finalised CALLORIA Customer Lab practice interaction/i);
  assert.match(edge, /No QA record was created/);
});
