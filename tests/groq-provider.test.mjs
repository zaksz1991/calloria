import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');

test('CALLORIA AI selects only the two supported Groq GPT-OSS models', async () => {
  const engine = await read('js/ai-assist-engine.js');
  const edge = await read('supabase/functions/calloria-ai-assist/index.ts');
  assert.match(engine, /openai\/gpt-oss-20b/);
  assert.match(engine, /openai\/gpt-oss-120b/);
  assert.match(edge, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.match(edge, /https:\/\/api\.groq\.com\/openai\/v1\/chat\/completions/);
  assert.match(edge, /response_format:[\s\S]*json_schema/);
});

test('Groq secrets are not exposed through Vercel client variables or committed env examples', async () => {
  const env = await read('.env.example');
  const html = await read('index.html');
  const engine = await read('js/ai-assist-engine.js');
  const edge = await read('supabase/functions/calloria-ai-assist/index.ts');
  assert.doesNotMatch(env, /GROQ_API_KEY/);
  assert.doesNotMatch(html, /GROQ_API_KEY/);
  assert.doesNotMatch(engine, /GROQ_API_KEY|api\.groq\.com/);
  assert.match(edge, /Deno\.env\.get\('GROQ_API_KEY'\)/);
  assert.doesNotMatch(edge, /OPENAI_API_KEY|api\.openai\.com/);
});

test('AI assistance continues to require authentication, tenant membership, redaction and human approval', async () => {
  const edge = await read('supabase/functions/calloria-ai-assist/index.ts');
  assert.match(edge, /supabase\.auth\.getUser\(token\)/);
  assert.match(edge, /organization_memberships/);
  assert.match(edge, /consume_calloria_ai_quota/);
  assert.match(edge, /redactText/);
  assert.match(edge, /humanApprovalRequired: true/);
});
