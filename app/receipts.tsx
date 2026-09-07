import React, { useState } from 'react';
import { Alert, Image, RefreshControl, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Banner,
  Button,
  Card,
  InkLabel,
  InkPanel,
  LinkButton,
  PickerSheet,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components';
import type { PickerOption } from '@/components';
import { supabase } from '@/lib/supabase';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { formatDay, formatMoney } from '@/lib/format';
import { useBusinesses, useExpenses, useReceipts } from '@/data/queries';
import { useFileReceipt } from '@/data/mutations';
import type { Receipt } from '@/types/db';

const SOURCE_LABEL: Record<string, string> = {
  scan: 'Scanned',
  email: 'Emailed',
  whatsapp: 'WhatsApp',
  photo: 'Photo',
  upload: 'Uploaded',
};

/** Screen 16 — the receipt inbox. */
export default function ReceiptsScreen() {
  const receipts = useReceipts();
  const businesses = useBusinesses();
  const expenses = useExpenses();
  const fileReceipt = useFileReceipt();

  const [assigning, setAssigning] = useState<Receipt | null>(null);
  const [uploading, setUploading] = useState(false);

  const rows = receipts.data ?? [];
  const [newest, ...waiting] = rows;

  const withReceipt = (expenses.data ?? []).filter((e) => e.receipt_id).length;
  const totalExpenses = expenses.data?.length ?? 0;

  const defaultBusiness = businesses.data?.find((b) => b.is_default) ?? businesses.data?.[0];

  const onFile = async (receipt: Receipt, businessId: string) => {
    try {
      await fileReceipt.mutateAsync({ receiptId: receipt.id, businessId });
    } catch (e) {
      Alert.alert('Could not file receipt', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  /** Capture a receipt and store it in the private `receipts` bucket. */
  const captureReceipt = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to scan receipts.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: false });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      const path = `${userId}/${Date.now()}.jpg`;
      const bytes = await (await fetch(asset.uri)).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, bytes, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('receipts').insert({
        owner_id: userId,
        storage_path: path,
        source: 'scan',
        status: 'pending',
      });
      if (insertError) throw insertError;

      await receipts.refetch();
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={receipts.isRefetching} onRefresh={() => void receipts.refetch()} />
      }
    >
      <ScreenHeader
        title="Receipts"
        subtitle={`${rows.length} to match · forwarded to receipts@ledger.app`}
        right={<LinkButton label="Scan" onPress={captureReceipt} />}
      />

      {newest ? (
        <InkPanel variant="card" style={styles.hero}>
          <View style={styles.heroRow}>
            <ReceiptThumb path={newest.storage_path} />
            <View style={styles.heroBody}>
              <InkLabel small>{SOURCE_LABEL[newest.source]?.toUpperCase() ?? 'RECEIPT'}</InkLabel>
              <Text style={styles.heroTitle}>
                {[newest.merchant ?? 'Unknown merchant',
                  newest.amount_minor != null
                    ? formatMoney(newest.amount_minor, newest.currency ?? 'USD', { decimals: true })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
              <Text style={styles.heroMeta}>
                {[
                  newest.tax_minor
                    ? `Tax ${formatMoney(newest.tax_minor, newest.currency ?? 'USD', { decimals: true })}`
                    : null,
                  newest.doc_number ? `invoice #${newest.doc_number}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No details read yet'}
              </Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <Button
              label={defaultBusiness ? `File to ${defaultBusiness.name}` : 'Pick a business'}
              height={42}
              loading={fileReceipt.isPending}
              onPress={() =>
                defaultBusiness
                  ? void onFile(newest, defaultBusiness.id)
                  : setAssigning(newest)
              }
            />
            <Button
              label="Change"
              height={42}
              variant="onInk"
              fullWidth={false}
              style={styles.changeButton}
              onPress={() => setAssigning(newest)}
            />
          </View>
        </InkPanel>
      ) : (
        <Card variant="card" padded style={styles.hero}>
          <Text style={text.body}>
            {uploading ? 'Uploading…' : 'Inbox clear — every receipt is filed.'}
          </Text>
        </Card>
      )}

      {waiting.length > 0 ? (
        <>
          <SectionLabel style={styles.section}>WAITING</SectionLabel>
          <View style={styles.list}>
            {waiting.map((receipt) => (
              <Card key={receipt.id} variant="card" inset={false} style={styles.waitingCard}>
                <View style={styles.thumbSmall} />
                <View style={styles.waitingBody}>
                  <Text style={text.rowTitle} numberOfLines={1}>
                    {[receipt.merchant ?? 'Receipt',
                      receipt.amount_minor != null
                        ? formatMoney(receipt.amount_minor, receipt.currency ?? 'USD', {
                            decimals: true,
                          })
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  <Text style={styles.waitingMeta} numberOfLines={1}>
                    {[
                      `${SOURCE_LABEL[receipt.source] ?? 'Added'} ${formatDay(receipt.captured_at)}`,
                      receipt.note,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <LinkButton
                  label={receipt.business_id ? 'Accept' : 'Assign'}
                  onPress={() =>
                    receipt.business_id
                      ? void onFile(receipt, receipt.business_id)
                      : setAssigning(receipt)
                  }
                />
              </Card>
            ))}
          </View>
        </>
      ) : null}

      {totalExpenses > 0 ? (
        <View style={styles.banner}>
          <Banner
            tone="green"
            body={
              `${withReceipt} of ${totalExpenses} expenses this month have a receipt attached. ` +
              (withReceipt === totalExpenses
                ? 'Tax pack is export-ready.'
                : 'Attach the rest before you export.')
            }
          />
        </View>
      ) : null}

      <PickerSheet
        visible={assigning !== null}
        title="File to"
        options={(businesses.data ?? []).map<PickerOption<string>>((b) => ({
          value: b.id,
          label: b.name,
          meta: b.currency,
        }))}
        selected={assigning?.business_id ?? null}
        onSelect={(businessId) => {
          if (assigning) void onFile(assigning, businessId);
        }}
        onClose={() => setAssigning(null)}
      />
    </Screen>
  );
}

/** Signed URL for a private receipt image, resolved lazily. */
function ReceiptThumb({ path }: { path: string | null }) {
  const [uri, setUri] = useState<string | null>(null);

  React.useEffect(() => {
    if (!path) return;
    let cancelled = false;
    void supabase.storage
      .from('receipts')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUri(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (uri) {
    return <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />;
  }
  return (
    <View style={styles.thumb}>
      <View style={styles.thumbLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 18 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroBody: { flex: 1 },
  heroTitle: { marginTop: 5, fontFamily: font.sansSemi, fontSize: 15, color: color.paper },
  heroMeta: { marginTop: 3, fontFamily: font.sans, fontSize: 12, color: alpha.onInk66 },
  heroActions: { marginTop: 14, flexDirection: 'row', gap: 8 },
  changeButton: { width: 96 },

  thumb: {
    width: 56,
    height: 70,
    borderRadius: radius.doc,
    backgroundColor: alpha.onInk14,
    justifyContent: 'flex-end',
    padding: 7,
    overflow: 'hidden',
  },
  thumbLine: { width: '100%', height: 8, backgroundColor: alpha.onInk40 },
  thumbSmall: { width: 38, height: 46, borderRadius: radius.chip, backgroundColor: color.line },

  section: { marginTop: 22, marginBottom: 8 },
  list: { paddingHorizontal: gutter.screen, gap: 8 },
  waitingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  waitingBody: { flex: 1, minWidth: 0 },
  waitingMeta: { marginTop: 2, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
  banner: { marginTop: 20 },
});
