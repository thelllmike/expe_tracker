import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
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
import { businessAccents, gutter } from '@/theme/tokens';
import { text } from '@/theme/type';
import { formatDayGroup, formatMoney, formatMonth } from '@/lib/format';
import { useBusinesses, useCategories, useExpenses, useProfile, useReceipts } from '@/data/queries';
import type { ExpenseRow } from '@/data/queries';

type Filter = { businessId: string | null; categoryId: string | null; taxOnly: boolean };

/** Screen 03 — the month's ledger, grouped by day. */
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

  const expenses = useExpenses(filter);
  const base = profile.data?.base_currency ?? 'USD';

  const total = useMemo(
    () => (expenses.data ?? []).reduce((sum, e) => sum + e.base_minor, 0),
    [expenses.data],
  );

  const groups = useMemo(() => groupByDay(expenses.data ?? []), [expenses.data]);
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
        <Text style={text.screenTitle}>Expenses</Text>
        <Text style={[text.subtitle, styles.subtitle]}>
          {`${expenses.data?.length ?? 0} item${expenses.data?.length === 1 ? '' : 's'} · ${formatMoney(
            total,
            base,
          )} in ${formatMonth(new Date())}`}
        </Text>
      </View>

      <View style={styles.filters}>
        <PillRow>
          <Pill
            label={businessLabel}
            selected={filter.businessId === null}
            onPress={() => cycleBusiness(filter, businesses.data ?? [], setFilter)}
          />
          <Pill label={formatMonth(new Date()).slice(0, 3) + ' ' + new Date().getFullYear()} />
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
            {`${group.label} · ${formatMoney(group.total, base)}`}
          </SectionLabel>
          <ListCard>
            {group.items.map((expense) => {
              const title =
                expense.vendor?.name ?? expense.memo ?? expense.category?.name ?? 'Expense';
              return (
                <Row
                  key={expense.id}
                  left={
                    <AccentBar
                      tint={
                        businessAccents[expense.business?.accent_index ?? 0] ?? businessAccents[0]
                      }
                    />
                  }
                  title={title}
                  meta={expenseMeta(expense, title)}
                  value={formatMoney(expense.base_minor, base)}
                />
              );
            })}
          </ListCard>
        </View>
      ))}

      {expenses.isSuccess && groups.length === 0 ? (
        <Card variant="card" padded style={styles.empty}>
          <Text style={text.body}>
            Nothing recorded for this month yet. Tap + to add your first expense.
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

/** "Cost of goods · Maple & Co · Unit 3B" */
function expenseMeta(expense: ExpenseRow, title: string): string {
  // The title falls back through vendor -> memo -> category, so drop whichever
  // of those it ended up using rather than printing it twice.
  return [
    expense.category?.name,
    expense.business?.short_name ?? expense.business?.name,
    expense.memo,
    expense.is_recurring ? 'recurring' : null,
  ]
    .filter((part): part is string => Boolean(part) && part !== title)
    .join(' · ');
}

type DayGroup = { key: string; label: string; total: number; items: ExpenseRow[] };

function groupByDay(rows: ExpenseRow[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const row of rows) {
    const existing = map.get(row.spent_on);
    if (existing) {
      existing.items.push(row);
      existing.total += row.base_minor;
    } else {
      map.set(row.spent_on, {
        key: row.spent_on,
        label: formatDayGroup(row.spent_on),
        total: row.base_minor,
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

const styles = StyleSheet.create({
  header: { paddingHorizontal: gutter.screen },
  subtitle: { marginTop: 4 },
  filters: { marginTop: 16 },
  groupLabel: { marginTop: 20, marginBottom: 8 },
  empty: { marginTop: 20 },
  banner: { marginTop: 18 },
});
