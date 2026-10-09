import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {
  Button,
  Card,
  InkFigure,
  InkLabel,
  InkPanel,
  ListCard,
  NavRow,
  Row,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components';
import { gutter } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { formatDay, formatMoney } from '@/lib/format';
import { useExpenses, useExports, useProfile, useTaxSummary } from '@/data/queries';

/** Screen 10 — the built-in reports and the quarterly tax pack. */
export default function ReportsScreen() {
  const router = useRouter();
  const profile = useProfile();
  const tax = useTaxSummary();
  const exports = useExports();
  const expenses = useExpenses();

  const [exporting, setExporting] = useState(false);
  const base = profile.data?.base_currency ?? 'USD';

  /**
   * The expense ledger exports client-side as CSV — no server round trip needed
   * for data the app already holds. The PDF pack goes through the Edge Function.
   */
  const exportLedgerCsv = async () => {
    const rows = expenses.data ?? [];
    if (rows.length === 0) {
      Alert.alert('Nothing to export', 'No expenses recorded for this month yet.');
      return;
    }

    setExporting(true);
    try {
      const header = 'Date,Business,Category,Vendor,Amount,Currency,Base amount,Tax,Recoverable\n';
      const body = rows
        .map((e) =>
          [
            e.spent_on,
            csvCell(e.business?.name),
            csvCell(e.category?.name),
            csvCell(e.vendor?.name),
            (e.amount_minor / 100).toFixed(2),
            e.currency,
            (e.base_minor / 100).toFixed(2),
            (e.tax_minor / 100).toFixed(2),
            e.tax_recoverable ? 'yes' : 'no',
          ].join(','),
        )
        .join('\n');

      const name = `ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      const file = new FileSystem.File(FileSystem.Paths.cache, name);
      file.write(header + body);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Expense ledger' });
      } else {
        Alert.alert('Saved', `Written to ${file.uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Reports" subtitle="Anything here exports as PDF or CSV" />

      <InkPanel style={styles.taxPanel}>
        <InkLabel small>QUARTER TO DATE · TAX</InkLabel>
        <View style={styles.taxFigure}>
          <InkFigure value={formatMoney(tax.data?.payable_minor ?? 0, base)} size={34} />
          <Text style={styles.payable}>payable</Text>
        </View>
        <View style={styles.taxActions}>
          <Button
            label="Export pack"
            height={42}
            loading={exporting}
            onPress={exportLedgerCsv}
          />
          <Button
            label="Send to CA"
            height={42}
            variant="onInk"
            onPress={() =>
              Alert.alert(
                'Send to your accountant',
                'Invite them with read-only access from Settings → Accountant access.',
              )
            }
          />
        </View>
      </InkPanel>

      <SectionLabel style={styles.section}>BUILT-IN REPORTS</SectionLabel>
      <ListCard>
        <NavRow
          title="Profit & loss"
          meta="Per business or consolidated"
          onPress={() => router.push('/pl')}
        />
        <NavRow
          title="Expense ledger"
          meta={`${expenses.data?.length ?? 0} rows · receipts attached`}
          onPress={() => router.push('/(tabs)/spend')}
        />
        <NavRow
          title="Tax summary"
          meta="Collected, input credit, payable"
          onPress={() =>
            Alert.alert(
              'Tax summary',
              `Collected ${formatMoney(tax.data?.collected_minor ?? 0, base)}\n` +
                `Input credit ${formatMoney(tax.data?.recoverable_minor ?? 0, base)}\n` +
                `Payable ${formatMoney(tax.data?.payable_minor ?? 0, base)}`,
            )
          }
        />
        <NavRow
          title="Receivables ageing"
          meta="0–30, 30–60, 60+"
          onPress={() => router.push('/clients')}
        />
      </ListCard>

      <SectionLabel style={styles.section}>RECENT EXPORTS</SectionLabel>
      {(exports.data?.length ?? 0) > 0 ? (
        <View style={styles.exportList}>
          {exports.data!.map((record) => (
            <Card key={record.id} variant="card" inset={false}>
              <Row title={record.filename} value={formatDay(record.created_at)} />
            </Card>
          ))}
        </View>
      ) : (
        <Card variant="card" padded>
          <Text style={text.body}>No exports yet.</Text>
        </Card>
      )}
    </Screen>
  );
}

/** Quote a CSV cell only when it needs it. */
function csvCell(value: string | null | undefined): string {
  const raw = value ?? '';
  return /[",\n]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

const styles = themedStyles(() => ({
  taxPanel: { marginTop: 18, padding: 18 },
  taxFigure: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  payable: { fontFamily: font.sans, fontSize: 14, color: 'rgba(245,243,238,0.7)' },
  taxActions: { marginTop: 14, flexDirection: 'row', gap: 10 },
  section: { marginTop: 20, marginBottom: 8 },
  exportList: { paddingHorizontal: gutter.screen, gap: 8 },
}));
