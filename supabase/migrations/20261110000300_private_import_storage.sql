-- P2 storage foundation only. Upload/validation/commit workflows belong to P3.
BEGIN;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('retail-imports','retail-imports',false,2097152,array['text/csv','application/csv','application/vnd.ms-excel']);

create function private.can_access_import_object(p_name text, p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\.csv$'
    and exists (
      select 1 from public.import_jobs j
      join public.organization_members m on m.org_id = j.org_id
      join public.organizations o on o.id = j.org_id
      where m.user_id = (select auth.uid())
        and j.org_id::text = split_part(p_name,'/',1) and j.id::text = split_part(p_name,'/',2)
        and (not p_write or (m.role in ('owner','operator') and not o.is_sample and j.created_by = (select auth.uid())))
    )
$$;
revoke all on function private.can_access_import_object(text,boolean) from public, anon;
grant execute on function private.can_access_import_object(text,boolean) to authenticated;

create policy reorderlens_import_read on storage.objects for select to authenticated
  using (bucket_id = 'retail-imports' and private.can_access_import_object(name,false));
create policy reorderlens_import_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'retail-imports' and private.can_access_import_object(name,true));
create policy reorderlens_import_update on storage.objects for update to authenticated
  using (bucket_id = 'retail-imports' and private.can_access_import_object(name,true))
  with check (bucket_id = 'retail-imports' and private.can_access_import_object(name,true));
create policy reorderlens_import_delete on storage.objects for delete to authenticated
  using (bucket_id = 'retail-imports' and private.can_access_import_object(name,true));
COMMIT;
