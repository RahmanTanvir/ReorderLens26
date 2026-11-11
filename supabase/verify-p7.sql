-- Read-only P7 schema/grant checks in the isolated development project.
select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('convert_plan_to_drafts','read_purchase_order','list_purchase_orders');
-- Expect anon=false, authenticated=true; only convert is security definer.
select c.relname,c.relrowsecurity,
  has_table_privilege('authenticated',c.oid,'SELECT') as can_read_with_rls,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as direct_write
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('purchase_orders','purchase_order_lines');
-- Expect RLS=true, read=true, direct_write=false.
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and ((table_name='purchase_orders' and column_name='document_snapshot')
  or (table_name='purchase_order_lines' and column_name in ('lead_days_snapshot','pack_multiple_snapshot','line_rank')));
select conname,pg_get_constraintdef(oid) from pg_constraint
where conrelid='public.purchase_orders'::regclass and contype in ('c','u');
-- Status remains draft only; unique(org_id,plan_id,supplier_id) prevents duplicates.
