-- Read-only structural check after the P3 upgrade. Not a tenant-isolation test.
select table_name,column_name,data_type from information_schema.columns
where table_schema='public' and table_name in ('forecast_runs','replenishment_plans')
  and column_name='stale_at'; -- two timestamptz columns

select to_regprocedure('public.begin_import(uuid,uuid,jsonb)') as begin_import,
  to_regprocedure('public.validate_import(uuid,uuid,jsonb,jsonb,jsonb)') as validate_import,
  to_regprocedure('public.commit_import(uuid,uuid,jsonb,boolean,uuid)') as commit_import,
  to_regprocedure('public.create_sample_workspace()') as create_sample_workspace;

select policyname,cmd from pg_policies where schemaname='storage'
  and tablename='objects' and policyname like 'reorderlens_import_%';
-- Only SELECT/INSERT policies; no app-specific UPDATE/DELETE policy.

select indexname from pg_indexes where schemaname='public'
  and indexname='organizations_one_sample_per_creator';
