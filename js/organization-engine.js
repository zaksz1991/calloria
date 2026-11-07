export const ORGANIZATION_ROLES = Object.freeze({
  owner: { label: 'Organisation owner', permissions: ['org:manage','members:manage','policies:manage','audit:read','operations:read','cases:read','reports:read'] },
  admin: { label: 'Organisation administrator', permissions: ['org:manage','members:manage','policies:manage','audit:read','operations:read','cases:read','reports:read'] },
  manager: { label: 'Operations manager', permissions: ['operations:read','members:read','policies:read','cases:read','reports:read','audit:read'] },
  supervisor: { label: 'Team leader / supervisor', permissions: ['operations:read','members:read','cases:read','reports:read'] },
  qa: { label: 'Quality assurance', permissions: ['cases:read','reports:read','operations:read'] },
  agent: { label: 'Customer service agent', permissions: ['cases:own','operations:own'] },
  trainee: { label: 'Trainee', permissions: ['knowledge:read','operations:own'] }
});

export const DEFAULT_ORG_POLICY = Object.freeze({
  voiceResponseTargetSeconds: 30,
  digitalResponseTargetMinutes: 15,
  qaPassMark: 85,
  promotionThreshold: 80,
  maxConcurrentChats: 2,
  dataRetentionDays: 90,
  departments: ['Inbound Voice','Outbound Voice','Email Support','Social Media','Live Chat','IT Support','Quality Assurance','Customer Experience','Fraud and Security','Back Office']
});

const clean = value => String(value ?? '').trim();
const safeId = value => clean(value).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36);

export function createOrganization(input, now = Date.now()) {
  const name = clean(input?.name);
  const industry = clean(input?.industry || 'General customer service');
  if (name.length < 2) throw new TypeError('Organisation name must contain at least two characters.');
  const id = `ORG-${safeId(name)}-${now.toString(36).toUpperCase()}`;
  return {
    id, name: name.slice(0, 80), industry: industry.slice(0, 60), status: 'active',
    createdAt: new Date(now).toISOString(), policy: structuredClone(DEFAULT_ORG_POLICY),
    members: [], audit: [{ id: `AUD-${now}-1`, type: 'organisation-created', actor: 'Simulation owner', detail: `Created ${name}.`, at: new Date(now).toISOString() }]
  };
}

export function createOrganizationMember(organization, input, now = Date.now()) {
  if (!organization || !Array.isArray(organization.members)) throw new TypeError('A valid organisation workspace is required.');
  const name = clean(input?.name);
  const email = clean(input?.email).toLowerCase();
  const role = clean(input?.role || 'agent');
  const department = clean(input?.department);
  if (name.length < 2) throw new TypeError('Staff name must contain at least two characters.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError('Enter a valid work email address.');
  if (!Object.hasOwn(ORGANIZATION_ROLES, role) || role === 'owner') throw new TypeError('Select a permitted organisation role. Owner access cannot be assigned through a staff invitation.');
  if (organization.members.some(member => member.email.toLowerCase() === email)) throw new TypeError('This email already belongs to a member of the active organisation.');
  if (!organization.policy.departments.includes(department)) throw new TypeError('Select a department configured for this organisation.');
  const member = { id: `MEM-${now.toString(36).toUpperCase()}-${organization.members.length + 1}`, name: name.slice(0, 70), email, role, department, status: 'invited', createdAt: new Date(now).toISOString(), lastActiveAt: null };
  organization.members.push(member);
  recordOrganizationAudit(organization, { type: 'member-invited', actor: 'Simulation owner', detail: `Invited ${member.name} as ${ORGANIZATION_ROLES[role].label} to ${department}.` }, now);
  return member;
}

export function setOrganizationMemberStatus(organization, memberId, status, now = Date.now()) {
  if (!['active','suspended'].includes(status)) throw new TypeError('Member status must be active or suspended.');
  const member = organization?.members?.find(item => item.id === memberId);
  if (!member) throw new TypeError('Organisation member was not found in the active workspace.');
  member.status = status;
  recordOrganizationAudit(organization, { type: `member-${status}`, actor: 'Simulation owner', detail: `${member.name} was ${status}.` }, now);
  return member;
}

export function updateOrganizationPolicy(organization, input, now = Date.now()) {
  if (!organization?.policy) throw new TypeError('A valid organisation workspace is required.');
  const numeric = {
    voiceResponseTargetSeconds: [input.voiceResponseTargetSeconds, 5, 600],
    digitalResponseTargetMinutes: [input.digitalResponseTargetMinutes, 1, 1440],
    qaPassMark: [input.qaPassMark, 0, 100],
    promotionThreshold: [input.promotionThreshold, 0, 100],
    maxConcurrentChats: [input.maxConcurrentChats, 1, 10],
    dataRetentionDays: [input.dataRetentionDays, 1, 3650]
  };
  const next = {};
  for (const [key, [raw, min, max]] of Object.entries(numeric)) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new RangeError(`${key} must be a whole number between ${min} and ${max}.`);
    next[key] = value;
  }
  organization.policy = { ...organization.policy, ...next };
  recordOrganizationAudit(organization, { type: 'policy-updated', actor: 'Simulation owner', detail: 'Updated organisation service, quality, promotion, concurrency and retention settings.' }, now);
  return organization.policy;
}

export function recordOrganizationAudit(organization, event, now = Date.now()) {
  if (!organization) throw new TypeError('Organisation is required.');
  const entry = { id: `AUD-${now}-${(organization.audit?.length || 0) + 1}`, type: clean(event?.type) || 'activity', actor: clean(event?.actor) || 'System', detail: clean(event?.detail).slice(0, 300), at: new Date(now).toISOString() };
  if (!Array.isArray(organization.audit)) organization.audit = [];
  organization.audit.push(entry);
  if (organization.audit.length > 250) organization.audit.splice(0, organization.audit.length - 250);
  return entry;
}

export function canOrganizationRole(role, permission) {
  return Boolean(ORGANIZATION_ROLES[role]?.permissions.includes(permission));
}

export function ensureOrganizationWorkspace(state, now = Date.now()) {
  if (!state.organizationWorkspace || !Array.isArray(state.organizationWorkspace.organizations)) {
    const organization = createOrganization({ name: 'Meridian Service Group', industry: 'Banking and financial services' }, now);
    organization.id = 'ORG-MERIDIAN-SERVICE-GROUP';
    organization.members = [
      { id: 'MEM-OWNER-001', name: 'Simulation Owner', email: 'owner@meridian.example', role: 'owner', department: 'Customer Experience', status: 'active', createdAt: new Date(now).toISOString(), lastActiveAt: new Date(now).toISOString() },
      { id: 'MEM-SUP-001', name: 'Amina Yusuf', email: 'amina.yusuf@meridian.example', role: 'supervisor', department: 'Inbound Voice', status: 'active', createdAt: new Date(now).toISOString(), lastActiveAt: null },
      { id: 'MEM-QA-001', name: 'Tunde Okafor', email: 'tunde.okafor@meridian.example', role: 'qa', department: 'Quality Assurance', status: 'active', createdAt: new Date(now).toISOString(), lastActiveAt: null },
      { id: 'MEM-EMAIL-001', name: 'Zainab Bello', email: 'zainab.bello@meridian.example', role: 'agent', department: 'Email Support', status: 'active', createdAt: new Date(now).toISOString(), lastActiveAt: null },
      { id: 'MEM-SOCIAL-001', name: 'Chinedu Eze', email: 'chinedu.eze@meridian.example', role: 'agent', department: 'Social Media', status: 'invited', createdAt: new Date(now).toISOString(), lastActiveAt: null }
    ];
    state.organizationWorkspace = { activeOrganizationId: organization.id, organizations: [organization] };
    recordOrganizationAudit(organization, { type: 'workspace-initialised', actor: 'System', detail: 'Created the default local training organisation and synthetic staff directory.' }, now);
  }
  for (const organization of state.organizationWorkspace.organizations) {
    organization.policy = { ...structuredClone(DEFAULT_ORG_POLICY), ...(organization.policy || {}) };
    organization.members = Array.isArray(organization.members) ? organization.members : [];
    organization.audit = Array.isArray(organization.audit) ? organization.audit : [];
  }
  if (!state.organizationWorkspace.organizations.some(org => org.id === state.organizationWorkspace.activeOrganizationId)) {
    state.organizationWorkspace.activeOrganizationId = state.organizationWorkspace.organizations[0]?.id || '';
  }
  return state.organizationWorkspace;
}

export function getActiveOrganization(workspace) {
  return workspace?.organizations?.find(org => org.id === workspace.activeOrganizationId) || null;
}

export function getOrganizationSnapshot(workspace, organizationId) {
  const organization = workspace?.organizations?.find(org => org.id === organizationId);
  if (!organization) return null;
  return { id: organization.id, name: organization.name, industry: organization.industry, status: organization.status, memberCount: organization.members.length, activeMembers: organization.members.filter(member => member.status === 'active').length, policy: structuredClone(organization.policy), members: structuredClone(organization.members), audit: structuredClone(organization.audit) };
}
