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
