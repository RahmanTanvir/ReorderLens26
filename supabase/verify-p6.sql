-- Read-only structural audit, not proof of hosted multi-account RLS behavior.
select n.nspname,p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'execute') anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in
 ('create_replenishment_plan','read_plan_context','list_replenishment_plans',
  'edit_replenishment_plan','set_plan_line_quantity','set_plan_budget','propose_plan','plan_json','plan_line_json','plan_money')
order by n.nspname,p.proname;
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and
 ((table_name='replenishment_plans' and column_name in ('method','algorithm_version','creation_request','source_as_of_date','exclusions_snapshot')) or
  (table_name='plan_lines' and column_name in ('input_snapshot','allocation_rank','desired_qty','eligible')))
order by table_name,column_name;
select c.relname,c.relrowsecurity,
  has_table_privilege('authenticated',c.oid,'insert') authenticated_insert,
  has_table_privilege('authenticated',c.oid,'update') authenticated_update,
  has_table_privilege('authenticated',c.oid,'delete') authenticated_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
  and c.relname in ('replenishment_plans','plan_lines','purchase_orders','purchase_order_lines');
