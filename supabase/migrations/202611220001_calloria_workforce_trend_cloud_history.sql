-- CALLORIA v8.1 — organisation-scoped, privacy-minimised workforce trend history.
-- Apply once after CALLORIA tenancy migration 202611070001 has succeeded.
-- This migration creates only CALLORIA-prefixed objects and does not alter Prospector tables.

begin;

create table if not exists public.calloria_workforce_trend_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  captured_at timestamptz not null,
  schema_version smallint not null default 1 check (schema_version = 1),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_catalog.octet_length(snapshot::text) <= 32768),
  created_at timestamptz not null default now(),
  unique (organization_id, captured_at)
);

create index if not exists calloria_workforce_trend_snapshots_org_time_idx
  on public.calloria_workforce_trend_snapshots (organization_id, captured_at desc);

create or replace function public.calloria_workforce_safe_count_v801(p_value jsonb)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) not in ('number', 'string') then return 0; end if;
  v := p_value #>> '{}';
  if v !~ '^[0-9]{1,9}$' then return 0; end if;
  return least(1000000, v::integer);
exception when others then
  return 0;
end;
$$;

create or replace function public.calloria_workforce_safe_percent_v801(p_value jsonb)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) not in ('number', 'string') then return null; end if;
  v := p_value #>> '{}';
  if v !~ '^(100(\.0{1,2})?|([0-9]{1,2})(\.[0-9]{1,2})?)$' then return null; end if;
  return v::numeric;
exception when others then
  return null;
end;
$$;

-- Rebuild the accepted snapshot from an allow-list. Extra client-supplied keys,
-- including employee IDs, customer identifiers, transcripts and arbitrary notes,
-- are discarded before persistence.
create or replace function public.calloria_normalise_workforce_trend_snapshot_v801(p_snapshot jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_captured_at timestamptz;
  v_source_version text;
  v_summary jsonb;
  v_workstreams jsonb := '[]'::jsonb;
  v_departments jsonb := '[]'::jsonb;
  v_row jsonb;
  v_id text;
  v_label text;
  v_department text;
  v_count integer := 0;
  v_result jsonb;
begin
  if p_snapshot is null or pg_catalog.jsonb_typeof(p_snapshot) <> 'object' then return null; end if;
  if public.calloria_workforce_safe_count_v801(p_snapshot -> 'schemaVersion') <> 1 then return null; end if;
  if pg_catalog.jsonb_typeof(p_snapshot -> 'summary') is distinct from 'object' then return null; end if;
  begin
    v_captured_at := (p_snapshot ->> 'capturedAt')::timestamptz;
  exception when others then
    return null;
  end;
  if v_captured_at is null then return null; end if;

  v_source_version := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_snapshot ->> 'sourceVersion', 'unknown')), '[[:cntrl:]]', ' ', 'g'), 20);
  if v_source_version = '' then v_source_version := 'unknown'; end if;

  v_summary := pg_catalog.jsonb_build_object(
    'digitalAgents', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,digitalAgents}'),
    'completedReplies', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,completedReplies}'),
    'openDigitalWork', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,openDigitalWork}'),
    'overdueDigitalWork', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,overdueDigitalWork}'),
    'atRiskDigitalWork', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,atRiskDigitalWork}'),
    'responseTargetRate', public.calloria_workforce_safe_percent_v801(p_snapshot #> '{summary,responseTargetRate}'),
    'workstreamsAvailable', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,workstreamsAvailable}'),
    'departmentsAvailable', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,departmentsAvailable}'),
    'agentsNeedingSupervisorAttention', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,agentsNeedingSupervisorAttention}'),
    'departmentCoveragePercent', public.calloria_workforce_safe_percent_v801(p_snapshot #> '{summary,departmentCoveragePercent}'),
    'mappedDepartmentAgents', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,mappedDepartmentAgents}'),
    'identifiedDigitalAgents', public.calloria_workforce_safe_count_v801(p_snapshot #> '{summary,identifiedDigitalAgents}')
  );

  if pg_catalog.jsonb_typeof(p_snapshot -> 'workstreams') = 'array' then
    for v_row in select value from pg_catalog.jsonb_array_elements(p_snapshot -> 'workstreams') loop
      if pg_catalog.jsonb_typeof(v_row) <> 'object' then continue; end if;
      v_id := v_row ->> 'id';
      if v_id is null or v_id not in ('voice', 'email', 'live_chat', 'social', 'unmapped') then continue; end if;
      v_count := v_count + 1;
      if v_count > 5 then exit; end if;
      v_label := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_row ->> 'label', v_id)), '[[:cntrl:]]', ' ', 'g'), 60);
      v_workstreams := v_workstreams || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'id', v_id,
        'label', v_label,
        'available', coalesce((v_row ->> 'available') = 'true', false),
        'completed', public.calloria_workforce_safe_count_v801(v_row -> 'completed'),
        'responseTargetRate', public.calloria_workforce_safe_percent_v801(v_row -> 'responseTargetRate'),
        'open', public.calloria_workforce_safe_count_v801(v_row -> 'open'),
        'overdue', public.calloria_workforce_safe_count_v801(v_row -> 'overdue'),
        'atRisk', public.calloria_workforce_safe_count_v801(v_row -> 'atRisk')
      ));
    end loop;
  end if;

  v_count := 0;
  if pg_catalog.jsonb_typeof(p_snapshot -> 'departments') = 'array' then
    for v_row in select value from pg_catalog.jsonb_array_elements(p_snapshot -> 'departments') loop
      if pg_catalog.jsonb_typeof(v_row) <> 'object' then continue; end if;
      v_department := pg_catalog.left(pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(v_row ->> 'department', '')), '[[:cntrl:]]', ' ', 'g'), 100);
      if v_department = '' then continue; end if;
      v_count := v_count + 1;
      if v_count > 100 then exit; end if;
      v_departments := v_departments || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'department', v_department,
        'agents', public.calloria_workforce_safe_count_v801(v_row -> 'agents'),
        'completed', public.calloria_workforce_safe_count_v801(v_row -> 'completed'),
        'responseTargetRate', public.calloria_workforce_safe_percent_v801(v_row -> 'responseTargetRate'),
        'open', public.calloria_workforce_safe_count_v801(v_row -> 'open'),
        'overdue', public.calloria_workforce_safe_count_v801(v_row -> 'overdue'),
        'atRisk', public.calloria_workforce_safe_count_v801(v_row -> 'atRisk')
      ));
    end loop;
  end if;

  v_result := pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'capturedAt', v_captured_at,
    'sourceVersion', v_source_version,
    'summary', v_summary,
    'workstreams', v_workstreams,
    'departments', v_departments
  );
  if pg_catalog.octet_length(v_result::text) > 32768 then return null; end if;
  return v_result;
end;
$$;

create or replace function public.calloria_save_workforce_trend_snapshots(
  p_org_id uuid,
  p_snapshots jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw jsonb;
  v_snapshot jsonb;
  v_captured_at timestamptz;
  v_saved integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_org_id is null or not public.has_calloria_org_permission(p_org_id, 'reports:read') then
    raise exception 'This organisation role cannot save workforce report history.' using errcode = '42501';
  end if;
  if p_snapshots is null or pg_catalog.jsonb_typeof(p_snapshots) <> 'array' then
    raise exception 'Snapshots must be supplied as an array.';
  end if;
  if pg_catalog.jsonb_array_length(p_snapshots) > 90 then
    raise exception 'A maximum of 90 snapshots can be synchronised at once.';
  end if;

  for v_raw in select value from pg_catalog.jsonb_array_elements(p_snapshots) loop
    v_snapshot := public.calloria_normalise_workforce_trend_snapshot_v801(v_raw);
    if v_snapshot is null then
      raise exception 'A snapshot is invalid or exceeds the accepted aggregate schema.';
    end if;
    v_captured_at := (v_snapshot ->> 'capturedAt')::timestamptz;
    insert into public.calloria_workforce_trend_snapshots
      (organization_id, captured_at, schema_version, snapshot)
    values
      (p_org_id, v_captured_at, 1, v_snapshot)
    on conflict (organization_id, captured_at) do update
      set snapshot = excluded.snapshot,
          created_at = now();
    v_saved := v_saved + 1;
  end loop;
  return v_saved;
end;
$$;

create or replace function public.calloria_prune_workforce_trend_snapshots_v801()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.calloria_workforce_trend_snapshots stale
  where stale.organization_id = new.organization_id
    and stale.id in (
      select recent.id
      from public.calloria_workforce_trend_snapshots recent
      where recent.organization_id = new.organization_id
      order by recent.captured_at desc, recent.created_at desc, recent.id desc
      offset 90
    );
  return new;
end;
$$;

drop trigger if exists calloria_workforce_trend_snapshots_prune on public.calloria_workforce_trend_snapshots;
create trigger calloria_workforce_trend_snapshots_prune
after insert or update on public.calloria_workforce_trend_snapshots
for each row execute function public.calloria_prune_workforce_trend_snapshots_v801();

alter table public.calloria_workforce_trend_snapshots enable row level security;
drop policy if exists calloria_workforce_trend_snapshots_read on public.calloria_workforce_trend_snapshots;
create policy calloria_workforce_trend_snapshots_read
  on public.calloria_workforce_trend_snapshots
  for select to authenticated
  using (public.has_calloria_org_permission(organization_id, 'reports:read'));

revoke all on table public.calloria_workforce_trend_snapshots from public, anon, authenticated;
grant select on table public.calloria_workforce_trend_snapshots to authenticated;

revoke all on function public.calloria_workforce_safe_count_v801(jsonb) from public, anon, authenticated;
revoke all on function public.calloria_workforce_safe_percent_v801(jsonb) from public, anon, authenticated;
revoke all on function public.calloria_normalise_workforce_trend_snapshot_v801(jsonb) from public, anon, authenticated;
revoke all on function public.calloria_save_workforce_trend_snapshots(uuid, jsonb) from public, anon;
grant execute on function public.calloria_save_workforce_trend_snapshots(uuid, jsonb) to authenticated;
revoke all on function public.calloria_prune_workforce_trend_snapshots_v801() from public, anon, authenticated;

commit;
