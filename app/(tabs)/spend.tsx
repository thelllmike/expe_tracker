import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AccentBar,
  Banner,
  Card,
  LinkButton,
  ListCard,
  Pill,
  PillRow,
  Row,
  Screen,
  SectionLabel,
} from '@/components';
import { alpha, businessAccents, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatDayGroup, formatMoney, formatMonth, startOfMonth, toISODate } from '@/lib/format';
import {
  useBusinesses,
  useCategories,
  useExpenses,
  useIncome,
  useProfile,
  useReceipts,
} from '@/data/queries';
import type { ExpenseRow, IncomeRow } from '@/data/queries';

type Filter = { businessId: string | null; categoryId: string | null; taxOnly: boolean };
type Side = 'all' | 'out' | 'in';

const SIDES: { value: Side; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'out', label: 'Money out' },
  { value: 'in', label: 'Money in' },
];

/**
 * One row of the ledger, from either side. Expenses and income are different
 * shapes in the database; this is the shared face the list renders.
 */
type Entry = {
  id: string;
  kind: 'expense' | 'income';
  date: string;
  title: string;
  meta: string;
  baseMinor: number;
  accentIndex: number;
};

/** Screen 03 — the month's ledger, money out and money in, grouped by day. */
export default function SpendScreen() {
  const router = useRouter();
  const profile = useProfile();
  const businesses = useBusinesses();
  const categories = useCategories();
  const receipts = useReceipts();

  const [filter, setFilter] = useState<Filter>({
    businessId: null,
    categoryId: null,
    taxOnly: false,
  });

  const [side, setSide] = useState<Side>('all');
  /** Months back from the current one; 0 is this month. */
  const [monthsBack, setMonthsBack] = useState(0);

  const month = useMemo(() => {
    const d = startOfMonth(new Date());
    d.setMonth(d.getMonth() - monthsBack);
    return d;
  }, [monthsBack]);
  const monthISO = toISODate(month);

  const expenses = useExpenses({ ...filter, month: monthISO });
  const income = useIncome({ businessId: filter.businessId, month: monthISO });
  const base = profile.data?.base_currency ?? 'USD';

  // Category and tax filters only describe expenses, so selecting either drops
  // income from the list rather than showing an unfiltered half.
  const expenseOnlyFilter = filter.categoryId !== null || filter.taxOnly;
  const showOut = side !== 'in';
  const showIn = side !== 'out' && !expenseOnlyFilter;

  const entries = useMemo(() => {
    const rows: Entry[] = [];
    if (showOut) rows.push(...(expenses.data ?? []).map(toExpenseEntry));
    if (showIn) rows.push(...(income.data ?? []).map(toIncomeEntry));
    return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses.data, income.data, showOut, showIn]);

  const outTotal = useMemo(
    () => (expenses.data ?? []).reduce((sum, e) => sum + e.base_minor, 0),
    [expenses.data],
  );
  const inTotal = useMemo(
    () => (income.data ?? []).reduce((sum, i) => sum + i.base_minor, 0),
    [income.data],
  );

  const groups = useMemo(() => groupByDay(entries), [entries]);
  const pending = (receipts.data ?? []).filter((r) => r.status !== 'filed').length;

  const businessLabel = filter.businessId
    ? businesses.data?.find((b) => b.id === filter.businessId)?.name ?? 'Business'
    : `All ${businesses.data?.length ?? 0} businesses`;
  const categoryLabel = filter.categoryId
    ? categories.data?.find((c) => c.id === filter.categoryId)?.name ?? 'Category'
    : 'Category';

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={expenses.isRefetching}
          onRefresh={() => void expenses.refetch()}
        />
      }
    >
      <View style={styles.header}>
        <Text style={text.screenTitle}>
          {side === 'in' ? 'Income' : side === 'out' ? 'Expenses' : 'Ledger'}
        </Text>
        <Text style={[text.subtitle, styles.subtitle]}>
          {`${entries.length} item${entries.length === 1 ? '' : 's'} · ${summaryLine(
            side,
            inTotal,
            outTotal,
            base,
          )} in ${formatMonth(month)}`}
        </Text>
      </View>

      <View style={styles.sideBar}>
        <View style={styles.segment}>
          {SIDES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setSide(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: side === option.value }}
              style={[styles.segmentItem, side === option.value && styles.segmentItemActive]}
            >
              <Text
                style={[styles.segmentLabel, side === option.value && styles.segmentLabelActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.filters}>
        <PillRow>
          <Pill
            label={businessLabel}
            selected={filter.businessId === null}
            onPress={() => cycleBusiness(filter, businesses.data ?? [], setFilter)}
          />
          <Pill label="‹" onPress={() => setMonthsBack((n) => n + 1)} />
          <Pill label={`${formatMonth(month).slice(0, 3)} ${month.getFullYear()}`} />
          <Pill
            label="›"
            selected={monthsBack > 0}
            onPress={() => setMonthsBack((n) => Math.max(0, n - 1))}
          />
          <Pill
            label={categoryLabel}
            selected={filter.categoryId !== null}
            onPress={() => cycleCategory(filter, categories.data ?? [], setFilter)}
          />
          <Pill
            label="Tax"
            selected={filter.taxOnly}
            onPress={() => setFilter((f) => ({ ...f, taxOnly: !f.taxOnly }))}
          />
        </PillRow>
      </View>

      {groups.map((group) => (
        <View key={group.key}>
          <SectionLabel style={styles.groupLabel}>
            {`${group.label} · ${group.total < 0 ? '+' : ''}${formatMoney(
              Math.abs(group.total),
              base,
            )}`}
          </SectionLabel>
          <ListCard>
            {group.items.map((entry) => (
              <Row
                key={`${entry.kind}-${entry.id}`}
                left={
                  <AccentBar tint={businessAccents[entry.accentIndex] ?? businessAccents[0]} />
                }
                title={entry.title}
                meta={entry.meta}
                value={
                  entry.kind === 'income'
                    ? `+${formatMoney(entry.baseMinor, base)}`
                    : formatMoney(entry.baseMinor, base)
                }
                valueColor={entry.kind === 'income' ? color.green : undefined}
                onPress={() =>
                  router.push({
                    pathname: '/add-expense',
                    params: { id: entry.id, kind: entry.kind },
                  })
                }
              />
            ))}
          </ListCard>
        </View>
      ))}

      {expenses.isSuccess && groups.length === 0 ? (
        <Card variant="card" padded style={styles.empty}>
          <Text style={text.body}>
            {`Nothing recorded in ${formatMonth(month)}. Use ‹ to look further back, or tap + to add an entry.`}
          </Text>
        </Card>
      ) : null}

      {pending > 0 ? (
        <View style={styles.banner}>
          <Banner
            tone="green"
            body={`${pending} receipt${pending === 1 ? '' : 's'} waiting to be matched`}
            right={<LinkButton label="Review" onPress={() => router.push('/receipts')} />}
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** Expense -> the shared row shape. */
function toExpenseEntry(expense: ExpenseRow): Entry {
  const title = expense.vendor?.name ?? expense.memo ?? expense.category?.name ?? 'Expense';
  // The title falls back through vendor -> memo -> category, so drop whichever
  // of those it ended up using rather than printing it twice.
  const meta = [
    expense.category?.name,
    expense.business?.short_name ?? expense.business?.name,
    expense.memo,
    expense.is_recurring ? 'recurring' : null,
  ]
    .filter((part): part is string => Boolean(part) && part !== title)
    .join(' · ');

  return {
    id: expense.id,
    kind: 'expense',
    date: expense.spent_on,
    title,
    meta,
    baseMinor: expense.base_minor,
    accentIndex: expense.business?.accent_index ?? 0,
  };
}

/** Income -> the same shape, falling back through client -> memo -> source. */
function toIncomeEntry(row: IncomeRow): Entry {
  const title = row.client?.name ?? row.memo ?? row.source?.name ?? 'Income';
  const meta = [
    row.source?.name,
    row.business?.short_name ?? row.business?.name,
    row.memo,
  ]
    .filter((part): part is string => Boolean(part) && part !== title)
    .join(' · ');

  return {
    id: row.id,
    kind: 'income',
    date: row.received_on,
    title,
    meta,
    baseMinor: row.base_minor,
    accentIndex: row.business?.accent_index ?? 0,
  };
}

/** "3 in · 2 out" style summary under the screen title. */
function summaryLine(side: Side, inTotal: number, outTotal: number, base: string): string {
  if (side === 'in') return `${formatMoney(inTotal, base)} in`;
  if (side === 'out') return `${formatMoney(outTotal, base)} out`;
  return `${formatMoney(inTotal, base)} in · ${formatMoney(outTotal, base)} out`;
}

type DayGroup = { key: string; label: string; total: number; items: Entry[] };

function groupByDay(rows: Entry[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const row of rows) {
    // Money in counts against the day's total, so a day that took more than it
    // spent shows a negative figure, which the label renders as "+".
    const signed = row.kind === 'income' ? -row.baseMinor : row.baseMinor;
    const existing = map.get(row.date);
    if (existing) {
      existing.items.push(row);
      existing.total += signed;
    } else {
      map.set(row.date, {
        key: row.date,
        label: formatDayGroup(row.date),
        total: signed,
        items: [row],
      });
    }
  }
  return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** The design's chips cycle rather than opening a sheet — one tap, next value. */
function cycleBusiness(
  filter: Filter,
  businesses: { id: string }[],
  set: React.Dispatch<React.SetStateAction<Filter>>,
) {
  const ids: (string | null)[] = [null, ...businesses.map((b) => b.id)];
  const next = ids[(ids.indexOf(filter.businessId) + 1) % ids.length];
  set((f) => ({ ...f, businessId: next }));
}

function cycleCategory(
  filter: Filter,
  categories: { id: string }[],
  set: React.Dispatch<React.SetStateAction<Filter>>,
) {
  const ids: (string | null)[] = [null, ...categories.map((c) => c.id)];
  const next = ids[(ids.indexOf(filter.categoryId) + 1) % ids.length];
  set((f) => ({ ...f, categoryId: next }));
}

const styles = themedStyles(() => ({
  sideBar: { marginTop: 16, paddingHorizontal: 22 },
  segment: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha.divider,
  },
  segmentItem: {
    flex: 1,
    height: 34,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: { backgroundColor: color.card },
  segmentLabel: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.muted },
  segmentLabelActive: { color: color.ink },
  header: { paddingHorizontal: gutter.screen },
  subtitle: { marginTop: 4 },
  filters: { marginTop: 16 },
  groupLabel: { marginTop: 20, marginBottom: 8 },
  empty: { marginTop: 20 },
  banner: { marginTop: 18 },
}));
