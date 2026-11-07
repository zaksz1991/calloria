-- CALLORIA Phase 9: staff workforce control.
-- All objects are isolated under calloria_wfm_*; no existing Prospector,
-- CALLORIA authentication, CRM, knowledge or Agent Desk objects are altered.

create table if not exists public.calloria_wfm_shifts (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  department text not null check (department in (
    'RuffNeck Products and Platform Support','Sales and Service Enquiries',
    'Complaints and Service Recovery','Personal Development and Wellbeing Information',
    'General Customer Care','Email and Written Support','Social Media Support',
    'Technical Support and IT','Quality Assurance and Customer Experience',
    'Safeguarding and Trained Human Support','Learning and Career Development'
  )),
  shift_start timestamptz not null,
  shift_end timestamptz not null,
  status text not null default 'published' check (status in ('published','cancelled')),
  created_by uuid not null references auth.users(id),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (shift_end > shift_start),
  check (shift_end - shift_start between interval '4 hours' and interval '16 hours')
);

create table if not exists public.calloria_wfm_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.calloria_wfm_shifts(id) on delete cascade,
  activity text not null check (activity in (
    'customer_work','break','lunch','briefing','training','coaching',
    'quality_assurance','back_office','system_admin','prayer'
  )),
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create table if not exists public.calloria_wfm_attendance (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null unique references public.calloria_wfm_shifts(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz null,
  current_activity text not null default 'customer_work' check (current_activity in (
    'customer_work','break','lunch','briefing','training','coaching',
    'quality_assurance','back_office','system_admin','prayer','offline'
  )),
  last_activity_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);

create table if not exists public.calloria_wfm_activity_blocks (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references public.calloria_wfm_shifts(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  activity text not null check (activity in (
    'customer_work','break','lunch','briefing','training','coaching',
    'quality_assurance','back_office','system_admin','prayer','offline'
  )),
  started_at timestamptz not null default now(),
  ended_at timestamptz null,
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create table if not exists public.calloria_wfm_briefings (
  id uuid primary key default gen_random_uuid(),
  work_date date not null,
  department text not null check (department in (
    'RuffNeck Products and Platform Support','Sales and Service Enquiries',
    'Complaints and Service Recovery','Personal Development and Wellbeing Information',
    'General Customer Care','Email and Written Support','Social Media Support',
    'Technical Support and IT','Quality Assurance and Customer Experience',
    'Safeguarding and Trained Human Support','Learning and Career Development'
  )),
  briefing_type text not null check (briefing_type in ('morning','afternoon')),
  title text not null check (char_length(title) between 3 and 140),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'Africa/Lagos',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique(work_date, department, briefing_type),
  check (ends_at > starts_at)
);

create table if not exists public.calloria_wfm_briefing_attendance (
  briefing_id uuid not null references public.calloria_wfm_briefings(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (briefing_id, staff_user_id)
);

create table if not exists public.calloria_wfm_events (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id),
  shift_id uuid null references public.calloria_wfm_shifts(id) on delete set null,
  event_type text not null check (event_type in (
    'shift_published','clock_in','clock_out','activity_changed','briefing_acknowledged'
  )),
  detail text null check (detail is null or char_length(detail) <= 40),
  created_at timestamptz not null default now()
);

create index if not exists calloria_wfm_shifts_staff_start_idx
  on public.calloria_wfm_shifts(staff_user_id, shift_start);
create index if not exists calloria_wfm_shifts_department_start_idx
  on public.calloria_wfm_shifts(department, shift_start);
create index if not exists calloria_wfm_blocks_shift_time_idx
  on public.calloria_wfm_schedule_blocks(shift_id, start_at);
create index if not exists calloria_wfm_activity_staff_time_idx
  on public.calloria_wfm_activity_blocks(staff_user_id, started_at desc);
create unique index if not exists calloria_wfm_one_open_activity_per_staff
  on public.calloria_wfm_activity_blocks(staff_user_id) where ended_at is null;
create index if not exists calloria_wfm_briefings_date_department_idx
  on public.calloria_wfm_briefings(work_date, department, starts_at);
create index if not exists calloria_wfm_events_staff_time_idx
  on public.calloria_wfm_events(staff_user_id, created_at desc);

alter table public.calloria_wfm_shifts enable row level security;
alter table public.calloria_wfm_schedule_blocks enable row level security;
alter table public.calloria_wfm_attendance enable row level security;
alter table public.calloria_wfm_activity_blocks enable row level security;
alter table public.calloria_wfm_briefings enable row level security;
alter table public.calloria_wfm_briefing_attendance enable row level security;
alter table public.calloria_wfm_events enable row level security;

revoke all on public.calloria_wfm_shifts, public.calloria_wfm_schedule_blocks,
  public.calloria_wfm_attendance, public.calloria_wfm_activity_blocks,
  public.calloria_wfm_briefings, public.calloria_wfm_briefing_attendance,
  public.calloria_wfm_events from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_wfm_shifts,
  public.calloria_wfm_schedule_blocks, public.calloria_wfm_attendance,
  public.calloria_wfm_activity_blocks, public.calloria_wfm_briefings,
  public.calloria_wfm_briefing_attendance, public.calloria_wfm_events to service_role;

create or replace function public.calloria_wfm_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
revoke all on function public.calloria_wfm_touch_updated_at() from public, anon, authenticated;
drop trigger if exists calloria_wfm_shifts_touch on public.calloria_wfm_shifts;
create trigger calloria_wfm_shifts_touch before update on public.calloria_wfm_shifts
for each row execute function public.calloria_wfm_touch_updated_at();

create or replace function public.calloria_wfm_create_shift(
  p_staff_user_id uuid,
  p_department text,
  p_shift_start timestamptz,
  p_shift_end timestamptz,
  p_created_by uuid,
  p_blocks jsonb
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_shift_id uuid;
  v_block jsonb;
  v_activity text;
  v_start timestamptz;
  v_end timestamptz;
begin
  if p_shift_end <= p_shift_start or p_shift_end - p_shift_start < interval '4 hours'
     or p_shift_end - p_shift_start > interval '16 hours' then
    raise exception 'Shift duration must be between four and sixteen hours.';
  end if;
  if jsonb_typeof(coalesce(p_blocks, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_blocks, '[]'::jsonb)) > 24 then
    raise exception 'Invalid planned activity blocks.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text, 901));
  if exists (
    select 1 from public.calloria_wfm_shifts s
    where s.staff_user_id = p_staff_user_id and s.status = 'published'
      and s.shift_start < p_shift_end and s.shift_end > p_shift_start
  ) then
    raise exception 'This staff member already has an overlapping published shift.';
  end if;

  insert into public.calloria_wfm_shifts(staff_user_id, department, shift_start, shift_end, created_by)
  values (p_staff_user_id, p_department, p_shift_start, p_shift_end, p_created_by)
  returning id into v_shift_id;

  if jsonb_array_length(coalesce(p_blocks, '[]'::jsonb)) = 0 then
    insert into public.calloria_wfm_schedule_blocks(shift_id, activity, start_at, end_at)
    values (v_shift_id, 'customer_work', p_shift_start, p_shift_end);
  else
    for v_block in select value from jsonb_array_elements(p_blocks) loop
      v_activity := v_block->>'activity';
      v_start := (v_block->>'startAt')::timestamptz;
      v_end := (v_block->>'endAt')::timestamptz;
      if v_activity not in ('customer_work','break','lunch','briefing','training','coaching','quality_assurance','back_office','system_admin','prayer','offline')
         or v_start < p_shift_start or v_end > p_shift_end or v_end <= v_start
         or v_end - v_start < interval '5 minutes' then
        raise exception 'A planned activity block is invalid or outside the shift.';
      end if;
      if exists (
        select 1 from public.calloria_wfm_schedule_blocks b
        where b.shift_id = v_shift_id and b.start_at < v_end and b.end_at > v_start
      ) then raise exception 'Planned activity blocks must not overlap.'; end if;
      insert into public.calloria_wfm_schedule_blocks(shift_id, activity, start_at, end_at)
      values (v_shift_id, v_activity, v_start, v_end);
    end loop;
  end if;

  insert into public.calloria_wfm_events(staff_user_id, actor_user_id, shift_id, event_type)
  values (p_staff_user_id, p_created_by, v_shift_id, 'shift_published');
  return v_shift_id;
end;
$$;
revoke all on function public.calloria_wfm_create_shift(uuid,text,timestamptz,timestamptz,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.calloria_wfm_create_shift(uuid,text,timestamptz,timestamptz,uuid,jsonb) to service_role;

create or replace function public.calloria_wfm_clock_in(p_shift_id uuid, p_staff_user_id uuid)
returns public.calloria_wfm_attendance
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_shift public.calloria_wfm_shifts;
  v_attendance public.calloria_wfm_attendance;
  v_activity text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text, 902));
  select * into v_shift from public.calloria_wfm_shifts where id = p_shift_id and staff_user_id = p_staff_user_id and status = 'published' for update;
  if not found then raise exception 'Published shift was not found for this staff account.'; end if;
  if now() < v_shift.shift_start - interval '3 hours' or now() > v_shift.shift_end + interval '2 hours' then
    raise exception 'Clock-in is outside the permitted window for this shift.';
  end if;
  select b.activity into v_activity from public.calloria_wfm_schedule_blocks b
  where b.shift_id = p_shift_id and b.start_at <= now() and b.end_at > now()
  order by b.start_at limit 1;
  v_activity := coalesce(v_activity, 'customer_work');
  insert into public.calloria_wfm_attendance(shift_id, staff_user_id, current_activity)
  values (p_shift_id, p_staff_user_id, v_activity) returning * into v_attendance;
  insert into public.calloria_wfm_activity_blocks(shift_id, staff_user_id, activity)
  values (p_shift_id, p_staff_user_id, v_activity);
  insert into public.calloria_wfm_events(staff_user_id, actor_user_id, shift_id, event_type, detail)
  values (p_staff_user_id, p_staff_user_id, p_shift_id, 'clock_in', v_activity);
  return v_attendance;
end;
$$;
revoke all on function public.calloria_wfm_clock_in(uuid,uuid) from public, anon, authenticated;
grant execute on function public.calloria_wfm_clock_in(uuid,uuid) to service_role;

create or replace function public.calloria_wfm_change_activity(p_shift_id uuid, p_staff_user_id uuid, p_activity text)
returns public.calloria_wfm_attendance
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_attendance public.calloria_wfm_attendance;
begin
  if p_activity not in ('customer_work','break','lunch','briefing','training','coaching','quality_assurance','back_office','system_admin','prayer') then
    raise exception 'Unsupported workforce activity.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text, 902));
  select * into v_attendance from public.calloria_wfm_attendance
  where shift_id = p_shift_id and staff_user_id = p_staff_user_id and clock_out is null for update;
  if not found then raise exception 'Clock in before recording a workforce activity.'; end if;
  update public.calloria_wfm_activity_blocks set ended_at = now()
  where staff_user_id = p_staff_user_id and shift_id = p_shift_id and ended_at is null;
  insert into public.calloria_wfm_activity_blocks(shift_id, staff_user_id, activity)
  values (p_shift_id, p_staff_user_id, p_activity);
  update public.calloria_wfm_attendance set current_activity = p_activity, last_activity_at = now()
  where id = v_attendance.id returning * into v_attendance;
  insert into public.calloria_wfm_events(staff_user_id, actor_user_id, shift_id, event_type, detail)
  values (p_staff_user_id, p_staff_user_id, p_shift_id, 'activity_changed', p_activity);
  return v_attendance;
end;
$$;
revoke all on function public.calloria_wfm_change_activity(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.calloria_wfm_change_activity(uuid,uuid,text) to service_role;

create or replace function public.calloria_wfm_clock_out(p_shift_id uuid, p_staff_user_id uuid)
returns public.calloria_wfm_attendance
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_attendance public.calloria_wfm_attendance;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text, 902));
  select * into v_attendance from public.calloria_wfm_attendance
  where shift_id = p_shift_id and staff_user_id = p_staff_user_id and clock_out is null for update;
  if not found then raise exception 'No open attendance record exists for this shift.'; end if;
  update public.calloria_wfm_activity_blocks set ended_at = greatest(now(), started_at)
  where staff_user_id = p_staff_user_id and shift_id = p_shift_id and ended_at is null;
  update public.calloria_wfm_attendance set clock_out = greatest(now(), clock_in), current_activity = 'offline', last_activity_at = now()
  where id = v_attendance.id returning * into v_attendance;
  insert into public.calloria_wfm_events(staff_user_id, actor_user_id, shift_id, event_type)
  values (p_staff_user_id, p_staff_user_id, p_shift_id, 'clock_out');
  return v_attendance;
end;
$$;
revoke all on function public.calloria_wfm_clock_out(uuid,uuid) from public, anon, authenticated;
grant execute on function public.calloria_wfm_clock_out(uuid,uuid) to service_role;

create or replace function public.calloria_wfm_seed_standard_briefings(
  p_work_date date, p_departments text[], p_created_by uuid
) returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_department text;
  v_type text;
  v_time time;
  v_title text;
  v_count integer := 0;
  v_inserted integer;
begin
  foreach v_department in array p_departments loop
    if v_department not in (
      'RuffNeck Products and Platform Support','Sales and Service Enquiries',
      'Complaints and Service Recovery','Personal Development and Wellbeing Information',
      'General Customer Care','Email and Written Support','Social Media Support',
      'Technical Support and IT','Quality Assurance and Customer Experience',
      'Safeguarding and Trained Human Support','Learning and Career Development'
    ) then raise exception 'Unknown briefing department.'; end if;
    foreach v_type in array array['morning','afternoon'] loop
      if v_type = 'morning' then v_time := time '07:30'; v_title := 'Morning product and service briefing';
      else v_time := time '14:00'; v_title := 'Afternoon operations and update briefing'; end if;
      insert into public.calloria_wfm_briefings(work_date, department, briefing_type, title, starts_at, ends_at, created_by)
      values (p_work_date, v_department, v_type, v_title,
        ((p_work_date + v_time) at time zone 'Africa/Lagos'),
        ((p_work_date + v_time + interval '30 minutes') at time zone 'Africa/Lagos'), p_created_by)
      on conflict (work_date, department, briefing_type) do nothing;
      get diagnostics v_inserted = row_count;
      v_count := v_count + v_inserted;
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.calloria_wfm_seed_standard_briefings(date,text[],uuid) from public, anon, authenticated;
grant execute on function public.calloria_wfm_seed_standard_briefings(date,text[],uuid) to service_role;

comment on table public.calloria_wfm_shifts is 'CALLORIA staff workforce shifts; publication and attendance are controlled by the calloria-workforce Edge Function.';
comment on table public.calloria_wfm_activity_blocks is 'Actual staff activity intervals explicitly recorded by staff in Workforce Control; not device surveillance or telephony proof.';
comment on table public.calloria_wfm_briefings is 'Department briefing sessions defaulted to 07:30 and 14:00 Africa/Lagos.';
