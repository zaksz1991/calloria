-- CALLORIA v1.3.0 — tenant-configured, server-mediated AI practice assistance.
-- Apply after 202611070001 and 202611070002.
-- Only synthetic training transcripts may be sent. Provider secrets remain in Edge Function secrets.

begin;

create table if not exists public.calloria_ai_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  enabled boolean not null default false,
  model text not null default 'gpt-6-luna'
    check (model in ('gpt-6-luna', 'gpt-6.1-terra')),
  daily_request_limit integer not null default 100
    check (daily_request_limit between 1 and 5000),
  redaction_required boolean not null default true check (redaction_required is true),
  updated_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_ai_usage (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  usage_date date not null,
  request_count integer not null default 0 check (request_count between 0 and 5000),
  updated_at timestamptz not null default now(),
  primary key (organization_id, usage_date)
);

alter table public.calloria_ai_settings enable row level security;
alter table public.calloria_ai_usage enable row level security;

revoke all on table public.calloria_ai_settings, public.calloria_ai_usage from anon, authenticated;
grant select, insert, update on table public.calloria_ai_settings to authenticated;

 drop policy if exists calloria_ai_settings_read_member on public.calloria_ai_settings;
create policy calloria_ai_settings_read_member on public.calloria_ai_settings
for select to authenticated
using ((select public.is_calloria_org_member(organization_id)));

drop policy if exists calloria_ai_settings_insert_admin on public.calloria_ai_settings;
create policy calloria_ai_settings_insert_admin on public.calloria_ai_settings
for insert to authenticated
with check (
  (select public.has_calloria_org_permission(organization_id, 'policies:manage'))
  and updated_by = (select auth.uid())
);

drop policy if exists calloria_ai_settings_update_admin on public.calloria_ai_settings;
create policy calloria_ai_settings_update_admin on public.calloria_ai_settings
for update to authenticated
using ((select public.has_calloria_org_permission(organization_id, 'policies:manage')))
with check (
  (select public.has_calloria_org_permission(organization_id, 'policies:manage'))
  and updated_by = (select auth.uid())
);

-- Start every existing tenant with AI disabled. An owner/admin must explicitly enable it.
insert into public.calloria_ai_settings (organization_id, enabled, model, daily_request_limit, redaction_required)
select o.id, false, 'gpt-6-luna', 100, true
from public.organizations o
on conflict (organization_id) do nothing;

create or replace function public.audit_calloria_ai_settings_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_audit (organization_id, actor_user_id, event_type, details)
  values (
    new.organization_id,
    auth.uid(),
    'ai-assistance-policy-updated',
    jsonb_build_object('enabled', new.enabled, 'model', new.model, 'daily_request_limit', new.daily_request_limit, 'redaction_required', new.redaction_required)
  );
  return new;
end;
$$;

revoke all on function public.audit_calloria_ai_settings_change() from public, anon, authenticated;
drop trigger if exists calloria_ai_settings_audit on public.calloria_ai_settings;
create trigger calloria_ai_settings_audit
after insert or update on public.calloria_ai_settings
for each row execute function public.audit_calloria_ai_settings_change();

create or replace function public.consume_calloria_ai_quota(p_org_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_limit integer;
  v_used integer;
  v_day date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  if v_user is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org_id and m.user_id = v_user and m.status = 'active'
  ) then
    raise exception 'Active organisation membership required.' using errcode = '42501';
  end if;

  select s.daily_request_limit into v_limit
  from public.calloria_ai_settings s
  where s.organization_id = p_org_id and s.enabled is true and s.redaction_required is true;
  if v_limit is null then
    raise exception 'AI assistance is disabled or unconfigured for this organisation.' using errcode = '42501';
  end if;

  insert into public.calloria_ai_usage (organization_id, usage_date, request_count, updated_at)
  values (p_org_id, v_day, 1, pg_catalog.now())
  on conflict (organization_id, usage_date)
  do update set request_count = public.calloria_ai_usage.request_count + 1,
                updated_at = pg_catalog.now()
  where public.calloria_ai_usage.request_count < v_limit
  returning request_count into v_used;

  if v_used is null then
    raise exception 'Daily AI request quota reached.' using errcode = 'P0001';
  end if;

  return greatest(0, v_limit - v_used);
end;
$$;

revoke all on function public.consume_calloria_ai_quota(uuid) from public, anon;
grant execute on function public.consume_calloria_ai_quota(uuid) to authenticated;

commit;
