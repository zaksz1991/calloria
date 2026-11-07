import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CLOUD_DEFAULT_POLICY, CLOUD_ROLE_PERMISSIONS, canCloudRole,
  resolveSupabaseConfig, normaliseInvitationEmail, validateCloudPolicy
} from '../js/cloud-security.js';

const migration = await readFile(new URL('../supabase/migrations/202611070001_calloria_server_tenancy.sql', import.meta.url), 'utf8');
const platform = await readFile(new URL('../js/cloud-platform.js', import.meta.url), 'utf8');

test('cloud mode stays in local demo only when both Supabase settings are absent', () => {
  assert.equal(resolveSupabaseConfig({}).mode, 'demo');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co' }).mode, 'misconfigured');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).mode, 'misconfigured');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).mode, 'cloud');
  const anonJwt = 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoiYW5vbiJ9.eA';
  const serviceRoleJwt = 'eyJhbGciOiJub25lIn0.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.eA';
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: anonJwt }).mode, 'cloud');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_ANON_KEY: serviceRoleJwt }).mode, 'misconfigured');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_REPLACE_ME' }).mode, 'misconfigured');
  assert.equal(resolveSupabaseConfig({ VITE_SUPABASE_URL: 'http://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }).mode, 'misconfigured');
});

test('browser configuration rejects service-role and secret-style keys', () => {
  const result = resolveSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'service_role_secret' });
  assert.equal(result.mode, 'misconfigured');
  assert.doesNotMatch(platform, /service_role\s*[:=]/i);
  assert.doesNotMatch(platform, /SUPABASE_SERVICE_ROLE_KEY/);
});

test('organisation roles use a least-privilege client permission map', () => {
  assert.equal(canCloudRole('owner', 'members:manage'), true);
  assert.equal(canCloudRole('manager', 'members:manage'), false);
  assert.equal(canCloudRole('supervisor', 'audit:read'), false);
  assert.equal(canCloudRole('agent', 'operations:own'), true);
  assert.equal(canCloudRole('unrecognised', 'org:manage'), false);
  assert.ok(CLOUD_ROLE_PERMISSIONS.owner.includes('policies:manage'));
});

test('invitation email is normalised and validates format and length', () => {
  assert.equal(normaliseInvitationEmail('  AGENT@Example.com '), 'agent@example.com');
  assert.throws(() => normaliseInvitationEmail('not-an-email'), /valid email/);
  assert.throws(() => normaliseInvitationEmail(`${'a'.repeat(250)}@b.com`), /valid email/);
});

test('tenant policy validator enforces numeric boundaries and a bounded department list', () => {
  const policy = validateCloudPolicy(CLOUD_DEFAULT_POLICY);
  assert.deepEqual(policy, { ...CLOUD_DEFAULT_POLICY, departments: [...CLOUD_DEFAULT_POLICY.departments] });
  assert.throws(() => validateCloudPolicy({ ...CLOUD_DEFAULT_POLICY, qaPassMark: 101 }), /between 0 and 100/);
  assert.throws(() => validateCloudPolicy({ ...CLOUD_DEFAULT_POLICY, dataRetentionDays: 0 }), /between 1 and 3650/);
  assert.throws(() => validateCloudPolicy({ ...CLOUD_DEFAULT_POLICY, departments: [] }), /department names/);
});

test('server migration enables RLS on all tenant tables and revokes direct browser writes', () => {
  for (const table of ['profiles','organizations','organization_memberships','organization_invitations','organization_policies','organization_audit']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(migration, /revoke all on table public\.profiles, public\.organizations, public\.organization_memberships,[\s\S]+from anon, authenticated/);
  assert.match(migration, /grant select on table public\.organizations, public\.organization_memberships,[\s\S]+to authenticated/);
  assert.match(migration, /security definer set search_path = ''/);
  assert.match(migration, /grant usage on schema public to authenticated/);
  assert.match(migration, /status = 'pending' and expires_at > now\(\)/);
});

test('tenant creation and invitation acceptance are controlled database functions', () => {
  assert.match(migration, /create or replace function public\.create_calloria_organization/);
  assert.match(migration, /values \(v_org_id, v_user, 'owner', 'active'/);
  assert.match(migration, /create or replace function public\.accept_calloria_invitation/);
  assert.match(migration, /email_confirmed_at/);
  assert.match(migration, /v_inv\.email <> v_email/);
  assert.match(migration, /create or replace function public\.set_calloria_member_status/);
  assert.match(migration, /v_member\.role = 'owner'/);
});

test('browser application uses Supabase Auth and database RPCs rather than a privileged key', () => {
  assert.match(platform, /signInWithPassword/);
  assert.match(platform, /auth\.signUp/);
  assert.match(platform, /resetPasswordForEmail/);
  assert.match(platform, /PASSWORD_RECOVERY/);
  assert.match(platform, /auth\.updateUser\(\{ password \}\)/);
  assert.match(platform, /create_calloria_organization/);
  assert.match(platform, /create_calloria_invitation/);
  assert.match(platform, /update_calloria_policy/);
  assert.match(platform, /set_calloria_member_status/);
});
