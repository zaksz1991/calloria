import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/202611070002_calloria_employment_persistence.sql', import.meta.url), 'utf8');
const sync = await readFile(new URL('../js/cloud-employment-sync.js', import.meta.url), 'utf8');
const main = await readFile(new URL('../js/main.js', import.meta.url), 'utf8');
const platform = await readFile(new URL('../js/cloud-platform.js', import.meta.url), 'utf8');

test('employment snapshot table is organisation- and user-scoped with membership foreign key', () => {
  assert.match(migration, /unique \(organization_id, user_id, record_type, record_key\)/);
  assert.match(migration, /foreign key \(organization_id, user_id\)[\s\S]+references public\.organization_memberships/);
  assert.match(migration, /payload jsonb not null[\s\S]+pg_column_size\(payload\) <= 900000/);
});

test('employment records enforce RLS and expose read access only through authenticated policy', () => {
  assert.match(migration, /alter table public\.calloria_employment_records enable row level security/);
  assert.match(migration, /revoke all on table public\.calloria_employment_records from anon, authenticated/);
  assert.match(migration, /create policy calloria_employment_records_read[\s\S]+for select to authenticated/);
  assert.match(migration, /user_id = auth\.uid\(\)[\s\S]+operations:read/);
});

test('snapshot writes are authenticated, membership-checked and size-limited', () => {
  assert.match(migration, /create or replace function public\.save_calloria_employment_snapshot/);
  assert.match(migration, /m\.user_id = v_user and m\.status = 'active'/);
  assert.match(migration, /pg_column_size\(p_payload\) > 900000/);
  assert.match(migration, /revoke all on function public\.save_calloria_employment_snapshot/);
  assert.match(migration, /grant execute on function public\.save_calloria_employment_snapshot\(uuid, jsonb\) to authenticated/);
});

test('client loads and saves tenant-scoped employment snapshots through Supabase', () => {
  assert.match(sync, /from\('calloria_employment_records'\)/);
  assert.match(sync, /save_calloria_employment_snapshot/);
  assert.match(sync, /MAX_SNAPSHOT_BYTES = 900_000/);
  assert.match(sync, /syncReady/);
  assert.match(main, /markCloudEmploymentSyncReady\(\)/);
  assert.match(main, /scheduleCloudEmploymentSave\(state\)/);
  assert.match(main, /loadCloudEmploymentSnapshot\(\)/);
  assert.match(main, /configureCloudEmploymentSync\(\{userId:detail\.userId,organizationId:detail\.organizationId\}\)/);
  assert.match(platform, /getCloudSupabaseClient/);
});
