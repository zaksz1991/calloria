-- CALLORIA Phase 7: isolated, service-role-only Customer 360 data model.
-- No existing Prospector, CALLORIA auth/profile, knowledge or case table is altered.

create table if not exists public.calloria_crm_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_department text not null check (length(trim(owner_department)) between 3 and 120),
  display_name_ciphertext text null,
  display_name_iv text null,
  contact_data_ciphertext text not null,
  contact_data_iv text not null,
  email_hash text null check (email_hash is null or email_hash ~ '^[0-9a-f]{64}$'),
  phone_hash text null check (phone_hash is null or phone_hash ~ '^[0-9a-f]{64}$'),
  name_token_hashes text[] not null default '{}',
  preferred_channel text not null default 'none' check (preferred_channel in ('none','email','phone','whatsapp')),
  source text not null default 'customer_care' check (source in ('customer_care','case_desk','platform_referral','staff_created')),
  created_by uuid not null,
  last_interaction_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calloria_crm_contacts_email_hash_idx on public.calloria_crm_contacts(email_hash) where email_hash is not null;
create index if not exists calloria_crm_contacts_phone_hash_idx on public.calloria_crm_contacts(phone_hash) where phone_hash is not null;
create index if not exists calloria_crm_contacts_name_tokens_idx on public.calloria_crm_contacts using gin(name_token_hashes);
create index if not exists calloria_crm_contacts_department_idx on public.calloria_crm_contacts(owner_department, updated_at desc);
alter table public.calloria_crm_contacts enable row level security;
revoke all on public.calloria_crm_contacts from public, anon, authenticated;
grant select, insert, update, delete on public.calloria_crm_contacts to service_role;

create table if not exists public.calloria_crm_interactions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.calloria_crm_contacts(id) on delete cascade,
  channel text not null check (channel in ('voice','email','live_chat','social','whatsapp','website','portal','in_person','game')),
  direction text not null check (direction in ('inbound','outbound','internal')),
  interaction_type text not null check (interaction_type in ('platform_support','service_enquiry','sales_enquiry','complaint','personal_guidance','general_customer_care')),
  platform_id text null check (platform_id is null or platform_id in ('ruffneck-learn','ruffneck-prospector','ruffneck-connect','ruffneck-social-hub','kano-run','kano-keke')),
  summary_ciphertext text not null,
  summary_iv text not null,
  case_reference text null check (case_reference is null or case_reference ~ '^CC-[0-9]{6}-[A-Z2-9]{6}$'),
  agent_id uuid not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists calloria_crm_interactions_contact_idx on public.calloria_crm_interactions(contact_id, occurred_at desc);
alter table public.calloria_crm_interactions enable row level security;
revoke all on public.calloria_crm_interactions from public, anon, authenticated;
grant select, insert on public.calloria_crm_interactions to service_role;

create table if not exists public.calloria_crm_consents (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.calloria_crm_contacts(id) on delete cascade,
  purpose text not null check (purpose in ('service_contact','marketing','ai_personalization')),
  status text not null check (status in ('granted','revoked','not_granted')),
  capture_channel text not null check (capture_channel in ('voice','email','live_chat','social','whatsapp','website','portal','in_person','staff_recorded')),
  policy_version text not null default '2026-11-07.1',
  captured_by uuid not null,
  created_at timestamptz not null default now()
);
create index if not exists calloria_crm_consents_contact_idx on public.calloria_crm_consents(contact_id, purpose, created_at desc);
alter table public.calloria_crm_consents enable row level security;
revoke all on public.calloria_crm_consents from public, anon, authenticated;
grant select, insert on public.calloria_crm_consents to service_role;

create table if not exists public.calloria_crm_identities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.calloria_crm_contacts(id) on delete cascade,
  identity_type text not null check (identity_type in ('email','phone','platform_account','guest_profile')),
  value_hash text not null check (value_hash ~ '^[0-9a-f]{64}$'),
  masked_value text not null check (length(masked_value) between 3 and 100),
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','rejected')),
  verification_evidence_hash text null check (verification_evidence_hash is null or verification_evidence_hash ~ '^[0-9a-f]{64}$'),
  verified_by uuid null,
  verified_at timestamptz null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique(identity_type, value_hash)
);
create index if not exists calloria_crm_identities_contact_idx on public.calloria_crm_identities(contact_id, created_at desc);
alter table public.calloria_crm_identities enable row level security;
revoke all on public.calloria_crm_identities from public, anon, authenticated;
grant select, insert, update on public.calloria_crm_identities to service_role;

create table if not exists public.calloria_crm_audit (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  contact_id uuid null,
  action text not null check (action in ('customer_search','contact_viewed','contact_created','interaction_recorded','consent_changed','identity_linked','identity_verified','identity_rejected','recommendations_viewed','contact_erased')),
  metadata jsonb not null default '{}'::jsonb check (octet_length(metadata::text) <= 1200),
  created_at timestamptz not null default now()
);
create index if not exists calloria_crm_audit_contact_idx on public.calloria_crm_audit(contact_id, created_at desc);
alter table public.calloria_crm_audit enable row level security;
revoke all on public.calloria_crm_audit from public, anon, authenticated;
grant select, insert on public.calloria_crm_audit to service_role;

comment on table public.calloria_crm_contacts is 'CALLORIA Customer 360. Names and contact payloads are encrypted by the Edge Function; blind indexes are HMAC-SHA256.';
comment on table public.calloria_crm_interactions is 'Customer service timeline. Summary payloads are encrypted; personal-guidance content is intentionally reduced to a generic marker before storage.';
comment on table public.calloria_crm_consents is 'Append-only consent history. Marketing and AI-personalisation opt-ins are distinct and never inferred.';
comment on table public.calloria_crm_identities is 'Identity associations are unverified by default; only supervisors may record verification after an approved independent check.';
comment on table public.calloria_crm_audit is 'Staff audit events with metadata restricted to non-sensitive operational facts.';
