import React, { useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AccentBar,
  Avatar,
  Banner,
  Button,
  Card,
  InkBarRow,
  InkFigure,
  InkFooter,
  InkFooterText,
  InkLabel,
  InkPanel,
  LinkButton,
  Screen,
  SectionLabel,
} from '@/components';
import { alpha, businessAccents, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import {
  delta,
  formatMoney,
  formatMonthYear,
  formatPercent,
  margin,
} from '@/lib/format';
import { useHomeSummary, useProfile } from '@/data/queries';
import type { HomeBusiness, PLPeriod } from '@/types/db';

const PERIODS: { value: PLPeriod; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
];

const KIND_LABEL: Record<string, string> = {
  retail: 'Retail',
  design: 'Design',
  property: 'Property',
  services: 'Services',
  other: 'Other',
};

/** Screen 01 — combined position across every business. */
export default function HomeScreen() {
  const router = useRouter();
  const profile = useProfile();
  const [period, setPeriod] = useState<PLPeriod>('month');
  const summary = useHomeSummary(undefined, period);

  const data = summary.data;
  const base = profile.data?.base_currency ?? 'USD';
  const revenue = data?.revenue_minor ?? 0;
  const expense = data?.expense_minor ?? 0;
  const net = data?.net_minor ?? 0;

  // IN fills the track; OUT is drawn against IN, as in the export.
  const outRatio = revenue > 0 ? expense / revenue : 0;
  const change = data ? delta(net, data.prev_net_minor) : null;
  const overdue = data?.overdue;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={summary.isRefetching} onRefresh={() => void summary.refetch()} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={text.microLabel}>ALL BUSINESSES</Text>
          <Text style={[text.monthTitle, styles.month]}>
            {period === 'all'
              ? 'All time'
              : period === 'year'
                ? String(new Date().getFullYear())
                : formatMonthYear(data?.month ?? new Date())}
          </Text>
        </View>
        <Avatar
          name={profile.data?.full_name ?? profile.data?.email ?? 'You'}
          background={color.ink}
          tint={color.paper}
        />
      </View>

      <View style={styles.periodBar}>
        <View style={styles.segment}>
          {PERIODS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setPeriod(option.value)}
              accessibilityRole="button"
              accessibilityState={{ selected: period === option.value }}
              style={[styles.segmentItem, period === option.value && styles.segmentItemActive]}
            >
              <Text
                style={[styles.segmentLabel, period === option.value && styles.segmentLabelActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <InkPanel style={styles.hero}>
        <InkLabel>{`NET PROFIT · BASE ${base}`}</InkLabel>
        <InkFigure
          value={formatMoney(net, base)}
          delta={change != null ? `${change >= 0 ? '+' : ''}${formatPercent(change)}` : null}
        />

        <View style={styles.bars}>
          <InkBarRow label="IN" ratio={1} value={formatMoney(revenue, base)} tint={color.greenBright} />
          <InkBarRow label="OUT" ratio={outRatio} value={formatMoney(expense, base)} tint={color.amber} />
        </View>

        <InkFooter>
          <InkFooterText>Margin {formatPercent(margin(net, revenue))}</InkFooterText>
          <InkFooterText>
            Receivables{' '}
            <InkFooterText strong>{formatMoney(data?.receivable_minor ?? 0, base)}</InkFooterText>
          </InkFooterText>
        </InkFooter>
      </InkPanel>

      <SectionLabel
        style={styles.sectionLabel}
        right={<LinkButton label="Compare" onPress={() => router.push('/compare')} />}
      >
        BY BUSINESS
      </SectionLabel>

      <View style={styles.businessList}>
        {(data?.businesses ?? []).map((business) => (
          <BusinessCard
            key={business.id}
            business={business}
            baseCurrency={base}
            onPress={() => router.push({ pathname: '/pl', params: { businessId: business.id } })}
          />
        ))}
        {summary.isSuccess && (data?.businesses.length ?? 0) === 0 ? (
          <Card variant="card" padded inset={false}>
            <Text style={text.body}>
              Add your first business to start tracking spend, profit and invoices.
              You can add as many as you run.
            </Text>
            <Button
              label="Add a business"
              height={44}
              style={styles.seedButton}
              onPress={() => router.push('/business/new')}
            />
          </Card>
        ) : null}
      </View>

      {overdue && overdue.count > 0 ? (
        <View style={styles.alert}>
          <Banner
            tone="amber"
            title={`${overdue.count} invoice${overdue.count === 1 ? '' : 's'} overdue`}
            body={`${formatMoney(overdue.total_minor, base)} · ${overdue.names.join(', ')}`}
            right={<LinkButton label="Chase" onPress={() => router.push('/(tabs)/billing')} />}
          />
        </View>
      ) : null}
    </Screen>
  );
}

function BusinessCard({
  business,
  baseCurrency,
  onPress,
}: {
  business: HomeBusiness;
  baseCurrency: string;
  onPress: () => void;
}) {
  const tint = businessAccents[business.accent_index] ?? businessAccents[0];
  // Cards show the business's own currency; the hero above is already in base.
  const native = business.currency !== baseCurrency;
  const value = native
    ? formatMoney(business.net_native_minor, business.currency)
    : formatMoney(business.net_minor, baseCurrency);

  return (
    <Card variant="card" inset={false} onPress={onPress} style={styles.businessCard}>
      <AccentBar tint={tint} height={34} width={8} />
      <View style={styles.businessBody}>
        <Text style={text.cardTitle} numberOfLines={1}>
          {business.name}
        </Text>
        <Text style={[text.cardMeta, styles.businessMeta]} numberOfLines={1}>
          {`${KIND_LABEL[business.kind] ?? 'Other'} · ${business.currency} · ${business.expense_count} expense${
            business.expense_count === 1 ? '' : 's'
          }`}
        </Text>
      </View>
      <View style={styles.businessValue}>
        <Text style={styles.businessNet}>{value}</Text>
        <Text style={styles.businessMargin}>
          {formatPercent(margin(business.net_minor, business.revenue_minor))} margin
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  periodBar: { marginTop: 14, paddingHorizontal: gutter.screen },
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
  header: {
    paddingHorizontal: gutter.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  month: { marginTop: 4 },
  hero: { marginTop: 18 },
  bars: { marginTop: 16, gap: 9 },
  sectionLabel: { marginTop: 22 },
  businessList: { marginTop: 10, paddingHorizontal: gutter.screen, gap: 8 },
  businessCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, paddingHorizontal: 16 },
  businessBody: { flex: 1, minWidth: 0 },
  businessMeta: { marginTop: 2 },
  businessValue: { alignItems: 'flex-end' },
  businessNet: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink },
  businessMargin: { marginTop: 2, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
  alert: { marginTop: 18 },
  seedButton: { marginTop: 14 },
});
