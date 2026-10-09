import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Badge,
  Card,
  PillButton,
  Pill,
  PillRow,
  Screen,
  ScreenHeader,
  quotationBadge,
} from '@/components';
import { alpha, color, gutter } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatMoney } from '@/lib/format';
import { shareDocument } from '@/lib/documents';
import { useQuotations } from '@/data/queries';
import type { QuotationRow } from '@/data/queries';
import { useConvertQuotation } from '@/data/mutations';

type Tab = 'all' | 'sent' | 'accepted' | 'draft';

/** Screen 12 — quotations across every business. */
export default function QuotationsScreen() {
  const router = useRouter();
  const quotations = useQuotations();
  const convert = useConvertQuotation();
  const [sharing, setSharing] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');

  const rows = useMemo(() => quotations.data ?? [], [quotations.data]);

  const { quotedTotal, awaiting, sentCount } = useMemo(() => {
    const open = rows.filter((q) => q.status === 'sent' || q.status === 'accepted');
    return {
      // Quoted value is shown in each quote's own currency in the design; the
      // headline sums the numeric totals as a single running figure.
      quotedTotal: open.reduce((sum, q) => sum + q.total_minor, 0),
      awaiting: rows.filter((q) => q.status === 'sent').length,
      sentCount: rows.filter((q) => q.status === 'sent').length,
    };
  }, [rows]);

  const visible = rows.filter((quote) => {
    if (tab === 'all') return true;
    if (tab === 'sent') return quote.status === 'sent';
    if (tab === 'accepted') return quote.status === 'accepted';
    return quote.status === 'draft';
  });

  const onShare = async (id: string) => {
    setSharing(id);
    try {
      await shareDocument('quotation', id);
    } catch (e) {
      Alert.alert(
        'Could not share the PDF',
        e instanceof Error
          ? `${e.message}\n\nIf the function is missing, deploy it with:\nsupabase functions deploy generate-invoice-pdf`
          : 'Unknown error.',
      );
    } finally {
      setSharing(null);
    }
  };

  const onConvert = async (quote: QuotationRow) => {
    try {
      const invoice = await convert.mutateAsync(quote.id);
      router.push(`/invoice/${invoice.id}/preview`);
    } catch (e) {
      Alert.alert('Could not convert', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={quotations.isRefetching}
          onRefresh={() => void quotations.refetch()}
        />
      }
    >
      <ScreenHeader
        title="Quotations"
        subtitle={`${formatMoney(quotedTotal)} quoted · ${awaiting} awaiting reply`}
        right={<Pill label="New" large selected onPress={() => router.push('/quotations/new')} />}
      />

      <View style={styles.filters}>
        <PillRow>
          <Pill label="All" selected={tab === 'all'} onPress={() => setTab('all')} />
          <Pill
            label={sentCount ? `Sent ${sentCount}` : 'Sent'}
            selected={tab === 'sent'}
            onPress={() => setTab('sent')}
          />
          <Pill label="Accepted" selected={tab === 'accepted'} onPress={() => setTab('accepted')} />
          <Pill label="Draft" selected={tab === 'draft'} onPress={() => setTab('draft')} />
        </PillRow>
      </View>

      <View style={styles.list}>
        {visible.map((quote) => {
          const badge = quotationBadge(quote);
          const accepted = quote.status === 'accepted';
          const converted = Boolean(quote.converted_invoice_id);

          return (
            <Card
              key={quote.id}
              variant="card"
              inset={false}
              borderColor={accepted ? alpha.greenBorder : undefined}
              style={[styles.card, quote.status === 'draft' && styles.cardDraft]}
            >
              <View style={styles.cardTop}>
                <Text style={text.cardTitle} numberOfLines={1}>
                  {quote.client?.name ?? 'No client'}
                </Text>
                <Text style={styles.amount}>{formatMoney(quote.total_minor, quote.currency)}</Text>
              </View>

              <View style={styles.cardBottom}>
                <Text style={styles.meta} numberOfLines={1}>
                  {[quote.number, quote.business?.name, quote.summary].filter(Boolean).join(' · ')}
                </Text>
                <Badge label={badge.label} tone={badge.tone} />
              </View>

              <View style={styles.shareRow}>
                <PillButton
                  label={sharing === quote.id ? 'Preparing…' : 'Share PDF'}
                  onPress={() => void onShare(quote.id)}
                />
              </View>

              {accepted ? (
                <View style={styles.convertRow}>
                  <Text style={styles.convertLabel}>
                    {converted ? 'Already billed' : 'Ready to bill'}
                  </Text>
                  {!converted ? (
                    <PillButton label="Convert to invoice" onPress={() => void onConvert(quote)} />
                  ) : null}
                </View>
              ) : null}
            </Card>
          );
        })}

        {quotations.isSuccess && visible.length === 0 ? (
          <Card variant="card" padded inset={false}>
            <Text style={text.body}>
              {tab === 'all' ? 'No quotations yet. Tap New to draft one.' : 'Nothing in this state.'}
            </Text>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = themedStyles(() => ({
  shareRow: { marginTop: 12, flexDirection: 'row' },
  filters: { marginTop: 16 },
  list: { marginTop: 18, paddingHorizontal: gutter.screen, gap: 8 },
  card: { paddingVertical: 15, paddingHorizontal: 16 },
  cardDraft: { opacity: 0.7 },
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
  convertRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: alpha.track,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  convertLabel: { fontFamily: font.sans, fontSize: 12, color: color.muted },
}));
