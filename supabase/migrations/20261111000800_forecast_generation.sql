-- P5: reproducible, guarded seasonal baseline. Applied P2-P4 migrations stay frozen.
BEGIN;
alter table public.forecast_runs add column source_revision text,
  add column algorithm_version text;
create unique index forecast_success_inputs_idx on public.forecast_runs
  (org_id,as_of_date,horizon_days,source_revision,algorithm_version)
  where method='seasonal_baseline' and status='succeeded';
alter table public.forecast_product_results
  add column observed_days integer not null default 0 check(observed_days between 0 and 28),
  add column stockout_days integer not null default 0 check(stockout_days between 0 and 28),
  add column unknown_days integer not null default 0 check(unknown_days between 0 and 28),
  add column promo_days integer not null default 0 check(promo_days between 0 and 28),
  add column reason_codes text[] not null default array[]::text[],
  add column sku_snapshot text, add column name_snapshot text, add column supplier_snapshot text,
  add column history_snapshot jsonb not null default '[]'::jsonb
    check(jsonb_typeof(history_snapshot)='array' and jsonb_array_length(history_snapshot)<=28);

-- Exact integer-rational arithmetic. All counts 1..28 divide LCM(1..28).
-- Round once to the existing numeric(14,4) storage contract, never before D7.
create function private.forecast_round4(n numeric,d numeric) returns numeric
language sql immutable set search_path='' as $$select div(n*20000+d,2*d)/10000$$;
revoke all on function private.forecast_round4(numeric,numeric) from public,anon,authenticated;

create function private.forecast_baseline(p_org uuid,p_product uuid,p_date date,p_horizon integer)
returns jsonb language plpgsql stable set search_path='' as $$
declare history jsonb; eligible integer; observed integer; stockouts integer; unknowns integer; promos integer;
  recent boolean; total numeric; matches integer; weekday_sum numeric; numerator numeric; seven numeric:=0;
  points jsonb:='[]'; reasons text[]:=array[]::text[]; sufficient boolean; day integer;
  denominator constant numeric:=80313433200;
begin
  select coalesce(jsonb_agg(jsonb_build_object('date',sales_date,'units',units_sold,'availability',availability_status,'promo',promo_active) order by sales_date),'[]'),
    count(*),count(*) filter(where availability_status<>'stockout'),count(*) filter(where availability_status='stockout'),
    count(*) filter(where availability_status='unknown'),count(*) filter(where promo_active),
    coalesce(bool_or(sales_date>=p_date-6 and availability_status<>'stockout'),false),
    coalesce(sum(units_sold::numeric) filter(where availability_status<>'stockout'),0)
  into history,observed,eligible,stockouts,unknowns,promos,recent,total
  from public.sales_daily where org_id=p_org and product_id=p_product and sales_date between p_date-27 and p_date;
  if eligible<14 then reasons:=array_append(reasons,'INSUFFICIENT_HISTORY'); end if;
  if not recent then reasons:=array_append(reasons,'NO_RECENT_OBSERVATION'); end if;
  if stockouts>0 then reasons:=array_append(reasons,'STOCKOUT_DAYS_EXCLUDED'); end if;
  if unknowns>0 then reasons:=array_append(reasons,'UNKNOWN_AVAILABILITY'); end if;
  if promos>0 then reasons:=array_append(reasons,'PROMOTIONS_NOT_MODELED'); end if;
  reasons:=array_append(reasons,'BASELINE_LIMITS'); sufficient:=eligible>=14 and recent;
  if sufficient then
    for day in 1..p_horizon loop
      select count(*),coalesce(sum(units_sold::numeric),0) into matches,weekday_sum from public.sales_daily
        where org_id=p_org and product_id=p_product and sales_date between p_date-27 and p_date
        and availability_status<>'stockout' and extract(dow from sales_date)=extract(dow from p_date+day);
      numerator:=case when matches>=2 then weekday_sum*div(denominator,matches) else total*div(denominator,eligible) end;
      if day<=7 then seven:=seven+numerator; end if;
      points:=points||jsonb_build_array(jsonb_build_object('date',p_date+day,'units',private.forecast_round4(numerator,denominator)::numeric(14,4)::text));
    end loop;
  end if;
  return jsonb_build_object('quality',case when sufficient then 'sufficient' else 'insufficient' end,
    'dailyUnits',case when sufficient then private.forecast_round4(seven,denominator*7)::numeric(14,4)::text end,
    'eligibleDays',eligible,'observedDays',observed,'stockoutDays',stockouts,'unknownDays',unknowns,'promoDays',promos,
    'availabilityUsed',stockouts>0,'reasonCodes',to_jsonb(reasons),'history',history,'points',points);
end $$;
revoke all on function private.forecast_baseline(uuid,uuid,date,integer) from public,anon,authenticated;

create function public.generate_forecast(p_org_id uuid,p_as_of_date date,p_horizon_days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare run_id uuid; result_id uuid; revision text; row record; calculation jsonb; failed boolean:=false;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id
    and user_id=auth.uid() and role in ('owner','operator')) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if exists(select 1 from public.organizations where id=p_org_id and is_sample) then
    raise exception using errcode='22023',message='SAMPLE_READ_ONLY'; end if;
  if p_as_of_date is null or p_as_of_date<date '1900-01-01' or p_as_of_date>(now() at time zone 'Asia/Dhaka')::date
    or p_horizon_days is null or p_horizon_days not in (7,14,28) then
    raise exception using errcode='22023',message='INVALID_FORECAST_INPUT'; end if;
  -- Shared with imports: source snapshot and idempotence cannot race an import.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,3));
  if not exists(select 1 from public.products where org_id=p_org_id and active) then
    raise exception using errcode='22023',message='EMPTY_CATALOG'; end if;
  select md5(concat_ws('|',
    (select jsonb_agg(jsonb_build_array(p.id,p.sku,p.name,s.name) order by p.id)::text
      from public.products p join public.suppliers s on s.org_id=p.org_id and s.id=p.supplier_id where p.org_id=p_org_id and p.active),
    (select jsonb_agg(jsonb_build_array(d.product_id,d.sales_date,d.units_sold,d.availability_status,d.promo_active) order by d.product_id,d.sales_date)::text
      from public.sales_daily d join public.products p on p.org_id=d.org_id and p.id=d.product_id and p.active
      where d.org_id=p_org_id and d.sales_date between p_as_of_date-27 and p_as_of_date),
    (select max(committed_at)::text from public.import_jobs where org_id=p_org_id and status='committed')
  )) into revision;
  select id into run_id from public.forecast_runs where org_id=p_org_id and method='seasonal_baseline' and status='succeeded'
    and as_of_date=p_as_of_date and horizon_days=p_horizon_days and source_revision=revision and algorithm_version='seasonal_baseline_v1';
  if run_id is not null then return jsonb_build_object('runId',run_id,'status','succeeded','reused',true,'errorCode',null); end if;
  if (select count(*) from public.forecast_runs where org_id=p_org_id and method='seasonal_baseline' and created_at>now()-interval '1 hour')>=10 then
    raise exception using errcode='P0001',message='FORECAST_LIMIT'; end if;
  insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,history_start,history_end,horizon_days,source_revision,algorithm_version)
    values(p_org_id,auth.uid(),'seasonal_baseline','running',p_as_of_date,p_as_of_date-27,p_as_of_date,p_horizon_days,revision,'seasonal_baseline_v1') returning id into run_id;
  begin
    for row in select p.id,p.sku,p.name,s.name supplier from public.products p
      join public.suppliers s on s.org_id=p.org_id and s.id=p.supplier_id where p.org_id=p_org_id and p.active order by p.id loop
      calculation:=private.forecast_baseline(p_org_id,row.id,p_as_of_date,p_horizon_days);
      insert into public.forecast_product_results(org_id,run_id,product_id,estimated_daily_units,eligible_history_days,availability_used,quality,
        observed_days,stockout_days,unknown_days,promo_days,reason_codes,sku_snapshot,name_snapshot,supplier_snapshot,history_snapshot,limitation)
      values(p_org_id,run_id,row.id,(calculation->>'dailyUnits')::numeric,(calculation->>'eligibleDays')::integer,
        (calculation->>'availabilityUsed')::boolean,calculation->>'quality',(calculation->>'observedDays')::integer,
        (calculation->>'stockoutDays')::integer,(calculation->>'unknownDays')::integer,(calculation->>'promoDays')::integer,
        array(select jsonb_array_elements_text(calculation->'reasonCodes')),row.sku,row.name,row.supplier,calculation->'history',
        'Seasonal baseline; missing dates are not zero. No lost-sales reconstruction, promotion model, calibrated interval or proven accuracy.') returning id into result_id;
      insert into public.forecast_points(org_id,result_id,forecast_date,projected_units)
        select p_org_id,result_id,(x->>'date')::date,(x->>'units')::numeric from jsonb_array_elements(calculation->'points') x;
    end loop;
  exception when others then
    -- Subtransaction removes ALL partial results/points; do not persist raw SQL errors.
    failed:=true;
  end;
  update public.forecast_runs set status=case when failed then 'failed' else 'succeeded' end,
    error_code=case when failed then 'BASELINE_FAILED' end,finished_at=clock_timestamp() where id=run_id and org_id=p_org_id;
  return jsonb_build_object('runId',run_id,'status',case when failed then 'failed' else 'succeeded' end,'reused',false,'errorCode',case when failed then 'BASELINE_FAILED' end);
end $$;
revoke all on function public.generate_forecast(uuid,date,integer) from public,anon,authenticated;
grant execute on function public.generate_forecast(uuid,date,integer) to authenticated;
COMMIT;
