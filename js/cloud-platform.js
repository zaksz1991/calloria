import { CLOUD_DEFAULT_POLICY, CLOUD_ROLE_PERMISSIONS, canCloudRole, normaliseInvitationEmail, resolveSupabaseConfig, validateCloudPolicy } from './cloud-security.js';

const env = import.meta.env || {};
const config = resolveSupabaseConfig(env);
const state = {
  configured: config.mode !== 'demo',
  mode: config.mode,
  ready: false,
  session: null,
  user: null,
  organizations: [],
  activeOrganization: null,
  membership: null,
  members: [],
  invitations: [],
  policy: structuredClone(CLOUD_DEFAULT_POLICY),
  audit: [],
  permissions: [],
  error: '',
  message: '',
  client: null,
  passwordRecovery: false
};
let authSubscription = null;
let gateHost = null;
let busy = false;

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const errorText = error => String(error?.message || error || 'Unexpected error.').replace(/\s+/g, ' ').slice(0, 360);
const roleLabel = role => ({ owner:'Organisation owner', admin:'Organisation administrator', manager:'Operations manager', supervisor:'Team leader / supervisor', qa:'Quality assurance', agent:'Customer service agent', trainee:'Trainee' }[role] || role);

export function getCloudPlatformState() {
  return state;
}

export async function getCloudSupabaseClient() {
  if (!state.ready || !state.activeOrganization || !state.user) throw new Error('An authenticated organisation workspace is required.');
  return requireClient();
}

export { canCloudRole, CLOUD_ROLE_PERMISSIONS };

function setAppLocked(locked) {
  const app = document.querySelector('.app-shell');
  if (!app) return;
  app.inert = Boolean(locked);
  app.setAttribute('aria-hidden', locked ? 'true' : 'false');
}

function ensureGateHost() {
  if (gateHost) return gateHost;
  gateHost = document.createElement('div');
  gateHost.id = 'cloudAccessGate';
  gateHost.className = 'cloud-gate';
  gateHost.setAttribute('role', 'dialog');
  gateHost.setAttribute('aria-modal', 'true');
  gateHost.setAttribute('aria-label', 'CALLORIA secure workspace access');
  document.body.append(gateHost);
  return gateHost;
}

function gateShell(content) {
  ensureGateHost();
  setAppLocked(true);
  gateHost.innerHTML = `<section class="cloud-gate-card"><div class="cloud-brand"><span class="cloud-brand-mark">C</span><div><strong>CALLORIA</strong><small>SECURE WORKSPACE ACCESS</small></div></div>${content}</section>`;
}

function gateNotice() {
  if (state.error) return `<div class="cloud-notice error" role="alert">${html(state.error)}</div>`;
  if (state.message) return `<div class="cloud-notice" role="status">${html(state.message)}</div>`;
  return '';
}

function renderConfigurationFailure() {
  const isConfig = state.mode === 'misconfigured';
  gateShell(`<span class="cloud-kicker">${isConfig ? 'CLOUD CONFIGURATION' : 'CLOUD CONNECTION'}</span><h1>${isConfig ? 'Workspace connection is incomplete' : 'Secure workspace could not be loaded'}</h1><p>${isConfig ? 'CALLORIA detected Supabase environment settings, but they are incomplete or invalid. Local demo mode is disabled so a configuration error cannot silently bypass the intended sign-in gate.' : 'CALLORIA could not retrieve the authenticated workspace. Check the Supabase migration, Data API access and project availability, then reload the application.'}</p>${gateNotice()}<div class="cloud-setup-list"><span>Required: <code>VITE_SUPABASE_URL</code></span><span>Required: <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> or <code>VITE_SUPABASE_ANON_KEY</code></span><span>Required database migration: <code>supabase/migrations/202611070001_calloria_server_tenancy.sql</code></span></div><p class="cloud-muted">The public publishable/anon key is intended for browser use. Never add a Supabase service-role or secret key to Vercel client environment variables.</p><button type="button" class="cloud-primary" data-cloud-action="${isConfig ? 'reload' : 'retry'}">${isConfig ? 'Reload after configuration' : 'Retry connection'}</button>`);
}

function renderAuthGate(activeTab = 'signin') {
  gateShell(`
    <span class="cloud-kicker">IDENTITY & ACCESS</span>
    <h1>Sign in to CALLORIA</h1>
    <p>Your login is managed by Supabase Auth. Organisation membership and permissions are checked by the database.</p>
    ${gateNotice()}
    <div class="cloud-tabs"><button type="button" data-cloud-tab="signin" class="${activeTab==='signin'?'active':''}">Sign in</button><button type="button" data-cloud-tab="signup" class="${activeTab==='signup'?'active':''}">Create account</button></div>
    <form id="cloudSignInForm" class="cloud-form ${activeTab==='signin'?'':'hidden'}"><label>Email address<input name="email" type="email" autocomplete="username" required maxlength="254" placeholder="you@organisation.com"></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label><button class="cloud-primary" type="submit">Sign in securely</button><button class="cloud-text-button" type="button" data-cloud-action="reset-password">Send password reset email</button></form>
    <form id="cloudSignUpForm" class="cloud-form ${activeTab==='signup'?'':'hidden'}"><label>Full name<input name="fullName" type="text" autocomplete="name" required minlength="2" maxlength="100" placeholder="Your full name"></label><label>Email address<input name="email" type="email" inputmode="email" autocapitalize="none" spellcheck="false" autocomplete="email" required maxlength="254" placeholder="name@example.com"></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="10" placeholder="At least 10 characters"></label><button class="cloud-primary" type="submit">Create account</button><p class="cloud-muted">Email confirmation may be required before you can enter an organisation.</p></form>
    <div class="cloud-security-foot"><span class="cloud-lock">●</span> PostgreSQL Row Level Security is part of the required tenant migration.</div>`);
}

function renderWorkspaceGate() {
  const invites = state.pendingInvitations || [];
  const options = state.organizations.map(item => `<option value="${html(item.id)}">${html(item.name)} · ${html(roleLabel(item.role))}</option>`).join('');
  const invitationMarkup = invites.length ? `<div class="cloud-invite-list"><h3>Invitations addressed to your verified email</h3>${invites.map(invite => `<article><div><strong>${html(invite.organizations?.name || 'Organisation invitation')}</strong><small>${html(roleLabel(invite.role))} · ${html(invite.department)} · Expires ${new Date(invite.expires_at).toLocaleDateString()}</small></div><button type="button" data-cloud-accept="${html(invite.id)}">Accept invitation</button></article>`).join('')}</div>` : '';
  gateShell(`
    <span class="cloud-kicker">AUTHENTICATED ACCOUNT</span><h1>Select your organisation</h1>
    <p>Signed in as <strong>${html(state.user?.email)}</strong>. Select a workspace to continue. Memberships are retrieved from the server.</p>
    ${gateNotice()}
    ${state.organizations.length ? `<form id="cloudSelectOrgForm" class="cloud-form"><label>Organisation workspace<select name="organizationId" required>${options}</select></label><button class="cloud-primary" type="submit">Enter workspace</button></form>` : `<div class="cloud-empty-state"><strong>No active organisation membership</strong><p>Create a new organisation or accept an invitation sent to this verified email address.</p></div>`}
    ${invitationMarkup}
    <details class="cloud-create-details"><summary>Create a new organisation</summary><form id="cloudCreateOrgForm" class="cloud-form"><label>Organisation name<input name="name" minlength="2" maxlength="80" required placeholder="e.g. Northern Customer Services"></label><label>Industry<select name="industry"><option>Banking and financial services</option><option>Telecommunications</option><option>E-commerce and retail</option><option>Insurance</option><option>Healthcare administration</option><option>Travel and hospitality</option><option>Logistics and utilities</option><option>General customer service</option></select></label><button class="cloud-primary" type="submit">Create organisation workspace</button></form></details>
    <button class="cloud-text-button" type="button" data-cloud-action="signout">Sign out</button>
    <div class="cloud-security-foot"><span class="cloud-lock">●</span> Switching workspaces changes the tenant-scoped local simulation profile.</div>`);
}


function renderPasswordRecoveryGate() {
  gateShell(`<span class="cloud-kicker">ACCOUNT RECOVERY</span><h1>Choose a new password</h1><p>Set a new password for ${html(state.user?.email || 'your account')}.</p>${gateNotice()}<form id="cloudNewPasswordForm" class="cloud-form"><label>New password<input name="password" type="password" autocomplete="new-password" required minlength="10"></label><label>Confirm new password<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="10"></label><button class="cloud-primary" type="submit">Update password</button></form>`);
}

async function handlePasswordUpdate(form) {
  const values = new FormData(form);
  const password = String(values.get('password') || '');
  const confirmation = String(values.get('confirmPassword') || '');
  if (password.length < 10) throw new TypeError('Use a password of at least 10 characters.');
  if (password !== confirmation) throw new TypeError('The password confirmation does not match.');
  const client = await requireClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
  state.passwordRecovery = false;
  await loadMemberships();
  setMessage('Password updated successfully. Select your organisation to continue.');
  showGate(); bindGateEvents();
}

function renderLoadingGate(message = 'Connecting to your secure workspace…') {
  gateShell(`<div class="cloud-loading"><span class="cloud-spinner"></span><h1>Preparing your workspace</h1><p>${html(message)}</p></div>`);
}

function showGate() {
  if (state.mode === 'misconfigured' || state.mode === 'error') return renderConfigurationFailure();
  if (state.passwordRecovery && state.session) return renderPasswordRecoveryGate();
  if (!state.session) return renderAuthGate();
  return renderWorkspaceGate();
}

function setMessage(message = '', error = '') {
  state.message = message;
  state.error = error;
}

async function requireClient() {
  if (state.client) return state.client;
  if (config.mode !== 'cloud') throw new Error('Supabase is not configured.');
  const { createClient } = await import('@supabase/supabase-js');
  state.client = createClient(config.url, config.key, {
    auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
    global: { headers: { 'x-client-info': 'calloria-v1.3.1' } }
  });
  return state.client;
}

async function loadMemberships() {
  const client = await requireClient();
  const { data, error } = await client.from('organization_memberships')
    .select('id,organization_id,user_id,role,status,department,created_at,organizations(id,name,industry,created_at)')
    .eq('user_id', state.user.id).eq('status', 'active').order('created_at', { ascending: true });
  if (error) throw error;
  state.organizations = (data || []).map(row => ({
    id: row.organization_id,
    name: row.organizations?.name || 'Organisation',
    industry: row.organizations?.industry || 'General customer service',
    createdAt: row.organizations?.created_at || row.created_at,
    role: row.role,
    department: row.department,
    membershipId: row.id
  }));
  const invites = await client.from('organization_invitations')
    .select('id,organization_id,email,role,department,expires_at,organizations(name)')
    .eq('status', 'pending').eq('email', String(state.user.email || '').toLowerCase()).gt('expires_at', new Date().toISOString());
  if (invites.error) throw invites.error;
  state.pendingInvitations = invites.data || [];
}

async function loadActiveWorkspace(organizationId) {
  const client = await requireClient();
  const org = state.organizations.find(item => item.id === organizationId);
  if (!org) throw new Error('That organisation is not an active membership for this account.');
  const membership = await client.from('organization_memberships')
    .select('id,organization_id,user_id,role,status,department,created_at')
    .eq('organization_id', organizationId).eq('user_id', state.user.id).eq('status', 'active').single();
  if (membership.error) throw membership.error;
  state.membership = membership.data;
  state.activeOrganization = { ...org };
  try { sessionStorage.setItem(`calloria.active-org.${state.user.id}`, organizationId); } catch { /* session preference is optional */ }
  state.permissions = CLOUD_ROLE_PERMISSIONS[org.role] || [];

  const [policyResult, memberResult, invitationResult, auditResult] = await Promise.all([
    client.from('organization_policies').select('policy,updated_at').eq('organization_id', organizationId).maybeSingle(),
    client.from('organization_memberships').select('id,user_id,role,status,department,created_at,profiles(full_name,email)').eq('organization_id', organizationId).order('created_at', { ascending: true }),
    client.from('organization_invitations').select('id,email,role,department,status,expires_at,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50),
    client.from('organization_audit').select('id,actor_user_id,event_type,details,created_at').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(50)
  ]);
  if (policyResult.error) throw policyResult.error;
  if (memberResult.error) throw memberResult.error;
  if (invitationResult.error) throw invitationResult.error;
  if (auditResult.error && canCloudRole(state.membership?.role, 'audit:read')) throw auditResult.error;
  state.policy = validateCloudPolicy(policyResult.data?.policy || CLOUD_DEFAULT_POLICY);
  state.members = (memberResult.data || []).map(row => ({
    id: row.id, userId: row.user_id, role: row.role, status: row.status,
    department: row.department, createdAt: row.created_at,
    name: row.profiles?.full_name || 'CALLORIA member', email: row.profiles?.email || ''
  }));
  state.invitations = invitationResult.data || [];
  state.audit = auditResult.error ? [] : (auditResult.data || []);
  state.mode = 'active';
  state.ready = true;
  setMessage();
  gateHost?.remove(); gateHost = null;
  setAppLocked(false);
  renderSessionControl();
  window.dispatchEvent(new CustomEvent('calloria:cloud-context', {
    detail: { userId: state.user.id, organizationId, organizationName: org.name, signedOut: false, role: org.role, policy: state.policy }
  }));
}

function renderSessionControl() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  let control = document.getElementById('cloudSessionControl');
  if (!control) {
    control = document.createElement('div');
    control.id = 'cloudSessionControl';
    control.className = 'cloud-session-control';
    topbar.append(control);
  }
  control.innerHTML = `<span class="cloud-session-dot"></span><span title="${html(state.user?.email)}">${html(state.user?.email || 'Authenticated')}</span><button type="button" data-cloud-session-signout>Sign out</button>`;
}

async function enterWorkspace(organizationId) {
  renderLoadingGate('Checking your membership and loading organisation records…');
  try { await loadActiveWorkspace(organizationId); }
  catch (error) { setMessage('', errorText(error)); showGate(); }
}

async function refreshAfterMutation(message) {
  const organizationId = state.activeOrganization?.id;
  if (organizationId) await loadActiveWorkspace(organizationId);
  setMessage(message);
  if (!gateHost) {
    const host = document.getElementById('viewRoot');
    const notice = document.createElement('div');
    notice.className = 'cloud-inline-notice';
    notice.textContent = message;
    host?.prepend(notice);
  }
}

export async function createCloudOrganization(input) {
  const client = await requireClient();
  const { data, error } = await client.rpc('create_calloria_organization', {
    p_name: String(input.name || '').trim(), p_industry: String(input.industry || 'General customer service').trim()
  });
  if (error) throw error;
  await loadMemberships();
  const id = data;
  await enterWorkspace(id);
  return id;
}

export async function createCloudInvitation(input) {
  if (!canCloudRole(state.membership?.role, 'members:manage')) throw new Error('Your role cannot invite organisation members.');
  const email = normaliseInvitationEmail(input.email);
  const role = String(input.role || 'agent');
  if (!['admin','manager','supervisor','qa','agent','trainee'].includes(role)) throw new TypeError('Select a permitted role.');
  const department = String(input.department || '').trim();
  if (!state.policy.departments.includes(department)) throw new TypeError('Select a department configured for this organisation.');
  const client = await requireClient();
  const { data, error } = await client.rpc('create_calloria_invitation', {
    p_org_id: state.activeOrganization.id, p_email: email, p_role: role, p_department: department
  });
  if (error) throw error;
  await refreshAfterMutation(`Invitation recorded for ${email}. No email was sent; the recipient must sign up with this address and accept the invitation after confirming it.`);
  return data;
}

export async function updateCloudPolicy(input) {
  if (!canCloudRole(state.membership?.role, 'policies:manage')) throw new Error('Your role cannot change organisation policies.');
  const policy = validateCloudPolicy(input);
  const client = await requireClient();
  const { data, error } = await client.rpc('update_calloria_policy', { p_org_id: state.activeOrganization.id, p_policy: policy });
  if (error) throw error;
  await refreshAfterMutation('Organisation policy saved to Supabase.');
  return data;
}

export async function setCloudMemberStatus(memberId, status) {
  if (!canCloudRole(state.membership?.role, 'members:manage')) throw new Error('Your role cannot manage organisation members.');
  const client = await requireClient();
  const { error } = await client.rpc('set_calloria_member_status', {
    p_org_id: state.activeOrganization.id, p_member_id: memberId, p_status: status
  });
  if (error) throw error;
  await refreshAfterMutation(`Staff access status updated to ${status}.`);
}

async function handleSignIn(form) {
  const client = await requireClient();
  const values = new FormData(form);
  const { data, error } = await client.auth.signInWithPassword({
    email: normaliseInvitationEmail(values.get('email')),
    password: String(values.get('password') || '')
  });
  if (error) throw error;
  state.session = data.session; state.user = data.user;
  await loadMemberships(); setMessage(); showGate();
}

async function handleSignUp(form) {
  const client = await requireClient();
  const values = new FormData(form);
  const email = normaliseInvitationEmail(values.get('email'));
  const password = String(values.get('password') || '');
  const fullName = String(values.get('fullName') || '').trim();
  if (fullName.length < 2 || fullName.length > 100) throw new TypeError('Enter a full name between 2 and 100 characters.');
  if (password.length < 10) throw new TypeError('Use a password of at least 10 characters.');
  const { data, error } = await client.auth.signUp({
    email, password, options: { data: { full_name: fullName }, emailRedirectTo: window.location.origin }
  });
  if (error) throw error;
  if (data.session) {
    state.session = data.session; state.user = data.user;
    await loadMemberships(); setMessage(); showGate();
  } else {
    setMessage('Account request received. Check your email to confirm the address, then return here to sign in.');
    renderAuthGate('signin');
  }
}

async function handlePasswordReset() {
  const email = normaliseInvitationEmail(document.querySelector('#cloudSignInForm input[name="email"]')?.value);
  const client = await requireClient();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/` });
  if (error) throw error;
  setMessage('Password reset instructions were sent when the address is registered.');
  renderAuthGate('signin');
}

async function handleAcceptInvitation(invitationId) {
  const client = await requireClient();
  const { data, error } = await client.rpc('accept_calloria_invitation', { p_invitation_id: invitationId });
  if (error) throw error;
  if (!data) throw new Error('This invitation has expired. Ask an organisation administrator to issue another.');
  await loadMemberships();
  setMessage('Invitation accepted. Select the organisation to continue.');
  showGate();
}

async function doSignOut() {
  const client = await requireClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  state.passwordRecovery = false;
  state.session = null; state.user = null; state.organizations = []; state.activeOrganization = null;
  state.membership = null; state.members = []; state.invitations = []; state.audit = [];
  state.mode = 'cloud'; state.ready = false;
  window.dispatchEvent(new CustomEvent('calloria:cloud-context', { detail: { signedOut: true } }));
  setMessage('You have signed out.'); renderAuthGate(); bindGateEvents();
  document.getElementById('cloudSessionControl')?.remove();
}

function setBusy(value) {
  busy = value;
  gateHost?.querySelectorAll('button,input,select').forEach(node => { node.disabled = value; });
}

function bindGateEvents() {
  if (!gateHost || gateHost.dataset.bound === 'true') return;
  gateHost.dataset.bound = 'true';
  gateHost.addEventListener('click', async event => {
    const tab = event.target.closest('[data-cloud-tab]');
    const action = event.target.closest('[data-cloud-action]');
    const accept = event.target.closest('[data-cloud-accept]');
    if (tab) { renderAuthGate(tab.dataset.cloudTab); return; }
    if (busy) return;
    const run = async fn => {
      setBusy(true); setMessage();
      try { await fn(); }
      catch (error) { setMessage('', errorText(error)); showGate(); }
      finally { setBusy(false); }
    };
    if (action?.dataset.cloudAction === 'reload') { window.location.reload(); return; }
    if (action?.dataset.cloudAction === 'reset-password') return run(handlePasswordReset);
    if (action?.dataset.cloudAction === 'signout') return run(doSignOut);
    if (action?.dataset.cloudAction === 'retry') return run(async () => {
      state.client = null; state.mode = 'cloud';
      try {
        const client = await requireClient();
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        state.session = data.session; state.user = data.session?.user || null;
        if (state.user) await loadMemberships();
        showGate(); bindGateEvents();
      } catch (error) { state.mode = 'error'; throw error; }
    });
    if (accept) return run(() => handleAcceptInvitation(accept.dataset.cloudAccept));
  });
  gateHost.addEventListener('submit', async event => {
    const form = event.target;
    const actions = {
      cloudSignInForm: handleSignIn,
      cloudSignUpForm: handleSignUp,
      cloudNewPasswordForm: handlePasswordUpdate,
      cloudSelectOrgForm: async target => enterWorkspace(new FormData(target).get('organizationId')),
      cloudCreateOrgForm: async target => {
        const values = new FormData(target);
        await createCloudOrganization({ name: values.get('name'), industry: values.get('industry') });
      }
    };
    const action = actions[form.id];
    if (!action || busy) return;
    event.preventDefault(); setBusy(true); setMessage();
    try { await action(form); }
    catch (error) {
      setMessage('', errorText(error));
      if (form.id === 'cloudSignUpForm' && !state.session) renderAuthGate('signup');
      else showGate();
      bindGateEvents();
    }
    finally { setBusy(false); }
  });
}

function bindSessionControl() {
  if (document.documentElement.dataset.cloudSignOutBound === 'true') return;
  document.documentElement.dataset.cloudSignOutBound = 'true';
  document.addEventListener('click', async event => {
    if (!event.target.closest('[data-cloud-session-signout]') || busy) return;
    try { await doSignOut(); }
    catch (error) { console.error('CALLORIA sign-out failed:', error); window.alert(errorText(error)); }
  });
}

export async function selectCloudOrganization(organizationId) {
  await enterWorkspace(organizationId);
}

export async function initializeCloudPlatform() {
  if (config.mode === 'demo') {
    state.mode = 'demo'; state.ready = true;
    return state;
  }
  if (config.mode === 'misconfigured') {
    state.mode = 'misconfigured'; state.ready = false; state.error = 'Invalid or incomplete Supabase URL or publishable key.';
    renderConfigurationFailure(); bindGateEvents();
    return state;
  }
  renderLoadingGate(); bindGateEvents(); bindSessionControl();
  try {
    const client = await requireClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    state.user = data.session?.user || null;
    client.auth.onAuthStateChange((event, session) => {
      window.setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
          state.session = null; state.user = null; state.organizations = []; state.activeOrganization = null;
          state.membership = null; state.passwordRecovery = false; state.mode = 'cloud'; state.ready = false; showGate(); bindGateEvents();
          document.getElementById('cloudSessionControl')?.remove();
          window.dispatchEvent(new CustomEvent('calloria:cloud-context', { detail: { signedOut: true } }));
        } else if (event === 'PASSWORD_RECOVERY' && session?.user) {
          state.session = session; state.user = session.user; state.passwordRecovery = true;
          renderPasswordRecoveryGate(); bindGateEvents();
        } else if (session?.user && !state.activeOrganization) {
          state.session = session; state.user = session.user;
          try { await loadMemberships(); showGate(); bindGateEvents(); }
          catch (error) { setMessage('', errorText(error)); showGate(); bindGateEvents(); }
        } else if (session) {
          state.session = session; state.user = session.user;
        }
      }, 0);
    });
    if (state.session) {
      await loadMemberships();
      let preferred = null;
      try { preferred = sessionStorage.getItem(`calloria.active-org.${state.user.id}`); } catch { /* storage may be disabled */ }
      if (preferred && state.organizations.some(item => item.id === preferred)) {
        await enterWorkspace(preferred);
      } else if (state.organizations.length === 1) {
        await enterWorkspace(state.organizations[0].id);
      } else {
        showGate(); bindGateEvents();
      }
    } else {
      showGate(); bindGateEvents();
    }
    state.ready = true;
  } catch (error) {
    state.mode = 'error'; state.error = errorText(error); state.ready = false;
    renderConfigurationFailure();
  }
  return state;
}
