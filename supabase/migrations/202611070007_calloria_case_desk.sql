-- CALLORIA Phase 6: guest support cases with encrypted case details.
-- Additive and isolated: only creates calloria_cc_* objects. Does not alter Prospector,
-- existing CALLORIA tables, authentication triggers, or existing policies.

create table if not exists public.calloria_cc_cases (
  id uuid primary key default gen_random_uuid(),
  reference_code text not null unique check (reference_code ~ '^CC-[0-9]{6}-[A-Z2-9]{6}$'),
  access_token_hash text not null unique check (access_token_hash ~ '^[0-9a-f]{64}$'),
  guest_fingerprint text not null check (guest_fingerprint ~ '^[0-9a-f]{64}$'),
  intent text not null check (intent in ('platform_support','service_enquiry','complaint','personal_guidance','general_customer_care')),
  department text not null,
  platform_id text null check (platform_id is null or platform_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  urgency text not null default 'normal' check (urgency in ('low','normal','high')),
  status text not null default 'received' check (status in ('received','triaged','assigned','in_progress','awaiting_customer','resolved','closed')),
  contact_preference text not null default 'none' check (contact_preference in ('none','email','phone')),
  details_ciphertext text not null,
  details_iv text not null,
  public_status_message text not null default 'Your support request has been received and is awaiting review.',
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);

create index if not exists calloria_cc_cases_status_created_idx on public.calloria_cc_cases(status, created_at desc);
create index if not exists calloria_cc_cases_expiry_idx on public.calloria_cc_cases(expires_at);
create index if not exists calloria_cc_cases_department_idx on public.calloria_cc_cases(department, urgency, created_at desc);

alter table public.calloria_cc_cases enable row level security;
revoke all on public.calloria_cc_cases from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_cc_cases to service_role;

create table if not exists public.calloria_cc_rate_limits (
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_hash, window_start)
);
create index if not exists calloria_cc_rate_limits_window_idx on public.calloria_cc_rate_limits(window_start);
alter table public.calloria_cc_rate_limits enable row level security;
revoke all on public.calloria_cc_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_cc_rate_limits to service_role;

create or replace function public.consume_calloria_cc_rate_limit(
  p_subject_hash text,
  p_window_start timestamptz,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_count integer;
begin
  if p_subject_hash is null or p_subject_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid CALLORIA case rate-limit subject.'; end if;
  if p_max_requests is null or p_max_requests < 1 or p_max_requests > 100 then raise exception 'Invalid CALLORIA case rate-limit threshold.'; end if;
  if p_window_start is null or p_window_start > now() or p_window_start < now() - interval '24 hours' then raise exception 'Invalid CALLORIA case rate-limit window.'; end if;
  insert into public.calloria_cc_rate_limits(subject_hash, window_start, request_count, updated_at)
  values (p_subject_hash, p_window_start, 1, now())
  on conflict (subject_hash, window_start) do update
    set request_count = public.calloria_cc_rate_limits.request_count + 1, updated_at = now()
  returning request_count into v_count;
  delete from public.calloria_cc_rate_limits where window_start < now() - interval '48 hours';
  return v_count <= p_max_requests;
end;
$$;
revoke all on function public.consume_calloria_cc_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_calloria_cc_rate_limit(text, timestamptz, integer) to service_role;

comment on table public.calloria_cc_cases is 'CALLORIA support case metadata. Issue and optional contact details are AES-GCM encrypted by the Edge Function; no public table access.';
comment on column public.calloria_cc_cases.access_token_hash is 'SHA-256 hash of a high-entropy one-time-displayed case access token; raw token is never stored.';
comment on column public.calloria_cc_cases.expires_at is 'Case data retention limit: 180 days. Expired records are purged during new case creation.';

alter table public.calloria_cc_cases add column if not exists assigned_to uuid null;

create table if not exists public.calloria_cc_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.calloria_cc_cases(id) on delete cascade,
  actor_id uuid null,
  event_type text not null check (event_type in ('created','status_updated','assigned','internal_note')),
  from_status text null,
  to_status text null,
  public_message text null,
  private_note_ciphertext text null,
  private_note_iv text null,
  created_at timestamptz not null default now()
);
create index if not exists calloria_cc_case_events_case_created_idx on public.calloria_cc_case_events(case_id, created_at desc);
alter table public.calloria_cc_case_events enable row level security;
revoke all on public.calloria_cc_case_events from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_cc_case_events to service_role;

create or replace function public.create_calloria_cc_case(
  p_reference_code text,
  p_access_token_hash text,
  p_guest_fingerprint text,
  p_intent text,
  p_department text,
  p_platform_id text,
  p_urgency text,
  p_contact_preference text,
  p_details_ciphertext text,
  p_details_iv text,
  p_consented_at timestamptz,
  p_expires_at timestamptz
) returns table(case_id uuid, reference_code text, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_case_id uuid;
begin
  if p_reference_code is null or p_reference_code !~ '^CC-[0-9]{6}-[A-Z2-9]{6}$' then raise exception 'Invalid case reference.'; end if;
  if p_access_token_hash is null or p_access_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid case access hash.'; end if;
  if p_guest_fingerprint is null or p_guest_fingerprint !~ '^[0-9a-f]{64}$' then raise exception 'Invalid guest fingerprint.'; end if;
  if p_intent not in ('platform_support','service_enquiry','complaint','personal_guidance','general_customer_care') then raise exception 'Invalid case intent.'; end if;
  if p_urgency not in ('low','normal','high') then raise exception 'Invalid case urgency.'; end if;
  if p_contact_preference not in ('none','email','phone') then raise exception 'Invalid contact preference.'; end if;
  if p_details_ciphertext is null or length(p_details_ciphertext) < 20 or p_details_iv is null then raise exception 'Encrypted case details are missing.'; end if;
  if p_consented_at is null or p_expires_at is null or p_expires_at <= now() then raise exception 'Invalid case retention dates.'; end if;

  insert into public.calloria_cc_cases(
    reference_code,access_token_hash,guest_fingerprint,intent,department,platform_id,urgency,
    status,contact_preference,details_ciphertext,details_iv,public_status_message,consented_at,expires_at
  ) values (
    p_reference_code,p_access_token_hash,p_guest_fingerprint,p_intent,p_department,p_platform_id,p_urgency,
    'received',p_contact_preference,p_details_ciphertext,p_details_iv,
    'Your support request has been received and is awaiting review.',p_consented_at,p_expires_at
  ) returning id into v_case_id;

  insert into public.calloria_cc_case_events(case_id,event_type,to_status,public_message)
  values (v_case_id,'created','received','Your support request has been received and is awaiting review.');

  return query select c.id,c.reference_code,c.status,c.created_at from public.calloria_cc_cases c where c.id = v_case_id;
end;
$$;
revoke all on function public.create_calloria_cc_case(text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz) from public, anon, authenticated;
grant execute on function public.create_calloria_cc_case(text,text,text,text,text,text,text,text,text,text,timestamptz,timestamptz) to service_role;

create or replace function public.update_calloria_cc_case(
  p_reference_code text,
  p_actor_id uuid,
  p_new_status text,
  p_public_message text,
  p_private_note_ciphertext text,
  p_private_note_iv text,
  p_assigned_department text,
  p_assigned_to uuid
) returns table(status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_case_id uuid; v_old_status text; v_event_type text;
begin
  if p_reference_code is null or p_reference_code !~ '^CC-[0-9]{6}-[A-Z2-9]{6}$' then raise exception 'Invalid case reference.'; end if;
  if p_actor_id is null then raise exception 'Agent identity is required.'; end if;
  if p_new_status not in ('received','triaged','assigned','in_progress','awaiting_customer','resolved','closed') then raise exception 'Invalid case status.'; end if;
  if p_public_message is null or length(trim(p_public_message)) < 5 or length(p_public_message) > 320 then raise exception 'A public status update between 5 and 320 characters is required.'; end if;
  if p_assigned_department is null or length(trim(p_assigned_department)) < 3 or length(p_assigned_department) > 120 then raise exception 'A valid department is required.'; end if;
  if (p_private_note_ciphertext is null) <> (p_private_note_iv is null) then raise exception 'Private note encryption data is incomplete.'; end if;

  select c.id,c.status into v_case_id,v_old_status
  from public.calloria_cc_cases c
  where c.reference_code = p_reference_code and c.expires_at > now()
  for update;
  if v_case_id is null then raise exception 'Case not found or expired.'; end if;

  update public.calloria_cc_cases c
  set status = p_new_status,
      department = p_assigned_department,
      assigned_to = p_assigned_to,
      public_status_message = trim(p_public_message),
      updated_at = now()
  where c.id = v_case_id;

  v_event_type := case when p_new_status <> v_old_status then 'status_updated' else 'internal_note' end;
  if p_assigned_to is not null and p_new_status = 'assigned' then v_event_type := 'assigned'; end if;
  insert into public.calloria_cc_case_events(case_id,actor_id,event_type,from_status,to_status,public_message,private_note_ciphertext,private_note_iv)
  values(v_case_id,p_actor_id,v_event_type,v_old_status,p_new_status,trim(p_public_message),p_private_note_ciphertext,p_private_note_iv);

  return query select c.status,c.updated_at from public.calloria_cc_cases c where c.id = v_case_id;
end;
$$;
revoke all on function public.update_calloria_cc_case(text,uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.update_calloria_cc_case(text,uuid,text,text,text,text,text,uuid) to service_role;
