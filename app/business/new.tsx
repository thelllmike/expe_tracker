import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BusinessTile,
  Button,
  DockedBar,
  FieldRow,
  ListCard,
  NavBar,
  PickerSheet,
  SectionLabel,
  ToggleRow,
} from '@/components';
import type { PickerOption } from '@/components';
import { currencyOptions } from '@/lib/currencies';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { useBusinesses, useProfile } from '@/data/queries';
import { useSaveBusiness } from '@/data/mutations';
import type { BusinessKind } from '@/types/db';

type Sheet = 'kind' | 'currency' | 'accent' | 'tax' | null;

const KINDS: { value: BusinessKind; label: string }[] = [
  { value: 'retail', label: 'Retail' },
  { value: 'design', label: 'Design' },
  { value: 'property', label: 'Property' },
  { value: 'services', label: 'Services' },
  { value: 'other', label: 'Other' },
];

const TAX_PRESETS = [
  { label: 'No tax', tax_label: null, rate: 0 },
  { label: 'VAT 18% (Sri Lanka)', tax_label: 'VAT', rate: 18 },
  { label: 'VAT 19%', tax_label: 'VAT', rate: 19 },
  { label: 'VAT 20%', tax_label: 'VAT', rate: 20 },
  { label: 'GST 18%', tax_label: 'GST', rate: 18 },
  { label: 'Sales tax 8.5%', tax_label: 'Sales tax', rate: 8.5 },
];

const ACCENTS = ['Green', 'Blue', 'Amber'];

/** Create or edit a business. This is the first thing a new account does. */
export default function NewBusinessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();

  const profile = useProfile();
  const businesses = useBusinesses();
  const saveBusiness = useSaveBusiness();

  const existing = businesses.data?.find((b) => b.id === params.id);
  const isFirst = (businesses.data?.length ?? 0) === 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [shortName, setShortName] = useState(existing?.short_name ?? '');
  const [kind, setKind] = useState<BusinessKind>(existing?.kind ?? 'other');
  const [currency, setCurrency] = useState(
    existing?.currency ?? profile.data?.base_currency ?? 'LKR',
  );
  const [accent, setAccent] = useState(
    existing?.accent_index ?? (businesses.data?.length ?? 0) % 3,
  );
  const [taxIndex, setTaxIndex] = useState(() => {
    if (!existing) return 0;
    const match = TAX_PRESETS.findIndex(
      (t) => t.tax_label === existing.tax_label && t.rate === Number(existing.tax_rate),
    );
    return match >= 0 ? match : 0;
  });
  const [isDefault, setIsDefault] = useState(existing?.is_default ?? isFirst);
  const [vatNumber, setVatNumber] = useState(existing?.vat_number ?? '');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState<string | null>(null);

  const tax = TAX_PRESETS[taxIndex];
  const canSave = name.trim().length > 0 && !saveBusiness.isPending;

  const onSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      await saveBusiness.mutateAsync({
        id: existing?.id,
        name: name.trim(),
        shortName: shortName.trim() || null,
        kind,
        currency,
        accentIndex: accent,
        taxLabel: tax.tax_label,
        taxRate: tax.rate,
        vatNumber: vatNumber.trim() || null,
        isDefault,
        // A brand-new account gets a starter category list, otherwise the
        // expense form would have nothing to pick from.
        seedCategories: isFirst,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the business.');
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <NavBar
          left="Cancel"
          title={existing ? 'Edit business' : 'New business'}
          right="Save"
          onLeft={() => router.back()}
          onRight={onSave}
          rightDisabled={!canSave}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.preview}>
          <BusinessTile name={name || '?'} accentIndex={accent} size={56} />
          <Text style={styles.previewName} numberOfLines={1}>
            {name.trim() || 'Name your business'}
          </Text>
        </View>

        <SectionLabel style={styles.label}>DETAILS</SectionLabel>
        <ListCard>
          <View style={styles.inputRow}>
            <Text style={text.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Maple & Co"
              placeholderTextColor={color.muted2}
              style={styles.input}
              autoFocus={!existing}
              accessibilityLabel="Business name"
            />
          </View>
          <View style={styles.inputRow}>
            <Text style={text.fieldLabel}>Short name</Text>
            <TextInput
              value={shortName}
              onChangeText={setShortName}
              placeholder="Optional — used in tight rows"
              placeholderTextColor={color.muted2}
              style={styles.input}
              accessibilityLabel="Short name"
            />
          </View>
          <FieldRow
            label="Type"
            value={KINDS.find((k) => k.value === kind)?.label}
            onPress={() => setSheet('kind')}
          />
          <FieldRow label="Currency" value={currency} onPress={() => setSheet('currency')} />
          <FieldRow label="Colour" value={ACCENTS[accent]} onPress={() => setSheet('accent')} />
        </ListCard>

        <SectionLabel style={styles.label}>TAX</SectionLabel>
        <ListCard>
          <FieldRow label="Tax treatment" value={tax.label} onPress={() => setSheet('tax')} />
          {tax.tax_label ? (
            <View style={styles.inputRow}>
              <Text style={text.fieldLabel}>Tax number</Text>
              <TextInput
                value={vatNumber}
                onChangeText={setVatNumber}
                placeholder="Optional — shown on invoices"
                placeholderTextColor={color.muted2}
                style={styles.input}
                autoCapitalize="characters"
                accessibilityLabel="Tax registration number"
              />
            </View>
          ) : null}
        </ListCard>

        <SectionLabel style={styles.label}>DEFAULTS</SectionLabel>
        <ListCard>
          <ToggleRow
            label="Use as my default business"
            value={isDefault}
            onChange={setIsDefault}
          />
        </ListCard>

        {isFirst ? (
          <Text style={styles.note}>
            A starter set of expense categories will be created with your first business.
            You can rename or add to them later.
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <DockedBar>
        <Button
          label={existing ? 'Save changes' : 'Create business'}
          disabled={!canSave}
          loading={saveBusiness.isPending}
          onPress={onSave}
        />
      </DockedBar>

      <PickerSheet
        visible={sheet === 'kind'}
        title="Type"
        options={KINDS.map<PickerOption<string>>((k) => ({ value: k.value, label: k.label }))}
        selected={kind}
        onSelect={(v) => setKind(v as BusinessKind)}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'currency'}
        title="Currency"
        options={currencyOptions()}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'accent'}
        title="Colour"
        options={ACCENTS.map<PickerOption<number>>((label, i) => ({ value: i, label }))}
        selected={accent}
        onSelect={setAccent}
        onClose={() => setSheet(null)}
      />
      <PickerSheet
        visible={sheet === 'tax'}
        title="Tax treatment"
        options={TAX_PRESETS.map<PickerOption<number>>((t, i) => ({ value: i, label: t.label }))}
        selected={taxIndex}
        onSelect={setTaxIndex}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.paper },
  content: { paddingBottom: 24 },
  preview: { alignItems: 'center', paddingVertical: 26, gap: 12 },
  previewName: { fontFamily: font.serif, fontSize: 26, color: color.ink },
  label: { marginTop: 6, marginBottom: 8 },
  inputRow: { paddingVertical: 12, paddingHorizontal: 16 },
  input: {
    marginTop: 6,
    height: 42,
    borderRadius: radius.button,
    backgroundColor: color.paper,
    borderWidth: 1,
    borderColor: alpha.border,
    paddingHorizontal: 12,
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: color.ink,
  },
  note: {
    marginTop: 16,
    paddingHorizontal: gutter.screen,
    fontFamily: font.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: color.muted,
  },
  error: {
    marginTop: 14,
    paddingHorizontal: gutter.screen,
    fontFamily: font.sans,
    fontSize: 13,
    color: color.red,
  },
});
