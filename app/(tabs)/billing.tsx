import React, { useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Card,
  Pill,
  PillRow,
  Screen,
  ScreenHeader,
  invoiceBadge,
} from '@/components';
import { alpha, color, gutter } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatMoney } from '@/lib/format';
import { useInvoices, useProfile } from '@/data/queries';
import type { InvoiceRow } from '@/data/queries';

type Tab = 'all' | 'overdue' | 'sent' | 'paid';

/** Screen 06 — invoices across every business. */
export default function BillingScreen() {
  const router = useRouter();
  const profile = useProfile();
  const invoices = useInvoices();
  const [tab, setTab] = useState<Tab>('all');

  const base = profile.data?.base_currency ?? 'USD';
  const rows = useMemo(() => invoices.data ?? [], [invoices.data]);

  const counts = useMemo(
    () => ({
      overdue: rows.filter((i) => i.display_status === 'overdue').length,
      sent: rows.filter((i) => i.display_status === 'sent').length,
      paid: rows.filter((i) => i.display_status === 'paid').length,
    }),
    [rows],
  );

  // Outstanding is everything issued and not yet paid, in base currency.
  const outstanding = rows
    .filter((i) => i.status === 'sent')
    .reduce((sum, i) => sum + i.base_total_minor, 0);

  // The design orders by urgency: overdue first (soonest-late at the top), then
  // live invoices, with paid and draft settled at the bottom.
  const rank = (invoice: InvoiceRow) =>
    invoice.display_status === 'overdue' ? 0
      : invoice.display_status === 'sent' ? 1
      : invoice.display_status === 'draft' ? 2
      : 3;

  const visible = rows.filter((invoice) => {
    if (tab === 'all') return invoice.status !== 'void';
    if (tab === 'overdue') return invoice.display_status === 'overdue';
    if (tab === 'sent') return invoice.display_status === 'sent';
    return invoice.display_status === 'paid';
  }).sort((a, b) => rank(a) - rank(b) || a.days_overdue - b.days_overdue);

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={invoices.isRefetching} onRefresh={() => void invoices.refetch()} />
      }
    >
      <ScreenHeader
        title="Invoices"
        subtitle={`${formatMoney(outstanding, base)} outstanding`}
        right={<Pill label="New" large selected onPress={() => router.push('/invoice/new')} />}
      />

      <View style={styles.filters}>
        <PillRow>
          <Pill label="All" selected={tab === 'all'} onPress={() => setTab('all')} />
          <Pill
            label={counts.overdue ? `Overdue ${counts.overdue}` : 'Overdue'}
            selected={tab === 'overdue'}
            onPress={() => setTab('overdue')}
          />
          <Pill
            label={counts.sent ? `Sent ${counts.sent}` : 'Sent'}
            selected={tab === 'sent'}
            onPress={() => setTab('sent')}
          />
          <Pill label="Paid" selected={tab === 'paid'} onPress={() => setTab('paid')} />
        </PillRow>
      </View>

      <View style={styles.list}>
        {visible.map((invoice) => (
          <InvoiceCard
            key={invoice.id}
            invoice={invoice}
            onPress={() => router.push(`/invoice/${invoice.id}/preview`)}
          />
        ))}

        {invoices.isSuccess && visible.length === 0 ? (
          <Card variant="card" padded inset={false}>
            <Text style={text.body}>
              {tab === 'all' ? 'No invoices yet. Tap New to raise one.' : 'Nothing in this state.'}
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function InvoiceCard({ invoice, onPress }: { invoice: InvoiceRow; onPress: () => void }) {
  const badge = invoiceBadge(invoice);
  const overdue = invoice.display_status === 'overdue';
  const paid = invoice.display_status === 'paid';

  return (
    <Card
      variant="card"
      inset={false}
      onPress={onPress}
      borderColor={overdue ? alpha.redBorder : undefined}
      style={[styles.card, paid && styles.cardPaid]}
    >
      <View style={styles.cardTop}>
        <Text style={text.cardTitle} numberOfLines={1}>
          {invoice.client?.name ?? 'No client'}
        </Text>
        <Text style={styles.amount}>{formatMoney(invoice.total_minor, invoice.currency)}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.meta} numberOfLines={1}>
          {[invoice.number, invoice.business?.name, invoice.is_recurring ? 'monthly' : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <Badge label={badge.label} tone={badge.tone} />
      </View>
    </Card>
  );
}

const styles = themedStyles(() => ({
  filters: { marginTop: 16 },
  list: { marginTop: 18, paddingHorizontal: gutter.screen, gap: 8 },
  card: { paddingVertical: 15, paddingHorizontal: 16 },
  // The export dims settled invoices to 0.75.
  cardPaid: { opacity: 0.75 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  cardBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  amount: { fontFamily: font.serif, fontSize: 20, color: color.ink },
  meta: { flexShrink: 1, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
}));
