-- P3: deterministic, atomic, isolated sample catalog. No forecast/planner/PO APIs.
BEGIN;
create unique index organizations_one_sample_per_creator on public.organizations(created_by) where is_sample;
create function public.create_sample_workspace()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=(select auth.uid()); v_org uuid; supplier_id uuid; r record; rice uuid; oil uuid;
begin
  if v_user is null then raise exception using errcode='42501',message='AUTH_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text,0));
  select id into v_org from public.organizations where created_by=v_user and is_sample;
  if found then
    if not exists(select 1 from public.organization_members where org_id=v_org and user_id=v_user and role='owner') then
      raise exception using errcode='42501',message='FORBIDDEN'; end if;
    return v_org;
  end if;
  if (select count(*) from public.organizations where created_by=v_user and created_at>now()-interval '1 hour')>=5
    or (select count(*) from public.organizations where created_by=v_user)>=10 then
    raise exception using errcode='P0001',message='WORKSPACE_LIMIT'; end if;
  insert into public.organizations(name,location,is_sample,created_by)
    values('Northgate Market — Sample Store','Dhaka, Bangladesh',true,v_user) returning id into v_org;
  insert into public.organization_members(org_id,user_id,role) values(v_org,v_user,'owner');
  insert into public.profiles(user_id) values(v_user) on conflict(user_id) do nothing;
  insert into public.suppliers(org_id,name,lead_time_days) values
    (v_org,'Dhaka Wholesale Co.',4),(v_org,'Eastern Essentials',6),(v_org,'Local Traders',5);
  for r in select * from (values
    ('RL-101','Basmati Rice 5 kg','Dhaka Wholesale Co.',55,520,null::integer),
    ('RL-102','Sunflower Oil 1 L','Eastern Essentials',38,210,null),
    ('RL-103','Laundry Powder 1 kg','Local Traders',85,165,null),
    ('RL-104','Milk Powder 400 g','Eastern Essentials',24,430,3),
    ('RL-105','Black Tea 200 g','Local Traders',75,150,7),
    ('RL-106','Instant Noodles 8-pack','Dhaka Wholesale Co.',42,95,5),
    ('RL-107','Chickpeas 1 kg','Local Traders',92,140,null),
    ('RL-108','Soap Bar 100 g','Local Traders',110,55,3)
  ) as x(sku,name,supplier,on_hand,cost,lead_override) loop
    select id into supplier_id from public.suppliers where org_id=v_org and name=r.supplier;
    insert into public.products(org_id,sku,name,supplier_id,purchase_cost,lead_time_days_override)
      values(v_org,r.sku,r.name,supplier_id,r.cost,r.lead_override);
    insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand)
      select v_org,id,date '2026-11-09',r.on_hand from public.products where org_id=v_org and sku=r.sku;
  end loop;
  select id into rice from public.products where org_id=v_org and sku='RL-101';
  select id into oil from public.products where org_id=v_org and sku='RL-102';
  -- Only the documented illustrative history is seeded; missing days stay missing.
  insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status)
    select v_org,rice,date '2026-11-03'+(n::integer-1),units,case when units=0 then 'stockout' else 'available' end
      from unnest(array[11,10,0,0,0,9,10]) with ordinality as x(units,n);
  insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status) values
    (v_org,oil,date '2026-11-07',7,'available'),(v_org,oil,date '2026-11-08',8,'unknown');
  return v_org;
end $$;
revoke all on function public.create_sample_workspace() from public,anon;
grant execute on function public.create_sample_workspace() to authenticated;
COMMIT;
