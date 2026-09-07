-- Ledger — schema, RLS, aggregate functions and storage buckets.
-- No demo data. Safe to run more than once: re-running fills in anything
-- missing and leaves existing data untouched.
-- Paste into: Dashboard → SQL Editor → New query → Run.

-- ------------------------------------------------------------
-- 0001_schema.sql
-- ------------------------------------------------------------
-- Ledger — core schema
-- Money is stored in minor units (cents) as bigint to keep arithmetic exact.
-- Every business-scoped row carries owner_id so RLS never needs a recursive join.

create extension if not exists "pgcrypto";

-- `create type` has no IF NOT EXISTS, so each enum is guarded. Everything in
-- this file is written to be safe to run more than once.

-- ---------------------------------------------------------------- enums

do $$ begin
  if not exists (select 1 from pg_type where typname = 'business_kind') then
    create type business_kind as enum ('retail', 'design', 'property', 'services', 'other');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'contact_kind') then
    create type contact_kind as enum ('client', 'vendor');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'account_kind') then
    create type account_kind as enum ('bank', 'card', 'cash');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type account_status as enum ('live', 'expired', 'disconnected');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('draft', 'sent', 'paid', 'void');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'quote_status') then
    create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'receipt_source') then
    create type receipt_source as enum ('scan', 'email', 'whatsapp', 'photo', 'upload');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'receipt_status') then
    create type receipt_status as enum ('pending', 'matched', 'filed');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'txn_status') then
    create type txn_status as enum ('pending', 'confirmed', 'dismissed');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'alert_severity') then
    create type alert_severity as enum ('critical', 'positive', 'warning', 'info');
  end if;
end $$;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner', 'accountant');
  end if;
end $$;

-- ---------------------------------------------------------------- profiles

create table if not exists public.profiles (
  id               uuid primary key references auth.users on delete cascade,
  email            text,
  full_name        text,
  initials         text,
  base_currency    text not null default 'LKR',
  fy_start_month   smallint not null default 1 check (fy_start_month between 1 and 12),
  invoice_numbering text not null default 'per_business'
                   check (invoice_numbering in ('per_business', 'global')),
  fx_mode          text not null default 'daily_auto'
                   check (fx_mode in ('daily_auto', 'manual')),
  onboarded_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- Mint a profile row the moment a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, initials)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    -- First + last initial, matching the `initials()` helper the app renders with.
    upper(
      left(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.email), ' ', 1), 1) ||
      coalesce(
        nullif(left(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', ''), ' ', 2), 1), ''),
        left(split_part(coalesce(new.raw_user_meta_data ->> 'full_name', new.email), ' ', 1), 2)
      )
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- businesses

create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  name          text not null,
  -- Short form for tight rows and pills: the design writes "Northlight Studio"
  -- on cards but "Northlight" in list metas and the business selector.
  short_name    text,
  kind          business_kind not null default 'other',
  currency      text not null default 'USD',
  -- 0,1,2 -> green, blue, amber. Drives the accent stripe on every card.
  accent_index  smallint not null default 0 check (accent_index between 0 and 2),
  tax_label     text,                        -- 'Sales tax' | 'VAT' | null
  tax_rate      numeric(6,3) not null default 0,
  vat_number    text,
  address       text,
  pay_link      text,
  iban          text,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists idx_businesses_owner_id on public.businesses (owner_id);

-- Accountant / read-only collaborators.
create table if not exists public.business_members (
  business_id uuid not null references public.businesses on delete cascade,
  user_id     uuid not null references auth.users on delete cascade,
  role        member_role not null default 'accountant',
  invited_at  timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index if not exists idx_business_members_user_id on public.business_members (user_id);

-- ---------------------------------------------------------------- reference data

create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  business_id uuid references public.businesses on delete cascade, -- null = applies to all
  name        text not null,
  position    smallint not null default 0
);
create index if not exists idx_categories_owner_id on public.categories (owner_id);

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  business_id uuid references public.businesses on delete set null,
  kind        contact_kind not null,
  name        text not null,
  email       text,
  phone       text,
  address     text,
  currency    text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_contacts_owner_id_kind on public.contacts (owner_id, kind);

create table if not exists public.accounts (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  business_id    uuid references public.businesses on delete set null,
  name           text not null,
  institution    text,
  mask           text,                     -- last 4, e.g. '4412'
  badge          text,                     -- 'CH', 'N26', 'AX'
  kind           account_kind not null default 'bank',
  currency       text not null default 'USD',
  balance_minor  bigint not null default 0,
  status         account_status not null default 'live',
  auto_categorise boolean not null default true,
  last_synced_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists idx_accounts_owner_id on public.accounts (owner_id);

create table if not exists public.fx_rates (
  base   text not null,
  quote  text not null,
  rate   numeric(18,8) not null,
  as_of  date not null,
  primary key (base, quote, as_of)
);

-- ---------------------------------------------------------------- receipts

create table if not exists public.receipts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  business_id   uuid references public.businesses on delete set null,
  storage_path  text,                       -- object key in the `receipts` bucket
  source        receipt_source not null default 'upload',
  merchant      text,
  amount_minor  bigint,
  currency      text,
  tax_minor     bigint,
  doc_number    text,
  status        receipt_status not null default 'pending',
  note          text,                       -- 'matched to bank line', 'no business picked'
  captured_at   timestamptz not null default now()
);
create index if not exists idx_receipts_owner_id_status on public.receipts (owner_id, status);

-- ---------------------------------------------------------------- expenses

create table if not exists public.expenses (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  business_id    uuid not null references public.businesses on delete cascade,
  category_id    uuid references public.categories on delete set null,
  vendor_id      uuid references public.contacts on delete set null,
  account_id     uuid references public.accounts on delete set null,
  receipt_id     uuid references public.receipts on delete set null,
  amount_minor   bigint not null,
  currency       text not null,
  fx_rate        numeric(18,8) not null default 1,
  base_minor     bigint not null,           -- amount converted to profile.base_currency
  tax_minor      bigint not null default 0,
  tax_recoverable boolean not null default false,
  spent_on       date not null default current_date,
  memo           text,                      -- 'Unit 3B'
  is_recurring   boolean not null default false,
  recurrence     text,                      -- 'monthly'
  created_at     timestamptz not null default now()
);
create index if not exists idx_expenses_owner_id_spent_on on public.expenses (owner_id, spent_on desc);
create index if not exists idx_expenses_business_id_spent_on on public.expenses (business_id, spent_on desc);

-- Revenue is recorded separately so P&L has both sides without abusing sign.
create table if not exists public.income (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users on delete cascade,
  business_id  uuid not null references public.businesses on delete cascade,
  client_id    uuid references public.contacts on delete set null,
  invoice_id   uuid,                        -- FK added after invoices exists
  amount_minor bigint not null,
  currency     text not null,
  fx_rate      numeric(18,8) not null default 1,
  base_minor   bigint not null,
  tax_minor    bigint not null default 0,
  received_on  date not null default current_date,
  memo         text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_income_owner_id_received_on on public.income (owner_id, received_on desc);
create index if not exists idx_income_business_id_received_on on public.income (business_id, received_on desc);

-- ---------------------------------------------------------------- invoices

create table if not exists public.invoices (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  business_id    uuid not null references public.businesses on delete cascade,
  client_id      uuid references public.contacts on delete set null,
  number         text not null,
  currency       text not null,
  fx_rate        numeric(18,8) not null default 1,
  status         invoice_status not null default 'draft',
  issue_date     date not null default current_date,
  due_date       date not null,
  terms_days     smallint not null default 14,
  subtotal_minor bigint not null default 0,
  tax_rate       numeric(6,3) not null default 0,
  tax_minor      bigint not null default 0,
  total_minor    bigint not null default 0,
  base_total_minor bigint not null default 0,
  attach_payment_link boolean not null default true,
  is_recurring   boolean not null default false,
  recurrence     text,
  notes          text,
  pdf_path       text,                      -- object key in the `documents` bucket
  sent_at        timestamptz,
  paid_at        timestamptz,
  created_at     timestamptz not null default now(),
  unique (business_id, number)
);
create index if not exists idx_invoices_owner_id_status on public.invoices (owner_id, status);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'income_invoice_id_fkey') then
    alter table public.income
      add constraint income_invoice_id_fkey
      foreign key (invoice_id) references public.invoices on delete set null;
  end if;
end $$;

create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices on delete cascade,
  owner_id    uuid not null references auth.users on delete cascade,
  description text not null,
  detail      text,                          -- '€70 / hour', 'Fixed fee'
  qty         numeric(12,3) not null default 1,
  unit_minor  bigint not null default 0,
  amount_minor bigint not null default 0,
  position    smallint not null default 0
);
create index if not exists idx_invoice_items_invoice_id on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------- quotations

create table if not exists public.quotations (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  business_id    uuid not null references public.businesses on delete cascade,
  client_id      uuid references public.contacts on delete set null,
  number         text not null,
  currency       text not null,
  status         quote_status not null default 'draft',
  issue_date     date not null default current_date,
  valid_until    date not null,
  valid_days     smallint not null default 30,
  subtotal_minor bigint not null default 0,
  tax_rate       numeric(6,3) not null default 0,
  tax_minor      bigint not null default 0,
  total_minor    bigint not null default 0,
  summary        text,                       -- 'wholesale supply', '12-month lease'
  allow_online_accept boolean not null default true,
  auto_bill      boolean not null default false,
  converted_invoice_id uuid references public.invoices on delete set null,
  sent_at        timestamptz,
  accepted_at    timestamptz,
  created_at     timestamptz not null default now(),
  unique (business_id, number)
);
create index if not exists idx_quotations_owner_id_status on public.quotations (owner_id, status);

create table if not exists public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations on delete cascade,
  owner_id     uuid not null references auth.users on delete cascade,
  description  text not null,
  detail       text,
  qty          numeric(12,3) not null default 1,
  unit_minor   bigint not null default 0,
  amount_minor bigint not null default 0,
  position     smallint not null default 0
);
create index if not exists idx_quotation_items_quotation_id on public.quotation_items (quotation_id);

-- ---------------------------------------------------------------- bank feed

create table if not exists public.bank_transactions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  account_id    uuid not null references public.accounts on delete cascade,
  business_id   uuid references public.businesses on delete set null,   -- suggested
  category_id   uuid references public.categories on delete set null,   -- suggested
  matched_invoice_id uuid references public.invoices on delete set null,
  description   text not null,               -- 'RIVERBEND ROAST 44'
  amount_minor  bigint not null,             -- negative = money out
  currency      text not null,
  posted_on     date not null default current_date,
  status        txn_status not null default 'pending',
  expense_id    uuid references public.expenses on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_bank_transactions_owner_id_status on public.bank_transactions (owner_id, status);

-- ---------------------------------------------------------------- alerts + exports

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users on delete cascade,
  severity     alert_severity not null default 'info',
  title        text not null,
  body         text,
  entity_type  text,                          -- 'invoice' | 'quotation' | 'tax'
  entity_id    uuid,
  needs_action boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_notifications_owner_id_created_at on public.notifications (owner_id, created_at desc);

create table if not exists public.exports (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users on delete cascade,
  filename     text not null,
  kind         text not null,                 -- 'pdf' | 'csv'
  storage_path text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_exports_owner_id_created_at on public.exports (owner_id, created_at desc);

-- ------------------------------------------------------------
-- 0002_rls.sql
-- ------------------------------------------------------------
-- Ledger — row level security
-- Rule: a row is visible to its owner, and to any user granted membership on the
-- business it belongs to. Owner checks are a plain column compare so Postgres can
-- use the (owner_id, ...) indexes rather than falling back to a sequential scan.

alter table public.profiles           enable row level security;
alter table public.businesses         enable row level security;
alter table public.business_members   enable row level security;
alter table public.categories         enable row level security;
alter table public.contacts           enable row level security;
alter table public.accounts           enable row level security;
alter table public.fx_rates           enable row level security;
alter table public.receipts           enable row level security;
alter table public.expenses           enable row level security;
alter table public.income             enable row level security;
alter table public.invoices           enable row level security;
alter table public.invoice_items      enable row level security;
alter table public.quotations         enable row level security;
alter table public.quotation_items    enable row level security;
alter table public.bank_transactions  enable row level security;
alter table public.notifications      enable row level security;
alter table public.exports            enable row level security;

-- Is the current user a granted member (not owner) of this business?
-- security definer so the policy on business_members does not recurse.
create or replace function public.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = auth.uid()
  );
$$;

-- Members are read-only; only the owner writes. This helper keeps that explicit.
create or replace function public.owns_business(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id
      and b.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------- profiles

drop policy if exists "profile is self" on public.profiles;
create policy "profile is self" on public.profiles
  for select using (id = auth.uid());
drop policy if exists "profile update self" on public.profiles;
create policy "profile update self" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "profile insert self" on public.profiles;
create policy "profile insert self" on public.profiles
  for insert with check (id = auth.uid());

-- ---------------------------------------------------------------- businesses

drop policy if exists "businesses readable by owner or member" on public.businesses;
create policy "businesses readable by owner or member" on public.businesses
  for select using (owner_id = auth.uid() or public.is_business_member(id));
drop policy if exists "businesses written by owner" on public.businesses;
create policy "businesses written by owner" on public.businesses
  for insert with check (owner_id = auth.uid());
drop policy if exists "businesses updated by owner" on public.businesses;
create policy "businesses updated by owner" on public.businesses
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "businesses deleted by owner" on public.businesses;
create policy "businesses deleted by owner" on public.businesses
  for delete using (owner_id = auth.uid());

drop policy if exists "members visible to owner and self" on public.business_members;
create policy "members visible to owner and self" on public.business_members
  for select using (user_id = auth.uid() or public.owns_business(business_id));
drop policy if exists "members managed by owner" on public.business_members;
create policy "members managed by owner" on public.business_members
  for all using (public.owns_business(business_id))
  with check (public.owns_business(business_id));

-- ---------------------------------------------------------------- fx rates
-- Rates are reference data: readable by any signed-in user, written by the service role.

drop policy if exists "fx readable when signed in" on public.fx_rates;
create policy "fx readable when signed in" on public.fx_rates
  for select using (auth.role() = 'authenticated');

-- ------------------------------------------------- owner-or-member business rows
-- Applied to every table that carries both owner_id and business_id.

do $$
declare t text;
begin
  foreach t in array array[
    'categories', 'contacts', 'accounts', 'receipts', 'expenses', 'income',
    'invoices', 'quotations', 'bank_transactions'
  ]
  loop
    execute format($f$
      drop policy if exists "%1$s readable" on public.%1$I;
      create policy "%1$s readable" on public.%1$I
        for select using (
          owner_id = auth.uid()
          or (business_id is not null and public.is_business_member(business_id))
        );
      -- Owning the row is not enough: a read-only member could otherwise set
      -- owner_id to themselves and attach rows to a business they cannot write.
      drop policy if exists "%1$s insert own" on public.%1$I;
      create policy "%1$s insert own" on public.%1$I
        for insert with check (
          owner_id = auth.uid()
          and (business_id is null or public.owns_business(business_id))
        );
      drop policy if exists "%1$s update own" on public.%1$I;
      create policy "%1$s update own" on public.%1$I
        for update using (owner_id = auth.uid())
        with check (
          owner_id = auth.uid()
          and (business_id is null or public.owns_business(business_id))
        );
      drop policy if exists "%1$s delete own" on public.%1$I;
      create policy "%1$s delete own" on public.%1$I
        for delete using (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- --------------------------------------------------------- owner-only child rows
-- Line items and personal feeds have no business_id of their own; they inherit
-- visibility from owner_id, and members reach them through the parent's policy.

do $$
declare t text;
begin
  foreach t in array array['invoice_items', 'quotation_items', 'notifications', 'exports']
  loop
    execute format($f$
      drop policy if exists "%1$s readable" on public.%1$I;
      create policy "%1$s readable" on public.%1$I
        for select using (owner_id = auth.uid());
      drop policy if exists "%1$s insert own" on public.%1$I;
      create policy "%1$s insert own" on public.%1$I
        for insert with check (owner_id = auth.uid());
      drop policy if exists "%1$s update own" on public.%1$I;
      create policy "%1$s update own" on public.%1$I
        for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
      drop policy if exists "%1$s delete own" on public.%1$I;
      create policy "%1$s delete own" on public.%1$I
        for delete using (owner_id = auth.uid());
    $f$, t);
  end loop;
end $$;

-- Members need to read the line items of invoices they can already see.
drop policy if exists "invoice items readable by business member" on public.invoice_items;
create policy "invoice items readable by business member" on public.invoice_items
  for select using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id
        and i.business_id is not null
        and public.is_business_member(i.business_id)
    )
  );

drop policy if exists "quotation items readable by business member" on public.quotation_items;
create policy "quotation items readable by business member" on public.quotation_items
  for select using (
    exists (
      select 1 from public.quotations q
      where q.id = quotation_items.quotation_id
        and q.business_id is not null
        and public.is_business_member(q.business_id)
    )
  );

-- ------------------------------------------------------------
-- 0003_functions.sql
-- ------------------------------------------------------------
-- Ledger — aggregate RPCs
-- The dashboards need sums across several tables at once. Doing that in SQL keeps
-- the client from over-fetching whole ledgers just to add them up. Every function
-- is `security invoker` so RLS still decides which rows are counted.

-- Invoices carry a status enum without 'overdue' because overdue is a function of
-- the clock, not a state anyone sets. This view derives it once.
create or replace view public.invoices_view
with (security_invoker = true) as
select
  i.*,
  case
    when i.status = 'sent' and i.due_date < current_date then 'overdue'
    else i.status::text
  end as display_status,
  greatest(0, current_date - i.due_date) as days_overdue
from public.invoices i;

-- Next document number for a business, e.g. INV-2096 / QT-120.
create or replace function public.next_document_number(
  p_business_id uuid,
  p_kind text default 'invoice'
)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_prefix text := case when p_kind = 'quotation' then 'QT-' else 'INV-' end;
  v_max int;
begin
  if p_kind = 'quotation' then
    select max(nullif(regexp_replace(number, '\D', '', 'g'), '')::int)
      into v_max from public.quotations where business_id = p_business_id;
  else
    select max(nullif(regexp_replace(number, '\D', '', 'g'), '')::int)
      into v_max from public.invoices where business_id = p_business_id;
  end if;

  return v_prefix || coalesce(v_max + 1, case when p_kind = 'quotation' then 101 else 2001 end);
end;
$$;

-- ------------------------------------------------------------- home summary
-- Consolidated figures for a month, plus a per-business breakdown, all in base
-- currency. Shape matches the home screen top to bottom.
create or replace function public.home_summary(p_month date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select date_trunc('month', p_month)::date as from_d,
         (date_trunc('month', p_month) + interval '1 month')::date as to_d
),
per_business as (
  select
    b.id,
    b.name,
    coalesce(b.short_name, b.name) as short_name,
    b.kind::text          as kind,
    b.is_default,
    b.created_at,
    b.currency,
    b.accent_index,
    coalesce(inc.total, 0)   as revenue_minor,
    coalesce(exp.total, 0)   as expense_minor,
    coalesce(inc.total, 0) - coalesce(exp.total, 0) as net_minor,
    coalesce(exp.cnt, 0)     as expense_count,
    coalesce(inc.native, 0) - coalesce(exp.native, 0) as net_native_minor
  from public.businesses b
  cross join bounds
  left join lateral (
    select sum(e.base_minor) as total, sum(e.amount_minor) as native, count(*) as cnt
    from public.expenses e
    where e.business_id = b.id and e.spent_on >= bounds.from_d and e.spent_on < bounds.to_d
  ) exp on true
  left join lateral (
    select sum(i.base_minor) as total, sum(i.amount_minor) as native
    from public.income i
    where i.business_id = b.id and i.received_on >= bounds.from_d and i.received_on < bounds.to_d
  ) inc on true
),
prev as (
  select coalesce(sum(i.base_minor), 0) - coalesce((
    select sum(e.base_minor) from public.expenses e
    where e.spent_on >= (date_trunc('month', p_month) - interval '1 month')::date
      and e.spent_on <  date_trunc('month', p_month)::date
  ), 0) as net_minor
  from public.income i
  where i.received_on >= (date_trunc('month', p_month) - interval '1 month')::date
    and i.received_on <  date_trunc('month', p_month)::date
),
receivable as (
  select coalesce(sum(v.base_total_minor), 0) as total
  from public.invoices_view v
  where v.status = 'sent'
),
overdue as (
  select
    count(*)                                   as cnt,
    coalesce(sum(v.base_total_minor), 0)       as total,
    coalesce(
      array_agg(c.name order by v.due_date) filter (where c.name is not null),
      '{}'
    )                                          as names
  from public.invoices_view v
  left join public.contacts c on c.id = v.client_id
  where v.display_status = 'overdue'
)
select jsonb_build_object(
  'month',            to_char(date_trunc('month', p_month), 'YYYY-MM-DD'),
  'revenue_minor',    coalesce(sum(pb.revenue_minor), 0),
  'expense_minor',    coalesce(sum(pb.expense_minor), 0),
  'net_minor',        coalesce(sum(pb.net_minor), 0),
  'prev_net_minor',   (select net_minor from prev),
  'receivable_minor', (select total from receivable),
  'overdue', jsonb_build_object(
    'count', (select cnt   from overdue),
    'total_minor', (select total from overdue),
    'names', to_jsonb((select names from overdue))
  ),
  'businesses', coalesce(jsonb_agg(
    jsonb_build_object(
      'id', pb.id,
      'name', pb.name,
      'short_name', pb.short_name,
      'kind', pb.kind,
      'currency', pb.currency,
      'accent_index', pb.accent_index,
      'revenue_minor', pb.revenue_minor,
      'expense_minor', pb.expense_minor,
      'net_minor', pb.net_minor,
      'net_native_minor', pb.net_native_minor,
      'expense_count', pb.expense_count
    ) order by pb.is_default desc, pb.created_at
  ), '[]'::jsonb)
)
from per_business pb;
$$;

-- ------------------------------------------------------------- P&L summary
create or replace function public.pl_summary(
  p_business_id uuid,
  p_month date default current_date
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select date_trunc('month', p_month)::date as from_d,
         (date_trunc('month', p_month) + interval '1 month')::date as to_d
),
rev as (
  select coalesce(sum(base_minor), 0) as total, coalesce(sum(tax_minor), 0) as tax
  from public.income, bounds
  where business_id = p_business_id and received_on >= from_d and received_on < to_d
),
exp as (
  select
    coalesce(sum(base_minor), 0) as total,
    coalesce(sum(tax_minor) filter (where tax_recoverable), 0) as recoverable_tax
  from public.expenses, bounds
  where business_id = p_business_id and spent_on >= from_d and spent_on < to_d
),
by_category as (
  select
    coalesce(c.name, 'Uncategorised') as name,
    sum(e.base_minor) as total_minor
  from public.expenses e
  cross join bounds
  left join public.categories c on c.id = e.category_id
  where e.business_id = p_business_id and e.spent_on >= bounds.from_d and e.spent_on < bounds.to_d
  group by 1
  order by 2 desc
),
cash as (
  select
    coalesce(sum(balance_minor) filter (where kind = 'cash'), 0) as hand_minor,
    coalesce(sum(balance_minor) filter (where kind <> 'cash'), 0) as bank_minor
  from public.accounts
  where business_id = p_business_id and status <> 'disconnected'
)
select jsonb_build_object(
  'business_id',    p_business_id,
  'month',          to_char(date_trunc('month', p_month), 'YYYY-MM-DD'),
  'revenue_minor',  (select total from rev),
  'expense_minor',  (select total from exp),
  'net_minor',      (select total from rev) - (select total from exp),
  'tax_collected_minor',   (select tax from rev),
  'tax_recoverable_minor', (select recoverable_tax from exp),
  'tax_payable_minor',     (select tax from rev) - (select recoverable_tax from exp),
  'cash_hand_minor', (select hand_minor from cash),
  'cash_bank_minor', (select bank_minor from cash),
  'categories', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'total_minor', total_minor))
    from by_category
  ), '[]'::jsonb)
);
$$;

-- ------------------------------------------------------------- net trend
-- One row per month, newest last. Powers the 6-month bar chart on P&L and the
-- grouped bars on compare. p_business_id null = every business the user can see.
create or replace function public.net_trend(
  p_business_id uuid default null,
  p_months int default 6,
  p_to date default current_date
)
returns table (
  business_id uuid,
  month       date,
  net_minor   bigint
)
language sql
stable
security invoker
set search_path = public
as $$
with months as (
  select generate_series(
    date_trunc('month', p_to) - ((p_months - 1) || ' months')::interval,
    date_trunc('month', p_to),
    interval '1 month'
  )::date as m
),
scope as (
  select b.id from public.businesses b
  where p_business_id is null or b.id = p_business_id
)
select
  s.id,
  months.m,
  coalesce((
    select sum(i.base_minor) from public.income i
    where i.business_id = s.id
      and i.received_on >= months.m
      and i.received_on < (months.m + interval '1 month')::date
  ), 0)
  -
  coalesce((
    select sum(e.base_minor) from public.expenses e
    where e.business_id = s.id
      and e.spent_on >= months.m
      and e.spent_on < (months.m + interval '1 month')::date
  ), 0)
from scope s
cross join months
order by s.id, months.m;
$$;

-- ------------------------------------------------------------- quarter tax
create or replace function public.tax_summary(p_as_of date default current_date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select date_trunc('quarter', p_as_of)::date as from_d, p_as_of as to_d
)
select jsonb_build_object(
  'from', (select from_d from bounds),
  'to',   (select to_d from bounds),
  'collected_minor', coalesce((
    select sum(tax_minor) from public.income, bounds
    where received_on >= from_d and received_on <= to_d), 0),
  'recoverable_minor', coalesce((
    select sum(tax_minor) from public.expenses, bounds
    where tax_recoverable and spent_on >= from_d and spent_on <= to_d), 0),
  'payable_minor', coalesce((
    select sum(tax_minor) from public.income, bounds
    where received_on >= from_d and received_on <= to_d), 0)
    - coalesce((
    select sum(tax_minor) from public.expenses, bounds
    where tax_recoverable and spent_on >= from_d and spent_on <= to_d), 0),
  'business_count', (select count(*) from public.businesses)
);
$$;

-- ------------------------------------------------------------- vendor history
-- Feeds the "Last 3 at Riverbend" hint on the add-expense screen.
create or replace function public.recent_vendor_amounts(
  p_vendor_id uuid,
  p_limit int default 3
)
returns table (amount_minor bigint, currency text, spent_on date)
language sql
stable
security invoker
set search_path = public
as $$
  select e.amount_minor, e.currency, e.spent_on
  from public.expenses e
  where e.vendor_id = p_vendor_id
  order by e.spent_on desc, e.created_at desc
  limit p_limit;
$$;

-- ------------------------------------------------------------
-- 0004_storage.sql
-- ------------------------------------------------------------
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

