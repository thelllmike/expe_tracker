import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Screen, ScreenHeader, SectionLabel } from '@/components';
import { GroupedBarChart, ShareBar } from '@/charts';
import type { GroupedSeries, ShareSlice } from '@/charts';
import { alpha, businessAccents, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatMonthShort, formatMonthYear, formatMoney, formatPercent, margin } from '@/lib/format';
import { useHomeSummary, useNetTrend, useProfile } from '@/data/queries';

/** Screen 05 — every business side by side, converted to base currency. */
export default function CompareScreen() {
  const profile = useProfile();
  const summary = useHomeSummary();
  const trend = useNetTrend(null, 3);

  const base = profile.data?.base_currency ?? 'USD';
  const businesses = useMemo(() => summary.data?.businesses ?? [], [summary.data]);

  const slices: ShareSlice[] = businesses.map((b) => ({
    label: b.name,
    value: Math.max(0, b.net_minor),
    tint: businessAccents[b.accent_index] ?? businessAccents[0],
  }));

  // net_trend returns one row per business per month; pivot into series.
  const { labels, series } = useMemo(() => {
    const rows = trend.data ?? [];
    const months = [...new Set(rows.map((r) => r.month))].sort();
    const byBusiness: GroupedSeries[] = businesses.map((b) => ({
      tint: businessAccents[b.accent_index] ?? businessAccents[0],
      values: months.map(
        (m) => rows.find((r) => r.business_id === b.id && r.month === m)?.net_minor ?? 0,
      ),
    }));
    return { labels: months.map(formatMonthShort), series: byBusiness };
  }, [trend.data, businesses]);

  const insight = useMemo(() => buildInsight(businesses, base), [businesses, base]);

  return (
    <Screen>
      <ScreenHeader
        title="Side by side"
        subtitle={`${formatMonthYear(summary.data?.month ?? new Date())} · converted to ${base}`}
      />

      <Card style={styles.table}>
        <View style={styles.tableHead}>
          <Text style={[text.tableHead, styles.colName]}>BUSINESS</Text>
          <Text style={[text.tableHead, styles.colNet]}>NET</Text>
          <Text style={[text.tableHead, styles.colMargin]}>MARGIN</Text>
        </View>

        {businesses.map((business, i) => (
          <View
            key={business.id}
            style={[styles.tableRow, i < businesses.length - 1 && styles.tableRowDivided]}
          >
            <View style={[styles.colName, styles.nameCell]}>
              <View
                style={[
                  styles.stripe,
                  { backgroundColor: businessAccents[business.accent_index] ?? businessAccents[0] },
                ]}
              />
              <View style={styles.flexShrink}>
                <Text style={styles.businessName} numberOfLines={1}>
                  {business.name}
                </Text>
                <Text style={styles.businessIn}>{formatMoney(business.revenue_minor, base)} in</Text>
              </View>
            </View>
            <Text style={[styles.netCell, styles.colNet]}>
              {formatMoney(business.net_minor, base)}
            </Text>
            <Text style={[styles.marginCell, styles.colMargin]}>
              {formatPercent(margin(business.net_minor, business.revenue_minor))}
            </Text>
          </View>
        ))}

        {businesses.length === 0 ? (
          <View style={styles.tableRow}>
            <Text style={text.body}>Nothing to compare yet.</Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.block}>
        <SectionLabel style={styles.noPad}>SHARE OF NET PROFIT</SectionLabel>
        <View style={styles.chart}>
          <ShareBar slices={slices} />
        </View>
      </View>

      <View style={styles.blockWide}>
        <SectionLabel style={styles.noPad}>NET TREND</SectionLabel>
        <View style={styles.chart}>
          <GroupedBarChart labels={labels} series={series} />
        </View>
      </View>

      {insight ? (
        <Card variant="card" padded style={styles.insight}>
          <Text style={text.body}>{insight}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

/**
 * The design ends on a written takeaway. Derive the equivalent sentence rather
 * than hard-coding the mock's copy: who earns most, and on what share of revenue.
 */
function buildInsight(
  businesses: { name: string; net_minor: number; revenue_minor: number }[],
  base: string,
): string | null {
  if (businesses.length < 2) return null;

  const ranked = [...businesses].sort((a, b) => b.net_minor - a.net_minor);
  const [top, second] = ranked;
  if (top.net_minor <= 0) return null;

  const totalRevenue = businesses.reduce((sum, b) => sum + b.revenue_minor, 0);
  const share = totalRevenue > 0 ? top.revenue_minor / totalRevenue : 0;
  const topMargin = margin(top.net_minor, top.revenue_minor);
  const secondMargin = margin(second.net_minor, second.revenue_minor);

  const lead =
    top.net_minor > second.net_minor
      ? `${top.name} leads on ${formatMoney(top.net_minor, base)} net`
      : `${top.name} and ${second.name} are level`;

  const revenueNote = ` from ${formatPercent(share, 0)} of revenue.`;

  const marginNote =
    topMargin != null && secondMargin != null && topMargin > secondMargin
      ? ` Its ${formatPercent(topMargin)} margin is the widest of the ${spell(businesses.length)}.`
      : secondMargin != null && topMargin != null && secondMargin > topMargin
        ? ` ${second.name} runs the wider margin at ${formatPercent(secondMargin)}.`
        : '';

  return lead + revenueNote + marginNote;
}

/** Small counts read better spelled out in prose. */
function spell(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] ?? String(n);
}

const styles = StyleSheet.create({
  table: { marginTop: 18 },
  tableHead: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    flexDirection: 'row',
    backgroundColor: color.line,
  },
  tableRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableRowDivided: { borderBottomWidth: 1, borderBottomColor: alpha.divider },
  colName: { flex: 1 },
  colNet: { width: 74, textAlign: 'right' },
  colMargin: { width: 56, textAlign: 'right' },
  nameCell: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  flexShrink: { flexShrink: 1 },
  stripe: { width: 6, height: 24, borderRadius: radius.pill },
  businessName: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.ink },
  businessIn: { fontFamily: font.sans, fontSize: 11, color: color.muted },
  netCell: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  marginCell: { fontFamily: font.sans, fontSize: 13, color: color.muted },

  block: { marginTop: 20, paddingHorizontal: gutter.screen },
  blockWide: { marginTop: 22, paddingHorizontal: gutter.screen },
  noPad: { paddingHorizontal: 0 },
  chart: { marginTop: 12 },
  insight: { marginTop: 20 },
});
