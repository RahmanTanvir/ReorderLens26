-- P8 operational metadata only. No questions, raw evidence or chat are stored.
BEGIN;
alter table public.ai_usage_events add column context_hash text check(context_hash ~ '^[a-f0-9]{64}$'),
  add column external_slots integer not null default 0 check(external_slots between 0 and 3),
  add column provider_reserved_at timestamptz,add column completed_at timestamptz,
  add column response_kind text check(response_kind in ('grounded_explanation','deterministic_explanation','insufficient_data','clarification','refusal')),
  add column model_slug text check(model_slug is null or (length(model_slug)<=150 and model_slug ~ '^[a-zA-Z0-9._-]+/[a-zA-Z0-9._:-]+:free$')),
  add column latency_ms integer check(latency_ms between 0 and 30000);
create index ai_usage_user_window_idx on public.ai_usage_events(user_id,created_at desc);
create index ai_usage_provider_window_idx on public.ai_usage_events(provider_reserved_at) where external_slots>0;

create function public.reserve_assistant_request(p_org_id uuid,p_request_id uuid,p_context_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare existing public.ai_usage_events; stamp timestamptz:=clock_timestamp(); day_start timestamptz; retry timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid()) then raise exception using errcode='42501',message='WORKSPACE_DENIED';end if;
  if p_request_id is null or p_context_hash is null or p_context_hash !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='INVALID_REQUEST';end if;
  perform pg_advisory_xact_lock(hashtextextended('assistant-user:'||auth.uid()::text,8));
  perform pg_advisory_xact_lock(hashtextextended('assistant-org:'||p_org_id::text,8));
  select * into existing from public.ai_usage_events where id=p_request_id;
  if existing.id is not null then
    if existing.org_id<>p_org_id or existing.user_id<>auth.uid() or existing.context_hash is distinct from p_context_hash then raise exception using errcode='P0001',message='ASSISTANT_REQUEST_CONFLICT';end if;
    return jsonb_build_object('allowed',true,'reused',true,'retryAt',null);
  end if;
  day_start:=date_trunc('day',stamp at time zone 'Asia/Dhaka') at time zone 'Asia/Dhaka';
  if (select count(*) from public.ai_usage_events where user_id=auth.uid() and status in ('accepted','error') and created_at>stamp-interval '1 hour')>=10 then
    select min(created_at)+interval '1 hour' into retry from public.ai_usage_events where user_id=auth.uid() and status in ('accepted','error') and created_at>stamp-interval '1 hour';
    return jsonb_build_object('allowed',false,'reused',false,'retryAt',retry);
  end if;
  if (select count(*) from public.ai_usage_events where org_id=p_org_id and status in ('accepted','error') and created_at>=day_start)>=40 then return jsonb_build_object('allowed',false,'reused',false,'retryAt',day_start+interval '1 day');end if;
  insert into public.ai_usage_events(id,org_id,user_id,status,created_at,context_hash) values(p_request_id,p_org_id,auth.uid(),'accepted',stamp,p_context_hash);
  return jsonb_build_object('allowed',true,'reused',false,'retryAt',null);
end $$;
create function public.reserve_assistant_provider(p_org_id uuid,p_request_id uuid,p_slots integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare event public.ai_usage_events; stamp timestamptz:=clock_timestamp(); day_start timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid()) then raise exception using errcode='42501',message='WORKSPACE_DENIED';end if;
  if p_slots is null or p_slots not between 1 and 3 then raise exception using errcode='22023',message='INVALID_SLOTS';end if;
  select * into event from public.ai_usage_events where id=p_request_id and org_id=p_org_id and user_id=auth.uid() for update;
  if event.id is null then raise exception using errcode='P0001',message='ASSISTANT_REQUEST_NOT_FOUND';end if;
  if event.external_slots>0 or event.completed_at is not null or event.created_at<stamp-interval '5 minutes'
    or not exists(select 1 from public.organizations where id=p_org_id and is_sample) then return false;end if;
  perform pg_advisory_xact_lock(hashtextextended('assistant-provider-global',8));
  day_start:=date_trunc('day',stamp at time zone 'UTC') at time zone 'UTC';
  if (select coalesce(sum(external_slots),0) from public.ai_usage_events where provider_reserved_at>=day_start)+p_slots>40
    or (select coalesce(sum(external_slots),0) from public.ai_usage_events where provider_reserved_at>stamp-interval '1 minute')+p_slots>12 then return false;end if;
  update public.ai_usage_events set external_slots=p_slots,provider_reserved_at=stamp where id=p_request_id;
  return true;
end $$;
create function public.complete_assistant_request(p_org_id uuid,p_request_id uuid,p_kind text,p_model text default null,p_latency integer default null,p_tokens_in integer default null,p_tokens_out integer default null) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid()) then raise exception using errcode='42501',message='WORKSPACE_DENIED';end if;
  if p_kind is null or p_kind not in ('grounded_explanation','deterministic_explanation','insufficient_data','clarification','refusal')
    or (p_model is not null and (length(p_model)>150 or p_model !~ '^[a-zA-Z0-9._-]+/[a-zA-Z0-9._:-]+:free$'))
    or (p_latency is not null and p_latency not between 0 and 30000)
    or (p_tokens_in is not null and p_tokens_in not between 0 and 100000) or (p_tokens_out is not null and p_tokens_out not between 0 and 2000) then raise exception using errcode='22023',message='INVALID_METADATA';end if;
  update public.ai_usage_events set completed_at=clock_timestamp(),response_kind=p_kind,model_slug=p_model,latency_ms=p_latency,tokens_in=p_tokens_in,tokens_out=p_tokens_out
    where id=p_request_id and org_id=p_org_id and user_id=auth.uid() and completed_at is null;
  return found;
end $$;
revoke all on function public.reserve_assistant_request(uuid,uuid,text),public.reserve_assistant_provider(uuid,uuid,integer),public.complete_assistant_request(uuid,uuid,text,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.reserve_assistant_request(uuid,uuid,text),public.reserve_assistant_provider(uuid,uuid,integer),public.complete_assistant_request(uuid,uuid,text,text,integer,integer,integer) to authenticated;
COMMIT;
