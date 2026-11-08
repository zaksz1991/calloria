-- CALLORIA Phase 14: WhatsApp Business channel storage.
-- Requires the Phase 12 Contact Routing objects (migration 013).
-- Stores no raw Meta webhook payloads and exposes no customer contact/message
-- data to browser roles. All reads/writes occur through the server-side function.

create table if not exists public.calloria_wa_conversations (
  id uuid primary key default gen_random_uuid(),
  wa_id_hash text not null unique check (wa_id_hash ~ '^[0-9a-f]{64}$'),
  contact_ciphertext text not null,
  contact_iv text not null,
  display_name_ciphertext text,
  display_name_iv text,
  last_inbound_at timestamptz,
  service_window_expires_at timestamptz,
  active_route_ref text,
  messaging_opt_out boolean not null default false,
  messaging_opt_out_at timestamptz,
  marketing_consent boolean not null default false,
  marketing_consent_at timestamptz,
  marketing_consent_by uuid,
  marketing_consent_source text,
  marketing_consent_evidence_ref text,
  service_followup_consent boolean not null default false,
  service_followup_consent_at timestamptz,
  service_followup_consent_by uuid,
  service_followup_consent_source text,
  service_followup_consent_evidence_ref text,
  retention_due_at timestamptz not null default (now() + interval '180 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calloria_wa_marketing_consent_evidence check (
    marketing_consent = false or
    (marketing_consent_at is not null and marketing_consent_by is not null and marketing_consent_source is not null and marketing_consent_evidence_ref is not null)
  ),
  constraint calloria_wa_followup_consent_evidence check (
    service_followup_consent = false or
    (service_followup_consent_at is not null and service_followup_consent_by is not null and service_followup_consent_source is not null and service_followup_consent_evidence_ref is not null)
  )
);

create index if not exists calloria_wa_conversations_recent_idx
  on public.calloria_wa_conversations (last_inbound_at desc nulls last, updated_at desc);
create index if not exists calloria_wa_conversations_route_idx
  on public.calloria_wa_conversations (active_route_ref) where active_route_ref is not null;
create index if not exists calloria_wa_conversations_retention_idx
  on public.calloria_wa_conversations (retention_due_at);

create table if not exists public.calloria_wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.calloria_wa_conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text' check (message_type in ('text','image','video','audio','document','sticker','location','interactive','button','unknown')),
  body_ciphertext text not null,
  body_iv text not null,
  provider_message_id text unique,
  provider_status text not null default 'received' check (provider_status in ('received','sending','sent','delivered','read','failed','unknown')),
  provider_error_code text,
  route_ref text,
  sent_by uuid,
  provider_timestamp timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists calloria_wa_messages_conversation_idx
  on public.calloria_wa_messages (conversation_id, created_at desc);
create index if not exists calloria_wa_messages_route_idx
  on public.calloria_wa_messages (route_ref) where route_ref is not null;

create table if not exists public.calloria_wa_webhook_events (
  provider_event_id text primary key,
  event_kind text not null check (event_kind in ('inbound_message','delivery_status')),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text not null default 'received' check (outcome in ('received','processed','duplicate','failed','ignored'))
);
create index if not exists calloria_wa_webhook_events_retention_idx
  on public.calloria_wa_webhook_events (received_at);

create table if not exists public.calloria_wa_send_limits (
  staff_user_id uuid not null,
  bucket_start timestamptz not null,
  send_count integer not null default 0 check (send_count >= 0),
  primary key (staff_user_id, bucket_start)
);

create or replace function public.calloria_wa_consume_send_limit(
  p_staff_user_id uuid,
  p_bucket_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  if p_staff_user_id is null or p_limit < 1 or p_limit > 60 then
    raise exception 'Invalid WhatsApp send-limit arguments.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text, 140014));
  delete from public.calloria_wa_send_limits where bucket_start < now() - interval '48 hours';
  insert into public.calloria_wa_send_limits(staff_user_id, bucket_start, send_count)
  values (p_staff_user_id, p_bucket_start, 1)
  on conflict (staff_user_id, bucket_start) do update
    set send_count = public.calloria_wa_send_limits.send_count + 1
  returning send_count into v_count;
  return v_count <= p_limit;
end;
$$;

alter table public.calloria_wa_conversations enable row level security;
alter table public.calloria_wa_messages enable row level security;
alter table public.calloria_wa_webhook_events enable row level security;
alter table public.calloria_wa_send_limits enable row level security;

revoke all on public.calloria_wa_conversations from public, anon, authenticated;
revoke all on public.calloria_wa_messages from public, anon, authenticated;
revoke all on public.calloria_wa_webhook_events from public, anon, authenticated;
revoke all on public.calloria_wa_send_limits from public, anon, authenticated;
grant all on public.calloria_wa_conversations to service_role;
grant all on public.calloria_wa_messages to service_role;
grant all on public.calloria_wa_webhook_events to service_role;
grant all on public.calloria_wa_send_limits to service_role;
revoke all on function public.calloria_wa_consume_send_limit(uuid,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.calloria_wa_consume_send_limit(uuid,timestamptz,integer) to service_role;

comment on table public.calloria_wa_conversations is 'Encrypted WhatsApp contact identity and service/marketing consent; service-role access only.';
comment on table public.calloria_wa_messages is 'Encrypted WhatsApp message bodies and delivery state; raw provider payloads are not stored.';
comment on table public.calloria_wa_webhook_events is 'Idempotency ledger containing provider event identifiers and processing state only.';

create or replace function public.calloria_wa_upsert_conversation(
  p_wa_id_hash text,
  p_contact_ciphertext text,
  p_contact_iv text,
  p_display_name_ciphertext text,
  p_display_name_iv text,
  p_inbound_at timestamptz
) returns public.calloria_wa_conversations
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_row public.calloria_wa_conversations;
begin
  if p_wa_id_hash !~ '^[0-9a-f]{64}$' or p_contact_ciphertext is null or p_contact_iv is null or p_inbound_at is null then
    raise exception 'Invalid WhatsApp conversation upsert.';
  end if;
  insert into public.calloria_wa_conversations as current_row(
    wa_id_hash,contact_ciphertext,contact_iv,display_name_ciphertext,display_name_iv,
    last_inbound_at,service_window_expires_at
  ) values (
    p_wa_id_hash,p_contact_ciphertext,p_contact_iv,p_display_name_ciphertext,p_display_name_iv,
    p_inbound_at,p_inbound_at + interval '24 hours'
  )
  on conflict (wa_id_hash) do update set
    contact_ciphertext=excluded.contact_ciphertext,
    contact_iv=excluded.contact_iv,
    display_name_ciphertext=coalesce(excluded.display_name_ciphertext,current_row.display_name_ciphertext),
    display_name_iv=coalesce(excluded.display_name_iv,current_row.display_name_iv),
    last_inbound_at=greatest(coalesce(current_row.last_inbound_at,'-infinity'::timestamptz),excluded.last_inbound_at),
    service_window_expires_at=greatest(coalesce(current_row.service_window_expires_at,'-infinity'::timestamptz),excluded.service_window_expires_at),
    retention_due_at=greatest(current_row.retention_due_at,excluded.last_inbound_at + interval '180 days'),
    updated_at=now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.calloria_wa_upsert_conversation(text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.calloria_wa_upsert_conversation(text,text,text,text,text,timestamptz) to service_role;

create or replace function public.calloria_wa_create_or_attach_route(
  p_conversation_id uuid,
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
  v_conversation public.calloria_wa_conversations;
  v_existing_status text;
  v_route public.calloria_route_requests;
begin
  select * into v_conversation from public.calloria_wa_conversations
  where id = p_conversation_id for update;
  if not found then raise exception 'WhatsApp conversation not found.'; end if;

  if v_conversation.active_route_ref is not null then
    select status into v_existing_status from public.calloria_route_requests
    where route_ref = v_conversation.active_route_ref;
    if v_existing_status in ('queued','assigned') then
      update public.calloria_wa_messages set route_ref = v_conversation.active_route_ref where id = p_message_id;
      return v_conversation.active_route_ref;
    end if;
  end if;

  select * into v_route from public.calloria_route_create_request(
    p_route_ref,p_department,'whatsapp',p_platform_id,p_intent,p_language,
    p_required_skills,p_priority,p_subject,p_summary_ciphertext,p_summary_iv,p_access_token_hash
  );
  update public.calloria_wa_conversations set active_route_ref = v_route.route_ref, updated_at = now()
  where id = p_conversation_id;
  update public.calloria_wa_messages set route_ref = v_route.route_ref where id = p_message_id;
  return v_route.route_ref;
end;
$$;
revoke all on function public.calloria_wa_create_or_attach_route(uuid,uuid,text,text,text,text,text,text[],text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_wa_create_or_attach_route(uuid,uuid,text,text,text,text,text,text[],text,text,text,text,text) to service_role;


-- Retention is explicit and callable by a trusted scheduler. It is not an
-- automatic schedule until the project owner configures Supabase Cron.
create or replace function public.calloria_wa_purge_expired()
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_deleted integer;
begin
  delete from public.calloria_wa_conversations c
  where c.retention_due_at <= now()
    and (c.active_route_ref is null or not exists (
      select 1 from public.calloria_route_requests r
      where r.route_ref = c.active_route_ref and r.status in ('queued','assigned')
    ));
  get diagnostics v_deleted = row_count;
  delete from public.calloria_wa_webhook_events where received_at < now() - interval '30 days';
  return v_deleted;
end;
$$;
revoke all on function public.calloria_wa_purge_expired() from public, anon, authenticated;
grant execute on function public.calloria_wa_purge_expired() to service_role;
comment on function public.calloria_wa_purge_expired() is 'Deletes expired WhatsApp conversations and cascaded encrypted messages after 180 days when no active route remains; webhook idempotency rows are deleted after 30 days. Schedule explicitly with a trusted Supabase Cron job.';
