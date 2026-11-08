-- CALLORIA Phase 18: live PSTN voice integration through Signals Programmable Voice.
-- This migration is additive and uses only calloria_voice_* objects.

create table if not exists public.calloria_voice_calls (
  id uuid primary key default gen_random_uuid(),
  call_ref text not null unique,
  provider text not null default 'signals' check (provider = 'signals'),
  provider_call_sid text unique,
  direction text not null check (direction in ('inbound','outbound')),
  status text not null default 'initiated' check (status in ('initiated','queued','ringing','in_progress','completed','busy','no-answer','failed','canceled','uncertain','rejected')),
  status_sequence integer not null default -1,
  route_ref text,
  department text,
  language text,
  staff_user_id uuid,
  ring_target_user_id uuid,
  inbound_dial_started_at timestamptz,
  from_ciphertext text not null,
  from_iv text not null,
  to_ciphertext text not null,
  to_iv text not null,
  from_masked text not null,
  to_masked text not null,
  call_duration_seconds integer,
  callback_authorization_id uuid,
  idempotency_key text unique,
  consent_type text,
  consent_evidence_reference text,
  recording_mode text not null default 'off' check (recording_mode = 'off'),
  provider_error_code text,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_voice_events (
  id uuid primary key default gen_random_uuid(),
  provider_call_sid text not null references public.calloria_voice_calls(provider_call_sid) on delete cascade,
  event_key text not null unique,
  sequence_number integer not null default -1,
  event_status text not null,
  duration_seconds integer,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.calloria_voice_callback_approvals (
  id uuid primary key default gen_random_uuid(),
  callback_ref text not null unique,
  route_ref text not null,
  requested_by uuid not null,
  phone_lookup_hash text not null,
  consent_type text not null check (consent_type in ('customer_requested_callback','service_follow_up_permission')),
  requested_at timestamptz not null,
  evidence_reference text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','used')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calloria_voice_calls_created_idx on public.calloria_voice_calls(created_at desc);
create index if not exists calloria_voice_calls_route_idx on public.calloria_voice_calls(route_ref, created_at desc);
create index if not exists calloria_voice_calls_staff_idx on public.calloria_voice_calls(staff_user_id, created_at desc);
create index if not exists calloria_voice_calls_status_idx on public.calloria_voice_calls(status, created_at desc);
create index if not exists calloria_voice_callback_status_idx on public.calloria_voice_callback_approvals(status, created_at desc);
create index if not exists calloria_voice_callback_route_idx on public.calloria_voice_callback_approvals(route_ref, created_at desc);
create unique index if not exists calloria_voice_callback_active_route_phone_uniq on public.calloria_voice_callback_approvals(route_ref, phone_lookup_hash) where status in ('pending','approved');

alter table public.calloria_voice_calls enable row level security;
alter table public.calloria_voice_events enable row level security;
alter table public.calloria_voice_callback_approvals enable row level security;
revoke all on public.calloria_voice_calls, public.calloria_voice_events, public.calloria_voice_callback_approvals from public, anon, authenticated;
grant all on public.calloria_voice_calls, public.calloria_voice_events, public.calloria_voice_callback_approvals to service_role;

create or replace function public.calloria_voice_touch_updated_at()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists calloria_voice_calls_touch on public.calloria_voice_calls;
create trigger calloria_voice_calls_touch before update on public.calloria_voice_calls
for each row execute function public.calloria_voice_touch_updated_at();
drop trigger if exists calloria_voice_callbacks_touch on public.calloria_voice_callback_approvals;
create trigger calloria_voice_callbacks_touch before update on public.calloria_voice_callback_approvals
for each row execute function public.calloria_voice_touch_updated_at();

create or replace function public.calloria_voice_start_inbound(
  p_call_ref text, p_provider_call_sid text, p_from_ciphertext text, p_from_iv text,
  p_to_ciphertext text, p_to_iv text, p_from_masked text, p_to_masked text,
  p_received_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_call public.calloria_voice_calls;
begin
  if p_call_ref !~ '^VC-[0-9]{8}-[A-Z2-9]{6}$' or p_provider_call_sid !~ '^CA[0-9a-fA-F]{32}$' then
    raise exception 'Invalid voice call reference.';
  end if;
  insert into public.calloria_voice_calls(
    call_ref, provider_call_sid, direction, status, status_sequence, from_ciphertext, from_iv,
    to_ciphertext, to_iv, from_masked, to_masked, created_at
  ) values (
    p_call_ref, p_provider_call_sid, 'inbound', 'in_progress', 2, p_from_ciphertext, p_from_iv,
    p_to_ciphertext, p_to_iv, p_from_masked, p_to_masked, coalesce(p_received_at,now())
  ) on conflict (provider_call_sid) do nothing;
  select * into v_call from public.calloria_voice_calls where provider_call_sid = p_provider_call_sid;
  return jsonb_build_object('call_ref',v_call.call_ref,'route_ref',v_call.route_ref,'status',v_call.status,'duplicate',v_call.call_ref <> p_call_ref);
end; $$;
revoke all on function public.calloria_voice_start_inbound(text,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.calloria_voice_start_inbound(text,text,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function public.calloria_voice_route_inbound(
  p_provider_call_sid text, p_route_ref text, p_department text, p_language text,
  p_intent text, p_required_skills text[], p_priority text, p_subject text,
  p_summary_ciphertext text, p_summary_iv text, p_access_token_hash text, p_ring_target_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_call public.calloria_voice_calls; v_route public.calloria_route_requests;
begin
  select * into v_call from public.calloria_voice_calls where provider_call_sid = p_provider_call_sid for update;
  if not found or v_call.direction <> 'inbound' then raise exception 'Inbound voice call was not found.'; end if;
  if v_call.route_ref is not null then return jsonb_build_object('route_ref',v_call.route_ref,'duplicate',true); end if;
  select * into v_route from public.calloria_route_create_request(
    p_route_ref, p_department, 'voice', null, p_intent, p_language, p_required_skills,
    p_priority, p_subject, p_summary_ciphertext, p_summary_iv, p_access_token_hash
  );
  update public.calloria_voice_calls set route_ref=p_route.route_ref, department=p_department,
    language=p_language, ring_target_user_id=p_ring_target_user_id where id=v_call.id;
  return jsonb_build_object('route_ref',p_route.route_ref,'duplicate',false);
end; $$;
revoke all on function public.calloria_voice_route_inbound(text,text,text,text,text,text[],text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.calloria_voice_route_inbound(text,text,text,text,text,text[],text,text,text,text,text,uuid) to service_role;

create or replace function public.calloria_voice_reserve_inbound_dial(p_provider_call_sid text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_call public.calloria_voice_calls; v_updated integer; v_active integer;
begin
  select * into v_call from public.calloria_voice_calls
  where provider_call_sid=p_provider_call_sid and direction='inbound'
    and route_ref is not null and ring_target_user_id is not null and inbound_dial_started_at is null
  for update;
  if not found then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_call.ring_target_user_id::text,180018));
  select count(*) into v_active from public.calloria_voice_calls
  where ring_target_user_id=v_call.ring_target_user_id and direction='inbound'
    and id<>v_call.id and inbound_dial_started_at is not null and completed_at is null
    and status in ('initiated','queued','ringing','in_progress','uncertain');
  if v_active >= 1 then return false; end if;
  update public.calloria_voice_calls set inbound_dial_started_at=now()
  where id=v_call.id and inbound_dial_started_at is null;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end; $$;
revoke all on function public.calloria_voice_reserve_inbound_dial(text) from public, anon, authenticated;
grant execute on function public.calloria_voice_reserve_inbound_dial(text) to service_role;

create or replace function public.calloria_voice_bind_provider_sid(p_call_ref text,p_provider_call_sid text)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_updated integer;
begin
  if p_provider_call_sid !~ '^CA[0-9a-fA-F]{32}$' then return false; end if;
  update public.calloria_voice_calls set provider_call_sid=p_provider_call_sid
  where call_ref=p_call_ref and direction='outbound' and (provider_call_sid is null or provider_call_sid=p_provider_call_sid);
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end; $$;
revoke all on function public.calloria_voice_bind_provider_sid(text,text) from public, anon, authenticated;
grant execute on function public.calloria_voice_bind_provider_sid(text,text) to service_role;

create or replace function public.calloria_voice_agent_ready(
  p_agent_id uuid, p_department text, p_language text, p_required_skill text,
  p_max_concurrency integer, p_ignore_route_ref text default null
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_shift_department text; v_active integer; v_voice_active integer;
begin
  if p_max_concurrency < 1 or p_max_concurrency > 10 then return false; end if;
  select s.department into v_shift_department from public.calloria_wfm_attendance a
  join public.calloria_wfm_shifts s on s.id=a.shift_id
  where a.staff_user_id=p_agent_id and a.clock_out is null and a.current_activity='customer_work'
    and s.status='published' and s.shift_start<=now() and s.shift_end>now()
  order by s.shift_start desc limit 1;
  if not found or v_shift_department <> p_department then return false; end if;
  select count(*) into v_active from public.calloria_ops_work_items w
  where w.assigned_to=p_agent_id and w.status in ('claimed','active','on_hold','after_contact_work')
    and (p_ignore_route_ref is null or w.work_ref <> p_ignore_route_ref);
  select count(*) into v_voice_active from public.calloria_voice_calls c
  where ((c.staff_user_id=p_agent_id and c.direction='outbound')
      or (c.ring_target_user_id=p_agent_id and c.direction='inbound' and c.inbound_dial_started_at is not null))
    and c.status in ('initiated','queued','ringing','in_progress','uncertain') and c.completed_at is null;
  return (v_active + v_voice_active) < p_max_concurrency;
end; $$;
revoke all on function public.calloria_voice_agent_ready(uuid,text,text,text,integer,text) from public, anon, authenticated;
grant execute on function public.calloria_voice_agent_ready(uuid,text,text,text,integer,text) to service_role;

create or replace function public.calloria_voice_claim_inbound(
  p_provider_call_sid text, p_agent_id uuid, p_actor_role text, p_departments text[],
  p_skills text[], p_languages text[], p_max_concurrency integer
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_call public.calloria_voice_calls; v_route public.calloria_route_requests; v_active integer; v_voice_active integer; v_shift_department text;
begin
  select * into v_call from public.calloria_voice_calls where provider_call_sid=p_provider_call_sid for update;
  if not found or v_call.direction <> 'inbound' or v_call.route_ref is null or v_call.ring_target_user_id <> p_agent_id then return false; end if;
  select * into v_route from public.calloria_route_requests where route_ref=v_call.route_ref for update;
  if not found or v_route.status <> 'queued' or v_route.channel <> 'voice' then return false; end if;
  if p_actor_role not in ('agent','supervisor') or p_max_concurrency < 1 or p_max_concurrency > 10 then return false; end if;
  if not (v_route.department = any(p_departments)) or not (v_route.language = any(p_languages)) or not (v_route.required_skills <@ p_skills) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_agent_id::text, 120018));
  select s.department into v_shift_department from public.calloria_wfm_attendance a
  join public.calloria_wfm_shifts s on s.id=a.shift_id
  where a.staff_user_id=p_agent_id and a.clock_out is null and a.current_activity='customer_work'
    and s.status='published' and s.shift_start<=now() and s.shift_end>now()
  order by s.shift_start desc limit 1;
  if not found or v_shift_department <> v_route.department then return false; end if;
  select count(*) into v_active from public.calloria_ops_work_items w
  where w.assigned_to=p_agent_id and w.status in ('claimed','active','on_hold','after_contact_work');
  select count(*) into v_voice_active from public.calloria_voice_calls c
  where ((c.staff_user_id=p_agent_id and c.direction='outbound')
      or (c.ring_target_user_id=p_agent_id and c.direction='inbound' and c.inbound_dial_started_at is not null))
    and c.id<>v_call.id and c.status in ('initiated','queued','ringing','in_progress','uncertain') and c.completed_at is null;
  if v_active + v_voice_active >= p_max_concurrency then return false; end if;
  update public.calloria_route_requests set status='assigned',assigned_to=p_agent_id,assigned_at=now(),last_actor_id=p_agent_id,updated_at=now()
  where id=v_route.id;
  perform set_config('calloria.route_claim_authorized','true',true);
  update public.calloria_ops_work_items set assigned_to=p_agent_id,claimed_at=now(),status='claimed',
    last_actor_id=p_agent_id,last_actor_role=p_actor_role,version=version+1,updated_at=now()
  where id=v_route.work_item_id and status in ('pending','escalated') and assigned_to is null;
  if not found then raise exception 'Voice work item claim failed; transaction rolled back.'; end if;
  update public.calloria_voice_calls set staff_user_id=p_agent_id,status='completed' where id=v_call.id;
  return true;
end; $$;
revoke all on function public.calloria_voice_claim_inbound(text,uuid,text,text[],text[],text[],integer) from public, anon, authenticated;
grant execute on function public.calloria_voice_claim_inbound(text,uuid,text,text[],text[],text[],integer) to service_role;

create or replace function public.calloria_voice_request_callback(
  p_callback_ref text, p_route_ref text, p_staff_user_id uuid, p_phone_lookup_hash text,
  p_consent_type text, p_requested_at timestamptz, p_evidence_reference text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_route public.calloria_route_requests; v_row public.calloria_voice_callback_approvals;
begin
  if p_callback_ref !~ '^VCA-[0-9]{8}-[A-Z2-9]{6}$' then raise exception 'Invalid callback reference.'; end if;
  if p_consent_type not in ('customer_requested_callback','service_follow_up_permission') then raise exception 'Invalid callback consent type.'; end if;
  if p_requested_at is null or p_requested_at > now() + interval '5 minutes' or p_requested_at < now() - interval '30 days' then raise exception 'Callback consent date is outside the allowed window.'; end if;
  if p_evidence_reference is null or length(p_evidence_reference) < 6 or length(p_evidence_reference) > 100 then raise exception 'A traceable consent evidence reference is required.'; end if;
  select * into v_route from public.calloria_route_requests where route_ref=p_route_ref and status='assigned' and assigned_to=p_staff_user_id;
  if not found then raise exception 'Callback must belong to a work item currently assigned to this staff member.'; end if;
  insert into public.calloria_voice_callback_approvals(
    callback_ref,route_ref,requested_by,phone_lookup_hash,consent_type,requested_at,evidence_reference
  ) values (
    p_callback_ref,p_route_ref,p_staff_user_id,p_phone_lookup_hash,p_consent_type,p_requested_at,p_evidence_reference
  ) returning * into v_row;
  return jsonb_build_object('callback_ref',v_row.callback_ref,'status',v_row.status,'expires_at',v_row.expires_at);
end; $$;
revoke all on function public.calloria_voice_request_callback(text,text,uuid,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.calloria_voice_request_callback(text,text,uuid,text,text,timestamptz,text) to service_role;

create or replace function public.calloria_voice_decide_callback(
  p_callback_ref text, p_supervisor_id uuid, p_approve boolean, p_note text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.calloria_voice_callback_approvals; v_status text;
begin
  select * into v_row from public.calloria_voice_callback_approvals where callback_ref=p_callback_ref for update;
  if not found or v_row.status <> 'pending' or v_row.requested_by=p_supervisor_id then raise exception 'Callback request is not eligible for this decision.'; end if;
  if v_row.expires_at <= now() then update public.calloria_voice_callback_approvals set status='expired' where id=v_row.id; raise exception 'Callback authorization has expired.'; end if;
  v_status := case when p_approve then 'approved' else 'rejected' end;
  update public.calloria_voice_callback_approvals set status=v_status,decided_by=p_supervisor_id,decided_at=now(),decision_note=left(coalesce(p_note,''),300)
  where id=v_row.id;
  return jsonb_build_object('callback_ref',v_row.callback_ref,'status',v_status);
end; $$;
revoke all on function public.calloria_voice_decide_callback(text,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.calloria_voice_decide_callback(text,uuid,boolean,text) to service_role;

create or replace function public.calloria_voice_reserve_outbound(
  p_call_ref text, p_idempotency_key text, p_route_ref text, p_staff_user_id uuid,
  p_callback_ref text, p_phone_lookup_hash text, p_customer_ciphertext text, p_customer_iv text,
  p_agent_ciphertext text, p_agent_iv text, p_customer_masked text, p_agent_masked text,
  p_max_concurrency integer
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_existing public.calloria_voice_calls; v_callback public.calloria_voice_callback_approvals; v_route public.calloria_route_requests; v_outbound_count integer;
begin
  select * into v_existing from public.calloria_voice_calls where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('call_ref',v_existing.call_ref,'status',v_existing.status,'provider_call_sid',v_existing.provider_call_sid,'duplicate',true); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text,180018));
  select * into v_callback from public.calloria_voice_callback_approvals where callback_ref=p_callback_ref for update;
  if not found or v_callback.status <> 'approved' or v_callback.used_at is not null or v_callback.expires_at <= now() then raise exception 'An unused supervisor-approved callback is required.'; end if;
  if v_callback.phone_lookup_hash <> p_phone_lookup_hash or v_callback.route_ref <> p_route_ref or v_callback.requested_by <> p_staff_user_id then raise exception 'Callback phone or ownership does not match the approved request.'; end if;
  select * into v_route from public.calloria_route_requests where route_ref=p_route_ref and status='assigned' and assigned_to=p_staff_user_id for update;
  if not found then raise exception 'The related work item is no longer assigned to this staff member.'; end if;
  if not public.calloria_voice_agent_ready(p_staff_user_id,v_route.department,v_route.language,
      coalesce(v_route.required_skills[1],'general_customer_care'),p_max_concurrency,p_route_ref) then
    raise exception 'The published shift, active work or voice-line availability does not permit another outbound call.';
  end if;
  select count(*) into v_outbound_count from public.calloria_voice_calls
  where staff_user_id=p_staff_user_id and created_at > now()-interval '1 hour' and direction='outbound';
  if v_outbound_count >= 10 then raise exception 'The hourly outbound callback limit has been reached.'; end if;
  insert into public.calloria_voice_calls(
    call_ref,direction,status,route_ref,department,language,staff_user_id,from_ciphertext,from_iv,
    to_ciphertext,to_iv,from_masked,to_masked,idempotency_key,callback_authorization_id,consent_type,consent_evidence_reference
  ) values (
    p_call_ref,'outbound','initiated',p_route_ref,v_route.department,v_route.language,p_staff_user_id,
    p_agent_ciphertext,p_agent_iv,p_customer_ciphertext,p_customer_iv,p_agent_masked,p_customer_masked,
    p_idempotency_key,v_callback.id,v_callback.consent_type,v_callback.evidence_reference
  );
  update public.calloria_voice_callback_approvals set status='used',used_at=now() where id=v_callback.id;
  return jsonb_build_object('call_ref',p_call_ref,'status','initiated','duplicate',false);
end; $$;
revoke all on function public.calloria_voice_reserve_outbound(text,text,text,uuid,text,text,text,text,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.calloria_voice_reserve_outbound(text,text,text,uuid,text,text,text,text,text,text,text,text,integer) to service_role;

create or replace function public.calloria_voice_finalize_outbound(
  p_call_ref text, p_provider_call_sid text, p_status text, p_error_code text default null
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_row public.calloria_voice_calls;
begin
  if p_status not in ('queued','uncertain','rejected') then raise exception 'Unsupported outbound call result.'; end if;
  update public.calloria_voice_calls set provider_call_sid=coalesce(p_provider_call_sid,provider_call_sid),
    status=case when status_sequence < 0 then p_status else status end,
    provider_error_code=left(coalesce(p_error_code,''),40)
  where call_ref=p_call_ref returning * into v_row;
  return found;
end; $$;
revoke all on function public.calloria_voice_finalize_outbound(text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_voice_finalize_outbound(text,text,text,text) to service_role;

create or replace function public.calloria_voice_update_status(
  p_provider_call_sid text,p_event_key text,p_sequence_number integer,p_status text,p_duration_seconds integer,p_received_at timestamptz
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_call public.calloria_voice_calls;
begin
  if p_status not in ('queued','ringing','in-progress','completed','busy','no-answer','failed','canceled') or p_sequence_number < 0 then return false; end if;
  select * into v_call from public.calloria_voice_calls where provider_call_sid=p_provider_call_sid for update;
  if not found then return false; end if;
  insert into public.calloria_voice_events(provider_call_sid,event_key,sequence_number,event_status,duration_seconds,received_at)
  values(p_provider_call_sid,p_event_key,p_sequence_number,p_status,p_duration_seconds,coalesce(p_received_at,now()))
  on conflict(event_key) do nothing;
  if not found then return true; end if;
  update public.calloria_voice_calls set status=case p_status when 'in-progress' then 'in_progress' else p_status end,
    status_sequence=p_sequence_number,call_duration_seconds=coalesce(p_duration_seconds,call_duration_seconds),
    answered_at=case when p_status='in-progress' then coalesce(answered_at,coalesce(p_received_at,now())) else answered_at end,
    completed_at=case when p_status in ('completed','busy','no-answer','failed','canceled') then coalesce(p_received_at,now()) else completed_at end
  where provider_call_sid=p_provider_call_sid and p_sequence_number > status_sequence;
  return true;
end; $$;
revoke all on function public.calloria_voice_update_status(text,text,integer,text,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.calloria_voice_update_status(text,text,integer,text,integer,timestamptz) to service_role;

create or replace function public.calloria_voice_record_dial_result(
  p_provider_call_sid text,p_event_key text,p_dial_status text,p_duration_seconds integer
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not exists (select 1 from public.calloria_voice_calls where provider_call_sid=p_provider_call_sid) then return false; end if;
  insert into public.calloria_voice_events(provider_call_sid,event_key,sequence_number,event_status,duration_seconds)
  values(p_provider_call_sid,p_event_key,100,'dial-'||left(p_dial_status,30),p_duration_seconds)
  on conflict(event_key) do nothing;
  if not found then return true; end if;
  update public.calloria_voice_calls set call_duration_seconds=coalesce(p_duration_seconds,call_duration_seconds),
    status=case when p_dial_status='completed' then 'completed' when p_dial_status='busy' then 'busy' when p_dial_status='no-answer' then 'no-answer' else 'failed' end,
    completed_at=now() where provider_call_sid=p_provider_call_sid;
  return found;
end; $$;
revoke all on function public.calloria_voice_record_dial_result(text,text,text,integer) from public, anon, authenticated;
grant execute on function public.calloria_voice_record_dial_result(text,text,text,integer) to service_role;

comment on table public.calloria_voice_calls is 'CALLORIA provider-confirmed voice call records. Phone numbers are encrypted; call recording is disabled by design.';
comment on table public.calloria_voice_events is 'Minimal, idempotent voice provider status events. No raw phone numbers or message content.';
comment on table public.calloria_voice_callback_approvals is 'Supervisor-approved callback authorizations. The customer phone is represented only by a keyed lookup hash.';
