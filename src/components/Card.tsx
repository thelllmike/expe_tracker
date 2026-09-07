import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { alpha, color, radius, gutter } from '@/theme/tokens';

type CardProps = {
  children: React.ReactNode;
  /** `panel` (16) groups rows; `card` (14) is a standalone tile. */
  variant?: 'panel' | 'card' | 'hero';
  /** Coloured border for status, e.g. overdue invoices. */
  borderColor?: string;
  background?: string;
  padded?: boolean;
  /** Adds the standard 22px screen gutter as horizontal margin. */
  inset?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * White surface on paper: 1px hairline, no shadow. The design only ever varies
 * the radius (14 / 16 / 18) and, for status, the border colour.
 */
export function Card({
  children,
  variant = 'panel',
  borderColor,
  background = color.card,
  padded = false,
  inset = true,
  onPress,
  style,
}: CardProps) {
  const cardStyle: StyleProp<ViewStyle> = [
    styles.base,
    {
      borderRadius: variant === 'hero' ? radius.hero : variant === 'card' ? radius.card : radius.panel,
      backgroundColor: background,
      borderColor: borderColor ?? alpha.border,
      // A status border is 1px in the export except where it marks a selection.
      borderWidth: 1,
    },
    padded && styles.padded,
    inset && styles.inset,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

/**
 * A card whose children are rows separated by hairlines. Clips its children so
 * row backgrounds follow the corner radius (the export uses overflow:hidden).
 */
export function ListCard({
  children,
  inset = true,
  borderColor,
  style,
}: {
  children: React.ReactNode;
  inset?: boolean;
  borderColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <Card variant="panel" inset={inset} borderColor={borderColor} style={[styles.clip, style]}>
      {items.map((child, i) => (
        <View key={i} style={i < items.length - 1 ? styles.divided : undefined}>
          {child}
        </View>
      ))}
    </Card>
  );
}

/** Dashed "+ Add a business" / "+ Link another account" affordance. */
export function DashedCard({
  children,
  onPress,
  height,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.dashed,
        height ? { height } : null,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  clip: { padding: 0 },
  padded: { padding: 16 },
  inset: { marginHorizontal: gutter.screen },
  pressed: { opacity: 0.72 },
  divided: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: alpha.divider },
  dashed: {
    marginHorizontal: gutter.screen,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: alpha.dashed,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
