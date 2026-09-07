import React from 'react';
import { Pressable, StyleSheet, Text, View, StyleProp, ViewStyle } from 'react-native';
import { alpha, color, radius } from '@/theme/tokens';
import { text } from '@/theme/type';

/** The vertical accent stripe that marks which business a row belongs to. */
export function AccentBar({ tint, height = 30, width = 6 }: { tint: string; height?: number; width?: number }) {
  return <View style={{ width, height, borderRadius: radius.pill, backgroundColor: tint }} />;
}

type RowProps = {
  title: string;
  meta?: string | null;
  /** Right-hand primary value, e.g. an amount. */
  value?: string | null;
  /** Right-hand secondary line under the value. */
  valueMeta?: string | null;
  valueColor?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Ledger-style row: optional leading element, title + meta, trailing amount. */
export function Row({
  title,
  meta,
  value,
  valueMeta,
  valueColor = color.ink,
  left,
  right,
  onPress,
  style,
}: RowProps) {
  const body = (
    <View style={[styles.row, style]}>
      {left}
      <View style={styles.grow}>
        <Text style={text.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {meta ? (
          <Text style={[text.rowMeta, styles.meta]} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {value != null ? (
        <View style={styles.valueBlock}>
          <Text style={[text.amount, { color: valueColor }]}>{value}</Text>
          {valueMeta ? <Text style={[text.rowMeta, styles.meta]}>{valueMeta}</Text> : null}
        </View>
      ) : null}
      {right}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.pressed : null)}>
      {body}
    </Pressable>
  );
}

/**
 * Settings / detail row: muted label on the left, semibold value with a chevron
 * on the right. The chevron is the design's ‹›-style single angle.
 */
export function FieldRow({
  label,
  value,
  left,
  onPress,
  chevron = true,
}: {
  label: string;
  value?: string | null;
  /** Replaces the plain text value, e.g. the business tile + name on invoices. */
  left?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <View style={styles.fieldRow}>
      <Text style={text.fieldLabel}>{label}</Text>
      <View style={styles.fieldValue}>
        {left}
        {value != null ? (
          <Text style={text.fieldValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {chevron && onPress ? <Chevron /> : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      {body}
    </Pressable>
  );
}

/** Navigation row: bold title, meta beneath, trailing chevron. */
export function NavRow({
  title,
  meta,
  onPress,
}: {
  title: string;
  meta?: string | null;
  onPress?: () => void;
}) {
  return (
    <Row
      title={title}
      meta={meta}
      onPress={onPress}
      right={<Chevron />}
      style={styles.navRow}
    />
  );
}

export function Chevron({ tint = color.muted2 }: { tint?: string }) {
  return <Text style={[styles.chevron, { color: tint }]}>›</Text>;
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navRow: { paddingVertical: 15 },
  grow: { flex: 1, minWidth: 0 },
  meta: { marginTop: 2 },
  valueBlock: { alignItems: 'flex-end' },
  fieldRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  chevron: { fontSize: 18, lineHeight: 20, marginLeft: 2 },
  pressed: { opacity: 0.6, backgroundColor: alpha.divider },
});
