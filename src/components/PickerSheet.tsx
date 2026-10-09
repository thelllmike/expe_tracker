import React from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';

export type PickerOption<T> = { value: T; label: string; meta?: string | null };

/**
 * Bottom sheet used by every "row › " field — category, vendor, account, client,
 * currency, terms. Keeps the field rows in the design purely presentational.
 */
export function PickerSheet<T extends string | number>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  footer,
  onCreate,
  createLabel,
}: {
  visible: boolean;
  title: string;
  options: PickerOption<T>[];
  selected?: T | null;
  onSelect: (value: T) => void;
  onClose: () => void;
  footer?: React.ReactNode;
  /**
   * Renders an inline "add" field at the bottom of the sheet. Without it a fresh
   * account has no way to create the first vendor, client or account.
   */
  onCreate?: (name: string) => Promise<void> | void;
  createLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submitCreate = async () => {
    const name = draft.trim();
    if (!name || !onCreate || saving) return;
    setSaving(true);
    try {
      await onCreate(name);
      setDraft('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.grabber} />
        <Text style={[text.microLabel, styles.title]}>{title.toUpperCase()}</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {options.map((option, i) => {
            const isSelected = selected != null && option.value === selected;
            return (
              <Pressable
                key={String(option.value)}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                style={({ pressed }) => [
                  styles.option,
                  i < options.length - 1 && styles.optionDivided,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.optionBody}>
                  <Text style={[text.fieldValue, isSelected && styles.optionSelected]}>
                    {option.label}
                  </Text>
                  {option.meta ? <Text style={styles.optionMeta}>{option.meta}</Text> : null}
                </View>
                {isSelected ? <Text style={styles.tick}>✓</Text> : null}
              </Pressable>
            );
          })}

          {options.length === 0 ? (
            <Text style={[text.body, styles.empty]}>Nothing to choose from yet.</Text>
          ) : null}
        </ScrollView>

        {onCreate ? (
          <View style={styles.createRow}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={createLabel ?? 'Add new…'}
              placeholderTextColor={color.muted2}
              style={styles.createInput}
              returnKeyType="done"
              onSubmitEditing={submitCreate}
              accessibilityLabel={createLabel ?? 'Add new'}
            />
            <Pressable
              onPress={submitCreate}
              disabled={!draft.trim() || saving}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.createButton,
                (!draft.trim() || saving) && styles.createDisabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.createButtonLabel}>{saving ? '…' : 'Add'}</Text>
            </Pressable>
          </View>
        ) : null}

        {footer}
      </View>
    </Modal>
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
    maxHeight: '72%',
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: alpha.dashed,
  },
  title: { marginTop: 14 },
  list: { marginTop: 10 },
  option: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionDivided: { borderBottomWidth: 1, borderBottomColor: alpha.divider },
  optionBody: { flex: 1 },
  optionSelected: { color: color.green },
  optionMeta: { marginTop: 2, fontFamily: font.sans, fontSize: 11.5, color: color.muted },
  tick: { fontFamily: font.sansBold, fontSize: 15, color: color.green },
  empty: { paddingVertical: 20 },
  pressed: { opacity: 0.6 },
  createRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: alpha.divider,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  createInput: {
    flex: 1,
    height: 44,
    borderRadius: radius.button,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: alpha.border,
    paddingHorizontal: 14,
    fontFamily: font.sansMedium,
    fontSize: 15,
    color: color.ink,
  },
  createButton: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: radius.button,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createDisabled: { opacity: 0.4 },
  createButtonLabel: { fontFamily: font.sansSemi, fontSize: 14, color: color.onAccent },
}));
