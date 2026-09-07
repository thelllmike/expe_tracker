import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, StyleProp, ViewStyle } from 'react-native';
import { alpha, color, radius } from '@/theme/tokens';
import { text } from '@/theme/type';

type Variant =
  | 'primary'   // green fill, white label — the main CTA
  | 'ink'       // ink fill, paper label — WhatsApp / "New" / "Send reminder"
  | 'outline'   // hairline border on paper — "Save draft", "Call"
  | 'onInk'     // translucent fill for buttons sitting on an ink panel
  | 'ghost';    // text only

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: color.green, fg: color.card },
  ink: { bg: color.ink, fg: color.paper },
  outline: { bg: 'transparent', fg: color.ink, border: alpha.borderHeavy },
  onInk: { bg: alpha.onInk14, fg: color.paper },
  ghost: { bg: 'transparent', fg: color.green },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  /** 52 is the docked CTA, 44 the send-row, 42 the buttons inside ink panels. */
  height = 52,
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  height?: number;
  size?: 'sm' | 'md';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          backgroundColor: v.bg,
          borderRadius: height >= 52 ? radius.card : height >= 44 ? radius.button : radius.action,
        },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        fullWidth ? styles.grow : null,
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[size === 'sm' ? styles.labelSm : text.cta, { color: v.fg }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Small pill-shaped action, e.g. "Convert to invoice", "Fix", "Send reminder". */
export function PillButton({
  label,
  onPress,
  variant = 'primary',
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
}) {
  const v = VARIANTS[variant];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pillButton,
        { backgroundColor: v.bg },
        v.border ? { borderWidth: 1, borderColor: v.border } : null,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.pillButtonLabel, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** Green inline text action: "Compare", "Review", "+ Add", "Mark all read". */
export function LinkButton({
  label,
  onPress,
  tint = color.green,
}: {
  label: string;
  onPress?: () => void;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Text style={[text.link, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  grow: { flex: 1 },
  labelSm: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 13.5 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.45 },
  pillButton: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillButtonLabel: { fontFamily: 'InstrumentSans_600SemiBold', fontSize: 11.5 },
});
