-- Ledger — year and all-time figures
--
-- home_summary and pl_summary both worked a calendar month at a time, so a
-- business whose entries sit in an earlier year read as zero on the home screen.
-- Both now take a period: day, week, month, year or all.
--
-- The new argument defaults to 'month', so every existing call is unchanged.
-- Safe to run more than once.

-- ---------------------------------------------------------------- shared bounds
-- 'all' has no natural window; these two dates bracket anything the app can hold.
create or replace function public.period_bounds(p_anchor date, p_period text)
returns table (from_d date, to_d date, unit text)
language sql
immutable
set search_path = public
as $$
  with u as (
    select case
      when p_period in ('day', 'week', 'month', 'year', 'all') then p_period
      else 'month'
    end as unit
  )
  select
    case when unit = 'all' then date '1900-01-01'
         else date_trunc(unit, p_anchor::timestamp)::date end,
    case when unit = 'all' then date '9999-12-31'
         else (date_trunc(unit, p_anchor::timestamp) + ('1 ' || unit)::interval)::date end,
    unit
  from u;
$$;

-- ------------------------------------------------------------- home summary

create or replace function public.home_summary(
  p_month date default current_date,
  p_period text default 'month'
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
with bounds as (
  select from_d, to_d, unit from public.period_bounds(p_month, p_period)
),
-- The period immediately before this one, for the change figure. 'all' has
-- nothing before it, so the window is collapsed to nothing and the sum is zero.
prev_bounds as (
  select
    case when unit = 'all' then date '1900-01-01'
         else (from_d - ('1 ' || unit)::interval)::date end as from_d,
    case when unit = 'all' then date '1900-01-01' else from_d end as to_d
  from bounds
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
  select
    coalesce((
      select sum(i.base_minor) from public.income i, prev_bounds pb
      where i.received_on >= pb.from_d and i.received_on < pb.to_d
    ), 0)
    -
    coalesce((
      select sum(e.base_minor) from public.expenses e, prev_bounds pb
      where e.spent_on >= pb.from_d and e.spent_on < pb.to_d
    ), 0) as net_minor
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
  'period',           (select unit   from bounds),
  'from',             to_char((select from_d from bounds), 'YYYY-MM-DD'),
  'to',               to_char((select to_d   from bounds), 'YYYY-MM-DD'),
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

-- --------------------------------------------------------------- pl summary
-- Same change: day, week and month as before, plus year and all.

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
with bounds as (
  select from_d, to_d, unit from public.period_bounds(p_month, p_period)
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
