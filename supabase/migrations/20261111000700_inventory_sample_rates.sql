-- P4 sample-only evidence for risk illustration. Never a runtime forecast claim.
BEGIN;
create unique index forecast_runs_one_sample_fixture on public.forecast_runs(org_id) where method='sample_fixture';
create function private.seed_inventory_sample(p_org uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_run uuid; v_user uuid;
begin
  select created_by into v_user from public.organizations where id=p_org and is_sample;
  if not found then raise exception using errcode='42501',message='SAMPLE_ONLY'; end if;
  insert into public.forecast_runs(org_id,created_by,method,status,as_of_date,horizon_days,finished_at)
    values(p_org,v_user,'sample_fixture','succeeded',date '2026-11-09',7,now())
    on conflict(org_id) where method='sample_fixture' do nothing returning id into v_run;
  if v_run is null then return; end if;
  insert into public.forecast_product_results(org_id,run_id,product_id,estimated_daily_units,eligible_history_days,availability_used,quality,limitation)
    select p_org,v_run,p.id,f.rate,0,false,'sufficient','Illustrative sample daily rate; not fitted from sales history. Range unavailable.'
    from (values('RL-101',10),('RL-102',7),('RL-103',4),('RL-104',5),('RL-105',3),('RL-106',8),('RL-107',2),('RL-108',6)) f(sku,rate)
    join public.products p on p.org_id=p_org and p.sku=f.sku;
  -- No invented history, forecast curve, plan, order, uncertainty or accuracy.
end $$;
revoke all on function private.seed_inventory_sample(uuid) from public,anon,authenticated;

alter function public.create_sample_workspace() set schema private;
alter function private.create_sample_workspace() rename to create_sample_catalog;
revoke all on function private.create_sample_catalog() from public,anon,authenticated;
create function public.create_sample_workspace()
returns uuid language plpgsql security definer set search_path='' as $$
declare v_org uuid;
begin
  v_org:=private.create_sample_catalog();
  perform private.seed_inventory_sample(v_org);
  return v_org;
end $$;
revoke all on function public.create_sample_workspace() from public,anon;
grant execute on function public.create_sample_workspace() to authenticated;
do $$declare o record;begin
  for o in select id from public.organizations where is_sample loop perform private.seed_inventory_sample(o.id);end loop;
end $$;
COMMIT;
