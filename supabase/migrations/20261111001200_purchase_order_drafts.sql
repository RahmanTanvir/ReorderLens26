-- P7: explicit, atomic draft conversion; immutable document snapshots.
BEGIN;
alter table public.purchase_orders add column document_snapshot jsonb
  check(document_snapshot is null or jsonb_typeof(document_snapshot)='object');
alter table public.purchase_order_lines add column lead_days_snapshot integer check(lead_days_snapshot between 0 and 365),
  add column pack_multiple_snapshot integer check(pack_multiple_snapshot between 1 and 10000),
  add column line_rank integer;
create index purchase_orders_org_keyset_idx on public.purchase_orders(org_id,created_at desc,id desc);

create function public.convert_plan_to_drafts(p_org_id uuid,p_plan_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare plan public.replenishment_plans; org public.organizations; group_row record;
  order_id uuid; ids jsonb; total numeric; selected integer; stamp timestamptz;
begin
  if auth.uid() is null or not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=auth.uid() and role in ('owner','operator')) then
    raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_expected_revision is null or p_expected_revision not between 0 and 2147483646 then raise exception using errcode='22023',message='INVALID_REVISION'; end if;
  -- Same lock order as imports and plan edits: workspace, then plan.
  perform pg_advisory_xact_lock(hashtextextended(p_org_id::text,3));
  select * into plan from public.replenishment_plans where org_id=p_org_id and id=p_plan_id for update;
  if plan.id is null then raise exception using errcode='P0001',message='PLAN_NOT_FOUND'; end if;
  if plan.status='converted' then
    select jsonb_agg(id order by supplier_id) into ids from public.purchase_orders where org_id=p_org_id and plan_id=p_plan_id and document_snapshot is not null;
    if ids is null then raise exception using errcode='P0001',message='ORDER_SNAPSHOT_UNAVAILABLE'; end if;
    return jsonb_build_object('purchaseOrderIds',ids,'alreadyConverted',true);
  end if;
  if plan.status<>'draft' or plan.method is null
    or (plan.method='reorder_v1' and plan.algorithm_version is distinct from 'reorder_v1')
    or (plan.method='sample_fixture' and plan.algorithm_version is distinct from 'sample_plan_v1') then raise exception using errcode='P0001',message='PLAN_READ_ONLY'; end if;
  if plan.revision<>p_expected_revision then raise exception using errcode='P0001',message='STALE_REVISION'; end if;
  if plan.stale_at is not null or exists(select 1 from public.forecast_runs where org_id=p_org_id and id=plan.forecast_run_id and stale_at is not null)
    or exists(select 1 from public.import_jobs where org_id=p_org_id and status='committed' and committed_at>plan.input_snapshot_at) then
    raise exception using errcode='P0001',message='STALE_INPUTS'; end if;
  if exists(select 1 from public.plan_lines l where l.org_id=p_org_id and l.plan_id=p_plan_id and
    (l.approved_qty<0 or l.approved_qty%l.pack_multiple_snapshot<>0 or (l.approved_qty>0 and
      (not l.eligible or l.purchase_cost_snapshot<=0 or l.estimated_daily_snapshot is null or l.estimated_daily_snapshot<=0
       or l.input_snapshot is null or l.input_snapshot->>'quality' is distinct from 'sufficient'
       or l.input_snapshot->>'supplierId' is distinct from l.supplier_id::text
       or l.input_snapshot->>'productId' is distinct from l.product_id::text
       or nullif(l.input_snapshot->>'supplierName','') is null or nullif(l.input_snapshot->>'sku','') is null or nullif(l.input_snapshot->>'name','') is null)))) then
    raise exception using errcode='P0001',message='INVALID_ORDER_LINES'; end if;
  select count(*) filter(where approved_qty>0),coalesce(sum(approved_qty::numeric*purchase_cost_snapshot),0) into selected,total
    from public.plan_lines where org_id=p_org_id and plan_id=p_plan_id;
  if selected=0 then raise exception using errcode='P0001',message='EMPTY_PLAN'; end if;
  if total>plan.budget then raise exception using errcode='P0001',message='OVER_BUDGET'; end if;
  select * into org from public.organizations where id=p_org_id;
  stamp:=clock_timestamp();
  for group_row in select supplier_id,min(input_snapshot->>'supplierName') name,sum(approved_qty::numeric*purchase_cost_snapshot) amount
    from public.plan_lines where org_id=p_org_id and plan_id=p_plan_id and approved_qty>0 group by supplier_id order by supplier_id loop
    order_id:=gen_random_uuid();
    insert into public.purchase_orders(id,org_id,plan_id,supplier_id,order_number,status,total_cost,created_by,created_at,document_snapshot)
    values(order_id,p_org_id,p_plan_id,group_row.supplier_id,'RL-PO-'||to_char(stamp at time zone 'Asia/Dhaka','YYYYMMDD')||'-'||replace(order_id::text,'-',''),'draft',group_row.amount,auth.uid(),stamp,
      jsonb_build_object('version',1,'workspaceName',org.name,'workspaceLocation',org.location,'currency','BDT','timezone','Asia/Dhaka',
        'isSample',org.is_sample,'supplierName',group_row.name,'planRevision',plan.revision,'inputSnapshotAt',plan.input_snapshot_at,'sourceDate',plan.source_as_of_date,'method',plan.method));
    insert into public.purchase_order_lines(org_id,purchase_order_id,product_id,sku_snapshot,product_name_snapshot,qty,purchase_cost_snapshot,lead_days_snapshot,pack_multiple_snapshot,line_rank)
      select p_org_id,order_id,product_id,input_snapshot->>'sku',input_snapshot->>'name',approved_qty,purchase_cost_snapshot,lead_time_days_snapshot,pack_multiple_snapshot,allocation_rank
      from public.plan_lines where org_id=p_org_id and plan_id=p_plan_id and supplier_id=group_row.supplier_id and approved_qty>0 order by allocation_rank,id;
  end loop;
  update public.replenishment_plans set status='converted',revision=revision+1,updated_at=stamp where org_id=p_org_id and id=p_plan_id;
  select jsonb_agg(id order by supplier_id) into ids from public.purchase_orders where org_id=p_org_id and plan_id=p_plan_id;
  return jsonb_build_object('purchaseOrderIds',ids,'alreadyConverted',false);
end $$;
revoke all on function public.convert_plan_to_drafts(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.convert_plan_to_drafts(uuid,uuid,integer) to authenticated;

create function private.order_header_json(r public.purchase_orders) returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('id',r.id,'planId',r.plan_id,'supplierId',r.supplier_id,'orderNumber',r.order_number,'status',r.status,
    'total',r.total_cost::text,'createdAt',r.created_at,'document',r.document_snapshot,
    'lineCount',count(*),'units',coalesce(sum(qty::numeric),0)::text)
  from public.purchase_order_lines where org_id=r.org_id and purchase_order_id=r.id
$$;
revoke all on function private.order_header_json(public.purchase_orders) from public,anon;
grant execute on function private.order_header_json(public.purchase_orders) to authenticated;

create function public.read_purchase_order(p_org_id uuid,p_order_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare order_row public.purchase_orders; items jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  select * into order_row from public.purchase_orders where org_id=p_org_id and id=p_order_id and document_snapshot is not null;
  if order_row.id is null then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'productId',product_id,'sku',sku_snapshot,'name',product_name_snapshot,'quantity',qty,
    'unitCost',purchase_cost_snapshot::text,'lineTotal',line_total::text,'leadDays',lead_days_snapshot,'packMultiple',pack_multiple_snapshot) order by line_rank,id),'[]') into items
    from public.purchase_order_lines where org_id=p_org_id and purchase_order_id=p_order_id;
  return jsonb_build_object('order',private.order_header_json(order_row),'items',items);
end $$;

create function public.list_purchase_orders(p_org_id uuid,p_supplier_id uuid default null,p_from date default null,p_to date default null,p_plan_id uuid default null,p_limit integer default 25,p_before uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare position public.purchase_orders; items jsonb; next_id uuid; totals jsonb; suppliers jsonb;
begin
  if not exists(select 1 from public.organization_members where org_id=p_org_id and user_id=(select auth.uid())) then raise exception using errcode='42501',message='WORKSPACE_DENIED'; end if;
  if p_limit is null or p_limit not between 1 and 100 or p_from>p_to then raise exception using errcode='22023',message='INVALID_QUERY'; end if;
  if p_before is not null then
    select * into position from public.purchase_orders where org_id=p_org_id and id=p_before and document_snapshot is not null
      and (p_supplier_id is null or supplier_id=p_supplier_id) and (p_plan_id is null or plan_id=p_plan_id)
      and (p_from is null or (created_at at time zone 'Asia/Dhaka')::date>=p_from) and (p_to is null or (created_at at time zone 'Asia/Dhaka')::date<=p_to);
    if position.id is null then raise exception using errcode='22023',message='INVALID_CURSOR'; end if;
  end if;
  with filtered as(select * from public.purchase_orders where org_id=p_org_id and document_snapshot is not null
    and (p_supplier_id is null or supplier_id=p_supplier_id) and (p_plan_id is null or plan_id=p_plan_id)
    and (p_from is null or (created_at at time zone 'Asia/Dhaka')::date>=p_from) and (p_to is null or (created_at at time zone 'Asia/Dhaka')::date<=p_to)
    and (p_before is null or (created_at,id)<(position.created_at,position.id)) order by created_at desc,id desc limit p_limit+1),
  page as(select * from filtered order by created_at desc,id desc limit p_limit)
  select coalesce(jsonb_agg(private.order_header_json(page) order by created_at desc,id desc),'[]') into items from page;
  if jsonb_array_length(items)=p_limit and exists(select 1 from public.purchase_orders where org_id=p_org_id and document_snapshot is not null
    and (p_supplier_id is null or supplier_id=p_supplier_id) and (p_plan_id is null or plan_id=p_plan_id)
    and (p_from is null or (created_at at time zone 'Asia/Dhaka')::date>=p_from) and (p_to is null or (created_at at time zone 'Asia/Dhaka')::date<=p_to)
    and (created_at,id)<((items->(p_limit-1)->>'createdAt')::timestamptz,(items->(p_limit-1)->>'id')::uuid)) then next_id:=(items->(p_limit-1)->>'id')::uuid; end if;
  select jsonb_build_object('count',count(*),'total',private.plan_money(coalesce(sum(total_cost*100),0)),'suppliers',count(distinct supplier_id)) into totals
    from public.purchase_orders where org_id=p_org_id and document_snapshot is not null and (p_supplier_id is null or supplier_id=p_supplier_id) and (p_plan_id is null or plan_id=p_plan_id)
    and (p_from is null or (created_at at time zone 'Asia/Dhaka')::date>=p_from) and (p_to is null or (created_at at time zone 'Asia/Dhaka')::date<=p_to);
  select coalesce(jsonb_agg(jsonb_build_object('id',supplier_id,'name',name) order by name collate "C",supplier_id),'[]') into suppliers
    from(select supplier_id,min(document_snapshot->>'supplierName') name from public.purchase_orders where org_id=p_org_id and document_snapshot is not null group by supplier_id) s;
  return jsonb_build_object('items',items,'nextCursor',next_id,'summary',totals,'suppliers',suppliers);
end $$;
revoke all on function public.read_purchase_order(uuid,uuid),public.list_purchase_orders(uuid,uuid,date,date,uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.read_purchase_order(uuid,uuid),public.list_purchase_orders(uuid,uuid,date,date,uuid,integer,uuid) to authenticated;
COMMIT;
