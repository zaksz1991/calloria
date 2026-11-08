-- CALLORIA Phase 20: Supervisor Operations Intelligence.
-- Aggregate-only reporting. No customer messages, contact details, auth identities,
-- access tokens, or encrypted payloads are selected or returned.
-- Requires CALLORIA Agent Desk, Workforce, Performance, Routing and channel migrations 009-019.

create index if not exists calloria_ops_work_items_department_created_idx
  on public.calloria_ops_work_items (department, created_at desc);
create index if not exists calloria_ops_work_items_assigned_created_idx
  on public.calloria_ops_work_items (assigned_to, created_at desc) where assigned_to is not null;
create index if not exists calloria_ops_work_items_resolved_at_idx
  on public.calloria_ops_work_items (department, resolved_at desc)
  where status = 'resolved' and resolved_at is not null;
create index if not exists calloria_ops_work_items_due_active_idx
  on public.calloria_ops_work_items (department, due_at)
  where status in ('pending','claimed','active','on_hold','after_contact_work','escalated');
create index if not exists calloria_perf_qa_reviews_staff_date_idx
  on public.calloria_perf_qa_reviews (staff_user_id, evaluated_at desc);
create index if not exists calloria_perf_qa_reviews_department_date_idx
  on public.calloria_perf_qa_reviews (department, evaluated_at desc);
create index if not exists calloria_perf_scorecards_staff_reviewed_idx
  on public.calloria_perf_scorecards (staff_user_id, reviewed_at desc)
  where status = 'reviewed';
create index if not exists calloria_perf_scorecards_reviewed_date_idx
  on public.calloria_perf_scorecards (department, reviewed_at desc)
  where status = 'reviewed';
create index if not exists calloria_wa_messages_route_created_idx
  on public.calloria_wa_messages (route_ref, created_at desc)
  where direction = 'outbound' and route_ref is not null;
create index if not exists calloria_email_messages_route_created_idx
  on public.calloria_email_messages (route_ref, created_at desc)
  where direction = 'outbound' and route_ref is not null;
create index if not exists calloria_social_messages_conversation_created_idx
  on public.calloria_social_messages (conversation_id, created_at desc)
  where direction = 'outbound';

create or replace function public.calloria_ops_intelligence_snapshot(
  p_departments text[],
  p_since timestamptz,
  p_until timestamptz,
  p_staff_user_id uuid default null,
  p_include_team boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := now();
  v_overview jsonb;
  v_queue jsonb;
  v_channels jsonb;
  v_departments jsonb;
  v_daily jsonb;
  v_staffing jsonb;
  v_quality jsonb;
  v_delivery jsonb;
  v_voice jsonb;
  v_scope_count integer;
  v_scope text;
begin
  if p_departments is null or cardinality(p_departments) < 1 or cardinality(p_departments) > 11 then
    raise exception 'A valid department scope is required.';
  end if;
  if p_since is null or p_until is null or p_since >= p_until or p_until > v_now + interval '5 minutes' or p_since < v_now - interval '91 days' then
    raise exception 'The reporting window must be between 1 and 90 days and cannot be in the future.';
  end if;
  if p_staff_user_id is not null and p_include_team then
    raise exception 'Personal scope cannot request team aggregates.';
  end if;
  select count(distinct x) into v_scope_count from unnest(p_departments) x;
  if v_scope_count <> cardinality(p_departments) then raise exception 'Department scope contains duplicates.'; end if;
  v_scope := case when p_staff_user_id is null then 'department_aggregate' else 'personal' end;

  with period_items as (
    select w.department,w.channel,w.priority,w.created_at from public.calloria_ops_work_items w
    where w.department = any(p_departments)
      and w.created_at >= p_since and w.created_at < p_until
      and (p_staff_user_id is null or w.assigned_to = p_staff_user_id)
  ), resolved_items as (
    select w.department,w.created_at,w.due_at,w.resolved_at from public.calloria_ops_work_items w
    where w.department = any(p_departments)
      and w.status = 'resolved' and w.resolved_at >= p_since and w.resolved_at < p_until
      and (p_staff_user_id is null or w.assigned_to = p_staff_user_id)
  ), active_items as (
    select w.department,w.priority,w.status,w.created_at,w.due_at,w.assigned_to from public.calloria_ops_work_items w
    where w.department = any(p_departments)
      and w.status in ('pending','claimed','active','on_hold','after_contact_work','escalated')
      and (p_staff_user_id is null or w.assigned_to = p_staff_user_id)
  ), claimed_period as (
    select w.created_at,w.claimed_at from public.calloria_ops_work_items w
    where w.department = any(p_departments) and w.claimed_at >= p_since and w.claimed_at < p_until
      and (p_staff_user_id is null or w.assigned_to = p_staff_user_id)
  )
  select jsonb_build_object(
    'contacts_received', (select count(*) from period_items),
    'resolved', (select count(*) from resolved_items),
    'active_work', (select count(*) from active_items),
    'overdue', (select count(*) from active_items where due_at < v_now),
    'high_urgent_open', (select count(*) from active_items where priority in ('high','urgent')),
    'urgent_open', (select count(*) from active_items where priority='urgent'),
    'oldest_open_wait_minutes', (select coalesce(floor(extract(epoch from (v_now-min(created_at)))/60),0)::integer from active_items),
    'sla_eligible_resolutions', (select count(*) from resolved_items where due_at is not null),
    'sla_met', (select count(*) from resolved_items where due_at is not null and resolved_at <= due_at),
    'sla_rate', (select case when count(*) filter (where due_at is not null)=0 then null else round(100.0*count(*) filter(where due_at is not null and resolved_at <= due_at)/count(*) filter(where due_at is not null),1) end from resolved_items),
    'average_resolution_minutes', (select case when count(*)=0 then null else round(avg(extract(epoch from (resolved_at-created_at))/60.0)::numeric,1) end from resolved_items where resolved_at >= created_at),
    'average_claim_wait_minutes', (select case when count(*)=0 then null else round(avg(extract(epoch from (claimed_at-created_at))/60.0)::numeric,1) end from claimed_period where claimed_at >= created_at)
  ) into v_overview;

  with active_items as (
    select w.priority,w.status,w.created_at,w.due_at,w.assigned_to from public.calloria_ops_work_items w
    where w.department = any(p_departments)
      and w.status in ('pending','claimed','active','on_hold','after_contact_work','escalated')
      and (p_staff_user_id is null or w.assigned_to = p_staff_user_id)
  )
  select jsonb_build_object(
    'urgent_waiting_over_5m', count(*) filter(where priority='urgent' and status in ('pending','escalated') and created_at < v_now - interval '5 minutes'),
    'high_waiting_over_30m', count(*) filter(where priority='high' and status in ('pending','escalated') and created_at < v_now - interval '30 minutes'),
    'overdue_open', count(*) filter(where due_at < v_now),
    'on_hold', count(*) filter(where status='on_hold'),
    'after_contact_work', count(*) filter(where status='after_contact_work'),
    'unassigned', count(*) filter(where assigned_to is null),
    'oldest_queue_item_at', min(created_at) filter(where status in ('pending','escalated') and assigned_to is null)
  ) into v_queue from active_items;

  with period_items as (
    select w.channel from public.calloria_ops_work_items w
    where w.department=any(p_departments) and w.created_at >= p_since and w.created_at < p_until
      and (p_staff_user_id is null or w.assigned_to=p_staff_user_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'count',n) order by n desc,channel),'[]'::jsonb)
  into v_channels from (select channel,count(*)::integer n from period_items group by channel) q;

  with depts as (select unnest(p_departments) department),
  created as (
    select department,count(*) n from public.calloria_ops_work_items
    where department=any(p_departments) and created_at >= p_since and created_at < p_until
      and (p_staff_user_id is null or assigned_to=p_staff_user_id) group by department
  ), resolved as (
    select department,count(*) n from public.calloria_ops_work_items
    where department=any(p_departments) and status='resolved' and resolved_at >= p_since and resolved_at < p_until
      and (p_staff_user_id is null or assigned_to=p_staff_user_id) group by department
  ), active as (
    select department,count(*) n,count(*) filter(where due_at < v_now) overdue
    from public.calloria_ops_work_items
    where department=any(p_departments) and status in ('pending','claimed','active','on_hold','after_contact_work','escalated')
      and (p_staff_user_id is null or assigned_to=p_staff_user_id) group by department
  )
  select coalesce(jsonb_agg(jsonb_build_object('department',d.department,'received',coalesce(c.n,0),'resolved',coalesce(r.n,0),'open',coalesce(a.n,0),'overdue',coalesce(a.overdue,0)) order by d.department),'[]'::jsonb)
  into v_departments from depts d left join created c using(department) left join resolved r using(department) left join active a using(department);

  with days as (
    select series.day_value::date as calendar_day
    from generate_series(
      date_trunc('day', p_since),
      date_trunc('day', p_until - interval '1 second'),
      interval '1 day'
    ) as series(day_value)
  ), created as (
    select created_at::date as calendar_day, count(*) as n
    from public.calloria_ops_work_items
    where department = any(p_departments)
      and created_at >= p_since and created_at < p_until
      and (p_staff_user_id is null or assigned_to = p_staff_user_id)
    group by created_at::date
  ), resolved as (
    select resolved_at::date as calendar_day, count(*) as n
    from public.calloria_ops_work_items
    where department = any(p_departments)
      and status = 'resolved'
      and resolved_at >= p_since and resolved_at < p_until
      and (p_staff_user_id is null or assigned_to = p_staff_user_id)
    group by resolved_at::date
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'day', d.calendar_day,
        'received', coalesce(c.n, 0),
        'resolved', coalesce(r.n, 0)
      ) order by d.calendar_day
    ),
    '[]'::jsonb
  )
  into v_daily
  from days d
  left join created c using (calendar_day)
  left join resolved r using (calendar_day);

  if p_staff_user_id is null then
    select jsonb_build_object(
      'on_shift',count(distinct a.staff_user_id),
      'customer_work',count(distinct a.staff_user_id) filter(where a.current_activity='customer_work'),
      'break_or_lunch',count(distinct a.staff_user_id) filter(where a.current_activity in ('break','lunch','prayer')),
      'training_or_coaching',count(distinct a.staff_user_id) filter(where a.current_activity in ('training','coaching','briefing','quality_assurance')),
      'other_activity',count(distinct a.staff_user_id) filter(where a.current_activity in ('back_office','system_admin','offline'))
    ) into v_staffing
    from public.calloria_wfm_shifts s join public.calloria_wfm_attendance a on a.shift_id=s.id
    where s.department=any(p_departments) and s.status='published' and s.shift_start<=v_now and s.shift_end>v_now
      and a.clock_out is null;
  else
    select jsonb_build_object(
      'on_shift',count(distinct a.staff_user_id),
      'customer_work',count(distinct a.staff_user_id) filter(where a.current_activity='customer_work'),
      'break_or_lunch',count(distinct a.staff_user_id) filter(where a.current_activity in ('break','lunch','prayer')),
      'training_or_coaching',count(distinct a.staff_user_id) filter(where a.current_activity in ('training','coaching','briefing','quality_assurance')),
      'other_activity',count(distinct a.staff_user_id) filter(where a.current_activity in ('back_office','system_admin','offline'))
    ) into v_staffing
    from public.calloria_wfm_shifts s join public.calloria_wfm_attendance a on a.shift_id=s.id
    where s.staff_user_id=p_staff_user_id and s.status='published' and s.shift_start<=v_now and s.shift_end>v_now
      and a.clock_out is null;
  end if;

  if p_staff_user_id is null then
    select jsonb_build_object(
      'qa_reviews',count(*),
      'qa_average',case when count(score)=0 then null else round(avg(score),1) end,
      'qa_pass_rate',case when count(*)=0 then null else round(100.0*count(*) filter(where result='pass')/count(*),1) end,
      'critical_fails',count(*) filter(where critical_fail),
      'reviewed_scorecards', (select count(*) from public.calloria_perf_scorecards s where s.department=any(p_departments) and s.status='reviewed' and s.reviewed_at >= p_since and s.reviewed_at < p_until),
      'scorecard_average', (select case when count(score)=0 then null else round(avg(score),1) end from public.calloria_perf_scorecards s where s.department=any(p_departments) and s.status='reviewed' and s.reviewed_at >= p_since and s.reviewed_at < p_until),
      'open_coaching', (select count(*) from public.calloria_perf_coaching c join public.calloria_perf_scorecards s on s.id=c.scorecard_id where s.department=any(p_departments) and c.status in ('open','in_progress'))
    ) into v_quality
    from public.calloria_perf_qa_reviews q
    where q.department=any(p_departments) and q.evaluated_at >= p_since and q.evaluated_at < p_until;
  else
    select jsonb_build_object(
      'qa_reviews',count(*),
      'qa_average',case when count(score)=0 then null else round(avg(score),1) end,
      'qa_pass_rate',case when count(*)=0 then null else round(100.0*count(*) filter(where result='pass')/count(*),1) end,
      'critical_fails',count(*) filter(where critical_fail),
      'reviewed_scorecards', (select count(*) from public.calloria_perf_scorecards s where s.staff_user_id=p_staff_user_id and s.status='reviewed' and s.reviewed_at >= p_since and s.reviewed_at < p_until),
      'scorecard_average', (select case when count(score)=0 then null else round(avg(score),1) end from public.calloria_perf_scorecards s where s.staff_user_id=p_staff_user_id and s.status='reviewed' and s.reviewed_at >= p_since and s.reviewed_at < p_until),
      'open_coaching', (select count(*) from public.calloria_perf_coaching c where c.staff_user_id=p_staff_user_id and c.status in ('open','in_progress'))
    ) into v_quality
    from public.calloria_perf_qa_reviews q
    where q.staff_user_id=p_staff_user_id and q.evaluated_at >= p_since and q.evaluated_at < p_until;
  end if;

  if p_staff_user_id is null then
    select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'sent',sent,'delivered',delivered,'failed',failed,'unknown',unknown) order by channel),'[]'::jsonb)
    into v_delivery from (
      select 'whatsapp'::text channel,count(*) filter(where m.provider_status in ('sent','delivered','read'))::integer sent,
        count(*) filter(where m.provider_status in ('delivered','read'))::integer delivered,
        count(*) filter(where m.provider_status='failed')::integer failed,count(*) filter(where m.provider_status='unknown')::integer unknown
      from public.calloria_wa_messages m
      join public.calloria_wa_conversations c on c.id=m.conversation_id
      join public.calloria_route_requests r on r.route_ref=coalesce(m.route_ref,c.active_route_ref)
      where m.direction='outbound' and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments)
      union all
      select 'email',count(*) filter(where m.provider_status='sent')::integer,null::integer,count(*) filter(where m.provider_status='failed')::integer,count(*) filter(where m.provider_status='unknown')::integer
      from public.calloria_email_messages m
      join public.calloria_email_threads t on t.id=m.thread_id
      join public.calloria_route_requests r on r.route_ref=coalesce(m.route_ref,t.active_route_ref)
      where m.direction='outbound' and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments)
      union all
      select 'social',count(*) filter(where m.delivery_state='sent')::integer,null::integer,count(*) filter(where m.delivery_state='failed')::integer,count(*) filter(where m.delivery_state='uncertain')::integer
      from public.calloria_social_messages m
      join public.calloria_social_conversations c on c.id=m.conversation_id
      join public.calloria_route_requests r on r.route_ref=c.route_ref
      where m.direction='outbound' and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments)
      union all
      select 'sms',count(*) filter(where m.status in ('sent','delivered'))::integer,count(*) filter(where m.status='delivered')::integer,count(*) filter(where m.status='failed')::integer,count(*) filter(where m.status='unknown')::integer
      from public.calloria_sms_messages m
      join public.calloria_sms_threads t on t.id=m.thread_id
      join public.calloria_route_requests r on r.route_ref=t.route_ref
      where m.direction='outbound' and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments)
    ) providers;
  else
    select coalesce(jsonb_agg(jsonb_build_object('channel',channel,'sent',sent,'delivered',delivered,'failed',failed,'unknown',unknown) order by channel),'[]'::jsonb)
    into v_delivery from (
      select 'whatsapp'::text channel,count(*) filter(where m.provider_status in ('sent','delivered','read'))::integer sent,
        count(*) filter(where m.provider_status in ('delivered','read'))::integer delivered,
        count(*) filter(where m.provider_status='failed')::integer failed,count(*) filter(where m.provider_status='unknown')::integer unknown
      from public.calloria_wa_messages m
      join public.calloria_wa_conversations c on c.id=m.conversation_id
      join public.calloria_route_requests r on r.route_ref=coalesce(m.route_ref,c.active_route_ref)
      where m.direction='outbound' and m.sent_by=p_staff_user_id and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments) and r.assigned_to=p_staff_user_id
      union all
      select 'email',count(*) filter(where m.provider_status='sent')::integer,null::integer,count(*) filter(where m.provider_status='failed')::integer,count(*) filter(where m.provider_status='unknown')::integer
      from public.calloria_email_messages m
      join public.calloria_email_threads t on t.id=m.thread_id
      join public.calloria_route_requests r on r.route_ref=coalesce(m.route_ref,t.active_route_ref)
      where m.direction='outbound' and m.sent_by=p_staff_user_id and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments) and r.assigned_to=p_staff_user_id
      union all
      select 'social',count(*) filter(where m.delivery_state='sent')::integer,null::integer,count(*) filter(where m.delivery_state='failed')::integer,count(*) filter(where m.delivery_state='uncertain')::integer
      from public.calloria_social_messages m
      join public.calloria_social_conversations c on c.id=m.conversation_id
      join public.calloria_route_requests r on r.route_ref=c.route_ref
      where m.direction='outbound' and m.sender_id=p_staff_user_id and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments) and r.assigned_to=p_staff_user_id
      union all
      select 'sms',count(*) filter(where m.status in ('sent','delivered'))::integer,count(*) filter(where m.status='delivered')::integer,count(*) filter(where m.status='failed')::integer,count(*) filter(where m.status='unknown')::integer
      from public.calloria_sms_messages m
      join public.calloria_sms_threads t on t.id=m.thread_id
      join public.calloria_route_requests r on r.route_ref=t.route_ref
      where m.direction='outbound' and m.sent_by=p_staff_user_id and m.created_at>=p_since and m.created_at<p_until and r.department=any(p_departments) and r.assigned_to=p_staff_user_id
    ) providers;
  end if;

  if p_staff_user_id is null then
    select jsonb_build_object(
      'calls',count(*),
      'inbound',count(*) filter(where direction='inbound'),
      'outbound',count(*) filter(where direction='outbound'),
      'completed',count(*) filter(where status='completed'),
      'failed_or_unanswered',count(*) filter(where status in ('busy','no-answer','failed','canceled','rejected')),
      'average_duration_seconds',case when count(call_duration_seconds)=0 then null else round(avg(call_duration_seconds),1) end
    ) into v_voice from public.calloria_voice_calls
    where department=any(p_departments) and created_at>=p_since and created_at<p_until;
  else
    select jsonb_build_object(
      'calls',count(*),
      'inbound',count(*) filter(where direction='inbound'),
      'outbound',count(*) filter(where direction='outbound'),
      'completed',count(*) filter(where status='completed'),
      'failed_or_unanswered',count(*) filter(where status in ('busy','no-answer','failed','canceled','rejected')),
      'average_duration_seconds',case when count(call_duration_seconds)=0 then null else round(avg(call_duration_seconds),1) end
    ) into v_voice from public.calloria_voice_calls
    where (staff_user_id=p_staff_user_id or ring_target_user_id=p_staff_user_id)
      and created_at>=p_since and created_at<p_until;
  end if;

  return jsonb_build_object(
    'generated_at',v_now,
    'period',jsonb_build_object('from',p_since,'until',p_until),
    'scope',jsonb_build_object('type',v_scope,'department_count',v_scope_count,'personal',p_staff_user_id is not null),
    'overview',coalesce(v_overview,'{}'::jsonb),
    'queue_risk',coalesce(v_queue,'{}'::jsonb),
    'channels',coalesce(v_channels,'[]'::jsonb),
    'departments',coalesce(v_departments,'[]'::jsonb),
    'daily',coalesce(v_daily,'[]'::jsonb),
    'staffing',coalesce(v_staffing,'{}'::jsonb),
    'quality',coalesce(v_quality,'{}'::jsonb),
    'provider_delivery',coalesce(v_delivery,'[]'::jsonb),
    'voice',coalesce(v_voice,'{}'::jsonb)
  );
end;
$$;

revoke all on function public.calloria_ops_intelligence_snapshot(text[],timestamptz,timestamptz,uuid,boolean) from public, anon, authenticated;
grant execute on function public.calloria_ops_intelligence_snapshot(text[],timestamptz,timestamptz,uuid,boolean) to service_role;
