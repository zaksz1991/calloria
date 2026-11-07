-- CALLORIA Phase 8: omnichannel agent work management.
-- Creates new calloria_ops_* objects only. It does not alter shared auth/profile,
-- Prospector, Customer 360, knowledge-base or Case Desk tables and policies.

create table if not exists public.calloria_ops_work_items (
  id uuid primary key default gen_random_uuid(),
  work_ref text not null unique,
  department text not null check (department in (
    'RuffNeck Products and Platform Support','Sales and Service Enquiries',
    'Complaints and Service Recovery','Personal Development and Wellbeing Information',
    'General Customer Care','Email and Written Support','Social Media Support',
    'Technical Support and IT','Quality Assurance and Customer Experience',
    'Safeguarding and Trained Human Support','Learning and Career Development'
  )),
  channel text not null check (channel in ('voice','email','live_chat','social','whatsapp','website','portal','game','back_office')),
  direction text not null default 'inbound' check (direction in ('inbound','outbound','internal')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  platform_id text null check (platform_id is null or platform_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  crm_customer_id uuid null,
  case_reference text null check (case_reference is null or case_reference ~ '^CC-[0-9]{6}-[A-Z2-9]{6}$'),
  subject text not null check (char_length(subject) between 3 and 140),
  summary_ciphertext text not null,
  summary_iv text not null,
  status text not null default 'pending' check (status in ('pending','claimed','active','on_hold','after_contact_work','resolved','escalated','cancelled')),
  assigned_to uuid null,
  claimed_at timestamptz null,
  started_at timestamptz null,
  hold_started_at timestamptz null,
  hold_seconds integer not null default 0 check (hold_seconds >= 0),
  due_at timestamptz not null,
  disposition text null check (disposition is null or disposition in ('information_provided','self_service_guided','technical_resolution','case_created','referred_to_specialist','complaint_escalated','sales_enquiry_recorded','customer_requested_follow_up','no_response','resolved_without_action')),
  outcome_ciphertext text null,
  outcome_iv text null,
  created_by uuid not null,
  last_actor_id uuid null,
  last_actor_role text null check (last_actor_role is null or last_actor_role in ('agent','supervisor')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz null
);

create table if not exists public.calloria_ops_events (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.calloria_ops_work_items(id) on delete cascade,
  actor_id uuid not null,
  actor_role text not null check (actor_role in ('agent','supervisor')),
  event_type text not null check (event_type in ('created','claimed','released','started','held','resumed','after_contact_work_started','escalated','resolved','cancelled','supervisor_reassigned')),
  from_status text null,
  to_status text null,
  created_at timestamptz not null default now()
);

create index if not exists calloria_ops_queue_idx on public.calloria_ops_work_items (department, status, priority, created_at);
create index if not exists calloria_ops_assignee_idx on public.calloria_ops_work_items (assigned_to, status, updated_at desc);
create index if not exists calloria_ops_customer_idx on public.calloria_ops_work_items (crm_customer_id, created_at desc) where crm_customer_id is not null;
create index if not exists calloria_ops_events_item_idx on public.calloria_ops_events (work_item_id, created_at desc);

alter table public.calloria_ops_work_items enable row level security;
alter table public.calloria_ops_events enable row level security;
revoke all on public.calloria_ops_work_items from public, anon, authenticated;
revoke all on public.calloria_ops_events from public, anon, authenticated;
grant select, insert, update on public.calloria_ops_work_items to service_role;
grant select, insert on public.calloria_ops_events to service_role;

create or replace function public.calloria_ops_claim_work_item(
  p_item_id uuid,
  p_agent_id uuid,
  p_actor_role text,
  p_departments text[]
) returns setof public.calloria_ops_work_items
language sql
security definer
set search_path = pg_catalog, public
as $$
  update public.calloria_ops_work_items
     set assigned_to = p_agent_id,
         claimed_at = now(),
         status = 'claimed',
         last_actor_id = p_agent_id,
         last_actor_role = p_actor_role,
         version = version + 1,
         updated_at = now()
   where id = p_item_id
     and department = any(p_departments)
     and status in ('pending','escalated')
     and assigned_to is null
  returning *;
$$;
revoke all on function public.calloria_ops_claim_work_item(uuid,uuid,text,text[]) from public, anon, authenticated;
grant execute on function public.calloria_ops_claim_work_item(uuid,uuid,text,text[]) to service_role;

create or replace function public.calloria_ops_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists calloria_ops_work_items_touch on public.calloria_ops_work_items;
create trigger calloria_ops_work_items_touch before update on public.calloria_ops_work_items
for each row execute function public.calloria_ops_touch_updated_at();

-- Database trigger guarantees that creation and every status transition have an
-- event row in the same transaction as the work-item write.
create or replace function public.calloria_ops_write_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_event text;
begin
  if tg_op = 'INSERT' then
    insert into public.calloria_ops_events(work_item_id, actor_id, actor_role, event_type, from_status, to_status)
    values (new.id, coalesce(new.last_actor_id, new.created_by), coalesce(new.last_actor_role, 'agent'), 'created', null, new.status);
    return new;
  end if;

  if old.status is distinct from new.status then
    v_event := case
      when new.status = 'claimed' then 'claimed'
      when new.status = 'active' and old.status = 'on_hold' then 'resumed'
      when new.status = 'active' then 'started'
      when new.status = 'pending' then 'released'
      when new.status = 'on_hold' then 'held'
      when new.status = 'after_contact_work' then 'after_contact_work_started'
      when new.status = 'escalated' then 'escalated'
      when new.status = 'resolved' then 'resolved'
      when new.status = 'cancelled' then 'cancelled'
      else null
    end;
    if v_event is not null then
      insert into public.calloria_ops_events(work_item_id, actor_id, actor_role, event_type, from_status, to_status)
      values (new.id, coalesce(new.last_actor_id, new.created_by), coalesce(new.last_actor_role, 'agent'), v_event, old.status, new.status);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.calloria_ops_write_event() from public, anon, authenticated;

drop trigger if exists calloria_ops_work_items_event on public.calloria_ops_work_items;
create trigger calloria_ops_work_items_event
  after insert or update of status on public.calloria_ops_work_items
  for each row execute function public.calloria_ops_write_event();


comment on table public.calloria_ops_work_items is 'CALLORIA staff-only multichannel work queue. Customer summaries/outcomes are encrypted by the Edge Function.';
comment on table public.calloria_ops_events is 'Append-only staff activity events for CALLORIA work items; no free-text notes or customer PII.';
