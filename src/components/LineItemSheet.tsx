import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { Button } from './Button';

export type LineItem = {
  description: string;
  detail?: string | null;
  qty: number;
  unitMinor: number;
};

/** Add / edit one invoice or quotation line. */
export function LineItemSheet({
  visible,
  initial,
  currencySymbol,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  initial?: LineItem | null;
  currencySymbol: string;
  onSave: (item: LineItem) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Seeded from `initial` on mount. The caller keys this component so opening the
  // sheet remounts it with fresh values, rather than syncing props into state.
  const [description, setDescription] = useState(initial?.description ?? '');
  const [detail, setDetail] = useState(initial?.detail ?? '');
  const [qty, setQty] = useState(String(initial?.qty ?? 1));
  const [unit, setUnit] = useState(initial ? String(initial.unitMinor / 100) : '');

  const qtyValue = Number.parseFloat(qty) || 0;
  const unitMinor = Math.round((Number.parseFloat(unit) || 0) * 100);
  const amount = Math.round(qtyValue * unitMinor);
  const valid = description.trim().length > 0 && amount > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={[text.microLabel, styles.title]}>
          {initial ? 'EDIT LINE' : 'ADD LINE'}
        </Text>

        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Brand identity — phase 2"
            placeholderTextColor={color.muted2}
            style={styles.input}
            autoFocus
          />
        </Field>

        <Field label="Detail (optional)">
          <TextInput
            value={detail}
            onChangeText={setDetail}
            placeholder="€70 / hour"
            placeholderTextColor={color.muted2}
            style={styles.input}
          />
        </Field>

        <View style={styles.split}>
          <Field label="Quantity" style={styles.half}>
            <TextInput
              value={qty}
              onChangeText={(v) => setQty(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </Field>
          <Field label={`Unit price (${currencySymbol})`} style={styles.half}>
            <TextInput
              value={unit}
              onChangeText={(v) => setUnit(v.replace(/[^0-9.]/g, ''))}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={color.muted2}
              style={styles.input}
            />
          </Field>
        </View>

        <Text style={styles.total}>
          {`Line total ${currencySymbol}${(amount / 100).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
        </Text>

        <View style={styles.actions}>
          {onDelete ? (
            <Button
              label="Remove"
              variant="outline"
              height={48}
              fullWidth={false}
              style={styles.removeButton}
              onPress={() => {
                onDelete();
                onClose();
              }}
            />
          ) : null}
          <Button
            label={initial ? 'Save line' : 'Add line'}
            height={48}
            disabled={!valid}
            onPress={() => {
              onSave({
                description: description.trim(),
                detail: detail.trim() || null,
                qty: qtyValue,
                unitMinor,
              });
              onClose();
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = themedStyles(() => ({
  scrim: { flex: 1, backgroundColor: 'rgba(15,28,46,0.35)' },
  sheet: {
    backgroundColor: color.paper,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: gutter.screen,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha.dashed,
  },
  title: { marginTop: 14 },
  field: { marginTop: 16 },
  fieldLabel: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.14,
    color: color.muted,
  },
  input: {
    marginTop: 6,
    height: 46,
    borderRadius: radius.button,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: alpha.border,
    paddingHorizontal: 14,
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: color.ink,
  },
  split: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  total: { marginTop: 16, fontFamily: font.sansSemi, fontSize: 13.5, color: color.ink },
  actions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  removeButton: { width: 120 },
}));
