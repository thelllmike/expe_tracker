import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AccentBar,
  Card,
  InkFigure,
  InkLabel,
  InkPanel,
  ListCard,
  PickerSheet,
  Pill,
  ProgressRow,
  Row,
  Screen,
  SectionLabel,
  StatRow,
  StatTile,
} from '@/components';
import type { PickerOption } from '@/components';
import type { PLPeriod, PLSummary } from '@/types/db';
import { BarChart } from '@/charts';
import { alpha, businessAccents, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import {
  formatDay,
  formatMonth,
  formatMonthShort,
  formatMoney,
  formatPercent,
  margin,
  toISODate,
} from '@/lib/format';
import {
  combinePLSummaries,
  useBusinesses,
  useNetTrend,
  usePLSummaries,
  usePLSummary,
  useProfile,
} from '@/data/queries';

/** Sentinel for the consolidated view; never a real business id. */
const ALL = 'all';

/** Upper bound on history; months with nothing in them are trimmed below. */
const TREND_MONTHS = 36;

const PERIODS: { value: PLPeriod; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

/** Screen 04 — P&L for one business over a day, a week or a month. */
export default function PLScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string }>();
  const businesses = useBusinesses();
  const profile = useProfile();

  const [override, setOverride] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [period, setPeriod] = useState<PLPeriod>('month');
  /** How many periods back from the current one; 0 is today / this week / this month. */
  const [stepsBack, setStepsBack] = useState(0);

  // Any date inside the period will do — the function truncates it.
  const anchor = useMemo(() => {
    const d = new Date();
    if (period === 'day') d.setDate(d.getDate() - stepsBack);
    else if (period === 'week') d.setDate(d.getDate() - stepsBack * 7);
    else if (period === 'year') d.setFullYear(d.getFullYear() - stepsBack);
    else if (period === 'month') d.setMonth(d.getMonth() - stepsBack);
    return toISODate(d);
  }, [period, stepsBack]);

  // Arriving without a business (from the menu) opens the consolidated view;
  // arriving from a business card keeps that business selected.
  const businessId = override ?? params.businessId ?? ALL;
  const isAll = businessId === ALL;
  const business = businesses.data?.find((b) => b.id === businessId);
  const allIds = useMemo(() => (businesses.data ?? []).map((b) => b.id), [businesses.data]);

  const single = usePLSummary(isAll ? undefined : businessId, anchor, period);
  const many = usePLSummaries(isAll ? allIds : [], anchor, period);

  const combined = useMemo(
    () => combinePLSummaries(many.map((q) => q.data).filter(Boolean) as PLSummary[]),
    [many],
  );

  // One face for both modes, so everything below reads from `pl`.
  const pl = isAll
    ? {
        data: combined ?? undefined,
        isError: many.some((q) => q.isError),
      }
    : { data: single.data, isError: single.isError };

  /** Net per business, for the breakdown the consolidated view adds. */
  const perBusiness = useMemo(() => {
    if (!isAll) return [];
    return (businesses.data ?? [])
      .map((b, i) => ({ business: b, summary: many[i]?.data }))
      .filter((row) => row.summary)
      .map((row) => ({
        id: row.business.id,
        name: row.business.name,
        accentIndex: row.business.accent_index,
        revenue: row.summary!.revenue_minor,
        expense: row.summary!.expense_minor,
        net: row.summary!.net_minor,
      }))
      .sort((a, b) => b.net - a.net);
  }, [isAll, businesses.data, many]);

  // Ask for a wide window and trim the empty lead-in, so the chart covers every
  // month that actually has entries rather than a fixed six.
  const trend = useNetTrend(isAll ? null : businessId, TREND_MONTHS);
  const base = profile.data?.base_currency ?? 'USD';

  const revenue = pl.data?.revenue_minor ?? 0;
  const expenses = pl.data?.expense_minor ?? 0;
  const net = pl.data?.net_minor ?? 0;

  // net_trend returns one row per business per month, so the consolidated view
  // has to add the months up — plotting the rows raw gave a bar per business.
  const bars = useMemo(() => {
    const rows = trend.data ?? [];
    if (!isAll) {
      return rows.map((row) => ({ label: formatMonthShort(row.month), value: row.net_minor }));
    }
    const byMonth = new Map<string, number>();
    for (const row of rows) {
      byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.net_minor);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([month, value]) => ({ label: formatMonthShort(month), value }));
  }, [trend.data, isAll]);

  // Everything before the first month with activity is padding from the RPC's
  // generated series; dropping it keeps the chart to real history.
  const history = useMemo(() => {
    const firstReal = bars.findIndex((b) => b.value !== 0);
    return firstReal <= 0 ? bars : bars.slice(firstReal);
  }, [bars]);

  // Category bars are scaled against the largest category, as in the export.
  const categories = pl.data?.categories ?? [];
  const peak = categories.length ? Math.max(...categories.map((c) => c.total_minor)) : 0;
  const sources = pl.data?.sources ?? [];
  const sourcePeak = sources.length ? Math.max(...sources.map((x) => x.total_minor)) : 0;
  const periodNoun =
    period === 'day'
      ? 'day'
      : period === 'week'
        ? 'week'
        : period === 'year'
          ? 'year'
          : period === 'all'
            ? 'period'
            : 'month';
  const accent = businessAccents[business?.accent_index ?? 0] ?? businessAccents[0];
  const periodFrom = (isAll ? many.find((q) => q.data)?.data?.from : pl.data?.from) ?? undefined;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.switcher, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.dot,
                { backgroundColor: isAll ? color.ink : accent },
              ]}
            />
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {isAll ? `All ${allIds.length} businesses` : business?.name ?? 'Business'}
            </Text>
            <Text style={styles.switcherChevron}>›</Text>
          </Pressable>
          <Text style={[text.plTitle, styles.title]}>
            {`P&L · ${periodLabel(period, periodFrom)}`}
          </Text>
        </View>
        <Pill label="Export" onPress={() => router.push('/reports')} />
      </View>

      <View style={styles.periodBar}>
        <View style={styles.segment}>
          {PERIODS.map((p) => (
            <Pressable
              key={p.value}
              onPress={() => {
                setPeriod(p.value);
                setStepsBack(0);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: period === p.value }}
              style={[styles.segmentItem, period === p.value && styles.segmentItemActive]}
            >
              <Text
                style={[styles.segmentLabel, period === p.value && styles.segmentLabelActive]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={[styles.stepper, period === 'all' && styles.stepperHidden]}>
          <Pressable
            onPress={() => setStepsBack((n) => n + 1)}
            disabled={period === 'all'}
            accessibilityRole="button"
            accessibilityLabel="Previous period"
            style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
          >
            <Text style={styles.stepGlyph}>‹</Text>
          </Pressable>
          <Pressable
            onPress={() => setStepsBack((n) => Math.max(0, n - 1))}
            disabled={stepsBack === 0}
            accessibilityRole="button"
            accessibilityLabel="Next period"
            style={({ pressed }) => [
              styles.stepButton,
              stepsBack === 0 && styles.stepButtonDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.stepGlyph}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tiles}>
        <StatRow>
          <StatTile label="REVENUE" value={formatMoney(revenue, base)} serif />
          <StatTile label="EXPENSES" value={formatMoney(expenses, base)} serif />
        </StatRow>
      </View>

      <InkPanel variant="card" style={styles.netPanel}>
        <View style={styles.netRow}>
          <View>
            <InkLabel small>NET PROFIT</InkLabel>
            <InkFigure value={formatMoney(net, base)} size={30} />
          </View>
          <View style={styles.netRight}>
            <InkLabel small>MARGIN</InkLabel>
            <InkFigure
              value={formatPercent(margin(net, revenue))}
              size={30}
              tint={color.greenBright}
            />
          </View>
        </View>
      </InkPanel>

      {isAll && perBusiness.length > 0 ? (
        <View style={styles.chartBlock}>
          <SectionLabel style={styles.noPad}>BY BUSINESS</SectionLabel>
          <ListCard style={styles.byBusiness}>
            {perBusiness.map((row) => (
              <Row
                key={row.id}
                left={
                  <AccentBar
                    tint={businessAccents[row.accentIndex] ?? businessAccents[0]}
                  />
                }
                title={row.name}
                meta={`${formatMoney(row.revenue, base)} in · ${formatMoney(
                  row.expense,
                  base,
                )} out`}
                value={formatMoney(row.net, base)}
                valueColor={row.net < 0 ? color.red : color.green}
                valueMeta={formatPercent(margin(row.net, row.revenue))}
                onPress={() => setOverride(row.id)}
              />
            ))}
          </ListCard>
        </View>
      ) : null}

      <View style={styles.chartBlock}>
        <SectionLabel style={styles.noPad}>
          {history.length > 1 ? `NET · ${history.length} MONTHS` : 'NET BY MONTH'}
        </SectionLabel>
        <View style={styles.chart}>
          <BarChart data={history} />
        </View>
      </View>

      <View style={styles.chartBlock}>
        <SectionLabel style={styles.noPad}>WHERE IT CAME FROM</SectionLabel>
        <View style={styles.categories}>
          {sources.slice(0, 5).map((entry) => (
            <ProgressRow
              key={entry.name}
              label={entry.name}
              ratio={sourcePeak > 0 ? entry.total_minor / sourcePeak : 0}
              value={formatMoney(entry.total_minor, base)}
            />
          ))}
          {sources.length === 0 ? (
            <Text style={text.body}>{`No income recorded for this ${periodNoun}.`}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.chartBlock}>
        <SectionLabel style={styles.noPad}>WHERE IT WENT</SectionLabel>
        <View style={styles.categories}>
          {categories.slice(0, 5).map((category) => (
            <ProgressRow
              key={category.name}
              label={category.name}
              ratio={peak > 0 ? category.total_minor / peak : 0}
              value={formatMoney(category.total_minor, base)}
            />
          ))}
          {categories.length === 0 ? (
            <Text style={text.body}>{`No expenses recorded for this ${periodNoun}.`}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.tiles}>
        <StatRow>
          <StatTile
            label="TAX PAYABLE"
            value={formatMoney(pl.data?.tax_payable_minor ?? 0, base)}
            meta={`${formatMoney(pl.data?.tax_collected_minor ?? 0, base, { bare: true })} out · ${formatMoney(
              pl.data?.tax_recoverable_minor ?? 0,
              base,
              { bare: true },
            )} in`}
          />
          <StatTile
            label="CASH POSITION"
            value={formatMoney(
              (pl.data?.cash_hand_minor ?? 0) + (pl.data?.cash_bank_minor ?? 0),
              base,
            )}
            meta={`${formatMoney(pl.data?.cash_hand_minor ?? 0, base, { bare: true })} hand · ${formatMoney(
              pl.data?.cash_bank_minor ?? 0,
              base,
              { bare: true },
            )} bank`}
          />
        </StatRow>
      </View>

      {pl.isError ? (
        <Card variant="card" padded style={styles.tiles}>
          <Text style={text.body}>{`Could not load the figures for this ${periodNoun}.`}</Text>
        </Card>
      ) : null}

      <PickerSheet
        visible={picking}
        title="Business"
        options={[
          { value: ALL, label: `All ${allIds.length} businesses` },
          ...(businesses.data ?? []).map<PickerOption<string>>((b) => ({
            value: b.id,
            label: b.name,
            meta: `${b.currency}`,
          })),
        ]}
        selected={businessId ?? null}
        onSelect={setOverride}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  periodBar: {
    marginTop: 18,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  segment: {
    flex: 1,
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
  stepper: { flexDirection: 'row', gap: 6 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: alpha.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonDisabled: { opacity: 0.35 },
  stepperHidden: { opacity: 0, pointerEvents: 'none' },
  byBusiness: { marginTop: 12 },
  stepGlyph: { fontFamily: font.sans, fontSize: 17, color: color.ink, lineHeight: 20 },
  header: {
    paddingHorizontal: gutter.screen,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: { flexShrink: 1 },
  switcher: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  switcherLabel: { fontFamily: font.sansSemi, fontSize: 12.5, color: color.muted },
  switcherChevron: { fontSize: 15, color: color.muted },
  title: { marginTop: 5 },

  tiles: { marginTop: 16, paddingHorizontal: gutter.screen },
  netPanel: { marginTop: 8 },
  netRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  netRight: { alignItems: 'flex-end' },

  chartBlock: { marginTop: 20, paddingHorizontal: gutter.screen },
  noPad: { paddingHorizontal: 0 },
  chart: { marginTop: 12 },
  categories: { marginTop: 12, gap: 10 },
  pressed: { opacity: 0.6 },
});

/** "Today · 16 Sep" / "Week of 15 Sep" / "September 2026". */
function periodLabel(period: PLPeriod, from: string | undefined): string {
  if (period === 'all') return 'All time';
  if (!from) return '—';
  if (period === 'year') return new Date(`${from}T00:00:00`).getFullYear().toString();
  // The RPC returns a bare date; parsing it as UTC keeps it off the previous day
  // for anyone behind Greenwich.
  const start = new Date(`${from}T00:00:00`);
  if (period === 'month') return formatMonth(start);
  if (period === 'week') return `Week of ${formatDay(start)}`;

  const today = new Date();
  const sameDay =
    start.getFullYear() === today.getFullYear() &&
    start.getMonth() === today.getMonth() &&
    start.getDate() === today.getDate();
  return sameDay ? `Today · ${formatDay(start)}` : formatDay(start, true);
}
