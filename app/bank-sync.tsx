import React from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  BadgeTile,
  Card,
  DashedCard,
  LinkButton,
  ListCard,
  PillButton,
  Screen,
  ScreenHeader,
  SectionLabel,
  SoftPill,
} from '@/components';
import { alpha, color, gutter } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatAgo, formatMoney } from '@/lib/format';
import { useAccounts, useBankTransactions } from '@/data/queries';
import { useConfirmTransaction } from '@/data/mutations';

const BADGE_TINTS = [color.ink, color.blue, color.amber];

/** Screen 15 — linked accounts and the review queue. */
export default function BankSyncScreen() {
  const accounts = useAccounts();
  const transactions = useBankTransactions();
  const confirm = useConfirmTransaction();

  const lastSync = (accounts.data ?? [])
    .map((a) => a.last_synced_at)
    .filter(Boolean)
    .sort()
    .at(-1);

  const pending = transactions.data ?? [];

  const onConfirm = async (id: string) => {
    try {
      await confirm.mutateAsync(id);
    } catch (e) {
      Alert.alert('Could not confirm', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  const acceptAll = () => {
    const ready = pending.filter((t) => t.business_id);
    if (ready.length === 0) {
      Alert.alert('Nothing to accept', 'Assign a business to these lines first.');
      return;
    }
    Alert.alert(
      `Accept ${ready.length} line${ready.length === 1 ? '' : 's'}?`,
      'Each becomes an expense, or marks its matching invoice paid.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Accept all',
          onPress: async () => {
            // Sequential so one failure does not leave the rest half-applied.
            for (const txn of ready) {
              try {
                await confirm.mutateAsync(txn.id);
              } catch {
                break;
              }
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={transactions.isRefetching}
          onRefresh={() => void transactions.refetch()}
        />
      }
    >
      <ScreenHeader title="Accounts" subtitle={`Last synced ${formatAgo(lastSync)}`} />

      <View style={styles.accountList}>
        {(accounts.data ?? [])
          .filter((a) => a.kind !== 'cash')
          .map((account, i) => {
            const expired = account.status === 'expired';
            return (
              <Card
                key={account.id}
                variant="card"
                inset={false}
                borderColor={expired ? alpha.amberBorder : undefined}
                style={styles.accountCard}
              >
                <BadgeTile
                  label={account.badge ?? account.name.slice(0, 2).toUpperCase()}
                  background={BADGE_TINTS[i % BADGE_TINTS.length]}
                  tint={i === 0 ? color.paper : '#FFFFFF'}
                />
                <View style={styles.accountBody}>
                  <Text style={text.rowTitle} numberOfLines={1}>
                    {account.mask ? `${account.name} ·· ${account.mask}` : account.name}
                  </Text>
                  <Text style={[styles.accountMeta, expired && styles.accountMetaWarn]} numberOfLines={1}>
                    {expired
                      ? 'Login expired · reconnect'
                      : [account.currency, account.auto_categorise ? 'auto-categorised' : null]
                          .filter(Boolean)
                          .join(' · ')}
                  </Text>
                </View>
                {expired ? (
                  <PillButton
                    label="Fix"
                    variant="ink"
                    onPress={() =>
                      Alert.alert(
                        'Reconnect account',
                        'Wire this to your bank aggregator (Plaid, TrueLayer, Salt Edge) to re-authenticate.',
                      )
                    }
                  />
                ) : (
                  <View style={styles.accountValue}>
                    <Text style={styles.balance}>
                      {formatMoney(account.balance_minor, account.currency)}
                    </Text>
                    <Text style={styles.live}>LIVE</Text>
                  </View>
                )}
              </Card>
            );
          })}

        <DashedCard
          onPress={() =>
            Alert.alert(
              'Link another account',
              'Connect your bank aggregator here to import transactions automatically.',
            )
          }
        >
          <Text style={styles.dashedLabel}>+ Link another account</Text>
        </DashedCard>
      </View>

      <SectionLabel
        style={styles.section}
        right={pending.length > 0 ? <LinkButton label="Accept all" onPress={acceptAll} /> : undefined}
      >
        {`TO REVIEW · ${pending.length}`}
      </SectionLabel>

      {pending.length > 0 ? (
        <ListCard>
          {pending.map((txn) => {
            const incoming = txn.amount_minor > 0;
            return (
              <View key={txn.id} style={styles.txn}>
                <View style={styles.txnTop}>
                  <Text style={styles.txnName} numberOfLines={1}>
                    {txn.description}
                  </Text>
                  <Text style={[styles.txnAmount, incoming && styles.txnAmountIn]}>
                    {formatMoney(Math.abs(txn.amount_minor), txn.currency, {
                      signed: incoming,
                    })}
                  </Text>
                </View>
                <View style={styles.txnTags}>
                  {txn.business ? (
                    <SoftPill
                      label={txn.business.name}
                      background={tagBackground(txn.business.accent_index)}
                      tint={tagTint(txn.business.accent_index)}
                    />
                  ) : (
                    <SoftPill label="No business" background={color.line} tint={color.muted} />
                  )}
                  {txn.matched_invoice ? (
                    <SoftPill
                      label={`Matches ${txn.matched_invoice.number}`}
                      background={color.blueSoft}
                      tint={color.blueDark}
                    />
                  ) : txn.category ? (
                    <SoftPill label={txn.category.name} background={color.line} tint={color.muted} />
                  ) : null}
                  <View style={styles.spacer} />
                  <LinkButton
                    label={incoming ? 'Mark paid' : 'Confirm'}
                    onPress={() => void onConfirm(txn.id)}
                  />
                </View>
              </View>
            );
          })}
        </ListCard>
      ) : (
        <Card variant="card" padded>
          <Text style={text.body}>Every imported transaction has been reviewed.</Text>
        </Card>
      )}
    </Screen>
  );
}

function tagBackground(accent: number): string {
  return accent === 1 ? color.blueSoft : accent === 2 ? color.amberSoft : color.greenSoft;
}

function tagTint(accent: number): string {
  return accent === 1 ? color.blueDark : accent === 2 ? color.amberText : color.greenDark;
}

const styles = StyleSheet.create({
  accountList: { marginTop: 18, paddingHorizontal: gutter.screen, gap: 8 },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  accountBody: { flex: 1, minWidth: 0 },
  accountMeta: { marginTop: 2, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
  accountMetaWarn: { color: color.amberText },
  accountValue: { alignItems: 'flex-end' },
  balance: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  live: {
    marginTop: 2,
    fontFamily: font.sansBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.08,
    color: color.greenDark,
  },
  dashedLabel: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.muted },

  section: { marginTop: 22, marginBottom: 8 },
  txn: { paddingVertical: 14, paddingHorizontal: 16 },
  txnTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  txnName: { flexShrink: 1, fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  txnAmount: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink },
  txnAmountIn: { color: color.greenDark },
  txnTags: { marginTop: 7, flexDirection: 'row', alignItems: 'center', gap: 6 },
  spacer: { flex: 1 },
});
