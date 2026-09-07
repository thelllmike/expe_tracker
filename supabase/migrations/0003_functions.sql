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
