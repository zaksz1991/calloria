-- CALLORIA Phase 16: first-party website live chat.
-- Dependencies: Phase 12 Contact Routing (calloria_route_requests and
-- calloria_route_create_request), Phase 8 Agent Desk and Phase 15 app config.
-- New objects are isolated to calloria_webchat_*; no Prospector objects are altered.

create table if not exists public.calloria_webchat_conversations (
  id uuid primary key default gen_random_uuid(),
  conversation_ref text not null unique check (conversation_ref ~ '^WC-[0-9]{8}-[A-Z0-9]{6}$'),
  route_ref text not null unique references public.calloria_route_requests(route_ref) on delete cascade,
  platform_id text not null check (platform_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  origin text not null check (origin in (
    'https://ruffneck-lms.vercel.app',
    'https://ruffneck-prospector.vercel.app',
    'https://ruffneck-connect.vercel.app',
    'https://ruffneck-social-hub.vercel.app',
    'https://kano-run.vercel.app',
    'https://kano-keke.vercel.app'
  )),
  visitor_token_hash text not null check (visitor_token_hash ~ '^[a-f0-9]{64}$'),
  language text not null check (language in ('en','ha','yo','ig','pcm')),
  status text not null default 'open' check (status in ('open','closed')),
  last_message_at timestamptz not null default now(),
  visitor_closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_webchat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.calloria_webchat_conversations(id) on delete cascade,
  direction text not null check (direction in ('customer','agent')),
  body_ciphertext text not null,
  body_iv text not null,
  sender_id uuid null references auth.users(id) on delete set null,
  client_message_id text null check (client_message_id is null or client_message_id ~ '^[0-9a-f-]{36}$'),
  created_at timestamptz not null default now(),
  unique (conversation_id, client_message_id)
);

create table if not exists public.calloria_webchat_rate_limits (
  fingerprint_hash text not null check (fingerprint_hash ~ '^[a-f0-9]{64}$'),
  bucket_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  primary key (fingerprint_hash, bucket_start)
);

create index if not exists calloria_webchat_conversations_recent_idx
  on public.calloria_webchat_conversations (status, last_message_at desc);
create index if not exists calloria_webchat_route_idx
  on public.calloria_webchat_conversations (route_ref);
create index if not exists calloria_webchat_messages_history_idx
  on public.calloria_webchat_messages (conversation_id, created_at asc);
create index if not exists calloria_webchat_rate_bucket_idx
  on public.calloria_webchat_rate_limits (bucket_start);

alter table public.calloria_webchat_conversations enable row level security;
alter table public.calloria_webchat_messages enable row level security;
alter table public.calloria_webchat_rate_limits enable row level security;
revoke all on public.calloria_webchat_conversations, public.calloria_webchat_messages, public.calloria_webchat_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_webchat_conversations to service_role;
grant select, insert, update, delete on public.calloria_webchat_messages to service_role;
grant select, insert, update, delete on public.calloria_webchat_rate_limits to service_role;

create or replace function public.calloria_webchat_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function public.calloria_webchat_touch_updated_at() from public, anon, authenticated;
drop trigger if exists calloria_webchat_conversations_touch on public.calloria_webchat_conversations;
create trigger calloria_webchat_conversations_touch
  before update on public.calloria_webchat_conversations
  for each row execute function public.calloria_webchat_touch_updated_at();

-- Rate-limit increments are atomic. The HMAC fingerprint is supplied by the
-- Edge Function; raw network addresses and user-agent strings are not stored.
create or replace function public.calloria_webchat_consume_limit(
  p_fingerprint_hash text,
  p_bucket_start timestamptz,
  p_limit integer
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_fingerprint_hash !~ '^[a-f0-9]{64}$' or p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid web chat rate-limit arguments.';
  end if;
  insert into public.calloria_webchat_rate_limits(fingerprint_hash, bucket_start, request_count)
  values (p_fingerprint_hash, p_bucket_start, 1)
  on conflict (fingerprint_hash, bucket_start)
  do update set request_count = public.calloria_webchat_rate_limits.request_count + 1
  returning request_count into v_count;
  return v_count <= p_limit;
end;
$$;
revoke all on function public.calloria_webchat_consume_limit(text,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.calloria_webchat_consume_limit(text,timestamptz,integer) to service_role;

-- Route creation, private visitor session and first encrypted message share one
-- database transaction: no orphan route is left if conversation creation fails.
create or replace function public.calloria_webchat_create_conversation(
  p_conversation_ref text,
  p_route_ref text,
  p_department text,
  p_platform_id text,
  p_intent text,
  p_language text,
  p_required_skills text[],
  p_priority text,
  p_subject text,
  p_agent_summary_ciphertext text,
  p_agent_summary_iv text,
  p_access_token_hash text,
  p_origin text,
  p_visitor_token_hash text,
  p_initial_message_ciphertext text,
  p_initial_message_iv text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_route public.calloria_route_requests;
  v_conversation_id uuid;
begin
  if p_conversation_ref !~ '^WC-[0-9]{8}-[A-Z0-9]{6}$'
     or p_route_ref !~ '^CR-[0-9]{8}-[A-Z0-9]{6}$'
     or p_access_token_hash !~ '^[a-f0-9]{64}$'
     or p_visitor_token_hash !~ '^[a-f0-9]{64}$'
     or p_initial_message_ciphertext is null or p_initial_message_iv is null
     or p_agent_summary_ciphertext is null or p_agent_summary_iv is null then
    raise exception 'Invalid live chat conversation data.';
  end if;

  v_route := public.calloria_route_create_request(
    p_route_ref,
    p_department,
    'live_chat',
    p_platform_id,
    p_intent,
    p_language,
    p_required_skills,
    p_priority,
    p_subject,
    p_agent_summary_ciphertext,
    p_agent_summary_iv,
    p_access_token_hash
  );

  insert into public.calloria_webchat_conversations(
    conversation_ref, route_ref, platform_id, origin,
    visitor_token_hash, language, status, last_message_at
  ) values (
    p_conversation_ref, p_route_ref, p_platform_id, p_origin,
    p_visitor_token_hash, p_language, 'open', pg_catalog.now()
  ) returning id into v_conversation_id;

  insert into public.calloria_webchat_messages(
    conversation_id, direction, body_ciphertext, body_iv
  ) values (
    v_conversation_id, 'customer', p_initial_message_ciphertext, p_initial_message_iv
  );

  return v_conversation_id;
end;
$$;
revoke all on function public.calloria_webchat_create_conversation(text,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_webchat_create_conversation(text,text,text,text,text,text,text[],text,text,text,text,text,text,text,text,text) to service_role;

-- Message insertion and conversation timestamps are committed together. The
-- route row is locked so a resolved/reassigned interaction cannot race a send.
create or replace function public.calloria_webchat_add_message(
  p_conversation_id uuid,
  p_direction text,
  p_body_ciphertext text,
  p_body_iv text,
  p_sender_id uuid,
  p_client_message_id text,
  p_require_sender_assignment boolean
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation public.calloria_webchat_conversations;
  v_route public.calloria_route_requests;
  v_message_id uuid;
  v_message_count integer;
begin
  if p_direction not in ('customer','agent')
     or p_body_ciphertext is null or p_body_iv is null
     or (p_client_message_id is not null and p_client_message_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Invalid live chat message data.';
  end if;
  if p_direction = 'customer' and p_sender_id is not null then
    raise exception 'Customer messages cannot contain a staff identity.';
  end if;
  if p_direction = 'agent' and p_sender_id is null then
    raise exception 'Staff replies require an authenticated staff identity.';
  end if;

  select * into v_conversation
  from public.calloria_webchat_conversations
  where id = p_conversation_id
  for update;
  if not found or v_conversation.status <> 'open' then
    raise exception 'This live chat session is closed or unavailable.';
  end if;

  select * into v_route
  from public.calloria_route_requests
  where route_ref = v_conversation.route_ref
  for update;
  if not found or v_route.status not in ('queued','assigned') then
    raise exception 'The linked support route is no longer open.';
  end if;
  if p_direction = 'agent' and v_route.status <> 'assigned' then
    raise exception 'A live chat must be assigned before staff can reply.';
  end if;
  if p_direction = 'agent' and p_require_sender_assignment
     and v_route.assigned_to is distinct from p_sender_id then
    raise exception 'This live chat is no longer assigned to this staff member.';
  end if;

  select pg_catalog.count(*)::integer into v_message_count
  from public.calloria_webchat_messages
  where conversation_id = p_conversation_id;
  if v_message_count >= 300 then
    raise exception 'This conversation has reached its message limit.';
  end if;

  insert into public.calloria_webchat_messages(
    conversation_id, direction, body_ciphertext, body_iv, sender_id, client_message_id
  ) values (
    p_conversation_id, p_direction, p_body_ciphertext, p_body_iv, p_sender_id, p_client_message_id
  ) returning id into v_message_id;

  update public.calloria_webchat_conversations
  set last_message_at = pg_catalog.now()
  where id = p_conversation_id;
  return v_message_id;
end;
$$;
revoke all on function public.calloria_webchat_add_message(uuid,text,text,text,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.calloria_webchat_add_message(uuid,text,text,text,uuid,text,boolean) to service_role;

-- Deletion is deliberately retention-driven and does not cancel an active route.
create or replace function public.calloria_webchat_purge_expired()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.calloria_webchat_conversations c
  using public.calloria_route_requests r
  where r.route_ref = c.route_ref
    and r.status in ('completed','abandoned','cancelled')
    and r.retention_due_at <= pg_catalog.now();
  get diagnostics v_deleted = row_count;

  delete from public.calloria_webchat_rate_limits
  where bucket_start < pg_catalog.now() - interval '2 days';
  return v_deleted;
end;
$$;
revoke all on function public.calloria_webchat_purge_expired() from public, anon, authenticated;
grant execute on function public.calloria_webchat_purge_expired() to service_role;

comment on table public.calloria_webchat_conversations is
  'CALLORIA website guest chat sessions; visitor token and origin are verified by the server; message content is stored separately encrypted.';
comment on table public.calloria_webchat_messages is
  'CALLORIA website live chat messages encrypted at application level with AES-256-GCM.';
comment on table public.calloria_webchat_rate_limits is
  'CALLORIA website live chat HMAC rate-limit fingerprints; raw IP addresses are not stored.';
