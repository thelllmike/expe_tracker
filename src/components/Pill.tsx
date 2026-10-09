import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { text } from '@/theme/type';

/**
 * Filter chip. Selected = ink fill with paper text; idle = white with a hairline.
 * `large` is the 12.5px variant used for business selectors and the "New" button.
 */
export function Pill({
  label,
  selected = false,
  large = false,
  tint,
  onPress,
}: {
  label: string;
  selected?: boolean;
  large?: boolean;
  /** Overrides the selected fill, e.g. green for a confirmed bank suggestion. */
  tint?: string;
  onPress?: () => void;
}) {
  const fill = selected ? tint ?? color.ink : color.card;
  const labelColor = selected ? color.paper : color.muted;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.pill,
        large ? styles.pillLarge : styles.pillSmall,
        { backgroundColor: fill },
        !selected && styles.pillIdle,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[large ? text.pillLg : text.pill, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Soft-tinted informational chip used on bank-feed suggestions. */
export function SoftPill({
  label,
  background,
  tint,
}: {
  label: string;
  background: string;
  tint: string;
}) {
  return (
    <View style={[styles.softPill, { backgroundColor: background }]}>
      <Text style={[styles.softPillText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Horizontally scrolling chip row that bleeds to the screen edge. */
export function PillRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillRow}
    >
      {children}
    </ScrollView>
  );
}

const styles = themedStyles(() => ({
  pill: { borderRadius: radius.pill, justifyContent: 'center' },
  pillSmall: { paddingVertical: 8, paddingHorizontal: 13 },
  pillLarge: { paddingVertical: 9, paddingHorizontal: 15 },
  pillIdle: { borderWidth: 1, borderColor: alpha.borderStrong },
  pillRow: { paddingHorizontal: gutter.screen, gap: 7, flexDirection: 'row' },
  pressed: { opacity: 0.7 },
  softPill: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: radius.pill },
  softPillText: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11.5 },
}));
