-- P4 read model. Security-invoker view/procedures retain underlying tenant RLS.
BEGIN;
create function private.stock_risk(h integer,d numeric,q text,l integer)
returns text language sql immutable set search_path='' as $$
  select case when h is null or d is null or q is distinct from 'sufficient' or l is null then 'unknown'
    when d>0 and (h=0 or h<l*d) then 'at_risk'
    when d>0 and h<=(l+7)*d then 'reorder_soon' else 'healthy' end
$$;
revoke all on function private.stock_risk(integer,numeric,text,integer) from public,anon;
grant execute on function private.stock_risk(integer,numeric,text,integer) to authenticated;

create view public.inventory_source_rows with (security_invoker=true) as
select p.id,p.org_id,p.sku,p.name,p.purchase_cost::text,p.pack_multiple,
  s.id supplier_id,s.name supplier_name,s.active supplier_active,s.lead_time_days default_lead_time_days,p.lead_time_days_override,
  stock.on_hand,stock.as_of_date,
  exists(select 1 from public.inventory_snapshots f where f.org_id=p.org_id and f.product_id=p.id and f.as_of_date>(now() at time zone 'Asia/Dhaka')::date) future_snapshot,
  result.estimated_daily_units::text,result.quality,run.id forecast_run_id,run.method,
  run.as_of_date forecast_as_of,run.created_at forecast_created_at,
  (run.id is not null and (run.stale_at is not null or coalesce(run.created_at<last_import.committed_at,false))) forecast_stale,
  result.eligible_history_days,result.availability_used,result.limitation,
  coalesce(p.lead_time_days_override,s.lead_time_days) lead_days,
  private.stock_risk(stock.on_hand,result.estimated_daily_units,result.quality,coalesce(p.lead_time_days_override,s.lead_time_days)) risk_code,
  coalesce(stock.as_of_date<(now() at time zone 'Asia/Dhaka')::date-7,false) snapshot_stale,
  o.is_sample,
  case when stock.on_hand is not null and result.quality='sufficient' and result.estimated_daily_units>0 then stock.on_hand/result.estimated_daily_units else null end cover_key
from public.products p join public.organizations o on o.id=p.org_id
join public.suppliers s on s.org_id=p.org_id and s.id=p.supplier_id
left join lateral(select on_hand,as_of_date from public.inventory_snapshots i
  where i.org_id=p.org_id and i.product_id=p.id and i.as_of_date<=(now() at time zone 'Asia/Dhaka')::date
  order by i.as_of_date desc,i.imported_at desc,i.id desc limit 1) stock on true
left join lateral(select f.* from public.forecast_runs f where f.org_id=p.org_id and f.status='succeeded' and f.finished_at is not null
  and f.as_of_date<=(now() at time zone 'Asia/Dhaka')::date
  and (f.method='seasonal_baseline' or (o.is_sample and f.method='sample_fixture'))
  order by f.finished_at desc,f.created_at desc,f.id desc limit 1) run on true
left join public.forecast_product_results result on result.org_id=p.org_id and result.run_id=run.id and result.product_id=p.id
left join lateral(select max(committed_at) committed_at from public.import_jobs j where j.org_id=p.org_id and j.status='committed') last_import on true
where p.active;
revoke all on public.inventory_source_rows from public,anon,authenticated;
grant select on public.inventory_source_rows to authenticated;

create function public.read_inventory(p_org_id uuid,p_q text default '',p_status text default null,p_supplier_id uuid default null,
  p_sort text default 'cover_asc',p_limit integer default 25,p_after jsonb default null,p_revision text default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare rows jsonb; summary jsonb; suppliers jsonb; matches integer; revision text; next_position jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_q is null or length(p_q)>500 or p_limit is null or p_limit not between 1 and 100
    or p_sort is null or p_sort not in ('cover_asc','cover_desc','sku_asc','name_asc','risk')
    or (p_status is not null and p_status not in ('at_risk','reorder_soon','healthy','unknown')) then
    raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  select md5(concat_ws('|',p_org_id::text,(now() at time zone 'Asia/Dhaka')::date::text,
    (select max(committed_at)::text from public.import_jobs where org_id=p_org_id and status='committed'),
    (select max(updated_at)::text from public.products where org_id=p_org_id),
    (select string_agg(id::text||coalesce(stale_at::text,''),',' order by id) from public.forecast_runs where org_id=p_org_id and status='succeeded')
  )) into revision;
  if p_revision is not null and p_revision<>revision then raise exception using errcode='P0001',message='STALE_CURSOR'; end if;
  if p_after is not null and (jsonb_typeof(p_after)<>'object' or p_after->>'missing' is null or p_after->>'missing' not in ('true','false')
    or p_after->>'number' is null or length(p_after->>'number')>100 or p_after->>'number' !~ '^-?\d+(\.\d+)?$'
    or p_after->>'text' is null or length(p_after->>'text')>250 or p_after->>'id' is null) then
    raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  with source as materialized(select * from public.inventory_source_rows where org_id=p_org_id),
  filtered as (select * from source where (p_q='' or strpos(lower(sku||' '||name),lower(p_q))>0)
    and (p_status is null or risk_code=p_status) and (p_supplier_id is null or supplier_id=p_supplier_id)),
  keyed as(select f.*,
    (p_sort in ('cover_asc','cover_desc') and cover_key is null) key_missing,
    case when p_sort='cover_asc' then coalesce(cover_key,0) when p_sort='cover_desc' then -coalesce(cover_key,0) else 0 end key_number,
    (case when p_sort='name_asc' then lower(name) when p_sort='risk' then
      (case risk_code when 'at_risk' then '0' when 'reorder_soon' then '1' when 'healthy' then '2' else '3' end)||':'||sku else sku end) collate "C" key_text
    from filtered f),
  remaining as(select * from keyed where p_after is null or
    (key_missing,key_number,key_text,id)>((p_after->>'missing')::boolean,(p_after->>'number')::numeric,(p_after->>'text') collate "C",(p_after->>'id')::uuid)),
  page as(select * from remaining order by key_missing,key_number,key_text,id limit p_limit),
  numbered as(select *,row_number() over(order by key_missing,key_number,key_text,id) n from page)
  select
    coalesce((select jsonb_agg(to_jsonb(p)-'cover_key'-'key_missing'-'key_number'-'key_text'-'n' order by n) from numbered p),'[]'),
    (select jsonb_build_object('total',count(*),'at_risk',count(*) filter(where risk_code='at_risk'),
      'reorder_soon',count(*) filter(where risk_code='reorder_soon'),'healthy',count(*) filter(where risk_code='healthy'),
      'unknown',count(*) filter(where risk_code='unknown'),'stale',count(*) filter(where snapshot_stale or forecast_stale)) from source),
    (select count(*) from filtered),
    coalesce((select jsonb_agg(x order by x.name,x.id) from (select distinct supplier_id id,supplier_name name from source) x),'[]'),
    case when (select count(*) from remaining)>p_limit then
      (select jsonb_build_object('missing',key_missing,'number',key_number::text,'text',key_text,'id',id) from numbered order by n desc limit 1) else null end
  into rows,summary,matches,suppliers,next_position;
  return jsonb_build_object('items',rows,'summary',summary,'matchCount',matches,'suppliers',suppliers,
    'asOf',(now() at time zone 'Asia/Dhaka')::date,'revision',revision,'nextPosition',next_position);
end $$;
revoke all on function public.read_inventory(uuid,text,text,uuid,text,integer,jsonb,text) from public,anon;
grant execute on function public.read_inventory(uuid,text,text,uuid,text,integer,jsonb,text) to authenticated;

create function public.read_product(p_org_id uuid,p_product_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare item jsonb; sales jsonb; forecasts jsonb; v_run uuid;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  select to_jsonb(s)-'cover_key',s.forecast_run_id into item,v_run from public.inventory_source_rows s where s.org_id=p_org_id and s.id=p_product_id;
  if item is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('date',sales_date,'units',units_sold,'availability',availability_status,'promo',promo_active) order by sales_date),'[]') into sales
    from public.sales_daily where org_id=p_org_id and product_id=p_product_id and sales_date between (now() at time zone 'Asia/Dhaka')::date-27 and (now() at time zone 'Asia/Dhaka')::date;
  select coalesce(jsonb_agg(jsonb_build_object('date',f.forecast_date,'units',f.projected_units::text) order by f.forecast_date),'[]') into forecasts
    from public.forecast_points f join public.forecast_product_results r on r.org_id=f.org_id and r.id=f.result_id
    where f.org_id=p_org_id and r.product_id=p_product_id and r.run_id=v_run and r.quality='sufficient'
      and f.forecast_date between (now() at time zone 'Asia/Dhaka')::date+1 and (now() at time zone 'Asia/Dhaka')::date+28;
  return jsonb_build_object('item',item,'sales',sales,'forecasts',forecasts,'asOf',(now() at time zone 'Asia/Dhaka')::date);
end $$;
revoke all on function public.read_product(uuid,uuid) from public,anon;
grant execute on function public.read_product(uuid,uuid) to authenticated;

create function public.read_inventory_budget(p_org_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  select jsonb_build_object('planId',p.id,'budget',p.budget::text,'approvedTotal',coalesce(l.total,0)::text,
    'remaining',(p.budget-coalesce(l.total,0))::text,'lineCount',coalesce(l.lines,0)) into result
  from public.replenishment_plans p join public.forecast_runs f on f.org_id=p.org_id and f.id=p.forecast_run_id
  left join lateral(select sum(approved_qty*purchase_cost_snapshot) total,count(*) filter(where approved_qty>0) lines
    from public.plan_lines where org_id=p.org_id and plan_id=p.id) l on true
  where p.org_id=p_org_id and p.status='draft' and p.stale_at is null and f.stale_at is null and f.status='succeeded'
    and not exists(select 1 from public.import_jobs j where j.org_id=p.org_id and j.status='committed' and j.committed_at>p.input_snapshot_at)
  order by p.created_at desc,p.id desc limit 1;
  return result;
end $$;
revoke all on function public.read_inventory_budget(uuid) from public,anon;
grant execute on function public.read_inventory_budget(uuid) to authenticated;
COMMIT;
