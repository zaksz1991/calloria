-- CALLORIA Phase 17: Meta social DM inbox (Instagram + Facebook Messenger).
-- Dependencies: Phase 12 routing (migration 013), Phase 14–16 Edge Function setup,
-- and the existing Agent Desk work-item / encryption contract.
-- Only calloria_social_* objects are created. Prospector objects are untouched.

create table if not exists public.calloria_social_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_ref text not null unique check (conversation_ref ~ '^SM-[0-9]{8}-[A-Z0-9]{6}$'),
  route_ref text not null unique references public.calloria_route_requests(route_ref) on delete cascade,
  provider text not null check (provider in ('messenger','instagram')),
  account_id text not null check (length(account_id) between 1 and 100),
  sender_hash text not null check (sender_hash ~ '^[a-f0-9]{64}$'),
  sender_ciphertext text not null,
  sender_iv text not null,
  status text not null default 'open' check (status in ('open','closed')),
  last_customer_message_at timestamptz not null,
  reply_window_expires_at timestamptz not null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.calloria_social_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.calloria_social_conversations(id) on delete cascade,
  provider text not null check (provider in ('messenger','instagram')),
  provider_message_id text null check (provider_message_id is null or length(provider_message_id) between 1 and 200),
  client_message_id uuid null,
  direction text not null check (direction in ('inbound','outbound')),
  body_ciphertext text not null,
  body_iv text not null,
  sender_id uuid null references auth.users(id) on delete set null,
  delivery_state text not null default 'received' check (delivery_state in ('received','sending','sent','failed','uncertain')),
  provider_error_code text null check (provider_error_code is null or provider_error_code ~ '^[A-Za-z0-9_.-]{1,80}$'),
  created_at timestamptz not null default now(),
  check ((direction = 'inbound' and delivery_state = 'received' and sender_id is null)
      or (direction = 'outbound' and sender_id is not null and delivery_state <> 'received'))
);

create unique index if not exists calloria_social_provider_message_unique
  on public.calloria_social_messages (provider, provider_message_id)
  where provider_message_id is not null;
create unique index if not exists calloria_social_client_message_unique
  on public.calloria_social_messages (conversation_id, client_message_id)
  where client_message_id is not null;
create index if not exists calloria_social_conversation_recent_idx
  on public.calloria_social_conversations (status, last_message_at desc);
create index if not exists calloria_social_route_ref_idx
  on public.calloria_social_conversations (route_ref);
create index if not exists calloria_social_sender_lookup_idx
  on public.calloria_social_conversations (provider, account_id, sender_hash, last_message_at desc);
create unique index if not exists calloria_social_one_open_conversation_per_sender
  on public.calloria_social_conversations (provider, account_id, sender_hash) where status = 'open';
create index if not exists calloria_social_messages_recent_idx
  on public.calloria_social_messages (conversation_id, created_at asc);
create unique index if not exists calloria_social_one_pending_outbound
  on public.calloria_social_messages (conversation_id)
  where direction = 'outbound' and delivery_state in ('sending','uncertain');

alter table public.calloria_social_conversations enable row level security;
alter table public.calloria_social_messages enable row level security;
revoke all on public.calloria_social_conversations, public.calloria_social_messages from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_social_conversations to service_role;
grant select, insert, update, delete on public.calloria_social_messages to service_role;

-- Serializes duplicate Meta webhook delivery by provider message ID, creates the
-- Contact Routing + Agent Desk record and records the encrypted DM atomically.
create or replace function public.calloria_social_ingest_message(
  p_route_ref text,
  p_conversation_ref text,
  p_provider text,
  p_account_id text,
  p_sender_hash text,
  p_sender_ciphertext text,
  p_sender_iv text,
  p_received_at timestamptz,
  p_provider_message_id text,
  p_body_ciphertext text,
  p_body_iv text,
  p_subject text,
  p_department text,
  p_intent text,
  p_language text,
  p_required_skills text[],
  p_priority text,
  p_platform_id text,
  p_summary_ciphertext text,
  p_summary_iv text,
  p_access_token_hash text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_conversation public.calloria_social_conversations;
  v_route public.calloria_route_requests;
  v_message_id uuid;
  v_received_at timestamptz;
  v_created boolean := false;
  v_duplicate boolean := false;
begin
  if p_provider not in ('messenger','instagram')
     or p_account_id is null or length(p_account_id) not between 1 and 100
     or p_sender_hash !~ '^[a-f0-9]{64}$'
     or p_provider_message_id is null or length(p_provider_message_id) not between 1 and 200
     or p_department not in (
       'RuffNeck Products and Platform Support','Sales and Service Enquiries',
       'Complaints and Service Recovery','Personal Development and Wellbeing Information',
       'General Customer Care','Email and Written Support','Social Media Support',
       'Technical Support and IT','Quality Assurance and Customer Experience',
       'Safeguarding and Trained Human Support','Learning and Career Development'
     )
     or p_intent not in ('platform_support','account_access','technical_support','sales_enquiry','complaint','personal_guidance','safeguarding','learning_career','social_media','general')
     or p_language not in ('en','ha','yo','ig','pcm')
     or p_priority not in ('low','normal','high','urgent')
     or cardinality(p_required_skills) not between 1 and 4
     or p_route_ref !~ '^CR-[0-9]{8}-[A-Z0-9]{6}$'
     or p_conversation_ref !~ '^SM-[0-9]{8}-[A-Z0-9]{6}$' then
    raise exception 'Invalid social message data.';
  end if;
  v_received_at := coalesce(p_received_at, now());
  if v_received_at > now() + interval '1 minute' or v_received_at < now() - interval '30 days' then
    v_received_at := now();
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_provider_message_id, 170017));
  perform pg_advisory_xact_lock(hashtextextended(p_provider || ':' || p_account_id || ':' || p_sender_hash, 170018));
  select id into v_message_id
  from public.calloria_social_messages
  where provider = p_provider and provider_message_id = p_provider_message_id;
  if found then
    select c.* into v_conversation
    from public.calloria_social_conversations c
    where c.id = (select conversation_id from public.calloria_social_messages where id = v_message_id);
    return jsonb_build_object('conversation_id', v_conversation.id, 'conversation_ref', v_conversation.conversation_ref, 'route_ref', v_conversation.route_ref, 'created', false, 'duplicate', true);
  end if;

  select c.* into v_conversation
  from public.calloria_social_conversations c
  join public.calloria_route_requests r on r.route_ref = c.route_ref
  where c.provider = p_provider and c.account_id = p_account_id and c.sender_hash = p_sender_hash
    and c.status = 'open' and r.status in ('queued','assigned')
  order by c.last_message_at desc
  limit 1
  for update of c;

  if not found then
    -- Close stale conversations whose linked route has already completed.
    update public.calloria_social_conversations c
    set status = 'closed'
    from public.calloria_route_requests r
    where r.route_ref = c.route_ref and c.provider = p_provider and c.account_id = p_account_id
      and c.sender_hash = p_sender_hash and c.status = 'open' and r.status not in ('queued','assigned');

    v_route := public.calloria_route_create_request(
      p_route_ref, p_department, 'social', p_platform_id, p_intent, p_language,
      p_required_skills, p_priority, p_subject, p_summary_ciphertext,
      p_summary_iv, p_access_token_hash
    );
    insert into public.calloria_social_conversations(
      conversation_ref, route_ref, provider, account_id, sender_hash,
      sender_ciphertext, sender_iv, last_customer_message_at,
      reply_window_expires_at, last_message_at
    ) values (
      p_conversation_ref, p_route_ref, p_provider, p_account_id, p_sender_hash,
      p_sender_ciphertext, p_sender_iv, v_received_at,
      v_received_at + interval '24 hours', v_received_at
    ) returning * into v_conversation;
    v_created := true;
  else
    update public.calloria_social_conversations
    set last_customer_message_at = greatest(last_customer_message_at, v_received_at),
        reply_window_expires_at = greatest(reply_window_expires_at, v_received_at + interval '24 hours'),
        last_message_at = greatest(last_message_at, v_received_at)
    where id = v_conversation.id returning * into v_conversation;
  end if;

  insert into public.calloria_social_messages(
    conversation_id, provider, provider_message_id, direction,
    body_ciphertext, body_iv, delivery_state, created_at
  ) values (
    v_conversation.id, p_provider, p_provider_message_id, 'inbound',
    p_body_ciphertext, p_body_iv, 'received', v_received_at
  ) returning id into v_message_id;

  return jsonb_build_object('conversation_id', v_conversation.id, 'conversation_ref', v_conversation.conversation_ref,
    'route_ref', v_conversation.route_ref, 'created', v_created, 'duplicate', v_duplicate, 'message_id', v_message_id);
end;
$$;
revoke all on function public.calloria_social_ingest_message(text,text,text,text,text,text,text,timestamptz,text,text,text,text,text,text,text,text[],text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_social_ingest_message(text,text,text,text,text,text,text,timestamptz,text,text,text,text,text,text,text,text[],text,text,text,text,text) to service_role;

-- A reply row is reserved before the provider call. The unique client ID makes
-- retries idempotent; a timeout is marked uncertain and must never be resent
-- automatically because Meta may already have accepted it.
create or replace function public.calloria_social_prepare_reply(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_client_message_id uuid,
  p_body_ciphertext text,
  p_body_iv text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_conversation public.calloria_social_conversations;
  v_route public.calloria_route_requests;
  v_message public.calloria_social_messages;
  v_inserted integer;
begin
  select c.* into v_conversation
  from public.calloria_social_conversations c
  where c.id = p_conversation_id and c.status = 'open'
  for update;
  if not found then raise exception 'Social conversation is closed or unavailable.'; end if;

  select * into v_route from public.calloria_route_requests
  where route_ref = v_conversation.route_ref for update;
  if not found or v_route.status <> 'assigned' or v_route.assigned_to <> p_sender_id then
    raise exception 'This interaction must be assigned to you through CALLORIA Routing Control.';
  end if;
  if v_conversation.last_customer_message_at <= now() - interval '24 hours' then
    raise exception 'The Meta customer-initiated 24-hour messaging window has expired.';
  end if;

  select * into v_message
  from public.calloria_social_messages
  where conversation_id = v_conversation.id and direction = 'outbound'
    and delivery_state in ('sending','uncertain')
  order by created_at desc limit 1;
  if found and v_message.client_message_id <> p_client_message_id then
    raise exception 'A previous social reply has an unresolved delivery result.';
  end if;

  insert into public.calloria_social_messages(
    conversation_id, provider, client_message_id, direction,
    body_ciphertext, body_iv, sender_id, delivery_state
  ) values (
    v_conversation.id, v_conversation.provider, p_client_message_id, 'outbound',
    p_body_ciphertext, p_body_iv, p_sender_id, 'sending'
  ) on conflict (conversation_id, client_message_id) where client_message_id is not null do nothing;
  get diagnostics v_inserted = row_count;

  select * into v_message from public.calloria_social_messages
  where conversation_id = v_conversation.id and client_message_id = p_client_message_id;
  update public.calloria_social_conversations set last_message_at = greatest(last_message_at, now()) where id = v_conversation.id;
  return jsonb_build_object('message_id', v_message.id, 'created', v_inserted = 1, 'delivery_state', v_message.delivery_state,
    'provider', v_conversation.provider, 'account_id', v_conversation.account_id, 'reply_window_expires_at', v_conversation.reply_window_expires_at);
end;
$$;
revoke all on function public.calloria_social_prepare_reply(uuid,uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.calloria_social_prepare_reply(uuid,uuid,uuid,text,text) to service_role;

create or replace function public.calloria_social_finish_reply(
  p_message_id uuid,
  p_delivery_state text,
  p_provider_message_id text,
  p_error_code text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  if p_delivery_state not in ('sent','failed','uncertain') then raise exception 'Invalid social delivery state.'; end if;
  update public.calloria_social_messages
  set delivery_state = p_delivery_state,
      provider_message_id = case when p_provider_message_id is null then provider_message_id else left(p_provider_message_id,200) end,
      provider_error_code = case when p_error_code is null then null else left(regexp_replace(p_error_code,'[^A-Za-z0-9_.-]','','g'),80) end
  where id = p_message_id and direction = 'outbound' and delivery_state = 'sending';
  get diagnostics v_count = row_count;
  return v_count = 1;
end;
$$;
revoke all on function public.calloria_social_finish_reply(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_social_finish_reply(uuid,text,text,text) to service_role;



-- Returns only encrypted latest-message payloads for the staff inbox preview.
create or replace function public.calloria_social_latest_messages(p_conversation_ids uuid[])
returns table (conversation_id uuid, body_ciphertext text, body_iv text)
language sql security definer set search_path = pg_catalog, public
as $$
  select distinct on (m.conversation_id) m.conversation_id, m.body_ciphertext, m.body_iv
  from public.calloria_social_messages m
  where m.conversation_id = any(coalesce(p_conversation_ids, '{}'::uuid[]))
  order by m.conversation_id, m.created_at desc, m.id desc;
$$;
revoke all on function public.calloria_social_latest_messages(uuid[]) from public, anon, authenticated;
grant execute on function public.calloria_social_latest_messages(uuid[]) to service_role;

comment on table public.calloria_social_conversations is 'CALLORIA customer-initiated Instagram Direct and Facebook Messenger conversations. Platform-scoped customer identifiers are encrypted.';
comment on table public.calloria_social_messages is 'Encrypted human-handled social messages. No raw message text or provider access token is stored.';
