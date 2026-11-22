-- CALLORIA v8.4 — durable archive and explicit resolution of workforce trend conflicts.
-- Apply once after migrations 202611220001 and 202611220002.
-- The original local and cloud variants are retained in this table before any
-- explicit decision changes the canonical organisation snapshot.

begin;

create table if not exists public.calloria_workforce_trend_conflicts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  captured_at timestamptz not null,
  local_snapshot jsonb not null check (
    pg_catalog.jsonb_typeof(local_snapshot) = 'object' and
    pg_catalog.octet_length(local_snapshot::text) <= 32768 and
    (local_snapshot ->> 'capturedAt')::timestamptz = captured_at
  ),
  cloud_snapshot jsonb not null check (
    pg_catalog.jsonb_typeof(cloud_snapshot) = 'object' and
    pg_catalog.octet_length(cloud_snapshot::text) <= 32768 and
    (cloud_snapshot ->> 'capturedAt')::timestamptz = captured_at
  ),
  local_fingerprint text generated always as (pg_catalog.md5(local_snapshot::text)) stored,
  cloud_fingerprint text generated always as (pg_catalog.md5(cloud_snapshot::text)) stored,
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolution text check (resolution is null or resolution in ('keep_local', 'keep_cloud')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_by uuid,
  resolved_at timestamptz,
  constraint calloria_workforce_trend_conflicts_different_variants
    check (local_snapshot is distinct from cloud_snapshot),
  constraint calloria_workforce_trend_conflicts_resolution_state
    check (
      (status = 'open' and resolution is null and resolved_by is null and resolved_at is null) or
      (status = 'resolved' and resolution is not null and resolved_by is not null and resolved_at is not null)
    ),
  constraint calloria_workforce_trend_conflicts_unique_pair
    unique (organization_id, captured_at, local_fingerprint, cloud_fingerprint)
);

create index if not exists calloria_workforce_trend_conflicts_org_status_time_idx
  on public.calloria_workforce_trend_conflicts (organization_id, status, captured_at desc);

-- Record both normalised variants. Repeated syncs are idempotent and never
-- replace an earlier archived pair.
create or replace function public.calloria_record_workforce_trend_conflicts_v803(
  p_org_id uuid,
  p_conflicts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw jsonb;
  v_local jsonb;
  v_cloud jsonb;
  v_captured_at timestamptz;
  v_added integer := 0;
  v_existing integer := 0;
  v_row_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_org_id is null or not public.has_calloria_org_permission(p_org_id, 'reports:read') then
    raise exception 'This organisation role cannot archive workforce report conflicts.' using errcode = '42501';
  end if;
  if p_conflicts is null or pg_catalog.jsonb_typeof(p_conflicts) <> 'array' then
    raise exception 'Conflicts must be supplied as an array.';
  end if;
  v_row_count := pg_catalog.jsonb_array_length(p_conflicts);
  if v_row_count > 90 then
    raise exception 'A maximum of 90 conflicts can be archived at once.';
  end if;

  for v_raw in select value from pg_catalog.jsonb_array_elements(p_conflicts) loop
    v_local := public.calloria_normalise_workforce_trend_snapshot_v801(v_raw -> 'localSnapshot');
    v_cloud := public.calloria_normalise_workforce_trend_snapshot_v801(v_raw -> 'cloudSnapshot');
    if v_local is null or v_cloud is null then
      raise exception 'A conflict contains an invalid aggregate snapshot.';
    end if;
    if v_local ->> 'capturedAt' is distinct from v_cloud ->> 'capturedAt' then
      raise exception 'Conflict variants must have the same capture timestamp.';
    end if;
    if v_local is not distinct from v_cloud then
      raise exception 'Identical snapshots cannot be archived as a conflict.';
    end if;
    v_captured_at := (v_local ->> 'capturedAt')::timestamptz;

    insert into public.calloria_workforce_trend_conflicts
      (organization_id, captured_at, local_snapshot, cloud_snapshot, created_by)
    values
      (p_org_id, v_captured_at, v_local, v_cloud, auth.uid())
    on conflict (organization_id, captured_at, local_fingerprint, cloud_fingerprint) do nothing;

    if found then v_added := v_added + 1; else v_existing := v_existing + 1; end if;
  end loop;

  return pg_catalog.jsonb_build_object('recorded', v_added, 'unchanged', v_existing);
end;
$$;

-- Resolve only after confirming the canonical cloud row still matches the
-- archived cloud variant. keep_local updates the canonical row only after both
-- variants have been durably archived. keep_cloud leaves it unchanged.
create or replace function public.calloria_resolve_workforce_trend_conflict_v803(
  p_conflict_id uuid,
  p_resolution text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conflict public.calloria_workforce_trend_conflicts%rowtype;
  v_current jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;
  if p_resolution is null or p_resolution not in ('keep_local', 'keep_cloud') then
    raise exception 'Select either keep_local or keep_cloud.';
  end if;

  select * into v_conflict
  from public.calloria_workforce_trend_conflicts
  where id = p_conflict_id
  for update;
  if not found then
    raise exception 'The archived conflict was not found.' using errcode = 'P0002';
  end if;
  if not public.has_calloria_org_permission(v_conflict.organization_id, 'reports:read') then
    raise exception 'This organisation role cannot resolve workforce report conflicts.' using errcode = '42501';
  end if;
  if v_conflict.status <> 'open' then
    raise exception 'This conflict has already been resolved.' using errcode = '55000';
  end if;

  select snapshot into v_current
  from public.calloria_workforce_trend_snapshots
  where organization_id = v_conflict.organization_id
    and captured_at = v_conflict.captured_at
  for update;
  if not found or v_current is distinct from v_conflict.cloud_snapshot then
    raise exception 'The organisation snapshot changed after this conflict was archived. Reload history and review the newer version.' using errcode = '40001';
  end if;

  if p_resolution = 'keep_local' then
    update public.calloria_workforce_trend_snapshots
    set snapshot = v_conflict.local_snapshot,
        schema_version = 1,
        created_at = now()
    where organization_id = v_conflict.organization_id
      and captured_at = v_conflict.captured_at;
  end if;

  update public.calloria_workforce_trend_conflicts
  set status = 'resolved',
      resolution = p_resolution,
      resolved_by = auth.uid(),
      resolved_at = now()
  where id = p_conflict_id;

  return pg_catalog.jsonb_build_object(
    'id', v_conflict.id,
    'status', 'resolved',
    'resolution', p_resolution,
    'capturedAt', v_conflict.captured_at
  );
end;
$$;


-- Retain the newest 90 resolved decisions per organisation. Open conflicts are
-- never pruned automatically; they remain visible until an authorised review.
create or replace function public.calloria_prune_workforce_trend_conflicts_v803()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.calloria_workforce_trend_conflicts stale
  where stale.organization_id = new.organization_id
    and stale.id in (
      select recent.id
      from public.calloria_workforce_trend_conflicts recent
      where recent.organization_id = new.organization_id
        and recent.status = 'resolved'
      order by recent.resolved_at desc, recent.created_at desc, recent.id desc
      offset 90
    );
  return new;
end;
$$;

drop trigger if exists calloria_workforce_trend_conflicts_prune on public.calloria_workforce_trend_conflicts;
create trigger calloria_workforce_trend_conflicts_prune
after insert or update on public.calloria_workforce_trend_conflicts
for each row execute function public.calloria_prune_workforce_trend_conflicts_v803();

alter table public.calloria_workforce_trend_conflicts enable row level security;
drop policy if exists calloria_workforce_trend_conflicts_read on public.calloria_workforce_trend_conflicts;
create policy calloria_workforce_trend_conflicts_read
  on public.calloria_workforce_trend_conflicts
  for select to authenticated
  using (public.has_calloria_org_permission(organization_id, 'reports:read'));

revoke all on table public.calloria_workforce_trend_conflicts from public, anon, authenticated;
grant select on table public.calloria_workforce_trend_conflicts to authenticated;
revoke all on function public.calloria_record_workforce_trend_conflicts_v803(uuid, jsonb) from public, anon;
grant execute on function public.calloria_record_workforce_trend_conflicts_v803(uuid, jsonb) to authenticated;
revoke all on function public.calloria_resolve_workforce_trend_conflict_v803(uuid, text) from public, anon;
revoke all on function public.calloria_prune_workforce_trend_conflicts_v803() from public, anon, authenticated;
grant execute on function public.calloria_resolve_workforce_trend_conflict_v803(uuid, text) to authenticated;

commit;
