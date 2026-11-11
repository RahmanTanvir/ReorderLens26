-- READ ONLY: structural inspection after the P4-only upgrade.
select c.relname,c.reloptions from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='inventory_source_rows';
-- reloptions must include security_invoker=true.
select p.proname,p.prosecdef,p.provolatile from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('read_inventory','read_product','read_inventory_budget');
-- All three: prosecdef=false, provolatile=s (stable).
select to_regprocedure('public.create_sample_workspace()') as sample_setup;
select o.is_sample,f.method,count(*) from public.forecast_runs f join public.organizations o on o.id=f.org_id
where f.method='sample_fixture' group by o.is_sample,f.method;
-- P4 seeds only is_sample=true organizations; do not show raw customer records.
