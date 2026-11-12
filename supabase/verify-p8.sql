-- Read-only schema/grant verification; no questions or tenant facts printed.
select p.proname,p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anonymous_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('reserve_assistant_request','reserve_assistant_provider','complete_assistant_request');
-- Expect security definer with empty search_path; anon=false, authenticated=true.
select relrowsecurity,
  has_table_privilege('authenticated','public.ai_usage_events','SELECT') as direct_read,
  has_table_privilege('authenticated','public.ai_usage_events','INSERT,UPDATE,DELETE') as direct_write
from pg_class where oid='public.ai_usage_events'::regclass;
-- Expect RLS=true, direct_read=false, direct_write=false.
