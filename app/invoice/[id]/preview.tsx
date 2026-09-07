import React, { useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { BusinessTile, Button, NavBar } from '@/components';
import { supabase } from '@/lib/supabase';
import { alpha, color, gutter, radius, shadow } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatDay, formatMoney } from '@/lib/format';
import { useInvoice } from '@/data/queries';
import { useMarkInvoicePaid } from '@/data/mutations';

/** Screen 08 — the document as the client will see it, plus the send actions. */
export default function InvoicePreviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useInvoice(id);
  const markPaid = useMarkInvoicePaid();
  const [busy, setBusy] = useState<'pdf' | null>(null);

  const invoice = query.data?.invoice;
  const items = query.data?.items ?? [];
  const business = invoice?.business as
    | { name: string; accent_index: number; vat_number: string | null; pay_link: string | null; iban: string | null }
    | null
    | undefined;

  const openPdf = async () => {
    if (!invoice) return;
    setBusy('pdf');
    try {
      const { data, error } = await supabase.functions.invoke('generate-invoice-pdf', {
        body: { invoice_id: invoice.id },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error('The function did not return a document URL.');
      await WebBrowser.openBrowserAsync(url);
    } catch (e) {
      Alert.alert(
        'Could not generate the PDF',
        e instanceof Error
          ? `${e.message}\n\nDeploy the Edge Function with: supabase functions deploy generate-invoice-pdf`
          : 'Unknown error.',
      );
    } finally {
      setBusy(null);
    }
  };

  const shareText = invoice
    ? `${business?.name ?? 'Invoice'} — ${invoice.number}\n` +
      `${formatMoney(invoice.total_minor, invoice.currency)} due ${formatDay(invoice.due_date, true)}`
    : '';

  const sendEmail = () => {
    if (!invoice) return;
    const to = invoice.client?.email ?? '';
    const subject = encodeURIComponent(`${business?.name ?? 'Invoice'} · ${invoice.number}`);
    const body = encodeURIComponent(shareText);
    void Linking.openURL(`mailto:${to}?subject=${subject}&body=${body}`);
  };

  const sendWhatsApp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      void Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp is not installed', 'Install WhatsApp to send from here.');
    }
  };

  if (!invoice) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <NavBar left="Back" title="Preview" onLeft={() => router.back()} />
        <Text style={[text.body, styles.loading]}>
          {query.isError ? 'Could not load this invoice.' : 'Loading…'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <NavBar
          left="Edit"
          title="Preview"
          right={busy === 'pdf' ? '…' : 'PDF'}
          onLeft={() => router.back()}
          onRight={openPdf}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.document}>
          <View style={styles.docHead}>
            <View style={styles.issuer}>
              <BusinessTile
                name={business?.name ?? 'B'}
                accentIndex={business?.accent_index ?? 0}
                size={30}
              />
              <View style={styles.flexShrink}>
                <Text style={styles.issuerName} numberOfLines={1}>
                  {business?.name ?? 'Business'}
                </Text>
                {business?.vat_number ? (
                  <Text style={styles.issuerMeta}>VAT {business.vat_number}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.docTitleBlock}>
              <Text style={styles.docTitle}>Invoice</Text>
              <Text style={styles.issuerMeta}>{invoice.number}</Text>
            </View>
          </View>

          <View style={styles.parties}>
            <View style={styles.flexOne}>
              <Text style={text.microLabelDoc}>BILLED TO</Text>
              <Text style={styles.partyBody}>
                {invoice.client?.address ?? invoice.client?.name ?? 'No client'}
              </Text>
            </View>
            <View style={styles.datesCol}>
              <Text style={text.microLabelDoc}>DATES</Text>
              <Text style={styles.partyBody}>
                {`Issued ${formatDay(invoice.issue_date, true)}\nDue ${formatDay(invoice.due_date, true)}`}
              </Text>
            </View>
          </View>

          <View style={styles.tableHead}>
            <Text style={[text.microLabelDoc, styles.colDesc]}>DESCRIPTION</Text>
            <Text style={[text.microLabelDoc, styles.colQty]}>QTY</Text>
            <Text style={[text.microLabelDoc, styles.colAmount]}>AMOUNT</Text>
          </View>

          {items.map((item, i) => (
            <View
              key={item.id}
              style={[styles.itemRow, i < items.length - 1 && styles.itemRowDivided]}
            >
              <View style={styles.colDesc}>
                <Text style={styles.itemName}>{item.description}</Text>
                {item.detail ? <Text style={styles.itemDetail}>{item.detail}</Text> : null}
              </View>
              <Text style={[styles.itemQty, styles.colQty]}>{String(Number(item.qty))}</Text>
              <Text style={[styles.itemAmount, styles.colAmount]}>
                {formatMoney(item.amount_minor, invoice.currency, { decimals: true })}
              </Text>
            </View>
          ))}

          <View style={styles.totalsWrap}>
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalLabel}>
                  {formatMoney(invoice.subtotal_minor, invoice.currency, { decimals: true })}
                </Text>
              </View>
              {invoice.tax_minor > 0 ? (
                <View style={[styles.totalRow, styles.totalRowSpaced]}>
                  <Text style={styles.totalLabel}>{`VAT ${Number(invoice.tax_rate)}%`}</Text>
                  <Text style={styles.totalLabel}>
                    {formatMoney(invoice.tax_minor, invoice.currency, { decimals: true })}
                  </Text>
                </View>
              ) : null}
              <View style={styles.grandRow}>
                <Text style={styles.grandLabel}>Total due</Text>
                <Text style={styles.grandValue}>
                  {formatMoney(invoice.total_minor, invoice.currency, { decimals: true })}
                </Text>
              </View>
            </View>
          </View>

          {invoice.attach_payment_link ? (
            <View style={styles.payBlock}>
              <View style={styles.qr}>
                <View style={styles.qrInner} />
              </View>
              <View style={styles.flexOne}>
                <Text style={styles.payTitle}>Pay by card, transfer or QR</Text>
                <Text style={styles.payDetail}>
                  {[business?.pay_link, business?.iban ? `IBAN ${business.iban}` : null]
                    .filter(Boolean)
                    .join('\n') || 'Add a payment link in Settings.'}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.actions, { marginBottom: Math.max(insets.bottom, 20) }]}>
        <Button label="Email" height={44} onPress={sendEmail} />
        <Button label="WhatsApp" height={44} variant="ink" onPress={sendWhatsApp} />
        <Button
          label="↻"
          height={44}
          variant="outline"
          fullWidth={false}
          style={styles.resend}
          onPress={() => {
            if (invoice.status === 'paid') return;
            Alert.alert('Mark as paid?', `${invoice.number} · ${formatMoney(invoice.total_minor, invoice.currency)}`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Mark paid',
                onPress: () => void markPaid.mutateAsync(invoice.id),
              },
            ]);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The preview sits on a darker ground so the white page reads as paper.
  root: { flex: 1, backgroundColor: color.previewBackdrop },
  scroll: { paddingTop: 16, paddingHorizontal: gutter.preview, paddingBottom: 16 },
  loading: { padding: gutter.screen },

  document: {
    backgroundColor: color.card,
    borderRadius: radius.doc,
    paddingVertical: 24,
    paddingHorizontal: 22,
    ...(Platform.OS === 'web' ? {} : shadow.document),
  },
  docHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  issuer: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  issuerName: { fontFamily: font.sansBold, fontSize: 13.5, color: color.ink },
  issuerMeta: { fontFamily: font.sans, fontSize: 10.5, color: color.muted },
  docTitleBlock: { alignItems: 'flex-end' },
  docTitle: { fontFamily: font.serif, fontSize: 22, color: color.ink },

  parties: { marginTop: 22, flexDirection: 'row', gap: 20 },
  datesCol: { width: 104 },
  partyBody: { marginTop: 5, fontFamily: font.sans, fontSize: 12, lineHeight: 18, color: color.ink },

  tableHead: {
    marginTop: 22,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: alpha.docRule,
    flexDirection: 'row',
  },
  colDesc: { flex: 1 },
  colQty: { width: 38, textAlign: 'right' },
  colAmount: { width: 68, textAlign: 'right' },

  itemRow: { paddingVertical: 11, flexDirection: 'row' },
  itemRowDivided: { borderBottomWidth: 1, borderBottomColor: alpha.divider },
  itemName: { fontFamily: font.sans, fontSize: 12, color: color.ink },
  itemDetail: { fontFamily: font.sans, fontSize: 10.5, color: color.muted },
  itemQty: { fontFamily: font.sans, fontSize: 12, color: color.muted },
  itemAmount: { fontFamily: font.sans, fontSize: 12, color: color.ink },

  totalsWrap: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end' },
  totals: { width: 190 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRowSpaced: { marginTop: 6 },
  totalLabel: { fontFamily: font.sans, fontSize: 12, color: color.muted },
  grandRow: {
    marginTop: 9,
    paddingTop: 9,
    borderTopWidth: 1,
    borderTopColor: alpha.docRule,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grandLabel: { fontFamily: font.sansBold, fontSize: 12, color: color.ink },
  grandValue: { fontFamily: font.serif, fontSize: 21, color: color.ink },

  payBlock: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: alpha.docRuleSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  qr: {
    width: 62,
    height: 62,
    borderRadius: radius.doc,
    backgroundColor: color.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInner: { width: 38, height: 38, backgroundColor: color.card },
  payTitle: { fontFamily: font.sansBold, fontSize: 11.5, color: color.ink },
  payDetail: { marginTop: 3, fontFamily: font.sans, fontSize: 10.5, lineHeight: 15.75, color: color.muted },

  actions: {
    marginHorizontal: gutter.preview,
    padding: 14,
    paddingHorizontal: 16,
    borderRadius: radius.panel,
    backgroundColor: color.card,
    flexDirection: 'row',
    gap: 8,
  },
  resend: { width: 56 },
  flexOne: { flex: 1 },
  flexShrink: { flexShrink: 1 },
});
