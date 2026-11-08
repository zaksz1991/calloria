import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
test('migration creates only isolated knowledge operations objects',()=>{
 const sql=read('../supabase/migrations/202611080021_calloria_knowledge_operations.sql');
 for(const name of ['calloria_km_records','calloria_km_review_events','calloria_km_announcements','calloria_km_acknowledgements','calloria_km_audit'])assert.match(sql,new RegExp(`public\\.${name}`));
 assert.match(sql,/enable row level security/);assert.match(sql,/revoke all[\s\S]*from anon, authenticated/i);assert.match(sql,/grant execute[\s\S]*to service_role/i);
 assert.doesNotMatch(sql,/drop table|truncate table|alter table public\.(profiles|organizations|organization_memberships)/i);
});
test('publication is atomic and synchronises published records to Phase 4 KB',()=>{
 const sql=read('../supabase/migrations/202611080021_calloria_knowledge_operations.sql');
 assert.match(sql,/function public\.calloria_km_publish_record/i);assert.match(sql,/insert into public\.calloria_kb_articles/i);assert.match(sql,/insert into public\.calloria_kb_platforms/i);assert.match(sql,/insert into public\.calloria_kb_services/i);
 assert.match(sql,/reviewed_by = v\.authored_by/i);assert.match(sql,/180 days/i);assert.match(sql,/v_payload->>'audience' = 'staff'[\s\S]*?status='retired'/i);
});
test('Edge Function validates the Supabase user and staff grant before actions',()=>{
 const ts=read('../supabase/functions/calloria-knowledge-operations/index.ts');
 assert.match(ts,/admin\.auth\.getUser\(token\)/);assert.match(ts,/const grant = accessMap\[user\.id\]/);assert.match(ts,/grant\.role !== 'people_admin'/);assert.match(ts,/rawBody\.length > MAX_BODY/);
});
test('Edge Function enforces two-person approval and exposes only supported types',()=>{
 const ts=read('../supabase/functions/calloria-knowledge-operations/index.ts');
 assert.match(ts,/row\.authored_by===user\.id/);assert.match(ts,/\['article','platform','service'\]/);assert.match(ts,/calloria_km_publish_record/);assert.match(ts,/status\.eq\.published,authored_by\.eq/);assert.match(ts,/containsSensitiveNotice\(.*JSON\.stringify\(payload\)/s);
});
test('customer and staff pages include knowledge navigation and Vite entry',()=>{
 const vite=read('../vite.config.js');assert.match(vite,/knowledgeOperations: resolve\(process\.cwd\(\), 'knowledge-operations\.html'\)/);
 for(const file of ['../agent-desk.html','../operations-intelligence.html'])assert.match(read(file),/knowledge-operations\.html/);
});
test('knowledge page avoids direct database writes and includes approval safeguards',()=>{
 const html=read('../knowledge-operations.html');const js=read('../js/knowledge-operations-workbench.js');
 assert.match(html,/Only independently reviewed/);assert.match(html,/7:30 AM \/ 2:00 PM/);assert.match(js,/calloria-knowledge-operations/);assert.doesNotMatch(js,/\.from\(['"]calloria_km_/);
});
test('briefing endpoints enforce staff acknowledgement and independent publishing',()=>{
 const ts=read('../supabase/functions/calloria-knowledge-operations/index.ts');
 assert.match(ts,/publish_announcement/);assert.match(ts,/acknowledged_at|calloria_km_acknowledgements/);assert.match(ts,/row\.authored_by===user\.id/);
});
