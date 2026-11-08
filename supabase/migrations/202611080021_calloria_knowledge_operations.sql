-- CALLORIA Phase 21: controlled editorial workflow for product, service and customer-care knowledge.
-- Additive and isolated: creates only calloria_km_* objects. Existing shared Prospector
-- tables, auth triggers, RLS policies and Phase 4 calloria_kb_* schema are not altered.

create table if not exists public.calloria_km_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null check (record_type in ('article','platform','service')),
  record_key text not null check (record_key ~ '^[a-z0-9][a-z0-9-]{1,99}$'),
  title text not null check (char_length(title) between 2 and 180),
  category text not null default 'general' check (char_length(category) between 2 and 80),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'draft' check (status in ('draft','in_review','changes_requested','approved','published','rejected','retired')),
  version integer not null default 1 check (version > 0),
  change_summary text not null check (char_length(change_summary) between 3 and 600),
  source_url text,
  source_verified_at timestamptz,
  review_due_at timestamptz,
  authored_by uuid not null references auth.users(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (record_type, record_key, version),
  check (source_url is null or source_url ~ '^https://')
);
create index if not exists calloria_km_records_status_idx on public.calloria_km_records(status, record_type, updated_at desc);
create index if not exists calloria_km_records_key_idx on public.calloria_km_records(record_type, record_key, version desc);
create index if not exists calloria_km_records_author_idx on public.calloria_km_records(authored_by, updated_at desc);

create table if not exists public.calloria_km_review_events (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.calloria_km_records(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('approved','changes_requested','rejected')),
  note text not null default '' check (char_length(note) <= 1200),
  created_at timestamptz not null default now()
);
create index if not exists calloria_km_review_events_record_idx on public.calloria_km_review_events(record_id, created_at desc);

create table if not exists public.calloria_km_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 180),
  body text not null check (char_length(body) between 10 and 5000),
  category text not null default 'product_update' check (category in ('product_update','service_change','policy_update','security_notice','known_issue','training_notice')),
  product_ids text[] not null default '{}',
  target_departments text[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  requires_ack boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published','expired','withdrawn')),
  authored_by uuid not null references auth.users(id) on delete restrict,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists calloria_km_announcements_active_idx on public.calloria_km_announcements(status, starts_at, ends_at);

create table if not exists public.calloria_km_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.calloria_km_announcements(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  unique (announcement_id, staff_user_id)
);

create table if not exists public.calloria_km_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('draft_saved','submitted','reviewed','published','retired','announcement_saved','announcement_published','announcement_acknowledged')),
  entity_type text not null check (entity_type in ('record','announcement')),
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index if not exists calloria_km_audit_entity_idx on public.calloria_km_audit(entity_type, entity_id, created_at desc);

create or replace function public.calloria_km_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists calloria_km_records_touch_updated_at on public.calloria_km_records;
create trigger calloria_km_records_touch_updated_at before update on public.calloria_km_records
for each row execute function public.calloria_km_touch_updated_at();
drop trigger if exists calloria_km_announcements_touch_updated_at on public.calloria_km_announcements;
create trigger calloria_km_announcements_touch_updated_at before update on public.calloria_km_announcements
for each row execute function public.calloria_km_touch_updated_at();

alter table public.calloria_km_records enable row level security;
alter table public.calloria_km_review_events enable row level security;
alter table public.calloria_km_announcements enable row level security;
alter table public.calloria_km_acknowledgements enable row level security;
alter table public.calloria_km_audit enable row level security;
revoke all on public.calloria_km_records from anon, authenticated;
revoke all on public.calloria_km_review_events from anon, authenticated;
revoke all on public.calloria_km_announcements from anon, authenticated;
revoke all on public.calloria_km_acknowledgements from anon, authenticated;
revoke all on public.calloria_km_audit from anon, authenticated;
grant select, insert, update, delete on public.calloria_km_records to service_role;
grant select, insert, update, delete on public.calloria_km_review_events to service_role;
grant select, insert, update, delete on public.calloria_km_announcements to service_role;
grant select, insert, update, delete on public.calloria_km_acknowledgements to service_role;
grant select, insert, update, delete on public.calloria_km_audit to service_role;
revoke all on sequence public.calloria_km_audit_id_seq from anon, authenticated;
grant usage, select on sequence public.calloria_km_audit_id_seq to service_role;

comment on table public.calloria_km_records is 'Restricted editorial records. Published facts are synchronised by the authenticated CALLORIA Knowledge Operations Edge Function into Phase 4 calloria_kb_* tables.';
comment on table public.calloria_km_announcements is 'Internal product/service/policy briefing notices with optional staff acknowledgement. Not customer marketing.';

-- Atomic publication: the editorial version and the customer-visible Phase 4
-- knowledge record change in one database transaction.
create or replace function public.calloria_km_publish_record(p_record_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v public.calloria_km_records%rowtype;
  v_payload jsonb;
  v_needs_source boolean;
begin
  select * into v from public.calloria_km_records where id = p_record_id for update;
  if not found then raise exception 'Knowledge record not found.'; end if;
  if v.status <> 'approved' or v.reviewed_by is null or v.reviewed_by = v.authored_by then
    raise exception 'Independent review approval is required before publication.';
  end if;
  v_needs_source := v.record_type in ('platform','service') or lower(v.category) = any(array['psychology','wellbeing','parenting','safeguarding','security','health','legal','financial','product_knowledge','platform_support','service_enquiry','complaint_recovery','pricing','plans']);
  if v_needs_source and (v.source_url is null or v.source_verified_at is null or v.source_verified_at > now() or v.source_verified_at < now() - interval '180 days') then
    raise exception 'A current HTTPS source verified within 180 days is required.';
  end if;
  v_payload := v.payload;
  if v.record_type = 'article' then
    -- The Phase 4 public-read policy checks status, not audience. Staff-only
    -- content must never be left in that public customer retrieval table.
    if v_payload->>'audience' = 'staff' then
      update public.calloria_kb_articles set status='retired',updated_at=now() where slug=v.record_key;
    else
      insert into public.calloria_kb_articles(slug,title,category,body,tags,audience,status,reviewed_at,updated_at)
      values(v.record_key,v.title,coalesce(nullif(v_payload->>'category',''),v.category),v_payload->>'body',
        array(select jsonb_array_elements_text(coalesce(v_payload->'tags','[]'::jsonb))),
        case when v_payload->>'audience' in ('customer','both') then v_payload->>'audience' else 'customer' end,
        'published',now(),now())
      on conflict(slug) do update set title=excluded.title,category=excluded.category,body=excluded.body,tags=excluded.tags,audience=excluded.audience,status='published',reviewed_at=now(),updated_at=now();
    end if;
  elsif v.record_type = 'platform' then
    insert into public.calloria_kb_platforms(id,name,url,purpose,features,support_topics,self_service,limitations,verified_at,active)
    values(v.record_key,v_payload->>'name',v_payload->>'url',v_payload->>'purpose',coalesce(v_payload->'features','[]'::jsonb),coalesce(v_payload->'support_topics','[]'::jsonb),coalesce(v_payload->'self_service','[]'::jsonb),nullif(v_payload->>'limitations',''),v.source_verified_at,coalesce((v_payload->>'active')::boolean,true))
    on conflict(id) do update set name=excluded.name,url=excluded.url,purpose=excluded.purpose,features=excluded.features,support_topics=excluded.support_topics,self_service=excluded.self_service,limitations=excluded.limitations,verified_at=excluded.verified_at,active=excluded.active;
  elsif v.record_type = 'service' then
    insert into public.calloria_kb_services(slug,name,description,category,active,updated_at)
    values(v.record_key,v_payload->>'name',v_payload->>'description',coalesce(nullif(v_payload->>'category',''),v.category),coalesce((v_payload->>'active')::boolean,true),now())
    on conflict(slug) do update set name=excluded.name,description=excluded.description,category=excluded.category,active=excluded.active,updated_at=now();
  else
    raise exception 'Unsupported knowledge record type.';
  end if;
  update public.calloria_km_records set status='published',published_at=now() where id=p_record_id returning * into v;
  insert into public.calloria_km_audit(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_actor_user_id,'published','record',p_record_id,jsonb_build_object('record_type',v.record_type,'record_key',v.record_key,'version',v.version));
  return jsonb_build_object('id',v.id,'status',v.status,'record_type',v.record_type,'record_key',v.record_key,'version',v.version,'published_at',v.published_at);
end;
$$;
revoke all on function public.calloria_km_publish_record(uuid,uuid) from public, anon, authenticated;
grant execute on function public.calloria_km_publish_record(uuid,uuid) to service_role;

create or replace function public.calloria_km_retire_record(p_record_id uuid, p_actor_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v public.calloria_km_records%rowtype;
begin
  select * into v from public.calloria_km_records where id=p_record_id for update;
  if not found or v.status <> 'published' then raise exception 'Only published knowledge can be retired.'; end if;
  if v.record_type='article' then update public.calloria_kb_articles set status='retired',updated_at=now() where slug=v.record_key;
  elsif v.record_type='platform' then update public.calloria_kb_platforms set active=false where id=v.record_key;
  elsif v.record_type='service' then update public.calloria_kb_services set active=false,updated_at=now() where slug=v.record_key;
  end if;
  update public.calloria_km_records set status='retired',retired_at=now() where id=p_record_id returning * into v;
  insert into public.calloria_km_audit(actor_user_id,event_type,entity_type,entity_id,metadata)
  values(p_actor_user_id,'retired','record',p_record_id,jsonb_build_object('record_type',v.record_type,'record_key',v.record_key));
  return jsonb_build_object('id',v.id,'status',v.status,'record_type',v.record_type,'record_key',v.record_key,'version',v.version,'retired_at',v.retired_at);
end;
$$;
revoke all on function public.calloria_km_retire_record(uuid,uuid) from public, anon, authenticated;
grant execute on function public.calloria_km_retire_record(uuid,uuid) to service_role;
