-- Ledger — manual income entry and a P&L that covers day, week or month
--
-- Income already existed but was only ever written by the app: marking an
-- invoice paid, or confirming a bank transaction. This adds the pieces needed to
-- record it by hand and to read a P&L over a period shorter than a month.
--
-- Safe to run more than once.

-- ------------------------------------------------------------ income sources
-- The revenue-side counterpart of `categories`. business_id null means the
-- source is shared across every business the owner has.

create table if not exists public.income_sources (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  business_id uuid references public.businesses on delete cascade,
  name        text not null,
  position    smallint not null default 0
);
create index if not exists idx_income_sources_owner_id on public.income_sources (owner_id);

alter table public.income
  add column if not exists source_id uuid references public.income_sources on delete set null;

-- Same owner-or-member shape as categories; see 0002_rls.sql.
alter table public.income_sources enable row level security;

drop policy if exists "income_sources readable" on public.income_sources;
create policy "income_sources readable" on public.income_sources
  for select using (
    owner_id = auth.uid()
    or (business_id is not null and public.is_business_member(business_id))
  );

drop policy if exists "income_sources insert own" on public.income_sources;
create policy "income_sources insert own" on public.income_sources
  for insert with check (
    owner_id = auth.uid()
    and (business_id is null or public.owns_business(business_id))
  );

drop policy if exists "income_sources update own" on public.income_sources;
create policy "income_sources update own" on public.income_sources
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (business_id is null or public.owns_business(business_id))
  );

drop policy if exists "income_sources delete own" on public.income_sources;
create policy "income_sources delete own" on public.income_sources
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------- pl_summary
-- Extended with a period. The third argument defaults to 'month', so the
-- existing two-argument call keeps returning exactly what it did before.
--
-- date_trunc does the work for all three: 'day' is the date itself, 'week'
-- starts Monday, 'month' the first. The returned 'month' key is kept for
-- callers that still read it, alongside the new from/to/period keys.

create or replace function public.pl_summary(
  p_business_id uuid,
  p_month date default current_date,
  p_period text default 'month'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with period as (
  select case when p_period in ('day', 'week', 'month') then p_period else 'month' end as unit
),
bounds as (
  select
    date_trunc(unit, p_month::timestamp)::date as from_d,
    (date_trunc(unit, p_month::timestamp) + ('1 ' || unit)::interval)::date as to_d,
    unit
  from period
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
by_source as (
  select
    coalesce(s.name, 'Uncategorised') as name,
    sum(i.base_minor) as total_minor
  from public.income i
  cross join bounds
  left join public.income_sources s on s.id = i.source_id
  where i.business_id = p_business_id and i.received_on >= bounds.from_d and i.received_on < bounds.to_d
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
  'period',         (select unit from bounds),
  'from',           to_char((select from_d from bounds), 'YYYY-MM-DD'),
  'to',             to_char((select to_d from bounds), 'YYYY-MM-DD'),
  -- Kept so existing callers keep working; equal to `from` on a month period.
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
  ), '[]'::jsonb),
  'sources', coalesce((
    select jsonb_agg(jsonb_build_object('name', name, 'total_minor', total_minor))
    from by_source
  ), '[]'::jsonb)
);
$$;

-- ------------------------------------------------------ backfill for existing
-- The app seeds starter sources when the first business is created, which has
-- already happened for anyone upgrading. Give every existing owner the same
-- starting list, skipping those who already have one.

insert into public.income_sources (owner_id, name, position)
select p.id, v.name, v.position
from public.profiles p
cross join (values
  ('Sales', 0), ('Services', 1), ('Invoice payment', 2), ('Interest', 3), ('Other', 4)
) as v(name, position)
where not exists (
  select 1 from public.income_sources s where s.owner_id = p.id
);
