-- CALLORIA Phase 10: isolated performance, QA, coaching and career progression.
-- This migration does not alter Prospector objects or earlier CALLORIA modules.

create table if not exists public.calloria_perf_scorecards (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null,
  department text not null check (length(btrim(department)) between 2 and 120),
  job_profile text not null check (job_profile in (
    'voice_agent','email_agent','social_agent','sales_advisor','technical_support',
    'qa_analyst','supervisor','safeguarding','learning_advisor','back_office'
  )),
  period_start date not null,
  period_end date not null,
  metric_values jsonb not null default '{}'::jsonb check (jsonb_typeof(metric_values) = 'object'),
  score numeric(5,1) check (score is null or (score >= 0 and score <= 100)),
  rating text check (rating is null or rating in ('incomplete','exceptional','strong','developing','below_expectation','improvement_required')),
  gate_pass boolean not null default false,
  critical_fail boolean not null default false,
  critical_reason text not null default '' check (length(critical_reason) <= 1000),
  status text not null default 'draft' check (status in ('draft','submitted','reviewed','returned')),
  evidence_summary text not null default '' check (length(evidence_summary) <= 1200),
  created_by uuid not null,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not critical_fail or length(btrim(critical_reason)) >= 8),
  check (period_end >= period_start),
  check (period_start = date_trunc('month', period_start)::date),
  check (period_end = (date_trunc('month', period_start) + interval '1 month - 1 day')::date),
  unique (staff_user_id, department, period_start)
);

create table if not exists public.calloria_perf_reviews (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid not null unique references public.calloria_perf_scorecards(id) on delete restrict,
  staff_user_id uuid not null,
  reviewer_user_id uuid not null,
  strengths text not null default '' check (length(strengths) <= 2000),
  improvement_areas text not null default '' check (length(improvement_areas) <= 2000),
  employee_response text not null default '' check (length(employee_response) <= 2000),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.calloria_perf_qa_reviews (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null,
  department text not null check (length(btrim(department)) between 2 and 120),
  channel text not null check (channel in ('voice','email','live_chat','social','whatsapp','back_office','game_support','platform_support')),
  interaction_ref text not null default '' check (length(interaction_ref) <= 100),
  rubric_values jsonb not null check (jsonb_typeof(rubric_values) = 'object'),
  score numeric(5,1) check (score is null or (score >= 0 and score <= 100)),
  critical_fail boolean not null default false,
  critical_reason text not null default '' check (length(critical_reason) <= 1000),
  result text not null check (result in ('pass','fail')),
  evaluator_notes text not null default '' check (length(evaluator_notes) <= 1600),
  evaluated_by uuid not null,
  evaluated_at timestamptz not null default now(),
  check (not critical_fail or length(btrim(critical_reason)) >= 8)
);

create table if not exists public.calloria_perf_coaching (
  id uuid primary key default gen_random_uuid(),
  scorecard_id uuid references public.calloria_perf_scorecards(id) on delete restrict,
  staff_user_id uuid not null,
  created_by uuid not null,
  action_plan text not null check (length(btrim(action_plan)) between 8 and 2000),
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','completed','cancelled')),
  completion_note text not null default '' check (length(completion_note) <= 1600),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calloria_perf_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  staff_user_id uuid not null,
  target_role text not null check (length(btrim(target_role)) between 2 and 80),
  attempt_no smallint not null check (attempt_no between 1 and 3),
  exam_year integer not null check (exam_year between 2026 and 2200),
  question_ids text[] not null check (cardinality(question_ids) between 8 and 20),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  score numeric(5,1) check (score is null or (score >= 0 and score <= 100)),
  passed boolean,
  status text not null default 'in_progress' check (status in ('in_progress','passed','failed','expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  submitted_at timestamptz,
  unique (staff_user_id, target_role, attempt_no),
  unique (staff_user_id, target_role, exam_year)
);

create table if not exists public.calloria_perf_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid not null,
  staff_user_id uuid,
  event_type text not null check (length(btrim(event_type)) between 2 and 60),
  entity_type text not null check (entity_type in ('scorecard','review','qa_review','coaching','exam')),
  entity_id uuid,
  detail jsonb not null default '{}'::jsonb check (jsonb_typeof(detail) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists calloria_perf_scorecards_staff_period_idx on public.calloria_perf_scorecards(staff_user_id, period_start desc);
create index if not exists calloria_perf_scorecards_dept_period_idx on public.calloria_perf_scorecards(department, period_start desc, status);
create index if not exists calloria_perf_qa_staff_date_idx on public.calloria_perf_qa_reviews(staff_user_id, evaluated_at desc);
create index if not exists calloria_perf_coaching_staff_status_idx on public.calloria_perf_coaching(staff_user_id, status, due_date);
create index if not exists calloria_perf_exam_staff_year_idx on public.calloria_perf_exam_attempts(staff_user_id, exam_year desc);
create index if not exists calloria_perf_events_staff_created_idx on public.calloria_perf_events(staff_user_id, created_at desc);

-- All access is brokered by calloria-performance. Browser roles receive no table grants.
do $$
declare t text;
begin
  foreach t in array array[
    'calloria_perf_scorecards','calloria_perf_reviews','calloria_perf_qa_reviews',
    'calloria_perf_coaching','calloria_perf_exam_attempts','calloria_perf_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on table public.%I to service_role', t);
  end loop;
end $$;

grant usage, select on sequence public.calloria_perf_events_id_seq to service_role;

create or replace function public.calloria_perf_open_exam(
  p_staff_user_id uuid,
  p_target_role text,
  p_exam_year integer,
  p_question_ids text[]
) returns public.calloria_perf_exam_attempts
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_first_year integer;
  v_last_year integer;
  v_attempt integer;
  v_row public.calloria_perf_exam_attempts;
begin
  if p_staff_user_id is null or length(btrim(p_target_role)) not between 2 and 80 then
    raise exception 'Invalid staff member or promotion target.';
  end if;
  if p_exam_year <> extract(year from (now() at time zone 'Africa/Lagos'))::integer then
    raise exception 'Promotion exams can only be started in the current calendar year.';
  end if;
  if p_question_ids is null or cardinality(p_question_ids) < 8 or cardinality(p_question_ids) > 20 then
    raise exception 'Exam question set is invalid.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_staff_user_id::text || ':' || p_target_role, 0));
  select count(*), min(exam_year), max(exam_year)
    into v_count, v_first_year, v_last_year
    from public.calloria_perf_exam_attempts
    where staff_user_id = p_staff_user_id and target_role = p_target_role;

  if exists (select 1 from public.calloria_perf_exam_attempts where staff_user_id = p_staff_user_id and target_role = p_target_role and passed = true) then
    raise exception 'This promotion target has already been passed; wait for formal management review.';
  end if;
  if v_count >= 3 then raise exception 'The three annual attempts for this promotion target have been used.'; end if;
  if exists (
    select 1 from public.calloria_perf_exam_attempts
    where staff_user_id = p_staff_user_id and target_role = p_target_role and exam_year = p_exam_year
  ) then raise exception 'Only one attempt per promotion target is allowed in a calendar year.'; end if;
  if v_count > 0 and (p_exam_year <= v_last_year or p_exam_year > v_first_year + 2) then
    raise exception 'The remaining annual attempt must fall within the original three-year examination window.';
  end if;

  v_attempt := v_count + 1;
  insert into public.calloria_perf_exam_attempts(staff_user_id, target_role, attempt_no, exam_year, question_ids)
  values (p_staff_user_id, p_target_role, v_attempt, p_exam_year, p_question_ids)
  returning * into v_row;
  return v_row;
end;
$$;
revoke all on function public.calloria_perf_open_exam(uuid,text,integer,text[]) from public, anon, authenticated;
grant execute on function public.calloria_perf_open_exam(uuid,text,integer,text[]) to service_role;

create or replace function public.calloria_perf_guard_event_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public as $$
begin
  raise exception 'Performance audit events are append-only.';
end;
$$;
create trigger calloria_perf_events_no_mutation
before update or delete on public.calloria_perf_events
for each row execute function public.calloria_perf_guard_event_mutation();

comment on table public.calloria_perf_scorecards is 'Monthly role-specific KPI scorecards. Scores are normalised 0–100, evidence-backed and quality-gated; speed cannot override compliance or critical failures.';
comment on table public.calloria_perf_qa_reviews is 'Sampled quality evaluations storing rubric scores and interaction references only; do not store recordings, transcripts or unnecessary customer personal data.';
comment on table public.calloria_perf_exam_attempts is 'Promotion exam attempts: one per target role per calendar year, no more than three in a three-year window.';
comment on table public.calloria_perf_events is 'Append-only audit events for performance, QA, coaching and promotion actions.';

create or replace function public.calloria_perf_finalize_review(
  p_scorecard_id uuid,
  p_reviewer_user_id uuid,
  p_strengths text,
  p_improvement_areas text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare
  v_card public.calloria_perf_scorecards;
  v_review public.calloria_perf_reviews;
begin
  select * into v_card from public.calloria_perf_scorecards where id = p_scorecard_id for update;
  if not found then raise exception 'Scorecard not found.'; end if;
  if v_card.staff_user_id = p_reviewer_user_id then raise exception 'A staff member cannot review their own scorecard.'; end if;
  if v_card.status <> 'submitted' then raise exception 'Only submitted scorecards can be reviewed.'; end if;
  if length(btrim(coalesce(p_strengths,''))) < 8 or length(btrim(coalesce(p_improvement_areas,''))) < 8 then
    raise exception 'Specific strengths and improvement areas are required.';
  end if;
  insert into public.calloria_perf_reviews(scorecard_id, staff_user_id, reviewer_user_id, strengths, improvement_areas)
  values (p_scorecard_id, v_card.staff_user_id, p_reviewer_user_id, left(p_strengths,2000), left(p_improvement_areas,2000))
  returning * into v_review;
  update public.calloria_perf_scorecards set status = 'reviewed', reviewed_by = p_reviewer_user_id, reviewed_at = now(), updated_at = now()
  where id = p_scorecard_id returning * into v_card;
  return jsonb_build_object('scorecard', to_jsonb(v_card), 'review', to_jsonb(v_review));
end;
$$;
revoke all on function public.calloria_perf_finalize_review(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.calloria_perf_finalize_review(uuid,uuid,text,text) to service_role;
