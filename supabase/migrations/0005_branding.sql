-- Ledger — per-business branding, pay-to details and document adjustments
--
-- Adds what the generated invoice/quotation PDF needs beyond the core schema:
-- a logo, an accent colour, the PAY TO block and the footer contact line, plus
-- the discount and advance rows that sit above the total.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------- businesses

alter table public.businesses
  add column if not exists logo_path            text,  -- object key in the `logos` bucket
  -- Hex like '#6D4AFF'. Null falls back to the accent_index palette, so every
  -- existing business keeps the colour it already shows in the app.
  add column if not exists brand_color          text,
  add column if not exists bank_name            text,
  add column if not exists bank_account_name    text,
  add column if not exists bank_account_number  text,
  add column if not exists bank_branch          text,
  -- One or two lines under the totals: street, phone, email.
  add column if not exists footer_contact       text;

alter table public.businesses
  drop constraint if exists businesses_brand_color_hex;
alter table public.businesses
  add constraint businesses_brand_color_hex
  check (brand_color is null or brand_color ~* '^#[0-9a-f]{6}$');

-- ------------------------------------------------- invoice / quote adjustments

alter table public.invoices
  add column if not exists discount_minor bigint not null default 0,
  add column if not exists advance_minor  bigint not null default 0;

alter table public.quotations
  add column if not exists discount_minor bigint not null default 0,
  add column if not exists advance_minor  bigint not null default 0,
  add column if not exists pdf_path       text;

-- ---------------------------------------------------------------- logos bucket
-- Public read: a logo is embedded in documents that get forwarded on to clients,
-- and it carries nothing sensitive. Writes are still owner-only, and keys stay
-- <user-id>/<business-id>.<ext> so `storage_owns` applies unchanged.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "logos readable by anyone" on storage.objects;
create policy "logos readable by anyone" on storage.objects
  for select using (bucket_id = 'logos');

drop policy if exists "logos writable by owner" on storage.objects;
create policy "logos writable by owner" on storage.objects
  for insert with check (bucket_id = 'logos' and public.storage_owns(name));

drop policy if exists "logos updatable by owner" on storage.objects;
create policy "logos updatable by owner" on storage.objects
  for update using (bucket_id = 'logos' and public.storage_owns(name));

drop policy if exists "logos deletable by owner" on storage.objects;
create policy "logos deletable by owner" on storage.objects
  for delete using (bucket_id = 'logos' and public.storage_owns(name));

-- -------------------------------------------------------------- invoices_view
-- A view fixes its column list when it is created, so `select i.*` does not pick
-- up columns added afterwards. `create or replace` cannot reorder columns either
-- (the new ones would land before display_status), so the view is dropped and
-- rebuilt. Definition is otherwise identical to 0003.

drop view if exists public.invoices_view;
create view public.invoices_view
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'sent' and i.due_date < current_date then 'overdue'
    else i.status::text
  end as display_status,
  greatest(0, current_date - i.due_date) as days_overdue
from public.invoices i;
