-- CALLORIA Phase 5: privacy-preserving rate limits for guest Customer Care requests.
-- Stores only HMAC fingerprints and short time buckets, never customer messages or PII.
create table if not exists public.calloria_kb_rate_limits (
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_hash, window_start)
);
create index if not exists calloria_kb_rate_limits_window_idx
  on public.calloria_kb_rate_limits(window_start);

alter table public.calloria_kb_rate_limits enable row level security;
revoke all on public.calloria_kb_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_kb_rate_limits to service_role;

create or replace function public.consume_calloria_kb_rate_limit(
  p_subject_hash text,
  p_window_start timestamptz,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_subject_hash is null or p_subject_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid CALLORIA rate-limit subject.';
  end if;
  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 100 then
    raise exception 'Invalid CALLORIA rate-limit threshold.';
  end if;
  if p_window_start is null or p_window_start > now() or p_window_start < now() - interval '15 minutes' then
    raise exception 'Invalid CALLORIA rate-limit window.';
  end if;

  insert into public.calloria_kb_rate_limits(subject_hash, window_start, request_count, updated_at)
  values (p_subject_hash, p_window_start, 1, now())
  on conflict (subject_hash, window_start)
  do update set
    request_count = public.calloria_kb_rate_limits.request_count + 1,
    updated_at = now()
  returning request_count into v_count;

  -- Retain only a short operational window; no message or identity data is stored.
  delete from public.calloria_kb_rate_limits
  where window_start < now() - interval '48 hours';

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_calloria_kb_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_calloria_kb_rate_limit(text, timestamptz, integer) to service_role;
