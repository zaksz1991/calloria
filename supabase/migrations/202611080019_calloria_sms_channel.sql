-- CALLORIA Phase 19: Termii customer-support SMS channel.
-- Dependencies: Contact Routing (013), Agent Desk (009), and provider channel phases (014-018).
-- This migration creates calloria_sms_* objects and extends only the channel checks
-- on the existing CALLORIA Agent Desk / Contact Routing tables. No Prospector objects
-- or shared authentication triggers are changed.

do $$
declare v_constraint record;
begin
  for v_constraint in
    select conname from pg_constraint
     where conrelid = 'public.calloria_ops_work_items'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%channel%'
  loop
    execute format('alter table public.calloria_ops_work_items drop constraint %I', v_constraint.conname);
  end loop;
  for v_constraint in
    select conname from pg_constraint
     where conrelid = 'public.calloria_route_requests'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%channel%'
  loop
    execute format('alter table public.calloria_route_requests drop constraint %I', v_constraint.conname);
  end loop;
end $$;

alter table public.calloria_ops_work_items
  add constraint calloria_ops_work_items_channel_check
  check (channel in ('voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'));
alter table public.calloria_route_requests
  add constraint calloria_route_requests_channel_check
  check (channel in ('voice','email','live_chat','social','whatsapp','sms','website','portal','game','back_office'));

create table if not exists public.calloria_sms_threads (
  id uuid primary key default gen_random_uuid(),
  thread_ref text not null unique check (thread_ref ~ '^SM-[0-9]{8}-[A-Z2-9]{6}$'),
  route_ref text not null unique references public.calloria_route_requests(route_ref) on delete cascade,
  phone_hash text not null check (phone_hash ~ '^[0-9a-f]{64}$'),
  phone_ciphertext text not null,
  phone_iv text not null,
  phone_masked text not null,
  status text not null default 'open' check (status in ('open','closed')),
  last_inbound_at timestamptz not null,
  last_outbound_at timestamptz,
  last_message_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  retention_due_at timestamptz not null default (now() + interval '180 days')
);

create index if not exists calloria_sms_threads_phone_active_idx
  on public.calloria_sms_threads(phone_hash, last_message_at desc) where status = 'open';
create index if not exists calloria_sms_threads_route_idx
  on public.calloria_sms_threads(route_ref);
create index if not exists calloria_sms_threads_retention_idx
  on public.calloria_sms_threads(retention_due_at);

create table if not exists public.calloria_sms_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.calloria_sms_threads(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  body_ciphertext text not null,
  body_iv text not null,
  provider_message_id text,
  provider_event_key text unique,
  idempotency_key text unique,
  status text not null default 'received' check (status in ('received','sending','sent','delivered','failed','unknown','rejected','dnd_blocked','expired')),
  sent_by uuid,
  provider_error_code text,
  created_at timestamptz not null default now(),
  delivery_updated_at timestamptz
);
create unique index if not exists calloria_sms_messages_provider_id_uniq
  on public.calloria_sms_messages(provider_message_id) where provider_message_id is not null;
create index if not exists calloria_sms_messages_thread_idx
  on public.calloria_sms_messages(thread_id, created_at);
create index if not exists calloria_sms_messages_latest_status_idx
  on public.calloria_sms_messages(status, created_at desc);
create index if not exists calloria_sms_messages_stale_sends_idx
  on public.calloria_sms_messages(created_at) where direction='outbound' and status='sending';

create table if not exists public.calloria_sms_suppressions (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  suppression_source text not null check (suppression_source in ('stop_keyword','staff_action')),
  suppressed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_sms_preferences (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  support_sms_enabled boolean not null default true,
  last_stop_at timestamptz,
  last_start_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_sms_webhook_events (
  event_key text primary key check (event_key ~ '^[0-9a-f]{64}$'),
  event_kind text not null check (event_kind in ('incoming_sms','delivery_report')),
  provider_message_id text,
  delivery_status text check (delivery_status is null or delivery_status in ('sent','delivered','failed','unknown','rejected','dnd_blocked','expired')),
  outcome text not null default 'received' check (outcome in ('received','processed','ignored','failed')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists calloria_sms_webhook_provider_delivery_idx
  on public.calloria_sms_webhook_events(provider_message_id, created_at desc)
  where event_kind='delivery_report' and provider_message_id is not null;

create table if not exists public.calloria_sms_send_limits (
  staff_user_id uuid not null,
  bucket_start timestamptz not null,
  send_count integer not null default 0 check (send_count >= 0),
  primary key (staff_user_id, bucket_start)
);

alter table public.calloria_sms_threads enable row level security;
alter table public.calloria_sms_messages enable row level security;
alter table public.calloria_sms_suppressions enable row level security;
alter table public.calloria_sms_webhook_events enable row level security;
alter table public.calloria_sms_preferences enable row level security;
alter table public.calloria_sms_send_limits enable row level security;
revoke all on public.calloria_sms_threads, public.calloria_sms_messages, public.calloria_sms_suppressions,
  public.calloria_sms_webhook_events, public.calloria_sms_send_limits, public.calloria_sms_preferences from public, anon, authenticated;
grant all on public.calloria_sms_threads, public.calloria_sms_messages, public.calloria_sms_suppressions,
  public.calloria_sms_webhook_events, public.calloria_sms_send_limits, public.calloria_sms_preferences to service_role;

create or replace function public.calloria_sms_touch_thread()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
revoke all on function public.calloria_sms_touch_thread() from public, anon, authenticated;
drop trigger if exists calloria_sms_threads_touch on public.calloria_sms_threads;
create trigger calloria_sms_threads_touch before update on public.calloria_sms_threads
for each row execute function public.calloria_sms_touch_thread();

create or replace function public.calloria_sms_process_inbound(
  p_event_key text,
  p_command text,
  p_phone_hash text,
  p_phone_ciphertext text,
  p_phone_iv text,
  p_phone_masked text,
  p_body_ciphertext text,
  p_body_iv text,
  p_provider_message_id text,
  p_thread_ref text,
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
  p_access_token_hash text,
  p_received_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_event public.calloria_sms_webhook_events;
  v_thread public.calloria_sms_threads;
  v_route public.calloria_route_requests;
  v_received timestamptz := coalesce(p_received_at, now());
begin
  if p_event_key !~ '^[0-9a-f]{64}$' or p_phone_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid SMS event fingerprint.'; end if;
  insert into public.calloria_sms_webhook_events(event_key,event_kind,outcome)
  values (p_event_key,'incoming_sms','received') on conflict (event_key) do nothing;
  select * into v_event from public.calloria_sms_webhook_events where event_key=p_event_key for update;
  if v_event.outcome='processed' then return jsonb_build_object('duplicate',true,'outcome','processed'); end if;

  if p_command='STOP' then
    insert into public.calloria_sms_suppressions as existing(phone_hash,suppression_source)
    values (p_phone_hash,'stop_keyword')
    on conflict (phone_hash) do update set suppression_source=case when existing.suppression_source='staff_action' then 'staff_action' else 'stop_keyword' end,updated_at=now();
    insert into public.calloria_sms_preferences(phone_hash,support_sms_enabled,last_stop_at)
    values (p_phone_hash,false,v_received)
    on conflict (phone_hash) do update set support_sms_enabled=false,last_stop_at=excluded.last_stop_at,updated_at=now();
    update public.calloria_sms_webhook_events set outcome='processed',processed_at=now() where event_key=p_event_key;
    return jsonb_build_object('duplicate',false,'command','STOP','suppressed',true);
  elsif p_command='START' then
    if exists(select 1 from public.calloria_sms_suppressions where phone_hash=p_phone_hash and suppression_source='staff_action') then
      insert into public.calloria_sms_preferences(phone_hash,support_sms_enabled,last_start_at)
      values (p_phone_hash,false,v_received)
      on conflict (phone_hash) do update set support_sms_enabled=false,last_start_at=excluded.last_start_at,updated_at=now();
    else
      delete from public.calloria_sms_suppressions where phone_hash=p_phone_hash and suppression_source='stop_keyword';
      insert into public.calloria_sms_preferences(phone_hash,support_sms_enabled,last_start_at)
      values (p_phone_hash,true,v_received)
      on conflict (phone_hash) do update set support_sms_enabled=true,last_start_at=excluded.last_start_at,updated_at=now();
    end if;
    update public.calloria_sms_webhook_events set outcome='processed',processed_at=now() where event_key=p_event_key;
    return jsonb_build_object('duplicate',false,'command','START','suppressed',exists(select 1 from public.calloria_sms_suppressions where phone_hash=p_phone_hash),'marketingConsent',false,'requiresNewCustomerMessage',true);
  end if;

  if exists(select 1 from public.calloria_sms_suppressions where phone_hash=p_phone_hash) then
    update public.calloria_sms_webhook_events set outcome='ignored',processed_at=now() where event_key=p_event_key;
    return jsonb_build_object('duplicate',false,'outcome','ignored','reason','customer_sms_opt_out');
  end if;

  if p_phone_ciphertext is null or p_phone_iv is null or p_body_ciphertext is null or p_body_iv is null
     or p_thread_ref !~ '^SM-[0-9]{8}-[A-Z2-9]{6}$' or p_route_ref !~ '^CR-[0-9]{8}-[A-Z0-9]{6}$'
     or p_department is null or p_intent is null or p_language not in ('en','ha','yo','ig','pcm')
     or cardinality(coalesce(p_required_skills,'{}')) not between 1 and 4 then
    update public.calloria_sms_webhook_events set outcome='failed' where event_key=p_event_key;
    raise exception 'Incoming SMS data did not pass validation.';
  end if;

  select t.* into v_thread
    from public.calloria_sms_threads t
    join public.calloria_route_requests r on r.route_ref=t.route_ref
   where t.phone_hash=p_phone_hash and t.status='open' and r.channel='sms' and r.status in ('queued','assigned')
   order by t.last_message_at desc limit 1 for update of t;

  if not found then
    select * into v_route from public.calloria_route_create_request(
      p_route_ref,p_department,'sms',p_platform_id,p_intent,p_language,p_required_skills,
      p_priority,p_subject,p_summary_ciphertext,p_summary_iv,p_access_token_hash
    );
    insert into public.calloria_sms_threads(
      thread_ref,route_ref,phone_hash,phone_ciphertext,phone_iv,phone_masked,last_inbound_at,last_message_at,retention_due_at
    ) values (
      p_thread_ref,v_route.route_ref,p_phone_hash,p_phone_ciphertext,p_phone_iv,p_phone_masked,v_received,v_received,v_received+interval '180 days'
    ) returning * into v_thread;
  end if;

  insert into public.calloria_sms_messages(
    thread_id,direction,body_ciphertext,body_iv,provider_message_id,provider_event_key,status,created_at
  ) values (
    v_thread.id,'inbound',p_body_ciphertext,p_body_iv,nullif(p_provider_message_id,''),p_event_key,'received',v_received
  ) on conflict (provider_event_key) do nothing;
  update public.calloria_sms_threads set last_inbound_at=greatest(last_inbound_at,v_received),last_message_at=greatest(last_message_at,v_received),
    phone_ciphertext=p_phone_ciphertext,phone_iv=p_phone_iv,phone_masked=p_phone_masked,
    retention_due_at=greatest(retention_due_at,v_received+interval '180 days')
  where id=v_thread.id;
  update public.calloria_sms_webhook_events set outcome='processed',processed_at=now() where event_key=p_event_key;
  return jsonb_build_object('duplicate',false,'threadRef',v_thread.thread_ref,'routeRef',v_thread.route_ref,'threadId',v_thread.id);
exception when others then
  update public.calloria_sms_webhook_events set outcome='failed' where event_key=p_event_key;
  raise;
end; $$;
revoke all on function public.calloria_sms_process_inbound(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text[],text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.calloria_sms_process_inbound(text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text[],text,text,text,text,text,timestamptz) to service_role;

create or replace function public.calloria_sms_reserve_send(
  p_thread_id uuid,
  p_staff_user_id uuid,
  p_idempotency_key text,
  p_body_ciphertext text,
  p_body_iv text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_thread public.calloria_sms_threads; v_route public.calloria_route_requests; v_existing public.calloria_sms_messages;
  v_last_inbound timestamptz; v_last_completed_outbound timestamptz; v_last_start timestamptz; v_new public.calloria_sms_messages;
begin
  if p_idempotency_key !~ '^[0-9a-f-]{36}$' or p_body_ciphertext is null or p_body_iv is null then raise exception 'Invalid SMS send reservation.'; end if;
  select * into v_existing from public.calloria_sms_messages where idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('messageId',v_existing.id,'status',v_existing.status,'duplicate',true); end if;
  select * into v_thread from public.calloria_sms_threads where id=p_thread_id for update;
  if not found or v_thread.status <> 'open' or v_thread.retention_due_at <= now() then raise exception 'SMS thread is closed or past its retention date.'; end if;
  select * into v_route from public.calloria_route_requests where route_ref=v_thread.route_ref for update;
  if not found or v_route.channel <> 'sms' or v_route.status <> 'assigned' or v_route.assigned_to is distinct from p_staff_user_id then
    raise exception 'Claim this SMS request through Routing Control before replying.';
  end if;
  if exists(select 1 from public.calloria_sms_suppressions where phone_hash=v_thread.phone_hash) then raise exception 'This customer has opted out of CALLORIA SMS.'; end if;
  select max(created_at) into v_last_inbound from public.calloria_sms_messages where thread_id=v_thread.id and direction='inbound';
  select max(created_at) into v_last_completed_outbound from public.calloria_sms_messages
   where thread_id=v_thread.id and direction='outbound' and status in ('sending','sent','delivered','unknown');
  select last_start_at into v_last_start from public.calloria_sms_preferences where phone_hash=v_thread.phone_hash and support_sms_enabled=true;
  if v_last_inbound is null or (v_last_completed_outbound is not null and v_last_completed_outbound >= v_last_inbound)
     or (v_last_start is not null and v_last_inbound <= v_last_start) then
    raise exception 'A new customer SMS is required before the next support reply.';
  end if;
  if exists(select 1 from public.calloria_sms_messages where thread_id=v_thread.id and direction='outbound' and status='sending') then
    raise exception 'Another SMS reply is currently being sent for this thread.';
  end if;
  insert into public.calloria_sms_messages(thread_id,direction,body_ciphertext,body_iv,idempotency_key,status,sent_by)
  values (v_thread.id,'outbound',p_body_ciphertext,p_body_iv,p_idempotency_key,'sending',p_staff_user_id)
  returning * into v_new;
  return jsonb_build_object('messageId',v_new.id,'status',v_new.status,'duplicate',false,'phoneCiphertext',v_thread.phone_ciphertext,'phoneIv',v_thread.phone_iv);
end; $$;
revoke all on function public.calloria_sms_reserve_send(uuid,uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_sms_reserve_send(uuid,uuid,text,text,text) to service_role;

create or replace function public.calloria_sms_finalize_send(
  p_message_id uuid,
  p_status text,
  p_provider_message_id text,
  p_error_code text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_message public.calloria_sms_messages; v_delivery_status text;
begin
  if p_status not in ('sent','failed','unknown') then raise exception 'Invalid SMS final status.'; end if;
  select * into v_message from public.calloria_sms_messages where id=p_message_id for update;
  if not found then return false; end if;
  update public.calloria_sms_messages set status=p_status,provider_message_id=coalesce(nullif(p_provider_message_id,''),provider_message_id),
    provider_error_code=left(coalesce(p_error_code,''),80),delivery_updated_at=now()
  where id=p_message_id;
  if nullif(p_provider_message_id,'') is not null then
    select delivery_status into v_delivery_status from public.calloria_sms_webhook_events
     where event_kind='delivery_report' and provider_message_id=p_provider_message_id and delivery_status is not null
     order by created_at desc limit 1;
    if v_delivery_status is not null then
      update public.calloria_sms_messages set
        status=case
          when status='delivered' then 'delivered'
          when v_delivery_status='delivered' then 'delivered'
          when status in ('failed','rejected','dnd_blocked','expired') and v_delivery_status in ('sent','unknown') then status
          else v_delivery_status
        end,
        delivery_updated_at=now()
      where id=p_message_id;
      update public.calloria_sms_webhook_events set outcome='processed',processed_at=now()
       where event_kind='delivery_report' and provider_message_id=p_provider_message_id and delivery_status is not null;
    end if;
  end if;
  if p_status in ('sent','unknown') then
    update public.calloria_sms_threads set last_outbound_at=now(),last_message_at=now() where id=v_message.thread_id;
  end if;
  return true;
end; $$;
revoke all on function public.calloria_sms_finalize_send(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_sms_finalize_send(uuid,text,text,text) to service_role;

create or replace function public.calloria_sms_record_delivery(
  p_event_key text,
  p_provider_message_id text,
  p_status text,
  p_error_code text
) returns boolean
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_inserted integer; v_updated integer;
begin
  if p_event_key !~ '^[0-9a-f]{64}$' or p_provider_message_id is null or p_status not in ('sent','delivered','failed','unknown','rejected','dnd_blocked','expired') then
    raise exception 'Invalid SMS delivery event.';
  end if;
  insert into public.calloria_sms_webhook_events(event_key,event_kind,provider_message_id,delivery_status,outcome)
  values (p_event_key,'delivery_report',p_provider_message_id,p_status,'received') on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted=0 then return true; end if;
  update public.calloria_sms_messages set
    status=case
      when status='delivered' then 'delivered'
      when p_status='delivered' then 'delivered'
      when status in ('failed','rejected','dnd_blocked','expired') and p_status in ('sent','unknown') then status
      else p_status
    end,
    provider_error_code=case when p_status in ('failed','rejected','dnd_blocked','expired') then left(coalesce(p_error_code,''),80) else provider_error_code end,
    delivery_updated_at=now()
  where provider_message_id=p_provider_message_id;
  get diagnostics v_updated = row_count;
  update public.calloria_sms_webhook_events set outcome=case when v_updated>0 then 'processed' else 'received' end,
    processed_at=case when v_updated>0 then now() else null end where event_key=p_event_key;
  return true;
end; $$;
revoke all on function public.calloria_sms_record_delivery(text,text,text,text) from public, anon, authenticated;
grant execute on function public.calloria_sms_record_delivery(text,text,text,text) to service_role;

create or replace function public.calloria_sms_reconcile_stale_sends()
returns integer
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_count integer;
begin
  with stale as (
    update public.calloria_sms_messages
       set status='unknown',
           provider_error_code='stale_send_requires_provider_check',
           delivery_updated_at=now()
     where direction='outbound' and status='sending'
       and created_at < now() - interval '3 minutes'
     returning thread_id, created_at
  ), latest as (
    select thread_id, max(created_at) as sent_at
      from stale group by thread_id
  )
  update public.calloria_sms_threads t
     set last_outbound_at=greatest(coalesce(t.last_outbound_at,'-infinity'::timestamptz),latest.sent_at),
         last_message_at=greatest(t.last_message_at,latest.sent_at)
    from latest where t.id=latest.thread_id;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;
revoke all on function public.calloria_sms_reconcile_stale_sends() from public, anon, authenticated;
grant execute on function public.calloria_sms_reconcile_stale_sends() to service_role;
comment on function public.calloria_sms_reconcile_stale_sends() is 'Converts outbound SMS sends left in sending state for more than three minutes to unknown and blocks retry until a new customer inbound message; provider logs must be checked before any manual follow-up.';

create or replace function public.calloria_sms_consume_send_limit(p_staff_user_id uuid,p_bucket_start timestamptz,p_limit integer default 20)
returns boolean language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_count integer;
begin
  delete from public.calloria_sms_send_limits where bucket_start < now() - interval '48 hours';
  insert into public.calloria_sms_send_limits(staff_user_id,bucket_start,send_count)
  values (p_staff_user_id,p_bucket_start,1)
  on conflict (staff_user_id,bucket_start) do update set send_count=calloria_sms_send_limits.send_count+1
  where calloria_sms_send_limits.send_count < greatest(1,least(30,p_limit))
  returning send_count into v_count;
  return v_count is not null;
end; $$;
revoke all on function public.calloria_sms_consume_send_limit(uuid,timestamptz,integer) from public, anon, authenticated;
grant execute on function public.calloria_sms_consume_send_limit(uuid,timestamptz,integer) to service_role;

comment on table public.calloria_sms_threads is 'Encrypted, one-to-one CALLORIA customer-initiated SMS support conversations. Phone identity is stored encrypted and HMAC-indexed.';
comment on table public.calloria_sms_messages is 'Encrypted inbound SMS and staff support replies with Termii delivery status and idempotency controls.';
comment on table public.calloria_sms_suppressions is 'Keyed SMS opt-out list. No raw phone number or message content is stored.';
comment on table public.calloria_sms_preferences is 'CALLORIA support-SMS preference timestamps. START re-enables support replies only after a subsequent customer-originated message; it never grants marketing consent.';
comment on table public.calloria_sms_webhook_events is 'Idempotency fingerprints and minimal Termii delivery identifiers/statuses. Raw provider webhook bodies and message text are not retained; unmatched early delivery reports are reconciled when the send finalizes.';


create or replace function public.calloria_sms_purge_expired()
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_threads integer; v_events integer;
begin
  update public.calloria_ops_work_items w
     set status='cancelled',last_actor_id='00000000-0000-4000-8000-000000000000'::uuid
    from public.calloria_route_requests r
    join public.calloria_sms_threads t on t.route_ref=r.route_ref
   where w.id=r.work_item_id and t.retention_due_at <= now()
     and r.status in ('queued','assigned')
     and w.status in ('pending','claimed','active','on_hold','after_contact_work','escalated');
  delete from public.calloria_sms_threads where retention_due_at <= now();
  get diagnostics v_threads = row_count;
  delete from public.calloria_sms_webhook_events where created_at < now() - interval '30 days';
  get diagnostics v_events = row_count;
  delete from public.calloria_sms_send_limits where bucket_start < now() - interval '48 hours';
  return jsonb_build_object('threadsDeleted',v_threads,'webhookEventsDeleted',v_events);
end; $$;
revoke all on function public.calloria_sms_purge_expired() from public, anon, authenticated;
grant execute on function public.calloria_sms_purge_expired() to service_role;
comment on function public.calloria_sms_purge_expired() is 'Service-role-only retention task. Invoke on a schedule; deletes expired message threads (and cascaded messages) after 180 days and webhook fingerprints after 30 days. SMS opt-out records are retained until explicit START to avoid accidental re-contact.';
