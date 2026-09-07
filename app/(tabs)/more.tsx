import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BusinessTile,
  Card,
  DashedCard,
  FieldRow,
  ListCard,
  NavRow,
  PickerSheet,
  Screen,
  ScreenHeader,
  SectionLabel,
} from '@/components';
import type { PickerOption } from '@/components';
import { supabase } from '@/lib/supabase';
import { color, gutter } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { currencySymbol } from '@/lib/format';
import { currencyOptions } from '@/lib/currencies';
import { useAuth } from '@/data/auth';
import { useBusinesses, useProfile } from '@/data/queries';
import type { Profile } from '@/types/db';

type Sheet = 'currency' | 'fx' | 'fy' | 'numbering' | null;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const KIND_LABEL: Record<string, string> = {
  retail: 'Retail',
  design: 'Design',
  property: 'Property',
  services: 'Services',
  other: 'Other',
};

/** Screen 11 — settings, and the switcher every other screen reads from. */
export default function MoreScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const profile = useProfile();
  const businesses = useBusinesses();
  const [sheet, setSheet] = useState<Sheet>(null);

  const base = profile.data?.base_currency ?? 'USD';

  const updateProfile = async (patch: Partial<Profile>) => {
    if (!profile.data) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.data.id);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await profile.refetch();
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" />

      <SectionLabel style={styles.section}>BUSINESSES</SectionLabel>
      <View style={styles.businessList}>
        {(businesses.data ?? []).map((business) => (
          <Card
            key={business.id}
            variant="card"
            inset={false}
            borderColor={business.is_default ? color.green : undefined}
            style={[styles.businessCard, business.is_default && styles.businessCardDefault]}
            onPress={() => router.push({ pathname: '/business/new', params: { id: business.id } })}
          >
            <BusinessTile name={business.name} accentIndex={business.accent_index} size={32} />
            <View style={styles.businessBody}>
              <Text style={text.rowTitle} numberOfLines={1}>
                {business.name}
              </Text>
              <Text style={styles.businessMeta} numberOfLines={1}>
                {[
                  KIND_LABEL[business.kind] ?? 'Other',
                  business.currency,
                  // "sales tax 8.5%" but "VAT 19%" — acronyms keep their case.
                  business.tax_label
                    ? `${
                        business.tax_label === business.tax_label.toUpperCase()
                          ? business.tax_label
                          : business.tax_label.toLowerCase()
                      } ${Number(business.tax_rate)}%`
                    : 'no tax',
                ].join(' · ')}
              </Text>
            </View>
            {business.is_default ? (
              <Text style={styles.defaultTag}>DEFAULT</Text>
            ) : (
              <Text style={styles.chevron}>›</Text>
            )}
          </Card>
        ))}

        <DashedCard onPress={() => router.push('/business/new')}>
          <Text style={styles.dashedLabel}>+ Add a business</Text>
        </DashedCard>
      </View>

      <SectionLabel style={styles.section}>GENERAL</SectionLabel>
      <ListCard>
        <FieldRow
          label="Base currency"
          value={`${base} ${currencySymbol(base)}`}
          onPress={() => setSheet('currency')}
        />
        <FieldRow
          label="Exchange rates"
          value={profile.data?.fx_mode === 'manual' ? 'Manual' : 'Daily, auto'}
          onPress={() => setSheet('fx')}
        />
        <FieldRow
          label="Financial year starts"
          value={MONTHS[(profile.data?.fy_start_month ?? 1) - 1]}
          onPress={() => setSheet('fy')}
        />
        <FieldRow
          label="Invoice numbering"
          value={profile.data?.invoice_numbering === 'global' ? 'Global' : 'Per business'}
          onPress={() => setSheet('numbering')}
        />
      </ListCard>

      <SectionLabel style={styles.section}>WORKFLOW</SectionLabel>
      <ListCard>
        <NavRow title="Quotations" meta="Draft, send and convert" onPress={() => router.push('/quotations')} />
        <NavRow title="Bank & card sync" meta="Linked accounts and the review queue" onPress={() => router.push('/bank-sync')} />
        <NavRow title="Receipt inbox" meta="Match receipts to expenses" onPress={() => router.push('/receipts')} />
        <NavRow title="Clients & vendors" meta="Who owes you, who you pay" onPress={() => router.push('/clients')} />
        <NavRow title="Reports & tax export" meta="PDF and CSV" onPress={() => router.push('/reports')} />
        <NavRow title="Notifications" meta="Alerts that need you" onPress={() => router.push('/notifications')} />
      </ListCard>

      <SectionLabel style={styles.section}>TEAM</SectionLabel>
      <ListCard>
        <NavRow
          title="Accountant access"
          meta="Read-only collaborators"
          onPress={() =>
            Alert.alert(
              'Accountant access',
              'Invited users get read-only rows through the business_members table.',
            )
          }
        />
      </ListCard>

      <SectionLabel style={styles.section}>ACCOUNT</SectionLabel>
      <ListCard>
        <NavRow
          title="Sign out"
          meta={profile.data?.email ?? undefined}
          onPress={() =>
            Alert.alert('Sign out?', 'You will need your email link to get back in.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
        />
      </ListCard>

      <PickerSheet
        visible={sheet === 'currency'}
        title="Base currency"
        options={currencyOptions()}
        selected={base}
        onSelect={(value) => void updateProfile({ base_currency: value })}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'fx'}
        title="Exchange rates"
        options={[
          { value: 'daily_auto', label: 'Daily, auto' },
          { value: 'manual', label: 'Manual' },
        ]}
        selected={profile.data?.fx_mode ?? 'daily_auto'}
        onSelect={(value) => void updateProfile({ fx_mode: value })}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'fy'}
        title="Financial year starts"
        options={MONTHS.map<PickerOption<number>>((label, i) => ({ value: i + 1, label }))}
        selected={profile.data?.fy_start_month ?? 1}
        onSelect={(value) => void updateProfile({ fy_start_month: value })}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'numbering'}
        title="Invoice numbering"
        options={[
          { value: 'per_business', label: 'Per business' },
          { value: 'global', label: 'Global' },
        ]}
        selected={profile.data?.invoice_numbering ?? 'per_business'}
        onSelect={(value) => void updateProfile({ invoice_numbering: value })}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 22, marginBottom: 8 },
  businessList: { paddingHorizontal: gutter.screen, gap: 8 },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  // The default business is marked with a heavier green border in the export.
  businessCardDefault: { borderWidth: 1.5 },
  businessBody: { flex: 1, minWidth: 0 },
  businessMeta: { marginTop: 2, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
  defaultTag: {
    fontFamily: font.sansBold,
    fontSize: 11,
    letterSpacing: 11 * 0.08,
    color: color.green,
  },
  chevron: { fontSize: 18, color: color.muted2 },
  dashedLabel: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.muted },
});
