-- CALLORIA Phase 15: Resend-backed email support channel.
-- Additive namespace only. Requires Contact Routing migration 013 and Phase 14 routing access.

create table if not exists public.calloria_email_threads (
  id uuid primary key default gen_random_uuid(),
  thread_hash text not null unique check (thread_hash ~ '^[0-9a-f]{64}$'),
  sender_hash text not null check (sender_hash ~ '^[0-9a-f]{64}$'),
  sender_ciphertext text not null,
  sender_iv text not null,
  display_name_ciphertext text,
  display_name_iv text,
  subject_ciphertext text not null,
  subject_iv text not null,
  active_route_ref text,
  latest_inbound_at timestamptz not null,
  latest_message_id text,
  reference_ids text[] not null default '{}',
  marketing_opt_out boolean not null default false,
  retention_due_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calloria_email_threads_latest_idx
  on public.calloria_email_threads (latest_inbound_at desc);
create index if not exists calloria_email_threads_route_idx
  on public.calloria_email_threads (active_route_ref);
create index if not exists calloria_email_threads_retention_idx
  on public.calloria_email_threads (retention_due_at);

create table if not exists public.calloria_email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.calloria_email_threads(id) on delete cascade,
  provider_email_id text not null unique,
  direction text not null check (direction in ('inbound','outbound')),
  subject_ciphertext text not null,
  subject_iv text not null,
  body_ciphertext text not null,
  body_iv text not null,
  attachments_ciphertext text,
  attachments_iv text,
  provider_message_id text,
  in_reply_to_id text,
  reference_ids text[] not null default '{}',
  provider_status text not null default 'received' check (provider_status in ('received','sending','sent','failed','unknown')),
  provider_error_code text,
  route_ref text,
  sent_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists calloria_email_messages_thread_idx
  on public.calloria_email_messages (thread_id, created_at);
create index if not exists calloria_email_messages_route_idx
  on public.calloria_email_messages (route_ref);

create table if not exists public.calloria_email_webhook_events (
  provider_event_id text primary key,
  event_kind text not null,
  outcome text not null default 'received' check (outcome in ('received','processed','ignored','failed')),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.calloria_email_send_limits (
  staff_user_id uuid not null,
  bucket_start timestamptz not null,
  send_count integer not null default 0 check (send_count >= 0),
  primary key (staff_user_id, bucket_start)
);

alter table public.calloria_email_threads enable row level security;
alter table public.calloria_email_messages enable row level security;
alter table public.calloria_email_webhook_events enable row level security;
alter table public.calloria_email_send_limits enable row level security;

revoke all on public.calloria_email_threads from public, anon, authenticated;
revoke all on public.calloria_email_messages from public, anon, authenticated;
revoke all on public.calloria_email_webhook_events from public, anon, authenticated;
revoke all on public.calloria_email_send_limits from public, anon, authenticated;
grant all on public.calloria_email_threads to service_role;
grant all on public.calloria_email_messages to service_role;
grant all on public.calloria_email_webhook_events to service_role;
grant all on public.calloria_email_send_limits to service_role;

create or replace function public.calloria_email_upsert_thread(
  p_thread_hash text,
  p_sender_hash text,
  p_sender_ciphertext text,
  p_sender_iv text,
  p_display_name_ciphertext text,
  p_display_name_iv text,
  p_subject_ciphertext text,
  p_subject_iv text,
  p_received_at timestamptz,
  p_latest_message_id text,
  p_reference_ids text[]
) returns public.calloria_email_threads
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_row public.calloria_email_threads;
begin
  if p_thread_hash !~ '^[0-9a-f]{64}$' or p_sender_hash !~ '^[0-9a-f]{64}$'
     or p_sender_ciphertext is null or p_sender_iv is null
     or p_subject_ciphertext is null or p_subject_iv is null or p_received_at is null then
    raise exception 'Invalid CALLORIA email thread upsert.';
  end if;
  insert into public.calloria_email_threads as current_row(
    thread_hash,sender_hash,sender_ciphertext,sender_iv,display_name_ciphertext,display_name_iv,
    subject_ciphertext,subject_iv,latest_inbound_at,latest_message_id,reference_ids,retention_due_at
  ) values (
    p_thread_hash,p_sender_hash,p_sender_ciphertext,p_sender_iv,p_display_name_ciphertext,p_display_name_iv,
    p_subject_ciphertext,p_subject_iv,p_received_at,p_latest_message_id,coalesce(p_reference_ids,'{}'),p_received_at + interval '180 days'
  )
  on conflict (thread_hash) do update set
    sender_hash=excluded.sender_hash,
    sender_ciphertext=excluded.sender_ciphertext,
    sender_iv=excluded.sender_iv,
    display_name_ciphertext=coalesce(excluded.display_name_ciphertext,current_row.display_name_ciphertext),
    display_name_iv=coalesce(excluded.display_name_iv,current_row.display_name_iv),
    subject_ciphertext=excluded.subject_ciphertext,
    subject_iv=excluded.subject_iv,
    latest_inbound_at=greatest(current_row.latest_inbound_at,excluded.latest_inbound_at),
    latest_message_id=coalesce(excluded.latest_message_id,current_row.latest_message_id),
    reference_ids=(
      select coalesce(array_agg(id order by ord), '{}')
      from (
        select id, max(ord) as ord
        from unnest(coalesce(current_row.reference_ids,'{}') || coalesce(excluded.reference_ids,'{}')) with ordinality as refs(id,ord)
        group by id
        order by max(ord) desc
        limit 40
      ) merged
    ),
    retention_due_at=greatest(current_row.retention_due_at,excluded.retention_due_at),
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.calloria_email_upsert_thread(text,text,text,text,text,text,text,text,timestamptz,text,text[]) from public, anon, authenticated;
grant execute on function public.calloria_email_upsert_thread(text,text,text,text,text,text,text,text,timestamptz,text,text[]) to service_role;

create or replace function public.calloria_email_create_or_attach_route(
  p_thread_id uuid,
  p_message_id uuid,
  p_route_ref text,
  p_department text,
  p_platform_id text,
  p_intent text,
  p_language text,
  p_required_skills text[],
  p_priority text,
  p_subject text,
  p_summary_ciphertext text,
  p_summary_iv text,
  p_access_token_hash text
) returns text
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_thread public.calloria_email_threads;
  v_existing_status text;
  v_route public.calloria_route_requests;
begin
  select * into v_thread from public.calloria_email_threads where id = p_thread_id for update;
  if not found then raise exception 'Email thread not found.'; end if;
  if v_thread.active_route_ref is not null then
    select status into v_existing_status from public.calloria_route_requests where route_ref = v_thread.active_route_ref;
    if v_existing_status in ('queued','assigned') then
      update public.calloria_email_messages set route_ref = v_thread.active_route_ref where id = p_message_id;
      return v_thread.active_route_ref;
    end if;
  end if;
  select * into v_route from public.calloria_route_create_request(
    p_route_ref,p_department,'email',p_platform_id,p_intent,p_language,
    p_required_skills,p_priority,p_subject,p_summary_ciphertext,p_summary_iv,p_access_token_hash
  );
  update public.calloria_email_threads set active_route_ref = v_route.route_ref, updated_at = now() where id = p_thread_id;
  update public.calloria_email_messages set route_ref = v_route.route_ref where id = p_message_id;
  return v_route.route_ref;
end;
$$;
revoke all on function public.calloria_email_create_or_attach_route(uuid,uuid,text,text,text,text,text,text[],text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_email_create_or_attach_route(uuid,uuid,text,text,text,text,text,text[],text,text,text,text,text) to service_role;

create or replace function public.calloria_email_add_thread_reference(
  p_thread_id uuid,
  p_message_id text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_updated uuid;
begin
  if p_thread_id is null or p_message_id is null or p_message_id !~ '^<[^<>[:space:]]+@[^<>[:space:]]+>$' then
    raise exception 'Invalid CALLORIA email threading reference.';
  end if;
  update public.calloria_email_threads t
  set reference_ids=(
    select coalesce(array_agg(id order by ord), '{}')
    from (
      select id, max(ord) as ord
      from unnest(coalesce(t.reference_ids,'{}') || array[p_message_id]) with ordinality as refs(id,ord)
      group by id
      order by max(ord) desc
      limit 40
    ) merged
  ), updated_at=now()
  where t.id=p_thread_id
  returning t.id into v_updated;
  return v_updated is not null;
end;
$$;
revoke all on function public.calloria_email_add_thread_reference(uuid,text) from public, anon, authenticated;
grant execute on function public.calloria_email_add_thread_reference(uuid,text) to service_role;

create or replace function public.calloria_email_consume_send_limit(
  p_staff_user_id uuid,
  p_bucket_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  if p_staff_user_id is null or p_bucket_start is null or p_limit < 1 or p_limit > 60 then
    raise exception 'Invalid email send limit request.';
  end if;
  insert into public.calloria_email_send_limits as current_row(staff_user_id,bucket_start,send_count)
  values (p_staff_user_id,p_bucket_start,1)
  on conflict (staff_user_id,bucket_start) do update
    set send_count = current_row.send_count + 1
    where current_row.send_count < p_limit
  returning send_count into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.calloria_email_consume_send_limit(uuid,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.calloria_email_consume_send_limit(uuid,timestamptz,integer) to service_role;

create or replace function public.calloria_email_purge_expired()
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_threads integer; v_events integer;
begin
  delete from public.calloria_email_threads t
  where t.retention_due_at <= now()
    and (t.active_route_ref is null or not exists (
      select 1 from public.calloria_route_requests r
      where r.route_ref=t.active_route_ref and r.status in ('queued','assigned')
    ));
  get diagnostics v_threads = row_count;
  delete from public.calloria_email_webhook_events where created_at <= now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from public.calloria_email_send_limits where bucket_start < now() - interval '2 days';
  return jsonb_build_object('threads_deleted',v_threads,'webhook_events_deleted',v_events);
end;
$$;
revoke all on function public.calloria_email_purge_expired() from public, anon, authenticated;
grant execute on function public.calloria_email_purge_expired() to service_role;
comment on function public.calloria_email_purge_expired() is 'Deletes encrypted email threads after 180 days when no active route remains; webhook idempotency records after 30 days. Configure trusted scheduling explicitly.';
