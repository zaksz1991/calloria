import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');

test('voice migration is isolated, RLS protected and service-role only',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  assert.match(sql,/calloria_voice_calls/); assert.match(sql,/calloria_voice_callback_approvals/);
  assert.match(sql,/enable row level security/i); assert.match(sql,/revoke all .* from public, anon, authenticated/i);
  assert.doesNotMatch(sql,/drop table|truncate |delete from public\.calloria_/i);
  assert.match(sql,/calloria_route_create_request/);
  assert.match(sql,/calloria_wfm_attendance/);
});

test('callback approval is required, time-bounded, and distinct from callback dispatch',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  assert.match(sql,/status text not null default 'pending'/);
  assert.match(sql,/v_row\.status <> 'pending'/);
  assert.match(sql,/p_callback_ref/);
  assert.match(sql,/v_callback\.status <> 'approved'/);
  assert.match(sql,/v_callback\.used_at is not null/);
  assert.match(sql,/interval '7 days'/);
  assert.match(sql,/v_callback\.requested_by <> p_staff_user_id/);
});

test('outbound callback approval matches phone HMAC and consumes the authorization',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  assert.match(sql,/v_callback\.phone_lookup_hash <> p_phone_lookup_hash/);
  assert.match(sql,/update public\.calloria_voice_callback_approvals set status='used',used_at=now\(\)/);
  assert.match(sql,/v_outbound_count >= 10/);
});

test('provider call creation is server-side with callback events and no recording instructions',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/api\.signals\.pressone\.africa\/2010-04-01/);
  assert.match(edge,/Authorization:`Basic \$\{auth\}`/);
  assert.match(edge,/StatusCallbackEvent/);
  assert.match(edge,/X-Twilio-Signature|x-twilio-signature/i);
  assert.doesNotMatch(edge,/<Record|record="record-from-start"/i);
  assert.doesNotMatch(edge,/console\.(log|info|debug)\(/);
});

test('voice webhook validates the exact public URL and signed form fields',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/CALLORIA_VOICE_PUBLIC_URL/);
  assert.match(edge,/requestUrl\.search/);
  assert.match(edge,/Object\.keys\(params\)\.sort\(\)/);
  assert.match(edge,/HMAC.*SHA-1|hash:'SHA-1'/);
  assert.match(edge,/verifySignalsRequest\(request,form\)/);
});

test('staff API revalidates Supabase session and voice channel permission',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/admin\.auth\.getUser\(token\)/);
  assert.match(edge,/grant\.channels\.includes\('voice'\)/);
  assert.match(edge,/CALLORIA_ROUTING_ACCESS/);
});

test('inbound route only rings a configured, language and skill eligible on-call handset',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/CALLORIA_VOICE_RING_GROUPS_JSON/);
  assert.match(edge,/grant\.languages\.includes\(language\)/);
  assert.match(edge,/grant\.skills\.includes\(selected\.skill\)/);
  assert.match(edge,/calloria_voice_agent_ready/);
});

test('provider configuration is merged and the new console is a Vite entry',()=>{
  const config=read('supabase/config.toml');
  const vite=read('vite.config.js');
  const pkg=JSON.parse(read('package.json'));
  const tsc=JSON.parse(read('tsconfig.edge.json'));
  assert.match(config,/\[functions\.calloria-voice-telephony\]/);
  assert.match(vite,/voice-console\.html/);
  assert.ok(pkg.scripts.check.includes('js/voice-console-workbench.js'));
  assert.ok(tsc.include.some(v=>v.includes('calloria-voice-telephony')));
});

test('voice console warns that recording is disabled and no browser softphone is included',()=>{
  const html=read('voice-console.html');
  assert.match(html,/Call recording: OFF/);
  assert.match(html,/browser softphone/);
  assert.match(html,/supervisor-approved/);
  assert.match(html,/voice-console-workbench\.js/);
});


test('inbound and outbound voice operations reserve a handset atomically and include concurrent calls in WFM capacity',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  const inbound=sql.slice(sql.indexOf('create or replace function public.calloria_voice_reserve_inbound_dial'),sql.indexOf('revoke all on function public.calloria_voice_reserve_inbound_dial'));
  const outbound=sql.slice(sql.indexOf('create or replace function public.calloria_voice_reserve_outbound'),sql.indexOf('revoke all on function public.calloria_voice_reserve_outbound'));
  assert.match(inbound,/pg_advisory_xact_lock/);
  assert.match(inbound,/inbound_dial_started_at is not null/);
  assert.match(outbound,/pg_advisory_xact_lock/);
  assert.match(outbound,/calloria_voice_agent_ready/);
  assert.match(sql,/v_voice_active/);
});

test('provider webhook action URLs are bound to the call SID and registered call direction',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/actionCallSid!==callSid/);
  assert.match(edge,/parentCall\.direction!=='inbound'/);
  assert.match(edge,/call not registered/);
});

test('status callback events cannot create orphan events or regress a later provider state',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  const fn=sql.slice(sql.indexOf('create or replace function public.calloria_voice_update_status'),sql.indexOf('revoke all on function public.calloria_voice_update_status'));
  assert.match(fn,/select \* into v_call .*for update/);
  assert.match(fn,/if not found then return false/);
  assert.match(fn,/p_sequence_number > status_sequence/);
  assert.match(sql,/status=case when status_sequence < 0 then p_status else status end/);
});

test('CORS preflight returns a null body for HTTP 204 and business caller ID must be an owned number',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/status===204\?null/);
  assert.match(edge,/businessNumberOwned/);
  assert.match(edge,/incomingNumbers\.some\(row=>row\.number===businessNumber\)/);
});


test('inbound IVR is recorded as already answered when the voice URL is called and stale callbacks cannot regress it',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  const fn=sql.slice(sql.indexOf('create or replace function public.calloria_voice_start_inbound'),sql.indexOf('revoke all on function public.calloria_voice_start_inbound'));
  assert.match(fn,/'inbound', 'in_progress', 2/);
  assert.match(sql,/p_sequence_number > status_sequence/);
});


test('callback approval is unique while pending or approved for the same case and customer',()=>{
  const sql=read('supabase/migrations/202611080018_calloria_voice_telephony.sql');
  assert.match(sql,/unique index if not exists calloria_voice_callback_active_route_phone_uniq/);
  assert.match(sql,/where status in \('pending','approved'\)/);
});

test('callback sending rechecks department, required skill, language and route channel',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/grant\.languages\.includes\(route\.language\)/);
  assert.match(edge,/route\.channel!=='voice'/);
  assert.match(edge,/p_max_concurrency:grant\.maxConcurrency/);
  assert.match(edge,/select\('route_ref,department,channel,language,status,assigned_to,required_skills'\)/);
});

test('Signals status callback only accepts documented lifecycle sequence values',()=>{
  const edge=read('supabase/functions/calloria-voice-telephony/index.ts');
  assert.match(edge,/sequence>3/);
  assert.match(edge,/StatusCallbackEvent/);
  assert.match(edge,/\['initiated','ringing','answered','completed'\]/);
});
