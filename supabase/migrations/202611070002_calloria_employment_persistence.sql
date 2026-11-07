-- CALLORIA v1.0.0 — persisted employment and contact-centre operations.
-- Apply after 202611070001_calloria_server_tenancy.sql in Supabase SQL Editor.
-- Only synthetic training data belongs in these records. Never store real customer secrets.

begin;

create table if not exists public.calloria_employment_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  record_type text not null check (record_type in ('employment_snapshot')),
  record_key text not null check (record_key = 'profile'),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 900000),
  revision bigint not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id, record_type, record_key),
  foreign key (organization_id, user_id)
    references public.organization_memberships(organization_id, user_id) on delete cascade
);

create index if not exists calloria_employment_records_org_updated_idx
  on public.calloria_employment_records (organization_id, updated_at desc);
create index if not exists calloria_employment_records_user_idx
  on public.calloria_employment_records (user_id, organization_id);

alter table public.calloria_employment_records enable row level security;
revoke all on table public.calloria_employment_records from anon, authenticated;
grant select on table public.calloria_employment_records to authenticated;

create policy calloria_employment_records_read on public.calloria_employment_records
for select to authenticated
using (
  organization_id in (
    select m.organization_id from public.organization_memberships m
    where m.organization_id = calloria_employment_records.organization_id
      and m.user_id = auth.uid() and m.status = 'active'
  )
  and (
    user_id = auth.uid()
    or public.has_calloria_org_permission(organization_id, 'operations:read')
  )
);

create or replace function public.save_calloria_employment_snapshot(p_org_id uuid, p_payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.calloria_employment_records%rowtype;
begin
  if v_user is null then raise exception 'Authentication required.' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org_id and m.user_id = v_user and m.status = 'active'
  ) then raise exception 'Active organisation membership required.' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload) <> 'object' or pg_column_size(p_payload) > 900000 then
    raise exception 'Employment snapshot must be an object no larger than 900 KB.' using errcode = '22023';
  end if;
  insert into public.calloria_employment_records (organization_id, user_id, record_type, record_key, payload)
  values (p_org_id, v_user, 'employment_snapshot', 'profile', p_payload)
  on conflict (organization_id, user_id, record_type, record_key)
  do update set payload = excluded.payload,
                revision = public.calloria_employment_records.revision + 1,
                updated_at = now()
  returning * into v_row;
  perform public.calloria_write_audit(p_org_id, 'employment-snapshot-saved', jsonb_build_object('user_id', v_user, 'revision', v_row.revision));
  return jsonb_build_object('id', v_row.id, 'revision', v_row.revision, 'updated_at', v_row.updated_at);
end;
$$;

revoke all on function public.save_calloria_employment_snapshot(uuid, jsonb) from public, anon;
grant execute on function public.save_calloria_employment_snapshot(uuid, jsonb) to authenticated;

commit;
