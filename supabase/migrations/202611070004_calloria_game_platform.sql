-- CALLORIA v1.4.0 — guest-first gameplay telemetry and sponsor inventory.
-- Additive CALLORIA-prefixed objects only. This migration does not alter Prospector tables,
-- shared Supabase Auth triggers, generic profiles, or generic organisation objects.

begin;

-- Groq model IDs supported by the server-side CALLORIA AI function.
alter table public.calloria_ai_settings
  alter column model set default 'openai/gpt-oss-20b';

alter table public.calloria_ai_settings
  drop constraint if exists calloria_ai_settings_model_check;

update public.calloria_ai_settings
set model = 'openai/gpt-oss-20b'
where model not in ('openai/gpt-oss-20b', 'openai/gpt-oss-120b');

alter table public.calloria_ai_settings
  add constraint calloria_ai_settings_model_check
  check (model in ('openai/gpt-oss-20b', 'openai/gpt-oss-120b'));

create table if not exists public.calloria_game_visitors (
  visitor_hash text primary key check (visitor_hash ~ '^[0-9a-f]{64}$'),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  total_sessions bigint not null default 0 check (total_sessions >= 0)
);

create table if not exists public.calloria_game_sessions (
  session_id uuid primary key,
  visitor_hash text not null references public.calloria_game_visitors(visitor_hash) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  device_category text not null default 'desktop' check (device_category in ('desktop','tablet','mobile'))
);

create index if not exists calloria_game_sessions_active_idx
  on public.calloria_game_sessions (last_seen_at desc)
  where ended_at is null;
create index if not exists calloria_game_sessions_daily_idx
  on public.calloria_game_sessions (started_at desc);

create table if not exists public.calloria_sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_name text not null check (char_length(advertiser_name) between 2 and 100),
  campaign_name text not null check (char_length(campaign_name) between 2 and 120),
  placement text not null default 'game_launch' check (placement in ('game_launch','in_world_billboard','sponsored_scenario')),
  creative_headline text not null check (char_length(creative_headline) between 2 and 100),
  creative_text text not null default '' check (char_length(creative_text) <= 240),
  image_url text,
  destination_url text,
  status text not null default 'pending' check (status in ('draft','pending','active','paused','ended')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (image_url is null or image_url ~ '^https://'),
  check (destination_url is null or destination_url ~ '^https://')
);

create index if not exists calloria_sponsor_campaigns_active_idx
  on public.calloria_sponsor_campaigns (status, starts_at, ends_at)
  where status = 'active';

create table if not exists public.calloria_sponsor_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.calloria_sponsor_campaigns(id) on delete cascade,
  session_id uuid not null,
  visitor_hash text not null references public.calloria_game_visitors(visitor_hash) on delete cascade,
  event_type text not null check (event_type in ('impression','click')),
  occurred_at timestamptz not null default now(),
  unique (campaign_id, session_id, event_type)
);

create index if not exists calloria_sponsor_events_campaign_idx
  on public.calloria_sponsor_events (campaign_id, occurred_at desc);

alter table public.calloria_game_visitors enable row level security;
alter table public.calloria_game_sessions enable row level security;
alter table public.calloria_sponsor_campaigns enable row level security;
alter table public.calloria_sponsor_events enable row level security;

revoke all on table public.calloria_game_visitors,
  public.calloria_game_sessions,
  public.calloria_sponsor_campaigns,
  public.calloria_sponsor_events from anon, authenticated;
grant all on table public.calloria_game_visitors,
  public.calloria_game_sessions,
  public.calloria_sponsor_campaigns,
  public.calloria_sponsor_events to service_role;

create or replace function public.calloria_record_game_presence(
  p_visitor_hash text,
  p_session_id uuid,
  p_action text,
  p_device_category text default 'desktop'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows integer;
  v_device text := case when p_device_category in ('desktop','tablet','mobile') then p_device_category else 'desktop' end;
begin
  if p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid visitor token.' using errcode = '22023';
  end if;
  if p_action not in ('start','heartbeat','end') then
    raise exception 'Invalid presence action.' using errcode = '22023';
  end if;
  if p_action = 'end' then
    update public.calloria_game_sessions
      set last_seen_at = pg_catalog.now(), ended_at = pg_catalog.now()
      where session_id = p_session_id and visitor_hash = p_visitor_hash and ended_at is null;
    update public.calloria_game_visitors set last_seen_at = pg_catalog.now() where visitor_hash = p_visitor_hash;
    return;
  end if;

  insert into public.calloria_game_visitors (visitor_hash, first_seen_at, last_seen_at)
  values (p_visitor_hash, pg_catalog.now(), pg_catalog.now())
  on conflict (visitor_hash) do update set last_seen_at = pg_catalog.now();

  if p_action = 'start' then
    insert into public.calloria_game_sessions (session_id, visitor_hash, started_at, last_seen_at, ended_at, device_category)
    values (p_session_id, p_visitor_hash, pg_catalog.now(), pg_catalog.now(), null, v_device)
    on conflict (session_id) do nothing;
    get diagnostics v_rows = row_count;
    if v_rows = 1 then
      update public.calloria_game_visitors
        set total_sessions = total_sessions + 1
        where visitor_hash = p_visitor_hash;
    else
      update public.calloria_game_sessions
        set last_seen_at = pg_catalog.now(), ended_at = null, device_category = v_device
        where session_id = p_session_id and visitor_hash = p_visitor_hash;
    end if;
  else
    update public.calloria_game_sessions
      set last_seen_at = pg_catalog.now()
      where session_id = p_session_id and visitor_hash = p_visitor_hash and ended_at is null;
  end if;
end;
$$;

create or replace function public.calloria_record_sponsor_event(
  p_campaign_id uuid,
  p_session_id uuid,
  p_visitor_hash text,
  p_event_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_type not in ('impression','click') or p_visitor_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid sponsor event.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.calloria_sponsor_campaigns c
    where c.id = p_campaign_id and c.status = 'active'
      and c.starts_at <= pg_catalog.now() and c.ends_at > pg_catalog.now()
  ) then
    raise exception 'Sponsor campaign is not active.' using errcode = '22023';
  end if;
  insert into public.calloria_sponsor_events (campaign_id, session_id, visitor_hash, event_type)
  values (p_campaign_id, p_session_id, p_visitor_hash, p_event_type)
  on conflict (campaign_id, session_id, event_type) do nothing;
end;
$$;

create or replace function public.calloria_get_public_game_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'livePlayers', (
      select count(distinct s.visitor_hash)
      from public.calloria_game_sessions s
      where s.ended_at is null and s.last_seen_at >= pg_catalog.now() - interval '5 minutes'
    ),
    'totalPlayers', (select count(*) from public.calloria_game_visitors),
    'totalSessions', (select count(*) from public.calloria_game_sessions),
    'dailyPlayers', (
      select count(distinct s.visitor_hash)
      from public.calloria_game_sessions s
      where s.started_at >= pg_catalog.date_trunc('day', pg_catalog.now())
    ),
    'updatedAt', pg_catalog.now()
  );
$$;

revoke all on function public.calloria_record_game_presence(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.calloria_record_sponsor_event(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.calloria_get_public_game_stats() from public, anon, authenticated;
grant execute on function public.calloria_record_game_presence(text, uuid, text, text) to service_role;
grant execute on function public.calloria_record_sponsor_event(uuid, uuid, text, text) to service_role;
grant execute on function public.calloria_get_public_game_stats() to service_role;

commit;
