-- P3 additive migration. Existing catalog and saved order snapshots are preserved.
BEGIN;
alter table public.forecast_runs add column stale_at timestamptz;
alter table public.replenishment_plans add column stale_at timestamptz;

create function private.require_import_editor(p_org uuid, p_job uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.organizations o join public.organization_members m on m.org_id=o.id
    where o.id=p_org and not o.is_sample and m.user_id=(select auth.uid()) and m.role in ('owner','operator')) then
    raise exception using errcode='42501',message='IMPORT_FORBIDDEN';
  end if;
  if p_job is not null and not exists(select 1 from public.import_jobs where id=p_job and org_id=p_org and created_by=(select auth.uid())) then
    raise exception using errcode='42501',message='IMPORT_FORBIDDEN';
  end if;
end $$;
revoke all on function private.require_import_editor(uuid,uuid) from public,anon,authenticated;

create function private.import_counts(p_org uuid,p_data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare k text; n integer:=0; v_insert integer; v_update integer; result jsonb:='{}'; r record;
begin
  if p_data is null or jsonb_typeof(p_data)<>'object' or (select count(*) from jsonb_object_keys(p_data))<>4 then
    raise exception using errcode='22023',message='INVALID_IMPORT';
  end if;
  foreach k in array array['suppliers','products','inventory_snapshots','sales_daily'] loop
    if jsonb_typeof(p_data->k) is distinct from 'array' or jsonb_array_length(p_data->k)<1 then
      raise exception using errcode='22023',message='INVALID_IMPORT';
    end if;
    n:=n+jsonb_array_length(p_data->k);
  end loop;
  if n>5000 then raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
  -- Typed recordsets validate all external input again at the privileged boundary.
  for r in select * from jsonb_to_recordset(p_data->'suppliers') as x(name text,lead_time_days integer) loop
    if r.name is null or length(r.name) not between 1 and 150 or r.name<>btrim(regexp_replace(r.name,'\s+',' ','g'))
      or r.lead_time_days is null or r.lead_time_days not between 0 and 365 then
      raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'products') as x(sku text,name text,supplier_name text,purchase_cost text,lead_time_days_override integer,pack_multiple integer) loop
    if r.sku is null or length(r.sku) not between 1 and 60 or r.sku<>upper(btrim(r.sku))
      or r.name is null or length(btrim(r.name)) not between 1 and 200
      or r.supplier_name is null or length(btrim(r.supplier_name)) not between 1 and 150
      or r.purchase_cost is null or r.purchase_cost !~ '^\d{1,12}(\.\d{1,2})?$'
      or r.pack_multiple is null or r.pack_multiple not between 1 and 10000
      or (r.lead_time_days_override is not null and r.lead_time_days_override not between 0 and 365) then
      raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
    if not exists(select 1 from jsonb_to_recordset(p_data->'suppliers') as s(name text) where lower(s.name)=lower(r.supplier_name))
      and not exists(select 1 from public.suppliers s where s.org_id=p_org and lower(s.name)=lower(r.supplier_name)) then
      raise exception using errcode='22023',message='UNKNOWN_SUPPLIER'; end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'inventory_snapshots') as x(sku text,as_of_date text,on_hand integer) loop
    if r.sku is null or length(r.sku) not between 1 and 60 or r.sku<>upper(btrim(r.sku))
      or r.as_of_date is null or r.as_of_date !~ '^\d{4}-\d{2}-\d{2}$' or r.as_of_date::date<date '1900-01-01'
      or r.as_of_date::date>((now() at time zone 'Asia/Dhaka')::date+1)
      or r.on_hand is null or r.on_hand<0 then raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
    if not exists(select 1 from jsonb_to_recordset(p_data->'products') as p(sku text) where p.sku=r.sku)
      and not exists(select 1 from public.products p where p.org_id=p_org and upper(p.sku)=r.sku) then
      raise exception using errcode='22023',message='UNKNOWN_SKU'; end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'sales_daily') as x(sku text,sales_date text,units_sold integer,availability_status text,promo_active boolean) loop
    if r.sku is null or length(r.sku) not between 1 and 60 or r.sku<>upper(btrim(r.sku))
      or r.sales_date is null or r.sales_date !~ '^\d{4}-\d{2}-\d{2}$' or r.sales_date::date<date '1900-01-01'
      or r.sales_date::date>((now() at time zone 'Asia/Dhaka')::date+1)
      or r.units_sold is null or r.units_sold<0 or r.availability_status is null
      or r.availability_status not in ('available','stockout','unknown') or r.promo_active is null then
      raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
    if not exists(select 1 from jsonb_to_recordset(p_data->'products') as p(sku text) where p.sku=r.sku)
      and not exists(select 1 from public.products p where p.org_id=p_org and upper(p.sku)=r.sku) then
      raise exception using errcode='22023',message='UNKNOWN_SKU'; end if;
  end loop;
  if exists(select lower(x->>'name') from jsonb_array_elements(p_data->'suppliers') x group by 1 having count(*)>1)
    or exists(select x->>'sku' from jsonb_array_elements(p_data->'products') x group by 1 having count(*)>1)
    or exists(select x->>'sku',x->>'as_of_date' from jsonb_array_elements(p_data->'inventory_snapshots') x group by 1,2 having count(*)>1)
    or exists(select x->>'sku',x->>'sales_date' from jsonb_array_elements(p_data->'sales_daily') x group by 1,2 having count(*)>1)
    or exists(select lower(name) from public.suppliers where org_id=p_org group by 1 having count(*)>1)
    or exists(select upper(sku) from public.products where org_id=p_org group by 1 having count(*)>1) then
    raise exception using errcode='22023',message='DUPLICATE_KEY'; end if;
  foreach k in array array['suppliers','products','inventory_snapshots','sales_daily'] loop
    if k='suppliers' then
      select count(*) into v_update from jsonb_array_elements(p_data->k) x join public.suppliers s on s.org_id=p_org and lower(s.name)=lower(x->>'name');
    elsif k='products' then
      select count(*) into v_update from jsonb_array_elements(p_data->k) x join public.products p on p.org_id=p_org and upper(p.sku)=x->>'sku';
    elsif k='inventory_snapshots' then
      select count(*) into v_update from jsonb_array_elements(p_data->k) x join public.products p on p.org_id=p_org and upper(p.sku)=x->>'sku'
        join public.inventory_snapshots s on s.org_id=p_org and s.product_id=p.id and s.as_of_date=(x->>'as_of_date')::date;
    else
      select count(*) into v_update from jsonb_array_elements(p_data->k) x join public.products p on p.org_id=p_org and upper(p.sku)=x->>'sku'
        join public.sales_daily s on s.org_id=p_org and s.product_id=p.id and s.sales_date=(x->>'sales_date')::date;
    end if;
    v_insert:=jsonb_array_length(p_data->k)-v_update;
    result:=result||jsonb_build_object(k,jsonb_build_object('inserted',v_insert,'updated',v_update));
  end loop;
  return result;
end $$;
revoke all on function private.import_counts(uuid,jsonb) from public,anon,authenticated;

create function public.begin_import(p_org_id uuid,p_job_id uuid,p_manifest jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
  declare item jsonb; prior public.import_jobs; total_size integer:=0;
begin
  perform private.require_import_editor(p_org_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org_id::text,3));
  if p_job_id is null or jsonb_typeof(p_manifest) is distinct from 'array' or jsonb_array_length(p_manifest)<>4
    or (select count(distinct x->>'kind') from jsonb_array_elements(p_manifest) x)<>4 then
    raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
  for item in select * from jsonb_array_elements(p_manifest) loop
    if item->>'kind' not in ('suppliers','products','inventory_snapshots','sales_daily') or item->>'kind' is null
      or item->>'sha256' is null or item->>'sha256' !~ '^[a-f0-9]{64}$'
      or item->>'size' is null or (item->>'size')::integer not between 1 and 2097152
      or item->>'filename' is null or length(item->>'filename')>180 or item->>'filename' !~* '^[^/\\]+\.csv$'
      or jsonb_typeof(item->'headers') is distinct from 'array' or jsonb_array_length(item->'headers') not between 1 and 30 then
      raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
    total_size:=total_size+(item->>'size')::integer;
  end loop;
  select * into prior from public.import_jobs where id=p_job_id;
  if found then
    if prior.org_id<>p_org_id or prior.created_by<>(select auth.uid()) then raise exception using errcode='42501',message='IMPORT_FORBIDDEN'; end if;
    if prior.file_manifest<>p_manifest then raise exception using errcode='P0001',message='IMPORT_STALE_FILE'; end if;
    return prior.id;
  end if;
  if (select count(*) from public.import_jobs where org_id=p_org_id and created_at>now()-interval '1 hour')>=20 then
    raise exception using errcode='P0001',message='IMPORT_RATE_LIMIT'; end if;
  insert into public.import_jobs(id,org_id,created_by,storage_prefix,file_manifest)
    values(p_job_id,p_org_id,(select auth.uid()),p_org_id::text||'/'||p_job_id::text,p_manifest);
  return p_job_id;
end $$;
revoke all on function public.begin_import(uuid,uuid,jsonb) from public,anon;
grant execute on function public.begin_import(uuid,uuid,jsonb) to authenticated;

create function public.validate_import(p_org_id uuid,p_job_id uuid,p_mapping jsonb,p_data jsonb,p_report jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.import_jobs; report jsonb; counts jsonb;
begin
  perform private.require_import_editor(p_org_id,p_job_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org_id::text,3));
  select * into job from public.import_jobs where id=p_job_id and org_id=p_org_id for update;
  if job.status='committed' then raise exception using errcode='P0001',message='IMPORT_ALREADY_COMMITTED'; end if;
  if p_mapping is null or jsonb_typeof(p_mapping)<>'object' or octet_length(p_mapping::text)>32768
    or p_report is null or jsonb_typeof(p_report)<>'object' or octet_length(p_report::text)>65536
    or p_report->>'mappingVersion' is distinct from '1'
    or p_report->>'valid' not in ('true','false') or p_report->>'valid' is null then
    raise exception using errcode='22023',message='INVALID_IMPORT'; end if;
  report:=p_report-'_batch_digest';
  if (report->>'valid')::boolean then
    if (select count(*) from storage.objects o where o.bucket_id='retail-imports'
      and o.name in (select job.storage_prefix||'/'||(f->>'kind')||'.csv' from jsonb_array_elements(job.file_manifest) f))<>4 then
      raise exception using errcode='P0001',message='IMPORT_FILES_MISSING'; end if;
    counts:=private.import_counts(p_org_id,p_data);
    report:=report||jsonb_build_object('counts',counts,'_batch_digest',md5(p_data::text),'validationToken',gen_random_uuid());
  end if;
  update public.import_jobs set status=case when (report->>'valid')::boolean then 'validated' else 'failed' end,
    column_mapping=p_mapping,validation_report=report,validated_at=case when (report->>'valid')::boolean then now() else null end
    where id=p_job_id and org_id=p_org_id;
  return report-'_batch_digest';
end $$;
revoke all on function public.validate_import(uuid,uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.validate_import(uuid,uuid,jsonb,jsonb,jsonb) to authenticated;

create function public.commit_import(p_org_id uuid,p_job_id uuid,p_data jsonb,p_confirm_upserts boolean,p_validation_token uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.import_jobs; counts jsonb; r record; v_supplier uuid; v_product uuid; result jsonb; committed timestamptz;
begin
  perform private.require_import_editor(p_org_id,p_job_id);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_org_id::text,3));
  select * into job from public.import_jobs where id=p_job_id and org_id=p_org_id for update;
  if job.status='committed' then return (job.validation_report->'result')||jsonb_build_object('alreadyCommitted',true); end if;
  if job.status<>'validated' or job.validation_report->>'_batch_digest' is distinct from md5(p_data::text)
    or job.validation_report->>'validationToken' is distinct from p_validation_token::text then
    raise exception using errcode='P0001',message='IMPORT_STALE_FILE'; end if;
  counts:=private.import_counts(p_org_id,p_data);
  if exists(select 1 from jsonb_each(counts) c where (c.value->>'updated')::integer>0) and p_confirm_upserts is distinct from true then
    raise exception using errcode='P0001',message='CONFLICT_REQUIRES_CONFIRMATION'; end if;
  for r in select * from jsonb_to_recordset(p_data->'suppliers') as x(name text,lead_time_days integer) loop
    select id into v_supplier from public.suppliers where org_id=p_org_id and lower(name)=lower(r.name);
    if found then update public.suppliers set name=r.name,lead_time_days=r.lead_time_days,updated_at=now() where id=v_supplier and org_id=p_org_id;
    else insert into public.suppliers(org_id,name,lead_time_days) values(p_org_id,r.name,r.lead_time_days); end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'products') as x(sku text,name text,supplier_name text,purchase_cost numeric,lead_time_days_override integer,pack_multiple integer) loop
    select id into v_supplier from public.suppliers where org_id=p_org_id and lower(name)=lower(r.supplier_name);
    select id into v_product from public.products where org_id=p_org_id and upper(sku)=r.sku;
    if found then update public.products set sku=r.sku,name=r.name,supplier_id=v_supplier,purchase_cost=r.purchase_cost,
      lead_time_days_override=r.lead_time_days_override,pack_multiple=r.pack_multiple,updated_at=now() where id=v_product and org_id=p_org_id;
    else insert into public.products(org_id,sku,name,supplier_id,purchase_cost,lead_time_days_override,pack_multiple)
      values(p_org_id,r.sku,r.name,v_supplier,r.purchase_cost,r.lead_time_days_override,r.pack_multiple); end if;
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'inventory_snapshots') as x(sku text,as_of_date date,on_hand integer) loop
    select id into v_product from public.products where org_id=p_org_id and upper(sku)=r.sku;
    insert into public.inventory_snapshots(org_id,product_id,as_of_date,on_hand) values(p_org_id,v_product,r.as_of_date,r.on_hand)
      on conflict(org_id,product_id,as_of_date) do update set on_hand=excluded.on_hand,imported_at=now();
  end loop;
  for r in select * from jsonb_to_recordset(p_data->'sales_daily') as x(sku text,sales_date date,units_sold integer,availability_status text,promo_active boolean) loop
    select id into v_product from public.products where org_id=p_org_id and upper(sku)=r.sku;
    insert into public.sales_daily(org_id,product_id,sales_date,units_sold,availability_status,promo_active)
      values(p_org_id,v_product,r.sales_date,r.units_sold,r.availability_status,r.promo_active)
      on conflict(org_id,product_id,sales_date) do update set units_sold=excluded.units_sold,
        availability_status=excluded.availability_status,promo_active=excluded.promo_active,imported_at=now();
  end loop;
  committed:=clock_timestamp();
  update public.forecast_runs set stale_at=committed where org_id=p_org_id and stale_at is null;
  update public.replenishment_plans set stale_at=committed where org_id=p_org_id and stale_at is null;
  -- Immutable purchase orders and their line snapshots are never touched.
  result:=jsonb_build_object('jobId',p_job_id,'committedAt',committed,'counts',counts,'alreadyCommitted',false);
  update public.import_jobs set status='committed',committed_at=committed,
    validation_report=validation_report||jsonb_build_object('result',result,'counts',counts) where id=p_job_id and org_id=p_org_id;
  return result;
end $$;
revoke all on function public.commit_import(uuid,uuid,jsonb,boolean,uuid) from public,anon;
grant execute on function public.commit_import(uuid,uuid,jsonb,boolean,uuid) to authenticated;

-- Freeze originals after successful validation. Revalidation may change mappings,
-- but replacement source bytes always require a fresh job/checksum.
drop policy reorderlens_import_update on storage.objects;
drop policy reorderlens_import_delete on storage.objects;
drop policy reorderlens_import_insert on storage.objects;
create policy reorderlens_import_insert on storage.objects for insert to authenticated
  with check (bucket_id='retail-imports' and private.can_access_import_object(name,true)
    and exists(select 1 from public.import_jobs j where j.storage_prefix=split_part(name,'/',1)||'/'||split_part(name,'/',2)
      and j.status in ('uploaded','failed') and exists(select 1 from jsonb_array_elements(j.file_manifest) f
        where split_part(name,'/',3)=(f->>'kind')||'.csv')));
COMMIT;
