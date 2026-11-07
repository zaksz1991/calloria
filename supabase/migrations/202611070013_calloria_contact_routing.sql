-- CALLORIA Phase 12: guest-first contact routing linked to the existing Agent Desk.
-- Dependencies: Phase 8 (calloria_ops_*) and Phase 9 (calloria_wfm_*).
-- New objects are restricted to calloria_route_*; shared Prospector objects are untouched.

create table if not exists public.calloria_route_requests (
  id uuid primary key default gen_random_uuid(),
  route_ref text not null unique check (route_ref ~ '^CR-[0-9]{8}-[A-Z0-9]{6}$'),
  work_item_id uuid not null unique references public.calloria_ops_work_items(id) on delete cascade,
  department text not null check (department in (
    'RuffNeck Products and Platform Support','Sales and Service Enquiries',
    'Complaints and Service Recovery','Personal Development and Wellbeing Information',
    'General Customer Care','Email and Written Support','Social Media Support',
    'Technical Support and IT','Quality Assurance and Customer Experience',
    'Safeguarding and Trained Human Support','Learning and Career Development'
  )),
  channel text not null check (channel in ('voice','email','live_chat','social','whatsapp','website','portal','game','back_office')),
  platform_id text null check (platform_id is null or platform_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  intent text not null check (intent in ('platform_support','account_access','technical_support','sales_enquiry','complaint','personal_guidance','safeguarding','learning_career','social_media','general')),
  language text not null check (language in ('en','ha','yo','ig','pcm')),
  required_skills text[] not null check (cardinality(required_skills) between 1 and 4),
  priority text not null check (priority in ('low','normal','high','urgent')),
  status text not null default 'queued' check (status in ('queued','assigned','completed','abandoned','cancelled')),
  access_token_hash text not null,
  assigned_to uuid null references auth.users(id) on delete set null,
  assigned_at timestamptz null,
  last_actor_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_due_at timestamptz not null default (now() + interval '180 days')
);

create table if not exists public.calloria_route_events (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.calloria_route_requests(id) on delete cascade,
  actor_id uuid not null,
  actor_label text not null check (actor_label in ('customer','system','staff')),
  event_type text not null check (event_type in ('request_queued','request_assigned','request_requeued','request_completed','request_cancelled','request_abandoned')),
  created_at timestamptz not null default now()
);

create table if not exists public.calloria_route_rate_limits (
  fingerprint_hash text not null,
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (fingerprint_hash, bucket_start)
);

create index if not exists calloria_route_queue_idx
  on public.calloria_route_requests (department, status, priority, created_at);
create index if not exists calloria_route_assignee_idx
  on public.calloria_route_requests (assigned_to, assigned_at desc) where assigned_to is not null;
create index if not exists calloria_route_event_idx
  on public.calloria_route_events (route_id, created_at desc);
create index if not exists calloria_route_retention_idx
  on public.calloria_route_requests (retention_due_at) where status in ('completed','abandoned','cancelled');

alter table public.calloria_route_requests enable row level security;
alter table public.calloria_route_events enable row level security;
alter table public.calloria_route_rate_limits enable row level security;
revoke all on public.calloria_route_requests, public.calloria_route_events, public.calloria_route_rate_limits from public, anon, authenticated;
grant select, insert, update on public.calloria_route_requests to service_role;
grant select, insert on public.calloria_route_events to service_role;
grant select, insert, update, delete on public.calloria_route_rate_limits to service_role;

create or replace function public.calloria_route_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if old.status is distinct from new.status and new.status in ('completed','abandoned','cancelled') then
    new.retention_due_at := now() + interval '180 days';
  end if;
  return new;
end;
$$;
revoke all on function public.calloria_route_touch_updated_at() from public, anon, authenticated;
drop trigger if exists calloria_route_requests_touch on public.calloria_route_requests;
create trigger calloria_route_requests_touch
  before update on public.calloria_route_requests
  for each row execute function public.calloria_route_touch_updated_at();

create or replace function public.calloria_route_write_event()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
    values (new.id, '00000000-0000-4000-8000-000000000000'::uuid, 'customer', 'request_queued');
  elsif old.status is distinct from new.status then
    if new.status = 'assigned' then
      insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
      values (new.id, coalesce(new.last_actor_id, new.assigned_to, '00000000-0000-4000-8000-000000000000'::uuid), 'staff', 'request_assigned');
    elsif new.status = 'queued' and old.status = 'assigned' then
      insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
      values (new.id, coalesce(new.last_actor_id, '00000000-0000-4000-8000-000000000000'::uuid), 'staff', 'request_requeued');
    elsif new.status = 'completed' then
      insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
      values (new.id, coalesce(new.last_actor_id, new.assigned_to, '00000000-0000-4000-8000-000000000000'::uuid), 'staff', 'request_completed');
    elsif new.status = 'cancelled' then
      insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
      values (new.id, coalesce(new.last_actor_id, new.assigned_to, '00000000-0000-4000-8000-000000000000'::uuid), 'staff', 'request_cancelled');
    elsif new.status = 'abandoned' then
      insert into public.calloria_route_events(route_id, actor_id, actor_label, event_type)
      values (new.id, '00000000-0000-4000-8000-000000000000'::uuid, 'customer', 'request_abandoned');
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.calloria_route_write_event() from public, anon, authenticated;
drop trigger if exists calloria_route_requests_event on public.calloria_route_requests;
create trigger calloria_route_requests_event
  after insert or update of status on public.calloria_route_requests
  for each row execute function public.calloria_route_write_event();

-- Guest-routed work items may only be claimed by the skills/Workforce-aware
-- routing RPC. This prevents the older generic Agent Desk claim button from
-- bypassing language, skill, shift and concurrency eligibility.
create or replace function public.calloria_route_guard_claim()
returns trigger language plpgsql set search_path = pg_catalog, public
as $$
begin
  if new.work_ref like 'CR-%'
     and old.status in ('pending','escalated')
     and new.status = 'claimed'
     and current_setting('calloria.route_claim_authorized', true) is distinct from 'true' then
    raise exception using errcode = '42501',
      message = 'Guest support requests must be claimed through CALLORIA Routing Control.';
  end if;
  return new;
end;
$$;
revoke all on function public.calloria_route_guard_claim() from public, anon, authenticated;
drop trigger if exists calloria_route_guard_guest_claim on public.calloria_ops_work_items;
create trigger calloria_route_guard_guest_claim
  before update of status on public.calloria_ops_work_items
  for each row execute function public.calloria_route_guard_claim();

create or replace function public.calloria_route_sync_work_item_status()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if new.status = 'resolved' then
    update public.calloria_route_requests set status = 'completed', last_actor_id = new.last_actor_id
    where work_item_id = new.id and status in ('queued','assigned');
  elsif new.status = 'cancelled' then
    update public.calloria_route_requests set status = 'cancelled', last_actor_id = new.last_actor_id
    where work_item_id = new.id and status in ('queued','assigned');
  elsif new.status in ('pending','escalated') and new.assigned_to is null then
    -- Agent Desk release/escalation returns guest-routed work to the skills queue.
    update public.calloria_route_requests
       set status = 'queued', assigned_to = null, assigned_at = null, last_actor_id = new.last_actor_id
     where work_item_id = new.id and status = 'assigned';
  elsif new.status = 'claimed' and new.assigned_to is not null then
    -- Keep route state in sync if a future approved staff workflow claims it.
    update public.calloria_route_requests
       set status = 'assigned', assigned_to = new.assigned_to,
           assigned_at = coalesce(new.claimed_at, now()), last_actor_id = new.last_actor_id
     where work_item_id = new.id and status = 'queued';
  end if;
  return new;
end;
$$;
revoke all on function public.calloria_route_sync_work_item_status() from public, anon, authenticated;
drop trigger if exists calloria_route_work_item_status_sync on public.calloria_ops_work_items;
create trigger calloria_route_work_item_status_sync
  after update of status on public.calloria_ops_work_items
  for each row when (old.status is distinct from new.status)
  execute function public.calloria_route_sync_work_item_status();

create or replace function public.calloria_route_consume_limit(
  p_fingerprint_hash text,
  p_bucket_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  if length(p_fingerprint_hash) <> 64 or p_limit < 1 or p_limit > 30 then
    raise exception 'Invalid routing rate-limit arguments.';
  end if;
  delete from public.calloria_route_rate_limits where bucket_start < now() - interval '48 hours';
  insert into public.calloria_route_rate_limits(fingerprint_hash, bucket_start, request_count)
  values (p_fingerprint_hash, p_bucket_start, 1)
  on conflict (fingerprint_hash, bucket_start) do update
    set request_count = public.calloria_route_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.calloria_route_consume_limit(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.calloria_route_consume_limit(text,timestamptz,integer) to service_role;

create or replace function public.calloria_route_create_request(
  p_route_ref text,
  p_department text,
  p_channel text,
  p_platform_id text,
  p_intent text,
  p_language text,
  p_required_skills text[],
  p_priority text,
  p_subject text,
  p_summary_ciphertext text,
  p_summary_iv text,
  p_access_token_hash text
) returns public.calloria_route_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_item_id uuid;
  v_route public.calloria_route_requests;
  v_priority_minutes integer;
  v_system_actor constant uuid := '00000000-0000-4000-8000-000000000000'::uuid;
begin
  if p_priority not in ('low','normal','high','urgent') then raise exception 'Unsupported priority.'; end if;
  v_priority_minutes := case p_priority when 'urgent' then 5 when 'high' then 15 when 'normal' then 60 else 240 end;
  insert into public.calloria_ops_work_items(
    work_ref, department, channel, direction, priority, platform_id,
    subject, summary_ciphertext, summary_iv, status, due_at, created_by
  ) values (
    p_route_ref, p_department, p_channel, 'inbound', p_priority, p_platform_id,
    p_subject, p_summary_ciphertext, p_summary_iv, 'pending', now() + make_interval(mins => v_priority_minutes), v_system_actor
  ) returning id into v_item_id;

  insert into public.calloria_route_requests(
    route_ref, work_item_id, department, channel, platform_id, intent,
    language, required_skills, priority, access_token_hash
  ) values (
    p_route_ref, v_item_id, p_department, p_channel, p_platform_id, p_intent,
    p_language, p_required_skills, p_priority, p_access_token_hash
  ) returning * into v_route;
  return v_route;
end;
$$;
revoke all on function public.calloria_route_create_request(text,text,text,text,text,text,text[],text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_route_create_request(text,text,text,text,text,text,text[],text,text,text,text,text) to service_role;

create or replace function public.calloria_route_purge_closed()
returns integer language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_deleted integer;
begin
  delete from public.calloria_ops_work_items w
  using public.calloria_route_requests r
  where r.work_item_id = w.id
    and r.status in ('completed','abandoned','cancelled')
    and r.retention_due_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;
revoke all on function public.calloria_route_purge_closed() from public, anon, authenticated;
grant execute on function public.calloria_route_purge_closed() to service_role;

create or replace function public.calloria_route_queue_summary(p_departments text[])
returns table(department text, priority text, total bigint, oldest_created_at timestamptz)
language sql security definer set search_path = pg_catalog, public
as $$
  select q.department, q.priority, count(*)::bigint, min(q.created_at)
  from public.calloria_route_requests q
  where q.status = 'queued' and q.department = any(p_departments)
  group by q.department, q.priority;
$$;
revoke all on function public.calloria_route_queue_summary(text[]) from public, anon, authenticated;
grant execute on function public.calloria_route_queue_summary(text[]) to service_role;

create or replace function public.calloria_route_claim_next(
  p_agent_id uuid,
  p_actor_role text,
  p_departments text[],
  p_skills text[],
  p_channels text[],
  p_languages text[],
  p_max_concurrency integer
) returns setof public.calloria_route_requests
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_route public.calloria_route_requests;
  v_active integer;
  v_shift_department text;
begin
  if p_actor_role not in ('agent','supervisor') or p_max_concurrency < 1 or p_max_concurrency > 10 then
    raise exception 'Invalid routing staff grant.';
  end if;

  -- Serialize simultaneous claims by one employee before checking capacity.
  perform pg_advisory_xact_lock(hashtextextended(p_agent_id::text, 120013));

  -- A current published shift, matching department and customer-work activity are required.
  select s.department into v_shift_department
  from public.calloria_wfm_attendance a
  join public.calloria_wfm_shifts s on s.id = a.shift_id
  where a.staff_user_id = p_agent_id and a.clock_out is null
    and a.current_activity = 'customer_work' and s.status = 'published'
    and s.shift_start <= now() and s.shift_end > now()
  order by s.shift_start desc
  limit 1;
  if not found or v_shift_department is null or not (v_shift_department = any(p_departments)) then return; end if;

  select count(*) into v_active
  from public.calloria_ops_work_items w
  where w.assigned_to = p_agent_id and w.status in ('claimed','active','on_hold','after_contact_work');
  if v_active >= p_max_concurrency then return; end if;

  select q.* into v_route
  from public.calloria_route_requests q
  join public.calloria_ops_work_items w on w.id = q.work_item_id
  where q.status = 'queued' and w.status in ('pending','escalated') and w.assigned_to is null
    and q.department = v_shift_department and q.department = any(p_departments)
    and q.channel = any(p_channels)
    and q.language = any(p_languages)
    and q.required_skills <@ p_skills
  order by
    case when q.priority = 'urgent' then 0 else greatest(1,
      (case q.priority when 'high' then 1 when 'normal' then 2 else 3 end)
      - floor(extract(epoch from (now() - q.created_at)) / 1800)::integer
    ) end,
    q.created_at asc
  limit 1
  for update of q, w skip locked;
  if not found then return; end if;

  update public.calloria_route_requests
  set status = 'assigned', assigned_to = p_agent_id, assigned_at = now(), last_actor_id = p_agent_id, updated_at = now()
  where id = v_route.id returning * into v_route;

  perform set_config('calloria.route_claim_authorized', 'true', true);
  update public.calloria_ops_work_items
  set assigned_to = p_agent_id, claimed_at = now(), status = 'claimed',
      last_actor_id = p_agent_id, last_actor_role = p_actor_role,
      version = version + 1, updated_at = now()
  where id = v_route.work_item_id and status in ('pending','escalated') and assigned_to is null;

  if not found then raise exception 'The selected work item could not be claimed. The transaction has been rolled back.'; end if;
  return next v_route;
end;
$$;
revoke all on function public.calloria_route_claim_next(uuid,text,text[],text[],text[],text[],integer) from public, anon, authenticated;
grant execute on function public.calloria_route_claim_next(uuid,text,text[],text[],text[],text[],integer) to service_role;

comment on table public.calloria_route_requests is 'CALLORIA guest support routing records. Customer narratives remain encrypted in the linked Agent Desk work item.';
comment on table public.calloria_route_events is 'Minimal routing event trail; contains no customer free text or contact details.';
comment on table public.calloria_route_rate_limits is 'Short-window hashed guest rate-limit counters; no raw IP address is stored.';
