import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const migration=await readFile(new URL('../supabase/migrations/202611080020_calloria_operations_intelligence.sql',import.meta.url),'utf8');
const edge=await readFile(new URL('../supabase/functions/calloria-operations-intelligence/index.ts',import.meta.url),'utf8');
const html=await readFile(new URL('../operations-intelligence.html',import.meta.url),'utf8');
const vite=await readFile(new URL('../vite.config.js',import.meta.url),'utf8');

test('aggregate function is service-role only',()=>{assert.match(migration,/security definer/i);assert.match(migration,/revoke all on function public\.calloria_ops_intelligence_snapshot[\s\S]*from public, anon, authenticated/i);assert.match(migration,/grant execute on function public\.calloria_ops_intelligence_snapshot[\s\S]*to service_role/i);});
test('report query reads operational tables and not message content',()=>{for(const table of ['calloria_ops_work_items','calloria_wfm_attendance','calloria_perf_qa_reviews','calloria_perf_scorecards','calloria_wa_messages','calloria_email_messages','calloria_social_messages','calloria_sms_messages','calloria_voice_calls'])assert.ok(migration.includes(table),`missing ${table}`);assert.doesNotMatch(migration,/body_ciphertext|contact_ciphertext|phone_ciphertext|subject_ciphertext|summary_ciphertext|outcome_ciphertext|select\s+w\.\*/i);});
test('department and personal scope filters are applied to work data',()=>{assert.match(migration,/w\.department = any\(p_departments\)/i);assert.match(migration,/w\.assigned_to = p_staff_user_id/i);assert.match(migration,/p_staff_user_id is null or w\.assigned_to = p_staff_user_id/i);});
test('function has a bounded report period and rejects personal team aggregation',()=>{assert.match(migration,/p_since < v_now - interval '91 days'/i);assert.match(migration,/p_staff_user_id is not null and p_include_team/i);});
test('edge function derives agent scope from validated session',()=>{assert.match(edge,/admin\.auth\.getUser\(token\)/);assert.match(edge,/p_staff_user_id:team\?null:user\.id/);assert.doesNotMatch(edge,/body\.staff(User)?Id/);});
test('edge function exposes aggregate-only actions and approved ranges',()=>{assert.match(edge,/action!=='snapshot'/);assert.match(edge,/\[7,30,90\]/);assert.match(edge,/CALLORIA_ROUTING_ACCESS/);});
test('page clearly explains operational counts and privacy boundaries',()=>{assert.match(html,/not unique customer counts/i);assert.match(html,/Customer message content and contact identities are never displayed/i);});
test('multi-page Vite build includes the new command centre',()=>assert.match(vite,/operationsIntelligence:\s*resolve\(process\.cwd\(\), 'operations-intelligence\.html'\)/));
