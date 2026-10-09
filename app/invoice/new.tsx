import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BusinessTile,
  Button,
  Card,
  DockedBar,
  FieldRow,
  LineItemSheet,
  ListCard,
  NavBar,
  PickerSheet,
  SectionLabel,
  ToggleRow,
  LinkButton,
} from '@/components';
import type { LineItem, PickerOption } from '@/components';
import { alpha, color, gutter } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { currencySymbol, formatDay, formatMoney } from '@/lib/format';
import { currencyOptions } from '@/lib/currencies';
import {
  useBusinesses,
  useContacts,
  useFxRate,
  useNextDocumentNumber,
  useProfile,
} from '@/data/queries';
import { invoiceTotals, useCreateContact, useSaveInvoice } from '@/data/mutations';

type Sheet = 'business' | 'client' | 'currency' | 'terms' | null;

const TERMS = [7, 14, 30, 60];

/** Screen 07 — build an invoice. */
export default function NewInvoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const businesses = useBusinesses();
  const clients = useContacts('client');
  const profile = useProfile();
  const saveInvoice = useSaveInvoice();
  const createContact = useCreateContact();

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [clientId, setClientId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [termsDays, setTermsDays] = useState(14);
  const [items, setItems] = useState<LineItem[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [addingLine, setAddingLine] = useState(false);
  const [attachPaymentLink, setAttachPaymentLink] = useState(true);
  const [isRecurring, setIsRecurring] = useState(false);
  // Held as typed text so a half-entered figure like "1." does not snap back.
  const [advanceText, setAdvanceText] = useState('');
  const [discountText, setDiscountText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const business = businesses.data?.find((b) => b.id === businessId) ?? businesses.data?.[0] ?? null;
  const activeBusinessId = businessId ?? business?.id ?? null;
  const client = clients.data?.find((c) => c.id === clientId) ?? null;
  const activeCurrency = currency ?? business?.currency ?? 'USD';
  const base = profile.data?.base_currency ?? 'USD';
  const taxRate = business?.tax_rate ?? 0;

  // Rate from the invoice currency into base. 1 when they are the same.
  const fxRate = useFxRate(activeCurrency, base).data ?? 1;
  const number = useNextDocumentNumber(activeBusinessId, 'invoice').data ?? 'INV-…';

  const dueDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + termsDays);
    return d;
  }, [termsDays]);

  const totals = invoiceTotals(items, taxRate, fxRate);
  const symbol = currencySymbol(activeCurrency);
  const advanceMinor = toMinor(advanceText);
  const discountMinor = toMinor(discountText);
  const canSave = Boolean(activeBusinessId) && items.length > 0 && !saveInvoice.isPending;

  const draft = () => ({
    businessId: activeBusinessId!,
    clientId,
    number,
    currency: activeCurrency,
    fxRate,
    issueDate: new Date(),
    dueDate,
    termsDays,
    taxRate,
    attachPaymentLink,
    isRecurring,
    discountMinor,
    advanceMinor,
    items,
  });

  const submit = async (status: 'draft' | 'sent') => {
    if (!canSave) return;
    setError(null);
    try {
      const invoice = await saveInvoice.mutateAsync({ draft: draft(), status });
      if (invoice && 'id' in invoice) {
        router.replace(`/invoice/${invoice.id}/preview`);
      } else {
        router.back();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the invoice.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <NavBar
          left="Back"
          title={number}
          right="Preview"
          onLeft={() => router.back()}
          onRight={() => void submit('draft')}
          rightDisabled={!canSave}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ListCard style={styles.card}>
          <FieldRow
            label="Issued by"
            left={
              business ? (
                <BusinessTile name={business.name} accentIndex={business.accent_index} size={22} />
              ) : null
            }
            value={business?.name ?? 'Choose'}
            onPress={() => setSheet('business')}
          />
          <FieldRow
            label="Client"
            value={client?.name ?? 'Choose'}
            onPress={() => setSheet('client')}
          />
          <FieldRow
            label="Currency"
            value={
              activeCurrency === base
                ? `${activeCurrency} ${symbol}`
                : `${activeCurrency} ${symbol} · 1 ${activeCurrency} = ${fxRate.toFixed(2)} ${base}`
            }
            onPress={() => setSheet('currency')}
          />
          <FieldRow
            label="Due"
            value={`Net ${termsDays} · ${formatDay(dueDate)}`}
            onPress={() => setSheet('terms')}
          />
        </ListCard>

        <SectionLabel
          style={styles.sectionLabel}
          right={<LinkButton label="+ Add" onPress={() => setAddingLine(true)} />}
        >
          LINE ITEMS
        </SectionLabel>

        {items.length > 0 ? (
          <ListCard>
            {items.map((item, index) => (
              <Pressable
                key={`${item.description}-${index}`}
                onPress={() => setEditingIndex(index)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.lineItem, pressed && styles.pressed]}
              >
                <View style={styles.lineTop}>
                  <Text style={styles.lineTitle} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={styles.lineAmount}>
                    {formatMoney(Math.round(item.qty * item.unitMinor), activeCurrency)}
                  </Text>
                </View>
                <Text style={styles.lineDetail}>
                  {item.detail ??
                    `${trimNumber(item.qty)} × ${formatMoney(item.unitMinor, activeCurrency)}`}
                </Text>
              </Pressable>
            ))}
          </ListCard>
        ) : (
          <Card variant="panel" padded>
            <Text style={text.body}>No lines yet. Tap “+ Add” to bill something.</Text>
          </Card>
        )}

        <Card variant="panel" padded style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalLabel}>{formatMoney(totals.subtotal, activeCurrency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowSpaced]}>
            <Text style={styles.totalLabel}>
              {`${business?.tax_label ?? 'Tax'} ${trimNumber(taxRate)}%`}
            </Text>
            <Text style={styles.totalLabel}>{formatMoney(totals.tax, activeCurrency)}</Text>
          </View>
          <View style={[styles.totalRow, styles.totalRowSpaced]}>
            <Text style={styles.totalLabel}>Advance paid</Text>
            <TextInput
              value={advanceText}
              onChangeText={setAdvanceText}
              placeholder="0"
              placeholderTextColor={color.muted2}
              keyboardType="decimal-pad"
              style={styles.adjustInput}
              accessibilityLabel="Advance paid"
            />
          </View>
          <View style={[styles.totalRow, styles.totalRowSpaced]}>
            <Text style={styles.totalLabel}>Discount</Text>
            <TextInput
              value={discountText}
              onChangeText={setDiscountText}
              placeholder="0"
              placeholderTextColor={color.muted2}
              keyboardType="decimal-pad"
              style={styles.adjustInput}
              accessibilityLabel="Discount"
            />
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total due</Text>
            <Text style={styles.grandValue}>
              {formatMoney(
                Math.max(totals.total - advanceMinor - discountMinor, 0),
                activeCurrency,
              )}
            </Text>
          </View>
          {activeCurrency !== base ? (
            <Text style={styles.baseNote}>
              {`≈ ${formatMoney(totals.baseTotal, base)} in base`}
            </Text>
          ) : null}
        </Card>

        <ListCard style={styles.card}>
          <ToggleRow
            label="Attach payment link & QR"
            value={attachPaymentLink}
            onChange={setAttachPaymentLink}
          />
          <ToggleRow label="Repeat monthly" value={isRecurring} onChange={setIsRecurring} />
        </ListCard>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <DockedBar>
        <Button
          label="Save draft"
          variant="outline"
          fullWidth={false}
          style={styles.draftButton}
          disabled={!canSave}
          onPress={() => void submit('draft')}
        />
        <Button
          label="Send invoice"
          disabled={!canSave}
          loading={saveInvoice.isPending}
          onPress={() => void submit('sent')}
        />
      </DockedBar>

      <PickerSheet
        visible={sheet === 'business'}
        title="Issued by"
        options={(businesses.data ?? []).map<PickerOption<string>>((b) => ({
          value: b.id,
          label: b.name,
          meta: `${b.currency}${b.tax_label ? ` · ${b.tax_label} ${trimNumber(b.tax_rate)}%` : ''}`,
        }))}
        selected={activeBusinessId}
        onSelect={(id) => {
          setBusinessId(id);
          setCurrency(null);
        }}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'client'}
        title="Client"
        options={(clients.data ?? []).map<PickerOption<string>>((c) => ({
          value: c.id,
          label: c.name,
          meta: c.email,
        }))}
        selected={clientId}
        onSelect={setClientId}
        onClose={() => setSheet(null)}
        createLabel="New client"
        onCreate={async (name) => {
          const created = await createContact.mutateAsync({
            name,
            kind: 'client',
            businessId: activeBusinessId,
            currency: activeCurrency,
          });
          if (created) setClientId(created.id);
        }}
      />
      <PickerSheet
        visible={sheet === 'currency'}
        title="Currency"
        options={currencyOptions()}
        selected={activeCurrency}
        onSelect={setCurrency}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'terms'}
        title="Payment terms"
        options={TERMS.map<PickerOption<number>>((days) => {
          const d = new Date();
          d.setDate(d.getDate() + days);
          return { value: days, label: `Net ${days}`, meta: formatDay(d) };
        })}
        selected={termsDays}
        onSelect={setTermsDays}
        onClose={() => setSheet(null)}
      />

      <LineItemSheet
        // Remounting on open clears the form without syncing props into state.
        key={addingLine ? 'add-open' : 'add-closed'}
        visible={addingLine}
        currencySymbol={symbol}
        onSave={(item) => setItems((prev) => [...prev, item])}
        onClose={() => setAddingLine(false)}
      />
      <LineItemSheet
        key={`edit-${editingIndex ?? 'none'}`}
        visible={editingIndex !== null}
        initial={editingIndex !== null ? items[editingIndex] : null}
        currencySymbol={symbol}
        onSave={(item) =>
          setItems((prev) => prev.map((existing, i) => (i === editingIndex ? item : existing)))
        }
        onDelete={() => setItems((prev) => prev.filter((_, i) => i !== editingIndex))}
        onClose={() => setEditingIndex(null)}
      />
    </View>
  );
}

/** 19.000 -> "19", 1.5 -> "1.5" */
function trimNumber(value: number): string {
  return String(Number(value));
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: color.paper },
  content: { paddingBottom: 24 },
  card: { marginTop: 18 },
  sectionLabel: { marginTop: 20, marginBottom: 8 },

  lineItem: { paddingVertical: 14, paddingHorizontal: 16 },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  lineTitle: { flex: 1, fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  lineAmount: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  lineDetail: { marginTop: 3, fontFamily: font.sans, fontSize: 11.5, color: color.muted },

  totals: { marginTop: 14 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  adjustInput: {
    minWidth: 90,
    textAlign: 'right',
    fontFamily: font.sans,
    fontSize: 13,
    color: color.ink,
    padding: 0,
  },
  totalRowSpaced: { marginTop: 8 },
  totalLabel: { fontFamily: font.sans, fontSize: 13, color: color.muted },
  grandRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: alpha.track,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  grandLabel: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.ink },
  grandValue: { fontFamily: font.serif, fontSize: 26, color: color.ink },
  baseNote: {
    marginTop: 4,
    textAlign: 'right',
    fontFamily: font.sans,
    fontSize: 11.5,
    color: color.muted,
  },

  draftButton: { width: 110 },
  error: {
    marginTop: 14,
    paddingHorizontal: gutter.screen,
    fontFamily: font.sans,
    fontSize: 13,
    color: color.red,
  },
  pressed: { opacity: 0.6 },
}));

/** "1,250.50" → 125050 minor units. Anything unparseable counts as zero. */
function toMinor(value: string): number {
  const n = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
