-- CALLORIA v8.3 — make organisation workforce snapshots append-only by capture time.
-- Apply once after 202611220001_calloria_workforce_trend_cloud_history.sql.
-- No table is added and no existing snapshot is rewritten or deleted.

begin;

-- Backwards-compatible hardening: older v8.1 clients may still call this RPC.
-- Preserve its integer return contract, but never replace a different snapshot
-- at an existing organisation/captured_at key.
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
  v_existing jsonb;
  v_inserted_id uuid;
  v_accepted integer := 0;
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
    v_inserted_id := null;
    insert into public.calloria_workforce_trend_snapshots
      (organization_id, captured_at, schema_version, snapshot)
    values
      (p_org_id, v_captured_at, 1, v_snapshot)
    on conflict (organization_id, captured_at) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is not null then
      v_accepted := v_accepted + 1;
      continue;
    end if;

    select snapshot into v_existing
    from public.calloria_workforce_trend_snapshots
    where organization_id = p_org_id and captured_at = v_captured_at;
    if not found then
      raise exception 'The existing snapshot could not be checked safely; retry the synchronisation.';
    end if;
    if v_existing is distinct from v_snapshot then
      raise exception 'A different organisation snapshot already exists at capture time %. Existing data was preserved; export the local history before resolving this conflict.', v_captured_at
        using errcode = '23505';
    end if;
    v_accepted := v_accepted + 1;
  end loop;

  return v_accepted;
end;
$$;

-- New detailed RPC: reports collisions without overwriting either the cloud
-- record or the browser-local copy. Insertions and identical retries are safe.
create or replace function public.calloria_sync_workforce_trend_snapshots_v802(
  p_org_id uuid,
  p_snapshots jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_raw jsonb;
  v_snapshot jsonb;
  v_captured_at timestamptz;
  v_existing jsonb;
  v_inserted_id uuid;
  v_inserted integer := 0;
  v_unchanged integer := 0;
  v_conflicts integer := 0;
  v_conflict_times jsonb := '[]'::jsonb;
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
    v_inserted_id := null;

    insert into public.calloria_workforce_trend_snapshots
      (organization_id, captured_at, schema_version, snapshot)
    values
      (p_org_id, v_captured_at, 1, v_snapshot)
    on conflict (organization_id, captured_at) do nothing
    returning id into v_inserted_id;

    if v_inserted_id is not null then
      v_inserted := v_inserted + 1;
      continue;
    end if;

    select snapshot into v_existing
    from public.calloria_workforce_trend_snapshots
    where organization_id = p_org_id and captured_at = v_captured_at;
    if not found then
      raise exception 'The existing snapshot could not be checked safely; retry the synchronisation.';
    end if;

    if v_existing is not distinct from v_snapshot then
      v_unchanged := v_unchanged + 1;
    else
      v_conflicts := v_conflicts + 1;
      if pg_catalog.jsonb_array_length(v_conflict_times) < 90 then
        v_conflict_times := v_conflict_times || pg_catalog.jsonb_build_array(v_captured_at);
      end if;
    end if;
  end loop;

  return pg_catalog.jsonb_build_object(
    'inserted', v_inserted,
    'unchanged', v_unchanged,
    'conflicts', v_conflicts,
    'conflictCapturedAt', v_conflict_times
  );
end;
$$;

revoke all on function public.calloria_save_workforce_trend_snapshots(uuid, jsonb) from public, anon;
grant execute on function public.calloria_save_workforce_trend_snapshots(uuid, jsonb) to authenticated;
revoke all on function public.calloria_sync_workforce_trend_snapshots_v802(uuid, jsonb) from public, anon;
grant execute on function public.calloria_sync_workforce_trend_snapshots_v802(uuid, jsonb) to authenticated;

commit;
