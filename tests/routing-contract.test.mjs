import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('customer routing page exposes only essential request fields and one-time tracking',()=>{
  const html=read('support-router.html');
  for(const id of ['platform-options','intent','language','subject','summary','storage-consent','route-form','track-form','track-reference','track-token']) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(html,/Guest access/);
  assert.match(html,/does not start a live telephone call/);
  assert.doesNotMatch(html,/type="email"|type="tel"/);
});

test('Customer Care retains its Phase 6 case creation and tracking workflow',()=>{
  const html=read('customer-care.html');
  for(const id of ['case-open-button','case-track-toggle','case-lookup-form','case-create-form','case-subject','case-description','case-consent']) assert.ok(html.includes(`id=\"${id}\"`),`missing case workflow element ${id}`);
  assert.match(html,/support-router\.html/);
});

test('routing page and control dashboard have distinct module entry points',()=>{
  assert.match(read('support-router.html'),/support-router-workbench\.js/);
  assert.match(read('routing-control.html'),/routing-control-workbench\.js/);
  assert.match(read('agent-desk.html'),/routing-control\.html/);
});

test('Vite build inputs preserve earlier pages and add both routing pages',()=>{
  const config=read('vite.config.js');
  for(const page of ['index.html','customer-care.html','case-desk.html','customer-360.html','agent-desk.html','workforce.html','performance.html','sales-desk.html','support-router.html','routing-control.html']) assert.ok(config.includes(page),`missing Vite entry ${page}`);
});

test('Edge Function uses separate secrets, encrypted request bodies and staff bearer checks',()=>{
  const fn=read('supabase/functions/calloria-contact-routing/index.ts');
  for(const term of ['CALLORIA_AGENT_DESK_ENCRYPTION_SECRET','CALLORIA_ROUTING_ACCESS','CALLORIA_ROUTING_RATE_SALT','admin.auth.getUser(token)','AES-GCM','calloria_route_create_request','calloria_route_claim_next','HMAC','general_customer_care']) assert.ok(fn.includes(term),`missing ${term}`);
  assert.doesNotMatch(fn,/GROQ_API_KEY|CALLORIA_CUSTOMER_CARE_GROQ_API_KEY|CALLORIA_ROUTING_ENCRYPTION_SECRET/);
});

test('SQL creates isolated routing objects and atomically claims the existing work item',()=>{
  const sql=read('supabase/migrations/202611070013_calloria_contact_routing.sql');
  assert.match(sql,/calloria_route_requests/);
  assert.match(sql,/calloria_route_events/);
  assert.match(sql,/calloria_route_rate_limits/);
  assert.match(sql,/for update of q, w skip locked/i);
  assert.match(sql,/current_activity = 'customer_work'/);
  assert.match(sql,/q\.department = v_shift_department/);
  assert.match(sql,/pg_advisory_xact_lock\(hashtextextended\(p_agent_id::text, 120013\)\)/);
  assert.match(sql,/calloria_route_sync_work_item_status/);
  assert.match(sql,/calloria_route_guard_claim/);
  assert.match(sql,/calloria\.route_claim_authorized/);
  assert.match(sql,/request_requeued/);
  assert.match(sql,/calloria_route_purge_closed/);
  assert.match(sql,/retention_due_at/);
  assert.match(sql,/status = 'completed'/);
  assert.match(sql,/w\.status in \('pending','escalated'\) and w\.assigned_to is null/);
  assert.match(sql,/revoke all on public\.calloria_route_requests, public\.calloria_route_events, public\.calloria_route_rate_limits from public, anon, authenticated/i);
  assert.doesNotMatch(sql,/drop table|truncate table/i);
  const deletedTables=[...sql.matchAll(/delete\s+from\s+public\.([a-z0-9_]+)/gi)].map(match=>match[1]);
  assert.deepEqual(deletedTables,['calloria_route_rate_limits','calloria_ops_work_items']);
  assert.match(sql,/using public\.calloria_route_requests r[\s\S]*r\.status in \('completed','abandoned','cancelled'\)[\s\S]*r\.retention_due_at <= now\(\)/);
});

test('function configuration retains prior function entries and adds guest routing',()=>{
  const config=read('supabase/config.toml');
  for(const name of ['calloria-ai-assist','calloria-game-telemetry','calloria-customer-care','calloria-case-desk','calloria-customer-360','calloria-agent-desk','calloria-workforce','calloria-performance','calloria-sales-desk','calloria-contact-routing']) assert.ok(config.includes(`[functions.${name}]`),`missing ${name}`);
  assert.match(config,/\[functions\.calloria-contact-routing\]\s*verify_jwt = false/);
});

test('TypeScript edge check includes the routing function',()=>{
  assert.match(read('tsconfig.edge.json'),/calloria-contact-routing/);
});


test('guest-routed Agent Desk work cannot bypass skills and Workforce routing',()=>{
  const edge=read('supabase/functions/calloria-agent-desk/index.ts');
  const ui=read('js/agent-desk-workbench.js');
  assert.match(edge,/startsWith\('CR-'\).*Routing Control/s);
  assert.match(ui,/routeManaged/);
  assert.match(ui,/claim it from Routing Control/);
});


test('routing access map requires the customer-care foundation skill and keyed request fingerprints',()=>{
  const fn=read('supabase/functions/calloria-contact-routing/index.ts');
  assert.match(fn,/skills\.includes\('general_customer_care'\)/);
  assert.match(fn,/importKey\('raw'.*HMAC/s);
  assert.match(fn,/crypto\.subtle\.sign\('HMAC'/);
  assert.match(fn,/role==='people_admin'.*cannot claim customer interactions/s);
});


test('Agent Desk release clears ownership so routed requests return to Routing Control',()=>{
  const edge=read('supabase/functions/calloria-agent-desk/index.ts');
  const ui=read('js/agent-desk-workbench.js');
  assert.match(edge,/next==='pending'.*patch\.assigned_to=null; patch\.claimed_at=null/s);
  assert.match(ui,/Release back to queue/);
  assert.match(read('supabase/migrations/202611070013_calloria_contact_routing.sql'),/new\.status in \('pending','escalated'\) and new\.assigned_to is null[\s\S]*status = 'queued'/);
});
