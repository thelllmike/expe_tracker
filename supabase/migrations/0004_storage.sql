-- Ledger — storage buckets
-- Objects are keyed <user-id>/<rest>, so the first path segment is the ACL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('receipts',  'receipts',  false, 10485760,
   array['image/jpeg','image/png','image/heic','image/webp','application/pdf']),
  ('documents', 'documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

-- Reusable predicate: does this object key belong to the caller?
create or replace function public.storage_owns(p_name text)
returns boolean
language sql
stable
as $$
  select (storage.foldername(p_name))[1] = auth.uid()::text;
$$;

drop policy if exists "receipts readable by owner" on storage.objects;
create policy "receipts readable by owner" on storage.objects
  for select using (bucket_id = 'receipts' and public.storage_owns(name));
drop policy if exists "receipts writable by owner" on storage.objects;
create policy "receipts writable by owner" on storage.objects
  for insert with check (bucket_id = 'receipts' and public.storage_owns(name));
drop policy if exists "receipts updatable by owner" on storage.objects;
create policy "receipts updatable by owner" on storage.objects
  for update using (bucket_id = 'receipts' and public.storage_owns(name));
drop policy if exists "receipts deletable by owner" on storage.objects;
create policy "receipts deletable by owner" on storage.objects
  for delete using (bucket_id = 'receipts' and public.storage_owns(name));

-- Generated invoice/quotation PDFs. Written by the Edge Function (service role),
-- read by the owner.
drop policy if exists "documents readable by owner" on storage.objects;
create policy "documents readable by owner" on storage.objects
  for select using (bucket_id = 'documents' and public.storage_owns(name));
drop policy if exists "documents deletable by owner" on storage.objects;
create policy "documents deletable by owner" on storage.objects
  for delete using (bucket_id = 'documents' and public.storage_owns(name));
