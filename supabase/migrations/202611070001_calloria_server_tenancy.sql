-- CALLORIA v0.9.0 — server-backed identity and organisation tenancy.
-- Apply in Supabase SQL Editor as a project administrator.
-- The browser must use only the project URL and publishable/anon key. Never expose service_role/secret keys.

begin;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  industry text not null default 'General customer service' check (char_length(industry) between 2 and 80),
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','supervisor','qa','agent','trainee')),
  status text not null default 'active' check (status in ('active','suspended')),
  department text not null default 'Customer Experience' check (char_length(department) between 2 and 60),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);


create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  role text not null check (role in ('admin','manager','supervisor','qa','agent','trainee')),
  department text not null check (char_length(department) between 2 and 60),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);

create unique index if not exists organization_invitations_one_pending_email
  on public.organization_invitations (organization_id, lower(email)) where status = 'pending';
create index if not exists organization_memberships_user_org_idx
  on public.organization_memberships (user_id, organization_id) where status = 'active';
create index if not exists organization_invitations_email_idx
  on public.organization_invitations (lower(email), status, expires_at);

create table if not exists public.organization_policies (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  policy jsonb not null default '{
    "voiceResponseTargetSeconds":30,
    "digitalResponseTargetMinutes":15,
    "qaPassMark":85,
    "promotionThreshold":80,
    "maxConcurrentChats":2,
    "dataRetentionDays":90,
    "departments":["Inbound Voice","Outbound Voice","Email Support","Social Media","Live Chat","IT Support","Quality Assurance","Customer Experience","Fraud and Security","Back Office"]
  }'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  event_type text not null check (char_length(event_type) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists organization_audit_org_created_idx
  on public.organization_audit (organization_id, created_at desc);

create or replace function public.calloria_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.calloria_touch_updated_at();

create or replace function public.calloria_sync_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1));
  insert into public.profiles (user_id, full_name, email)
  values (new.id, left(v_name, 100), lower(coalesce(new.email, '')))
  on conflict (user_id) do update
    set email = excluded.email,
        full_name = case when profiles.full_name = '' then excluded.full_name else profiles.full_name end;
  return new;
end;
$$;

drop trigger if exists calloria_auth_user_profile on auth.users;
create trigger calloria_auth_user_profile
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.calloria_sync_profile();

-- Backfill users created before this migration was installed.
insert into public.profiles (user_id, full_name, email)
select u.id,
       left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(u.email, ''), '@', 1)), 100),
       lower(coalesce(u.email, ''))
from auth.users u
on conflict (user_id) do update set email = excluded.email;

create or replace function public.is_calloria_org_member(p_org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org_id and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.has_calloria_org_permission(p_org_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case m.role
      when 'owner' then p_permission in ('org:manage','members:manage','members:read','policies:manage','policies:read','audit:read','operations:read','reports:read')
      when 'admin' then p_permission in ('org:manage','members:manage','members:read','policies:manage','policies:read','audit:read','operations:read','reports:read')
      when 'manager' then p_permission in ('members:read','policies:read','audit:read','operations:read','reports:read')
      when 'supervisor' then p_permission in ('members:read','operations:read','reports:read')
      when 'qa' then p_permission in ('operations:read','reports:read')
      when 'agent' then p_permission = 'operations:own'
      when 'trainee' then p_permission in ('knowledge:read','operations:own')
      else false
    end
    from public.organization_memberships m
    where m.organization_id = p_org_id and m.user_id = auth.uid() and m.status = 'active'
    limit 1
  ), false);
$$;

create or replace function public.calloria_write_audit(p_org_id uuid, p_event text, p_details jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.organization_audit (organization_id, actor_user_id, event_type, details)
  values (p_org_id, auth.uid(), left(coalesce(p_event, 'activity'), 80), coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.create_calloria_organization(p_name text, p_industry text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_org_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_industry text := trim(coalesce(p_industry, 'General customer service'));
  v_slug text;
begin
  if v_user is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if char_length(v_name) not between 2 and 80 then raise exception 'Organisation name must contain 2–80 characters.'; end if;
  if char_length(v_industry) not between 2 and 80 then raise exception 'Industry must contain 2–80 characters.'; end if;
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g')) || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.organizations (name, industry, slug, created_by)
  values (v_name, v_industry, v_slug, v_user) returning id into v_org_id;
  insert into public.organization_memberships (organization_id, user_id, role, status, department)
  values (v_org_id, v_user, 'owner', 'active', 'Customer Experience');
  insert into public.organization_policies (organization_id, updated_by) values (v_org_id, v_user);
  perform public.calloria_write_audit(v_org_id, 'organization-created', jsonb_build_object('name', v_name, 'industry', v_industry));
  return v_org_id;
end;
$$;

create or replace function public.create_calloria_invitation(p_org_id uuid, p_email text, p_role text, p_department text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_department text := trim(coalesce(p_department, ''));
  v_id uuid;
begin
  if not public.has_calloria_org_permission(p_org_id, 'members:manage') then raise exception 'You do not have permission to invite staff.' using errcode = '42501'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 254 then raise exception 'A valid email address is required.'; end if;
  if v_role not in ('admin','manager','supervisor','qa','agent','trainee') then raise exception 'The requested role cannot be invited.'; end if;
  if char_length(v_department) not between 2 and 60 then raise exception 'A valid department is required.'; end if;
  if exists (select 1 from public.profiles p join public.organization_memberships m on m.user_id = p.user_id where m.organization_id = p_org_id and lower(p.email) = v_email) then
    raise exception 'This person is already an active organisation member.';
  end if;
  if not exists (select 1 from public.organization_policies op where op.organization_id = p_org_id and op.policy -> 'departments' ? v_department) then
    raise exception 'Select a department configured for this organisation.';
  end if;
  update public.organization_invitations set status = 'expired'
    where organization_id = p_org_id and lower(email) = v_email and status = 'pending' and expires_at <= now();
  insert into public.organization_invitations (organization_id, email, role, department, invited_by)
  values (p_org_id, v_email, v_role, v_department, auth.uid()) returning id into v_id;
  perform public.calloria_write_audit(p_org_id, 'member-invited', jsonb_build_object('email', v_email, 'role', v_role, 'department', v_department));
  return v_id;
exception when unique_violation then
  raise exception 'A pending invitation already exists for this email address.';
end;
$$;

create or replace function public.accept_calloria_invitation(p_invitation_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_confirmed_at timestamptz;
  v_inv public.organization_invitations%rowtype;
  v_member_id uuid;
begin
  if v_user is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  select lower(coalesce(u.email, '')), u.email_confirmed_at into v_email, v_confirmed_at from auth.users u where u.id = v_user;
  if v_confirmed_at is null then raise exception 'Confirm your email address before accepting an organisation invitation.'; end if;
  select * into v_inv from public.organization_invitations i where i.id = p_invitation_id for update;
  if not found or v_inv.status <> 'pending' then raise exception 'This invitation is no longer available.'; end if;
  if v_inv.expires_at <= now() then
    update public.organization_invitations set status = 'expired' where id = v_inv.id;
    return null;
  end if;
  if v_inv.email <> v_email then raise exception 'Sign in using the email address that received this invitation.' using errcode = '42501'; end if;
  insert into public.organization_memberships (organization_id, user_id, role, status, department)
  values (v_inv.organization_id, v_user, v_inv.role, 'active', v_inv.department)
  returning id into v_member_id;
  update public.organization_invitations set status = 'accepted', accepted_at = now() where id = v_inv.id;
  perform public.calloria_write_audit(v_inv.organization_id, 'invitation-accepted', jsonb_build_object('user_id', v_user, 'role', v_inv.role));
  return v_member_id;
exception when unique_violation then
  raise exception 'You are already a member of this organisation.';
end;
$$;

create or replace function public.set_calloria_member_status(p_org_id uuid, p_member_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member public.organization_memberships%rowtype;
begin
  if not public.has_calloria_org_permission(p_org_id, 'members:manage') then raise exception 'You do not have permission to manage staff.' using errcode = '42501'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid staff status.'; end if;
  select * into v_member from public.organization_memberships m where m.id = p_member_id and m.organization_id = p_org_id for update;
  if not found then raise exception 'Staff member not found in this organisation.'; end if;
  if v_member.role = 'owner' then raise exception 'Owner membership cannot be suspended or changed here.'; end if;
  if v_member.user_id = auth.uid() then raise exception 'You cannot change your own access status here.'; end if;
  update public.organization_memberships set status = p_status where id = p_member_id;
  perform public.calloria_write_audit(p_org_id, 'member-' || p_status, jsonb_build_object('member_id', p_member_id, 'role', v_member.role));
end;
$$;

create or replace function public.revoke_calloria_invitation(p_org_id uuid, p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_inv public.organization_invitations%rowtype;
begin
  if not public.has_calloria_org_permission(p_org_id, 'members:manage') then raise exception 'You do not have permission to revoke invitations.' using errcode = '42501'; end if;
  select * into v_inv from public.organization_invitations where id = p_invitation_id and organization_id = p_org_id for update;
  if not found or v_inv.status <> 'pending' then raise exception 'Pending invitation not found.'; end if;
  update public.organization_invitations set status = 'revoked' where id = p_invitation_id;
  perform public.calloria_write_audit(p_org_id, 'invitation-revoked', jsonb_build_object('email', v_inv.email));
end;
$$;

create or replace function public.update_calloria_policy(p_org_id uuid, p_policy jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_voice integer; v_digital integer; v_qa integer; v_promotion integer; v_chats integer; v_retention integer;
  v_departments jsonb; v_policy jsonb;
begin
  if not public.has_calloria_org_permission(p_org_id, 'policies:manage') then raise exception 'You do not have permission to update organisation policies.' using errcode = '42501'; end if;
  if jsonb_typeof(p_policy) <> 'object' then raise exception 'Policy must be a JSON object.'; end if;
  v_voice := (p_policy ->> 'voiceResponseTargetSeconds')::integer;
  v_digital := (p_policy ->> 'digitalResponseTargetMinutes')::integer;
  v_qa := (p_policy ->> 'qaPassMark')::integer;
  v_promotion := (p_policy ->> 'promotionThreshold')::integer;
  v_chats := (p_policy ->> 'maxConcurrentChats')::integer;
  v_retention := (p_policy ->> 'dataRetentionDays')::integer;
  v_departments := p_policy -> 'departments';
  if v_voice is null or v_voice not between 5 and 600 then raise exception 'Voice target must be 5–600 seconds.'; end if;
  if v_digital is null or v_digital not between 1 and 1440 then raise exception 'Digital target must be 1–1440 minutes.'; end if;
  if v_qa is null or v_qa not between 0 and 100 then raise exception 'QA pass mark must be 0–100.'; end if;
  if v_promotion is null or v_promotion not between 0 and 100 then raise exception 'Promotion threshold must be 0–100.'; end if;
  if v_chats is null or v_chats not between 1 and 10 then raise exception 'Concurrent chats must be 1–10.'; end if;
  if v_retention is null or v_retention not between 1 and 3650 then raise exception 'Retention must be 1–3650 days.'; end if;
  if v_departments is null or jsonb_typeof(v_departments) is distinct from 'array' then raise exception 'Departments must be a JSON array.'; end if;
  if jsonb_array_length(v_departments) not between 1 and 40 then raise exception 'Provide 1–40 departments.'; end if;
  if exists (select 1 from jsonb_array_elements(v_departments) as d(value) where jsonb_typeof(d.value) <> 'string' or char_length(trim(d.value #>> '{}')) not between 2 and 60) then raise exception 'Each department must contain 2–60 characters.'; end if;
  v_policy := jsonb_build_object(
    'voiceResponseTargetSeconds', v_voice,
    'digitalResponseTargetMinutes', v_digital,
    'qaPassMark', v_qa,
    'promotionThreshold', v_promotion,
    'maxConcurrentChats', v_chats,
    'dataRetentionDays', v_retention,
    'departments', v_departments
  );
  insert into public.organization_policies (organization_id, policy, updated_by, updated_at)
  values (p_org_id, v_policy, auth.uid(), now())
  on conflict (organization_id) do update set policy = excluded.policy, updated_by = excluded.updated_by, updated_at = now();
  perform public.calloria_write_audit(p_org_id, 'policy-updated', jsonb_build_object('fields', jsonb_build_array('service-targets','quality','promotion','concurrency','retention','departments')));
  return v_policy;
end;
$$;

-- Enable RLS on every table exposed in public. No direct membership, invitation,
-- policy or audit writes are granted to browser clients; writes use checked RPCs.
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.organization_policies enable row level security;
alter table public.organization_audit enable row level security;

 drop policy if exists profiles_read_scoped on public.profiles;
create policy profiles_read_scoped on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or exists (
  select 1 from public.organization_memberships m
  where m.user_id = profiles.user_id and public.has_calloria_org_permission(m.organization_id, 'members:read')
));
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists organizations_read_member on public.organizations;
create policy organizations_read_member on public.organizations for select to authenticated
using ((select public.is_calloria_org_member(id)));

drop policy if exists memberships_read_scoped on public.organization_memberships;
create policy memberships_read_scoped on public.organization_memberships for select to authenticated
using (user_id = (select auth.uid()) or (select public.has_calloria_org_permission(organization_id, 'members:read')));

drop policy if exists invitations_read_scoped on public.organization_invitations;
create policy invitations_read_scoped on public.organization_invitations for select to authenticated
using (
  (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and status = 'pending' and expires_at > now())
  or invited_by = (select auth.uid())
  or (select public.has_calloria_org_permission(organization_id, 'members:read'))
);

drop policy if exists policies_read_member on public.organization_policies;
create policy policies_read_member on public.organization_policies for select to authenticated
using ((select public.is_calloria_org_member(organization_id)));

drop policy if exists audit_read_permission on public.organization_audit;
create policy audit_read_permission on public.organization_audit for select to authenticated
using ((select public.has_calloria_org_permission(organization_id, 'audit:read')));

grant usage on schema public to authenticated;

revoke all on table public.profiles, public.organizations, public.organization_memberships,
  public.organization_invitations, public.organization_policies, public.organization_audit from anon, authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.organizations, public.organization_memberships,
  public.organization_invitations, public.organization_policies, public.organization_audit to authenticated;

revoke all on function public.calloria_touch_updated_at() from public, anon, authenticated;
revoke all on function public.calloria_sync_profile() from public, anon, authenticated;
revoke all on function public.calloria_write_audit(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.is_calloria_org_member(uuid) from public, anon;
revoke all on function public.has_calloria_org_permission(uuid, text) from public, anon;
revoke all on function public.create_calloria_organization(text, text) from public, anon;
revoke all on function public.create_calloria_invitation(uuid, text, text, text) from public, anon;
revoke all on function public.accept_calloria_invitation(uuid) from public, anon;
revoke all on function public.set_calloria_member_status(uuid, uuid, text) from public, anon;
revoke all on function public.revoke_calloria_invitation(uuid, uuid) from public, anon;
revoke all on function public.update_calloria_policy(uuid, jsonb) from public, anon;
grant execute on function public.is_calloria_org_member(uuid) to authenticated;
grant execute on function public.has_calloria_org_permission(uuid, text) to authenticated;
grant execute on function public.create_calloria_organization(text, text) to authenticated;
grant execute on function public.create_calloria_invitation(uuid, text, text, text) to authenticated;
grant execute on function public.accept_calloria_invitation(uuid) to authenticated;
grant execute on function public.set_calloria_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_calloria_invitation(uuid, uuid) to authenticated;
grant execute on function public.update_calloria_policy(uuid, jsonb) to authenticated;

commit;
