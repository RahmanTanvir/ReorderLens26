-- P5 bounded, tenant-RLS-preserving reads of immutable forecast snapshots.
BEGIN;
create function private.forecast_run_json(r public.forecast_runs) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',r.id,'method',r.method,'status',r.status,'asOfDate',r.as_of_date,
    'horizonDays',r.horizon_days,'historyStart',r.history_start,'historyEnd',r.history_end,
    'createdAt',r.created_at,'finishedAt',r.finished_at,'staleAt',coalesce(r.stale_at,
      (select max(committed_at) from public.import_jobs where org_id=r.org_id and status='committed' and committed_at>r.created_at)),
    'version',r.algorithm_version,'errorCode',r.error_code,
    'summary',(select jsonb_build_object('total',count(*),'sufficient',count(*) filter(where quality='sufficient'),
      'insufficient',count(*) filter(where quality<>'sufficient')) from public.forecast_product_results where org_id=r.org_id and run_id=r.id))
$$;
create function private.forecast_item_json(r public.forecast_product_results) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',r.id,'productId',r.product_id,'sku',coalesce(r.sku_snapshot,p.sku),
    'name',coalesce(r.name_snapshot,p.name),'supplier',coalesce(r.supplier_snapshot,s.name),
    'dailyUnits',r.estimated_daily_units::text,'horizonTotal',
      (select sum(projected_units)::text from public.forecast_points where org_id=r.org_id and result_id=r.id),
    'quality',r.quality,'eligibleDays',r.eligible_history_days,'observedDays',r.observed_days,
    'stockoutDays',r.stockout_days,'unknownDays',r.unknown_days,'promoDays',r.promo_days,
    'availabilityUsed',r.availability_used,'reasonCodes',case when f.method='sample_fixture' then '["ILLUSTRATIVE_SAMPLE"]'::jsonb else to_jsonb(r.reason_codes) end,
    'limitation',r.limitation)
  from public.products p join public.suppliers s on s.org_id=p.org_id and s.id=p.supplier_id
  join public.forecast_runs f on f.org_id=r.org_id and f.id=r.run_id where p.org_id=r.org_id and p.id=r.product_id
$$;
revoke all on function private.forecast_run_json(public.forecast_runs),private.forecast_item_json(public.forecast_product_results) from public,anon;
grant execute on function private.forecast_run_json(public.forecast_runs),private.forecast_item_json(public.forecast_product_results) to authenticated;

create function public.list_forecast_runs(p_org_id uuid,p_limit integer default 25,p_before uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare items jsonb; next_id uuid; position public.forecast_runs;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  if p_before is not null then
    select * into position from public.forecast_runs where org_id=p_org_id and id=p_before and method in ('seasonal_baseline','sample_fixture');
    if position.id is null then raise exception using errcode='22023',message='INVALID_CURSOR'; end if;
  end if;
  with remaining as materialized(select f.* from public.forecast_runs f join public.organizations o on o.id=f.org_id
    where f.org_id=p_org_id and (f.method='seasonal_baseline' or (o.is_sample and f.method='sample_fixture'))
    and (p_before is null or (f.created_at,f.id)<(position.created_at,position.id))),
  page as materialized(select * from remaining order by created_at desc,id desc limit p_limit)
  select coalesce((select jsonb_agg(private.forecast_run_json(p) order by p.created_at desc,p.id desc) from page p),'[]'),
    case when (select count(*) from remaining)>p_limit then (select id from page order by created_at,id limit 1) end into items,next_id;
  return jsonb_build_object('items',items,'nextCursor',next_id);
end $$;

create function public.read_forecast_run(p_org_id uuid,p_run_id uuid,p_limit integer default 25,p_after uuid default null,p_product_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare run public.forecast_runs; position public.forecast_product_results; chosen public.forecast_product_results;
  items jsonb; total integer; next_id uuid; history jsonb; points jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  select f.* into run from public.forecast_runs f join public.organizations o on o.id=f.org_id where f.org_id=p_org_id and f.id=p_run_id
    and (f.method='seasonal_baseline' or (o.is_sample and f.method='sample_fixture'));
  if run.id is null then return null; end if;
  if p_after is not null then
    select * into position from public.forecast_product_results where org_id=p_org_id and run_id=p_run_id and id=p_after;
    if position.id is null then raise exception using errcode='22023',message='INVALID_CURSOR'; end if;
  end if;
  with remaining as materialized(select r.* from public.forecast_product_results r join public.products p on p.org_id=r.org_id and p.id=r.product_id
    where r.org_id=p_org_id and r.run_id=p_run_id and (p_after is null or
      (coalesce(r.sku_snapshot,p.sku) collate "C",r.id)>(coalesce(position.sku_snapshot,(select sku from public.products where org_id=p_org_id and id=position.product_id)) collate "C",position.id))),
  page as materialized(select r.* from remaining r join public.products p on p.org_id=r.org_id and p.id=r.product_id
    order by coalesce(r.sku_snapshot,p.sku) collate "C",r.id limit p_limit)
  select coalesce((select jsonb_agg(private.forecast_item_json(r) order by coalesce(r.sku_snapshot,p.sku) collate "C",r.id)
      from page r join public.products p on p.org_id=r.org_id and p.id=r.product_id),'[]'),
    case when (select count(*) from remaining)>p_limit then (select r.id from page r join public.products p on p.org_id=r.org_id and p.id=r.product_id
      order by coalesce(r.sku_snapshot,p.sku) collate "C" desc,r.id desc limit 1) end into items,next_id;
  select count(*) into total from public.forecast_product_results where org_id=p_org_id and run_id=p_run_id;
  if p_product_id is null then
    select * into chosen from public.forecast_product_results where org_id=p_org_id and run_id=p_run_id and id=(items->0->>'id')::uuid;
  else
    select * into chosen from public.forecast_product_results where org_id=p_org_id and run_id=p_run_id and product_id=p_product_id;
    if chosen.id is null then return null; end if;
  end if;
  if chosen.id is not null then
    history:=chosen.history_snapshot;
    -- The read-only sample fixture predates P5. Its unchanged recorded history is illustrative.
    if run.method='sample_fixture' then
      select coalesce(jsonb_agg(jsonb_build_object('date',sales_date,'units',units_sold,'availability',availability_status,'promo',promo_active) order by sales_date),'[]') into history
        from public.sales_daily where org_id=p_org_id and product_id=chosen.product_id and sales_date between run.as_of_date-27 and run.as_of_date;
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('date',forecast_date,'units',projected_units::text) order by forecast_date),'[]') into points
      from public.forecast_points where org_id=p_org_id and result_id=chosen.id;
  end if;
  return jsonb_build_object('run',private.forecast_run_json(run),'items',items,'total',total,'nextCursor',next_id,
    'selected',case when chosen.id is not null then jsonb_build_object('item',private.forecast_item_json(chosen),'history',history,'points',points) end);
end $$;
revoke all on function public.list_forecast_runs(uuid,integer,uuid),public.read_forecast_run(uuid,uuid,integer,uuid,uuid) from public,anon,authenticated;
grant execute on function public.list_forecast_runs(uuid,integer,uuid),public.read_forecast_run(uuid,uuid,integer,uuid,uuid) to authenticated;
COMMIT;
