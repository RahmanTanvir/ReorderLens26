-- P6: additive immutable planning inputs and exact-money greedy allocation.
BEGIN;
alter table public.replenishment_plans add column method text check(method in ('reorder_v1','sample_fixture')),
  add column algorithm_version text, add column creation_request jsonb,
  add column source_as_of_date date, add column exclusions_snapshot jsonb not null default '[]';
alter table public.plan_lines add column input_snapshot jsonb,
  add column allocation_rank integer, add column desired_qty integer not null default 0 check(desired_qty>=0),
  add column eligible boolean not null default false;

create function private.plan_money(n numeric) returns text language sql immutable set search_path='' as $$
  select (case when n<0 then '-' else '' end)||div(abs(n),100)::text||'.'||lpad(trunc(mod(abs(n),100))::text,2,'0')
$$;
revoke all on function private.plan_money(numeric) from public,anon;
grant execute on function private.plan_money(numeric) to authenticated;

-- Exact integer minor units and scaled demand. Sorting gap keys retain all
-- possible distinctions: each demand denominator is <10^14, so a gap difference
-- is >=10^-28. Integer floor at 10^28 preserves its order without float division.
create function private.propose_plan(p_inputs jsonb,p_budget numeric,p_review integer,p_safety integer)
returns jsonb language plpgsql immutable set search_path='' as $$
declare row record; remaining numeric:=p_budget*100; reasons text[]; eligible boolean;
  shortfall numeric; raw numeric; desired numeric; allocated numeric; lines jsonb:='[]'; rank integer:=0;
begin
  for row in with source as(select x,
    (x->>'onHand')::integer h,(x->>'dailyUnits')::numeric*10000 d,(x->>'leadDays')::integer l,
    (x->>'purchaseCost')::numeric*100 cost,(x->>'packMultiple')::integer pack,
    x->>'quality' quality,(x->>'supplierActive')::boolean supplier_active from jsonb_array_elements(p_inputs) x),
  risks as(select *,case when h is null or d is null or quality is distinct from 'sufficient' then 'unknown'
    when d>0 and (h=0 or h*10000::numeric<l*d) then 'at_risk'
    when d>0 and h*10000::numeric<=(l+p_review)*d then 'reorder_soon' else 'healthy' end risk from source)
  select * from risks order by case risk when 'at_risk' then 0 when 'reorder_soon' then 1 when 'healthy' then 2 else 3 end,
    div(greatest(l*coalesce(d,0)-coalesce(h,0)*10000::numeric,0)*10000000000000000000000000000,greatest(coalesce(d,0),1)) desc,
    (x->>'sku') collate "C",(x->>'productId') collate "C"
  loop
    rank:=rank+1;reasons:=array(select jsonb_array_elements_text(row.x->'warnings'));
    eligible:=row.risk in ('at_risk','reorder_soon') and row.d>0 and row.cost>0 and row.supplier_active;
    if row.h is null then reasons:=array_append(reasons,'MISSING_STOCK'); end if;
    if row.quality is distinct from 'sufficient' or row.d is null then reasons:=array_append(reasons,'INSUFFICIENT_DEMAND');
    elsif row.d=0 then reasons:=array_append(reasons,'NO_RECENT_DEMAND');
    elsif row.risk='healthy' then reasons:=array_append(reasons,'HEALTHY_STOCK'); end if;
    if row.cost<=0 then reasons:=array_append(reasons,'INVALID_COST'); end if;
    if not row.supplier_active then reasons:=array_append(reasons,'INACTIVE_SUPPLIER'); end if;
    desired:=0;
    if eligible then
      reasons:=array_append(reasons,case when row.risk='at_risk' then 'AT_RISK_BEFORE_ARRIVAL' else 'REORDER_WINDOW' end);
      shortfall:=row.d*(row.l+p_review+p_safety)-row.h*10000::numeric;
      raw:=case when shortfall>0 then div(shortfall+9999,10000) else 0 end;
      desired:=div(raw+row.pack-1,row.pack)*row.pack;
      if desired>2147483647 then raise exception using errcode='22023',message='QUANTITY_LIMIT'; end if;
      if desired<>raw then reasons:=array_append(reasons,'PACK_ROUNDING'); end if;
      if row.l+p_review+p_safety>(row.x->>'forecastHorizon')::integer then reasons:=array_append(reasons,'EXTRAPOLATED_RATE'); end if;
    end if;
    allocated:=case when eligible then least(desired,div(remaining,row.cost*row.pack)*row.pack) else 0 end;
    if allocated<desired then reasons:=array_append(reasons,'BUDGET_LIMIT'); end if;
    remaining:=remaining-allocated*row.cost;
    lines:=lines||jsonb_build_array(row.x||jsonb_build_object('rank',rank,'risk',row.risk,'eligible',eligible,
      'desiredQty',desired::integer,'suggestedQty',allocated::integer,'approvedQty',allocated::integer,
      'reasonCodes',to_jsonb(reasons),'suggestedTotal',private.plan_money(allocated*row.cost),'lineTotal',private.plan_money(allocated*row.cost)));
  end loop;
  return jsonb_build_object('lines',lines,'suggestedTotal',private.plan_money(p_budget*100-remaining),'remaining',private.plan_money(remaining));
end $$;
revoke all on function private.propose_plan(jsonb,numeric,integer,integer) from public,anon,authenticated;

create function public.create_replenishment_plan(p_org_id uuid,p_plan_id uuid,p_forecast_run_id uuid,p_budget numeric,p_review integer default 7,p_safety integer default 2)
returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.replenishment_plans; forecast public.forecast_runs; sample boolean; today date:=(now() at time zone 'Asia/Dhaka')::date;
  request jsonb; inputs jsonb; calculation jsonb; exclusions jsonb; row jsonb; qty integer; sampled jsonb:='[]';
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid() and role in ('owner','operator')) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_plan_id is null or p_forecast_run_id is null or p_budget is null or p_budget<0 or p_budget>999999999999.99 or p_budget<>round(p_budget,2)
    or p_review is null or p_review not between 1 and 30 or p_safety is null or p_safety not between 0 and 30 then
    raise exception using errcode='22023',message='INVALID_PLAN_INPUT'; end if;
  request:=jsonb_build_object('forecastRunId',p_forecast_run_id,'budget',p_budget::numeric(14,2)::text,'reviewPeriodDays',p_review,'safetyDays',p_safety);
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,3));
  select * into existing from public.replenishment_plans where id=p_plan_id;
  if existing.id is not null then
    if existing.org_id<>p_org_id then raise exception using errcode='P0001',message='PLAN_NOT_FOUND'; end if;
    if existing.creation_request is distinct from request then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('planId',existing.id,'reused',true);
  end if;
  select is_sample into sample from public.organizations where id=p_org_id;
  select * into forecast from public.forecast_runs where org_id=p_org_id and id=p_forecast_run_id and status='succeeded' and finished_at is not null
    and as_of_date<=today and ((not sample and method='seasonal_baseline') or (sample and method='sample_fixture'));
  if forecast.id is null then raise exception using errcode='P0001',message='FORECAST_NOT_FOUND'; end if;
  if forecast.stale_at is not null or exists(select 1 from public.import_jobs where org_id=p_org_id and status='committed' and committed_at>forecast.created_at) then
    raise exception using errcode='P0001',message='STALE_INPUTS'; end if;
  if (select count(*) from public.products where org_id=p_org_id and active)>500 then raise exception using errcode='P0001',message='PLAN_SIZE_LIMIT'; end if;
  if (select count(*) from public.replenishment_plans where org_id=p_org_id and created_at>now()-interval '1 hour')>=20 then
    raise exception using errcode='P0001',message='PLAN_LIMIT'; end if;
  if sample and (p_budget<>50000 or p_review<>7 or p_safety<>2) then raise exception using errcode='22023',message='SAMPLE_PLAN_DEFAULTS'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('productId',v.id,'sku',v.sku,'name',v.name,'supplierId',v.supplier_id,
    'supplierName',v.supplier_name,'supplierActive',v.supplier_active,'purchaseCost',v.purchase_cost,'packMultiple',v.pack_multiple,
    'onHand',v.on_hand,'stockDate',v.as_of_date,'dailyUnits',r.estimated_daily_units::text,'quality',r.quality,'leadDays',v.lead_days,
    'forecastHorizon',forecast.horizon_days,'warnings',to_jsonb(array_remove(array[
      case when v.snapshot_stale then 'STALE_SNAPSHOT' end,case when forecast.as_of_date<today then 'HISTORICAL_FORECAST' end,
      case when v.future_snapshot then 'FUTURE_SNAPSHOT_IGNORED' end],null))) order by v.id),'[]') into inputs
  from public.inventory_source_rows v left join public.forecast_product_results r on r.org_id=v.org_id and r.product_id=v.id and r.run_id=p_forecast_run_id
  where v.org_id=p_org_id;
  calculation:=private.propose_plan(inputs,p_budget,p_review,p_safety);
  if not exists(select 1 from jsonb_array_elements(calculation->'lines') x where (x->>'eligible')::boolean) then
    raise exception using errcode='P0001',message='NO_ELIGIBLE_PRODUCTS'; end if;
  if sample then
    for row in select x from jsonb_array_elements(calculation->'lines') x loop
      qty:=case row->>'sku' when 'RL-101' then 40 when 'RL-102' then 65 when 'RL-104' then 20 when 'RL-106' then 60 else 0 end;
      sampled:=sampled||jsonb_build_array(row||jsonb_build_object('desiredQty',qty,'suggestedQty',qty,'approvedQty',qty,
        'reasonCodes',(select coalesce(jsonb_agg(code),'[]') from jsonb_array_elements_text(row->'reasonCodes') code where code not in ('BUDGET_LIMIT','PACK_ROUNDING'))||'["ILLUSTRATIVE_SAMPLE"]'::jsonb));
    end loop;
    calculation:=jsonb_build_object('lines',sampled);
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('productId',x->>'productId','sku',x->>'sku','name',x->>'name','reason','MISSING_STOCK')),'[]') into exclusions
    from jsonb_array_elements(calculation->'lines') x where x->>'onHand' is null;
  insert into public.replenishment_plans(id,org_id,created_by,forecast_run_id,status,budget,review_period_days,safety_days,
    method,algorithm_version,creation_request,source_as_of_date,exclusions_snapshot,input_snapshot_at,created_at)
    values(p_plan_id,p_org_id,auth.uid(),p_forecast_run_id,'building',p_budget,p_review,p_safety,
      case when sample then 'sample_fixture' else 'reorder_v1' end,case when sample then 'sample_plan_v1' else 'reorder_v1' end,
      request,today,exclusions,clock_timestamp(),clock_timestamp());
  for row in select x from jsonb_array_elements(calculation->'lines') x where x->>'onHand' is not null loop
    insert into public.plan_lines(org_id,plan_id,product_id,supplier_id,suggested_qty,approved_qty,purchase_cost_snapshot,pack_multiple_snapshot,
      on_hand_snapshot,estimated_daily_snapshot,lead_time_days_snapshot,risk_class,reason_codes,input_snapshot,allocation_rank,desired_qty,eligible)
    values(p_org_id,p_plan_id,(row->>'productId')::uuid,(row->>'supplierId')::uuid,(row->>'suggestedQty')::integer,(row->>'approvedQty')::integer,
      (row->>'purchaseCost')::numeric,(row->>'packMultiple')::integer,(row->>'onHand')::integer,(row->>'dailyUnits')::numeric,(row->>'leadDays')::integer,
      row->>'risk',array(select jsonb_array_elements_text(row->'reasonCodes')),row,(row->>'rank')::integer,(row->>'desiredQty')::integer,(row->>'eligible')::boolean);
  end loop;
  update public.replenishment_plans set status='draft' where id=p_plan_id and org_id=p_org_id;
  return jsonb_build_object('planId',p_plan_id,'reused',false);
end $$;
revoke all on function public.create_replenishment_plan(uuid,uuid,uuid,numeric,integer,integer) from public,anon,authenticated;
grant execute on function public.create_replenishment_plan(uuid,uuid,uuid,numeric,integer,integer) to authenticated;
COMMIT;
