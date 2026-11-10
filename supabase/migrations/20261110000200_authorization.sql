-- P2: least-privilege reads, owner setup/settings and own-profile updates.
BEGIN;
create schema if not exists private;

create function private.my_org_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$ select org_id from public.organization_members where user_id = (select auth.uid()) $$;
revoke all on function private.my_org_ids() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.my_org_ids() to authenticated;

do $$ declare t text; begin
  foreach t in array array[
    'organizations','organization_members','profiles','suppliers','products',
    'inventory_snapshots','sales_daily','import_jobs','forecast_runs',
    'forecast_product_results','forecast_points','replenishment_plans',
    'plan_lines','purchase_orders','purchase_order_lines','ai_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public, anon, authenticated', t);
  end loop;
  foreach t in array array[
    'suppliers','products','inventory_snapshots','sales_daily','import_jobs',
    'forecast_runs','forecast_product_results','forecast_points',
    'purchase_orders','purchase_order_lines'
  ] loop
    execute format('grant select on public.%I to authenticated', t);
    execute format('create policy tenant_select on public.%I for select to authenticated using (org_id in (select private.my_org_ids()))', t);
  end loop;
end $$;

grant select on public.organizations, public.organization_members, public.profiles,
  public.replenishment_plans, public.plan_lines to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy organizations_select on public.organizations for select to authenticated
  using (id in (select private.my_org_ids()));
create policy members_select on public.organization_members for select to authenticated
  using (org_id in (select private.my_org_ids()));
create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy plans_select on public.replenishment_plans for select to authenticated
  using (org_id in (select private.my_org_ids()) and (status <> 'building' or created_by = (select auth.uid())));
create policy lines_select on public.plan_lines for select to authenticated
  using (org_id in (select private.my_org_ids()) and exists (
    select 1 from public.replenishment_plans p where p.org_id = plan_lines.org_id and p.id = plan_lines.plan_id
      and (p.status <> 'building' or p.created_by = (select auth.uid()))
  ));
-- ai_usage_events intentionally has neither user grants nor policies.

create function private.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger organizations_updated before update on public.organizations
  for each row execute function private.touch_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function private.touch_updated_at();

create function private.create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id) values(new.id) on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function private.create_profile() from public, anon, authenticated;
create trigger reorderlens_profile_created after insert on auth.users
  for each row execute function private.create_profile();
insert into public.profiles(user_id) select id from auth.users on conflict (user_id) do nothing;

create function public.create_workspace(p_name text, p_location text, p_is_sample boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid := (select auth.uid()); v_org uuid;
begin
  if v_user is null then raise exception using errcode = '42501', message = 'AUTH_REQUIRED'; end if;
  if p_is_sample is distinct from false then raise exception using errcode = '0A000', message = 'SAMPLE_NOT_AVAILABLE'; end if;
  if p_name is null or length(trim(p_name)) not between 2 and 120
    or p_location is null or length(trim(p_location)) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE';
  end if;
  -- Serialize same-user setup requests so the durable limit cannot race.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  if (select count(*) from public.organizations where created_by = v_user and created_at > now() - interval '1 hour') >= 5
    or (select count(*) from public.organizations where created_by = v_user) >= 10 then
    raise exception using errcode = 'P0001', message = 'WORKSPACE_LIMIT';
  end if;
  insert into public.organizations(name,location,is_sample,created_by)
    values(trim(p_name),trim(p_location),false,v_user) returning id into v_org;
  insert into public.organization_members(org_id,user_id,role) values(v_org,v_user,'owner');
  insert into public.profiles(user_id) values(v_user) on conflict (user_id) do nothing;
  return v_org;
end $$;
revoke all on function public.create_workspace(text,text,boolean) from public, anon;
grant execute on function public.create_workspace(text,text,boolean) to authenticated;

create function public.update_workspace_settings(p_org_id uuid, p_name text, p_location text)
returns setof public.organizations language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.organization_members where org_id = p_org_id
    and user_id = (select auth.uid()) and role = 'owner') then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;
  if p_name is null or length(trim(p_name)) not between 2 and 120
    or p_location is null or length(trim(p_location)) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'INVALID_WORKSPACE';
  end if;
  return query update public.organizations set name = trim(p_name), location = trim(p_location)
    where id = p_org_id returning *;
end $$;
revoke all on function public.update_workspace_settings(uuid,text,text) from public, anon;
grant execute on function public.update_workspace_settings(uuid,text,text) to authenticated;
COMMIT;
