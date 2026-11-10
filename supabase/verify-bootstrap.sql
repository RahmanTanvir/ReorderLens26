-- READ ONLY: run in the development project's SQL Editor.
-- Result 1: all 16 rows must show exists=true and rls_enabled=true.
with expected(name) as (
  values ('organizations'),('organization_members'),('profiles'),('suppliers'),
    ('products'),('inventory_snapshots'),('sales_daily'),('import_jobs'),
    ('forecast_runs'),('forecast_product_results'),('forecast_points'),
    ('replenishment_plans'),('plan_lines'),('purchase_orders'),
    ('purchase_order_lines'),('ai_usage_events')
)
select e.name, t.tablename is not null as exists,
  coalesce(t.rowsecurity,false) as rls_enabled
from expected e left join pg_tables t
  on t.schemaname='public' and t.tablename=e.name order by e.name;

-- Result 2: both values must be non-null.
select to_regprocedure('public.create_workspace(text,text,boolean)') as create_workspace,
  to_regprocedure('public.update_workspace_settings(uuid,text,text)') as update_workspace_settings;

-- Result 3: one row, public=false, file_size_limit=2097152.
select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='retail-imports';

-- Result 4: one row, is_nullable=NO.
select column_name,is_nullable from information_schema.columns
where table_schema='public' and table_name='plan_lines'
  and column_name='pack_multiple_snapshot';
