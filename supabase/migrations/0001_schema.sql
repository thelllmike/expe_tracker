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
