-- Read-only structural audit. Not a migration or proof of hosted RLS behavior.
select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'execute') anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in
  ('generate_forecast','list_forecast_runs','read_forecast_run','forecast_baseline','forecast_round4','forecast_run_json','forecast_item_json')
order by n.nspname,p.proname;
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and
  ((table_name='forecast_runs' and column_name in ('source_revision','algorithm_version')) or
   (table_name='forecast_product_results' and column_name in
     ('observed_days','stockout_days','unknown_days','promo_days','reason_codes','sku_snapshot','name_snapshot','supplier_snapshot','history_snapshot')))
order by table_name,column_name;
select tablename,indexname,indexdef from pg_indexes
where schemaname='public' and indexname='forecast_success_inputs_idx';
select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('forecast_runs','forecast_product_results','forecast_points');
