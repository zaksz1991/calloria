import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORGANIZATION_ROLES, DEFAULT_ORG_POLICY, createOrganization,
  createOrganizationMember, setOrganizationMemberStatus,
  updateOrganizationPolicy, canOrganizationRole,
  ensureOrganizationWorkspace, getActiveOrganization,
  getOrganizationSnapshot
} from '../js/organization-engine.js';

test('creates an organisation with independent policy, member and audit containers', () => {
  const org = createOrganization({ name: 'Northline Support', industry: 'Telecommunications' }, 1000);
  assert.equal(org.name, 'Northline Support');
  assert.equal(org.industry, 'Telecommunications');
  assert.deepEqual(org.policy.departments, [...DEFAULT_ORG_POLICY.departments]);
  assert.equal(org.members.length, 0);
  assert.equal(org.audit[0].type, 'organisation-created');
});

test('rejects invalid organisation and duplicate or malformed staff invitations', () => {
  const org = createOrganization({ name: 'Northline' }, 1000);
  assert.throws(() => createOrganization({ name: ' ' }), /at least two characters/);
  assert.throws(() => createOrganizationMember(org, { name: 'Amina Yusuf', email: 'bad', role: 'agent', department: 'Email Support' }), /valid work email/);
  createOrganizationMember(org, { name: 'Amina Yusuf', email: 'amina@example.com', role: 'agent', department: 'Email Support' }, 1001);
  assert.throws(() => createOrganizationMember(org, { name: 'Amina Yusuf', email: 'AMINA@example.com', role: 'agent', department: 'Email Support' }, 1002), /already belongs/);
  assert.throws(() => createOrganizationMember(org, { name: 'Bola Ade', email: 'bola@example.com', role: 'owner', department: 'Email Support' }, 1003), /permitted organisation role/);
  assert.throws(() => createOrganizationMember(org, { name: 'Bola Ade', email: 'bola@example.com', role: 'agent', department: 'Unconfigured' }, 1004), /configured for this organisation/);
});

test('staff status transitions are scoped to the selected organisation', () => {
  const a = createOrganization({ name: 'Alpha Services' }, 2000);
  const b = createOrganization({ name: 'Beta Services' }, 2001);
  const member = createOrganizationMember(a, { name: 'Tunde Okafor', email: 'tunde@alpha.example', role: 'qa', department: 'Quality Assurance' }, 2002);
  assert.throws(() => setOrganizationMemberStatus(b, member.id, 'suspended', 2003), /not found/);
  assert.equal(setOrganizationMemberStatus(a, member.id, 'suspended', 2004).status, 'suspended');
  assert.equal(a.audit.at(-1).type, 'member-suspended');
});

test('policy updates validate every range and preserve department catalogue', () => {
  const org = createOrganization({ name: 'Policy Services' }, 3000);
  const departments = [...org.policy.departments];
  const updated = updateOrganizationPolicy(org, { voiceResponseTargetSeconds:'45', digitalResponseTargetMinutes:'20', qaPassMark:'88', promotionThreshold:'82', maxConcurrentChats:'3', dataRetentionDays:'180' }, 3001);
  assert.equal(updated.voiceResponseTargetSeconds, 45);
  assert.equal(updated.promotionThreshold, 82);
  assert.deepEqual(updated.departments, departments);
  assert.throws(() => updateOrganizationPolicy(org, { voiceResponseTargetSeconds:'0', digitalResponseTargetMinutes:'20', qaPassMark:'88', promotionThreshold:'82', maxConcurrentChats:'3', dataRetentionDays:'180' }), /between 5 and 600/);
});

test('role permissions are explicit and least-privilege definitions are available', () => {
  assert.equal(canOrganizationRole('owner', 'members:manage'), true);
  assert.equal(canOrganizationRole('manager', 'members:manage'), false);
  assert.equal(canOrganizationRole('agent', 'cases:own'), true);
  assert.equal(canOrganizationRole('agent', 'cases:read'), false);
  assert.equal(canOrganizationRole('unknown', 'org:manage'), false);
  assert.ok(Object.hasOwn(ORGANIZATION_ROLES, 'qa'));
});

test('legacy player saves receive a default local workspace and snapshots remain tenant-scoped', () => {
  const state = {};
  const workspace = ensureOrganizationWorkspace(state, 4000);
  const first = getActiveOrganization(workspace);
  const second = createOrganization({ name: 'Separate Tenant' }, 4001);
  workspace.organizations.push(second);
  const snapshot = getOrganizationSnapshot(workspace, second.id);
  assert.equal(first.name, 'Meridian Service Group');
  assert.equal(snapshot.memberCount, 0);
  assert.equal(snapshot.name, 'Separate Tenant');
  assert.equal(getOrganizationSnapshot(workspace, 'missing'), null);
});
