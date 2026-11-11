-- P6: RLS-preserving snapshot reads and guarded revision-checked draft edits.
BEGIN;
create function private.plan_line_json(r public.plan_lines) returns jsonb language sql stable security invoker set search_path='' as $$
  select r.input_snapshot||jsonb_build_object('id',r.id,'rank',r.allocation_rank,'desiredQty',r.desired_qty,
    'suggestedQty',r.suggested_qty,'approvedQty',r.approved_qty,'eligible',r.eligible,'risk',r.risk_class,'reasonCodes',to_jsonb(r.reason_codes),
    'purchaseCost',r.purchase_cost_snapshot::text,'onHand',r.on_hand_snapshot,'dailyUnits',r.estimated_daily_snapshot::text,
    'packMultiple',r.pack_multiple_snapshot,'leadDays',r.lead_time_days_snapshot,
    'lineTotal',private.plan_money(r.approved_qty::numeric*r.purchase_cost_snapshot*100),
    'suggestedTotal',private.plan_money(r.suggested_qty::numeric*r.purchase_cost_snapshot*100))
$$;
create function private.plan_json(r public.replenishment_plans) returns jsonb language sql stable security invoker set search_path='' as $$
  with facts as(select r.stale_at is not null or f.stale_at is not null or exists(select 1 from public.import_jobs where org_id=r.org_id and status='committed' and committed_at>r.input_snapshot_at) stale,
    f.as_of_date,f.horizon_days from public.forecast_runs f where f.org_id=r.org_id and f.id=r.forecast_run_id),
  totals as(select count(*) n,count(*) filter(where eligible) eligible,count(*) filter(where approved_qty>0) selected,
    coalesce(sum(approved_qty::numeric),0) units,coalesce(sum(approved_qty::numeric*purchase_cost_snapshot*100),0) approved,
    coalesce(sum(suggested_qty::numeric*purchase_cost_snapshot*100),0) suggested,
    coalesce(bool_and(approved_qty=0 or (eligible and purchase_cost_snapshot>0 and approved_qty%pack_multiple_snapshot=0)),false) valid
    from public.plan_lines where org_id=r.org_id and plan_id=r.id)
  select jsonb_build_object('id',r.id,'forecastRunId',r.forecast_run_id,'status',r.status,'method',r.method,'version',r.algorithm_version,
    'budget',r.budget::text,'initialBudget',coalesce(r.creation_request->>'budget',r.budget::text),'reviewPeriodDays',r.review_period_days,
    'safetyDays',r.safety_days,'revision',r.revision,'snapshotDate',coalesce(r.source_as_of_date,(r.input_snapshot_at at time zone 'Asia/Dhaka')::date),
    'inputSnapshotAt',r.input_snapshot_at,'createdAt',r.created_at,'stale',f.stale,'forecastAsOf',f.as_of_date,'forecastHorizon',f.horizon_days,
    'summary',jsonb_build_object('lineCount',t.n,'eligibleCount',t.eligible,'selectedCount',t.selected,'units',trunc(t.units)::text,
      'suggestedTotal',private.plan_money(t.suggested),'approvedTotal',private.plan_money(t.approved),
      'remaining',private.plan_money(r.budget*100-t.approved),'overBudget',t.approved>r.budget*100,
      'overage',private.plan_money(greatest(t.approved-r.budget*100,0)),
      'canReview',r.status='draft' and r.method is not null and not f.stale and t.selected>0 and t.valid and t.approved<=r.budget*100),
    'supplierTotals',(select coalesce(jsonb_agg(jsonb_build_object('id',s.supplier_id,'name',s.name,'total',private.plan_money(s.total),'count',s.n) order by s.name collate "C",s.supplier_id),'[]')
      from(select supplier_id,min(input_snapshot->>'supplierName') name,sum(approved_qty::numeric*purchase_cost_snapshot*100) total,count(*) n
        from public.plan_lines where org_id=r.org_id and plan_id=r.id and approved_qty>0 group by supplier_id) s),
    'exclusions',r.exclusions_snapshot) from totals t cross join facts f
$$;
revoke all on function private.plan_line_json(public.plan_lines),private.plan_json(public.replenishment_plans) from public,anon;
grant execute on function private.plan_line_json(public.plan_lines),private.plan_json(public.replenishment_plans) to authenticated;

create function public.read_plan_context(p_org_id uuid,p_plan_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare plan public.replenishment_plans; items jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  select * into plan from public.replenishment_plans where org_id=p_org_id and id=p_plan_id and method is not null;
  if plan.id is null then return null; end if;
  select coalesce(jsonb_agg(private.plan_line_json(l) order by l.allocation_rank,l.id),'[]') into items
    from public.plan_lines l where l.org_id=p_org_id and l.plan_id=p_plan_id;
  return jsonb_build_object('plan',private.plan_json(plan),'items',items);
end $$;
create function public.list_replenishment_plans(p_org_id uuid,p_limit integer default 25,p_before uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare position public.replenishment_plans; items jsonb; next_id uuid;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  if p_before is not null then
    select * into position from public.replenishment_plans where org_id=p_org_id and id=p_before and method is not null;
    if position.id is null then raise exception using errcode='22023',message='INVALID_CURSOR'; end if;
  end if;
  with remaining as materialized(select p.* from public.replenishment_plans p where p.org_id=p_org_id and p.method is not null
    and (p_before is null or (p.created_at,p.id)<(position.created_at,position.id))),
  page as materialized(select * from remaining order by created_at desc,id desc limit p_limit)
  select coalesce((select jsonb_agg(private.plan_json(p) order by p.created_at desc,p.id desc) from page p),'[]'),
    case when (select count(*) from remaining)>p_limit then (select id from page order by created_at,id limit 1) end into items,next_id;
  return jsonb_build_object('items',items,'nextCursor',next_id);
end $$;
revoke all on function public.read_plan_context(uuid,uuid),public.list_replenishment_plans(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.read_plan_context(uuid,uuid),public.list_replenishment_plans(uuid,integer,uuid) to authenticated;

create function public.edit_replenishment_plan(p_org_id uuid,p_plan_id uuid,p_expected_revision integer,
  p_budget numeric default null,p_quantities jsonb default null,p_reset boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan public.replenishment_plans; line public.plan_lines; row jsonb; qty bigint;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid() and role in ('owner','operator')) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,3));
  select * into plan from public.replenishment_plans where org_id=p_org_id and id=p_plan_id for update;
  if plan.id is null then raise exception using errcode='P0001',message='PLAN_NOT_FOUND'; end if;
  if plan.status<>'draft' or plan.method is null then raise exception using errcode='P0001',message='PLAN_READ_ONLY'; end if;
  if plan.stale_at is not null or exists(select 1 from public.forecast_runs where org_id=p_org_id and id=plan.forecast_run_id and stale_at is not null)
    or exists(select 1 from public.import_jobs where org_id=p_org_id and status='committed' and committed_at>plan.input_snapshot_at) then
    raise exception using errcode='P0001',message='STALE_INPUTS'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_expected_revision>2147483646 then raise exception using errcode='22023',message='INVALID_REVISION'; end if;
  if plan.revision<>p_expected_revision then raise exception using errcode='P0001',message='STALE_REVISION'; end if;
  if p_reset is null or (p_reset and (p_budget is not null or p_quantities is not null)) or (not p_reset and p_budget is null and p_quantities is null)
    or (p_budget is not null and (p_budget<0 or p_budget>999999999999.99 or p_budget<>round(p_budget,2))) then
    raise exception using errcode='22023',message='INVALID_PLAN_INPUT'; end if;
  if p_quantities is not null then
    if jsonb_typeof(p_quantities)<>'array' or jsonb_array_length(p_quantities) not between 1 and 100 then raise exception using errcode='22023',message='INVALID_QUANTITIES'; end if;
    if (select count(*) from jsonb_array_elements(p_quantities))<>(select count(distinct x->>'lineId') from jsonb_array_elements(p_quantities) x) then
      raise exception using errcode='22023',message='DUPLICATE_LINES'; end if;
    for row in select x from jsonb_array_elements(p_quantities) x loop
      if jsonb_typeof(row)<>'object' or row->>'lineId' is null or jsonb_typeof(row->'approvedQty') is distinct from 'number'
        or row->>'approvedQty' !~ '^\d{1,10}$' or (select count(*) from jsonb_object_keys(row))<>2 then
        raise exception using errcode='22023',message='INVALID_QUANTITY'; end if;
      qty:=(row->>'approvedQty')::bigint;
      if qty>2147483647 then raise exception using errcode='22023',message='INVALID_QUANTITY'; end if;
      select * into line from public.plan_lines where org_id=p_org_id and plan_id=p_plan_id and id=(row->>'lineId')::uuid;
      if line.id is null then raise exception using errcode='P0001',message='PLAN_LINE_NOT_FOUND'; end if;
      if qty%line.pack_multiple_snapshot<>0 or (qty>0 and (not line.eligible or line.purchase_cost_snapshot<=0)) then
        raise exception using errcode='22023',message='INVALID_PACK_OR_ELIGIBILITY'; end if;
      update public.plan_lines set approved_qty=qty::integer where org_id=p_org_id and id=line.id and plan_id=p_plan_id;
    end loop;
  end if;
  if p_reset then update public.plan_lines set approved_qty=suggested_qty where org_id=p_org_id and plan_id=p_plan_id; end if;
  update public.replenishment_plans set budget=coalesce(p_budget,budget),revision=revision+1,updated_at=clock_timestamp() where org_id=p_org_id and id=p_plan_id;
  return jsonb_build_object('planId',p_plan_id,'revision',plan.revision+1);
end $$;
create function public.set_plan_line_quantity(p_org_id uuid,p_plan_id uuid,p_line_id uuid,p_approved_qty integer,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
  select public.edit_replenishment_plan(p_org_id,p_plan_id,p_expected_revision,null,
    jsonb_build_array(jsonb_build_object('lineId',p_line_id,'approvedQty',p_approved_qty)),false)
$$;
create function public.set_plan_budget(p_org_id uuid,p_plan_id uuid,p_budget numeric,p_expected_revision integer)
returns jsonb language sql security invoker set search_path='' as $$
  select public.edit_replenishment_plan(p_org_id,p_plan_id,p_expected_revision,p_budget,null,false)
$$;
revoke all on function public.edit_replenishment_plan(uuid,uuid,integer,numeric,jsonb,boolean),public.set_plan_line_quantity(uuid,uuid,uuid,integer,integer),public.set_plan_budget(uuid,uuid,numeric,integer) from public,anon,authenticated;
grant execute on function public.edit_replenishment_plan(uuid,uuid,integer,numeric,jsonb,boolean),public.set_plan_line_quantity(uuid,uuid,uuid,integer,integer),public.set_plan_budget(uuid,uuid,numeric,integer) to authenticated;

-- Overview purchasing context must not present an over-budget/empty draft as valid.
create or replace function public.read_inventory_budget(p_org_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  select jsonb_build_object('planId',p.id,'budget',p.budget::text,'approvedTotal',coalesce(l.total,0)::text,
    'remaining',(p.budget-coalesce(l.total,0))::text,'lineCount',coalesce(l.lines,0)) into result
  from public.replenishment_plans p join public.forecast_runs f on f.org_id=p.org_id and f.id=p.forecast_run_id
  left join lateral(select sum(approved_qty::numeric*purchase_cost_snapshot) total,count(*) filter(where approved_qty>0) lines
    from public.plan_lines where org_id=p.org_id and plan_id=p.id) l on true
  where p.org_id=p_org_id and p.status='draft' and p.stale_at is null and f.stale_at is null and f.status='succeeded'
    and coalesce(l.total,0)<=p.budget and coalesce(l.lines,0)>0
    and not exists(select 1 from public.import_jobs j where j.org_id=p.org_id and j.status='committed' and j.committed_at>p.input_snapshot_at)
  order by p.created_at desc,p.id desc limit 1;
  return result;
end $$;
COMMIT;
