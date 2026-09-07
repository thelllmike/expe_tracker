import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Card,
  InkFigure,
  InkLabel,
  InkPanel,
  PickerSheet,
  Pill,
  ProgressRow,
  Screen,
  SectionLabel,
  StatRow,
  StatTile,
} from '@/components';
import type { PickerOption } from '@/components';
import { BarChart } from '@/charts';
import { businessAccents, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatMonth, formatMonthShort, formatMoney, formatPercent, margin } from '@/lib/format';
import { useBusinesses, useNetTrend, usePLSummary, useProfile } from '@/data/queries';

/** Screen 04 — monthly P&L for one business. */
export default function PLScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string }>();
  const businesses = useBusinesses();
  const profile = useProfile();

  const [override, setOverride] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const businessId = override ?? params.businessId ?? businesses.data?.[0]?.id;
  const business = businesses.data?.find((b) => b.id === businessId);

  const pl = usePLSummary(businessId);
  const trend = useNetTrend(businessId ?? null, 6);
  const base = profile.data?.base_currency ?? 'USD';

  const revenue = pl.data?.revenue_minor ?? 0;
  const expenses = pl.data?.expense_minor ?? 0;
  const net = pl.data?.net_minor ?? 0;

  const bars = useMemo(
    () =>
      (trend.data ?? []).map((row) => ({
        label: formatMonthShort(row.month),
        value: row.net_minor,
      })),
    [trend.data],
  );

  // Category bars are scaled against the largest category, as in the export.
  const categories = pl.data?.categories ?? [];
  const peak = categories.length ? Math.max(...categories.map((c) => c.total_minor)) : 0;
  const accent = businessAccents[business?.accent_index ?? 0] ?? businessAccents[0];

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.switcher, pressed && styles.pressed]}
          >
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <Text style={styles.switcherLabel} numberOfLines={1}>
              {business?.name ?? 'Business'}
            </Text>
            <Text style={styles.switcherChevron}>›</Text>
          </Pressable>
          <Text style={[text.plTitle, styles.title]}>
            {`P&L · ${formatMonth(pl.data?.month ?? new Date())}`}
          </Text>
        </View>
        <Pill label="Export" onPress={() => router.push('/reports')} />
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

      <View style={styles.chartBlock}>
        <SectionLabel style={styles.noPad}>NET · LAST 6 MONTHS</SectionLabel>
        <View style={styles.chart}>
          <BarChart data={bars} />
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
            <Text style={text.body}>No expenses recorded for this month.</Text>
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
          <Text style={text.body}>Could not load the figures for this month.</Text>
        </Card>
      ) : null}

      <PickerSheet
        visible={picking}
        title="Business"
        options={(businesses.data ?? []).map<PickerOption<string>>((b) => ({
          value: b.id,
          label: b.name,
          meta: `${b.currency}`,
        }))}
        selected={businessId ?? null}
        onSelect={setOverride}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
