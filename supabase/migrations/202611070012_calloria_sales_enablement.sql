-- CALLORIA Phase 11: isolated Sales Enablement and ethical cross-sell workspace.
-- Requires Customer 360 migration 008. Does not modify any pre-existing table.

create table if not exists public.calloria_sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  crm_customer_id uuid null references public.calloria_crm_contacts(id) on delete set null,
  owner_user_id uuid not null,
  owner_department text not null check (length(trim(owner_department)) between 3 and 120),
  source_channel text not null check (source_channel in ('voice','email','live_chat','social','whatsapp','website','portal','in_person','platform_referral')),
  source_type text not null check (source_type in ('inbound_enquiry','customer_requested','platform_referral','staff_referral')),
  need_category text not null check (need_category in ('learning_development','business_growth','community_collaboration','social_media_operations','entertainment','career_development','customer_care_consultation','technical_support','product_access','cross_platform')),
  need_summary_ciphertext text not null,
  need_summary_iv text not null,
  stage text not null default 'new' check (stage in ('new','discovery','recommended','customer_interested','referred_to_platform','follow_up_due','closed_no_interest')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz null
);
create index if not exists calloria_sales_opportunities_department_idx on public.calloria_sales_opportunities(owner_department, updated_at desc);
create index if not exists calloria_sales_opportunities_owner_idx on public.calloria_sales_opportunities(owner_user_id, updated_at desc);
create index if not exists calloria_sales_opportunities_customer_idx on public.calloria_sales_opportunities(crm_customer_id, created_at desc) where crm_customer_id is not null;
alter table public.calloria_sales_opportunities enable row level security;
revoke all on public.calloria_sales_opportunities from public, anon, authenticated;
grant select, insert, update on public.calloria_sales_opportunities to service_role;

create table if not exists public.calloria_sales_recommendations (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.calloria_sales_opportunities(id) on delete cascade,
  product_id text not null check (product_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  fit_score smallint not null check (fit_score between 0 and 100),
  match_reason text not null check (length(trim(match_reason)) between 8 and 240),
  presentation_context text not null check (presentation_context in ('customer_requested','proactive')),
  marketing_consent_record_id uuid null references public.calloria_crm_consents(id) on delete cascade,
  status text not null default 'presented' check (status in ('presented','customer_interested','declined','referred')),
  catalogue_version text not null default '2026-11-07.1',
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(opportunity_id, product_id),
  check ((presentation_context = 'proactive' and marketing_consent_record_id is not null) or (presentation_context = 'customer_requested' and marketing_consent_record_id is null))
);
create index if not exists calloria_sales_recommendations_opportunity_idx on public.calloria_sales_recommendations(opportunity_id, created_at);
alter table public.calloria_sales_recommendations enable row level security;
revoke all on public.calloria_sales_recommendations from public, anon, authenticated;
grant select, insert, update on public.calloria_sales_recommendations to service_role;

create table if not exists public.calloria_sales_followups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.calloria_sales_opportunities(id) on delete cascade,
  crm_customer_id uuid not null references public.calloria_crm_contacts(id) on delete cascade,
  purpose text not null check (purpose in ('service_contact','marketing')),
  consent_record_id uuid not null references public.calloria_crm_consents(id) on delete cascade,
  due_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  created_by uuid not null,
  completed_by uuid null,
  completed_at timestamptz null,
  created_at timestamptz not null default now()
);
create index if not exists calloria_sales_followups_due_idx on public.calloria_sales_followups(status, due_at);
create index if not exists calloria_sales_followups_opportunity_idx on public.calloria_sales_followups(opportunity_id, created_at desc);
create unique index if not exists calloria_sales_one_open_followup_idx on public.calloria_sales_followups(opportunity_id) where status = 'scheduled';
alter table public.calloria_sales_followups enable row level security;
revoke all on public.calloria_sales_followups from public, anon, authenticated;
grant select, insert, update on public.calloria_sales_followups to service_role;

create table if not exists public.calloria_sales_events (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null references public.calloria_sales_opportunities(id) on delete cascade,
  actor_user_id uuid not null,
  event_type text not null check (event_type in ('opportunity_created','recommendation_presented','recommendation_responded','stage_changed','followup_scheduled','followup_completed','referral_recorded')),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 1200),
  created_at timestamptz not null default now()
);
create index if not exists calloria_sales_events_opportunity_idx on public.calloria_sales_events(opportunity_id, created_at desc);
alter table public.calloria_sales_events enable row level security;
revoke all on public.calloria_sales_events from public, anon, authenticated;
grant select, insert on public.calloria_sales_events to service_role;

comment on table public.calloria_sales_opportunities is 'CALLORIA sales-interest workflow. Need summaries are encrypted server-side. Does not record payment, pricing or a completed sale.';
comment on table public.calloria_sales_recommendations is 'Need-matched RuffNeck product recommendations with explicit distinction between customer-requested and proactive presentations.';
comment on table public.calloria_sales_followups is 'Staff tasks only. Each scheduled follow-up references the latest granted CRM service-contact or marketing consent. No message is sent by this table.';
comment on table public.calloria_sales_events is 'Minimal operational audit events. Do not place names, emails, phone numbers, transcripts or personal guidance in metadata.';
