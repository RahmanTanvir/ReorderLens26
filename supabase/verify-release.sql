-- P9 read-only catalog audit. Run in the isolated project's SQL Editor; no mutations.
-- Results are structural evidence only, not authenticated isolation or restore proof.
with expected(name) as (values
 ('organizations'),('organization_members'),('profiles'),('suppliers'),('products'),
 ('inventory_snapshots'),('sales_daily'),('import_jobs'),('forecast_runs'),
 ('forecast_product_results'),('forecast_points'),('replenishment_plans'),
 ('plan_lines'),('purchase_orders'),('purchase_order_lines'),('ai_usage_events')),
table_checks as (
select e.name, c.oid is not null as present, coalesce(c.relrowsecurity,false) as rls,
 coalesce(has_table_privilege('anon',c.oid,'SELECT'),false) as anonymous_select,
 coalesce(has_table_privilege('authenticated',c.oid,'INSERT'),false) as direct_insert,
 coalesce(has_table_privilege('authenticated',c.oid,'DELETE'),false) as direct_delete,
 coalesce(has_table_privilege('authenticated',c.oid,'UPDATE'),false) as direct_update
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name)
order by e.name
), function_checks as (

select n.nspname as schema_name,p.proname,p.oid::regprocedure::text as signature,
 p.prosecdef as security_definer,
 has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
 p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f'
 and p.proname not like 'pg_%'
 and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
order by n.nspname,p.proname
), bucket_checks as (

select id,public,file_size_limit,allowed_mime_types
from storage.buckets where id='retail-imports'
), policy_checks as (
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname
)
select jsonb_build_object(
 'summary',jsonb_build_object(
  'table_count',(select count(*) from table_checks),
  'tables_protected',(select count(*)=16 and bool_and(present and rls and not anonymous_select and not direct_insert and not direct_delete and not direct_update) from table_checks),
  'functions_deny_anonymous',(select coalesce(bool_and(not anonymous_execute),false) from function_checks),
  'definer_search_paths_safe',(select coalesce(bool_and(not security_definer or coalesce(proconfig @> array['search_path=""'],false)),false) from function_checks),
  'private_import_bucket',(select count(*)=1 and bool_and(not public and file_size_limit=2097152) from bucket_checks)
 ),
 'tables',coalesce((select jsonb_agg(to_jsonb(t)) from table_checks t),'[]'::jsonb),
 'functions',coalesce((select jsonb_agg(to_jsonb(f)) from function_checks f),'[]'::jsonb),
 'buckets',coalesce((select jsonb_agg(to_jsonb(b)) from bucket_checks b),'[]'::jsonb),
 'policies',coalesce((select jsonb_agg(to_jsonb(p)) from policy_checks p),'[]'::jsonb)
) as release_audit;
