import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { color, gutter } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { text } from '@/theme/type';

/**
 * Modal header: muted action left, ink title centred, green action right.
 * Used by add-expense ("Cancel / New expense / Save"), create-invoice and preview.
 */
export function NavBar({
  left,
  title,
  right,
  onLeft,
  onRight,
  rightDisabled = false,
}: {
  left?: string;
  title?: string;
  right?: string;
  onLeft?: () => void;
  onRight?: () => void;
  rightDisabled?: boolean;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {left ? (
          <NavAction label={left} tint={color.muted} onPress={onLeft} align="flex-start" />
        ) : null}
      </View>
      {title ? (
        <Text style={[text.navAction, styles.title]} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      <View style={styles.side}>
        {right ? (
          <NavAction
            label={right}
            tint={color.green}
            onPress={onRight}
            disabled={rightDisabled}
            align="flex-end"
          />
        ) : null}
      </View>
    </View>
  );
}

function NavAction({
  label,
  tint,
  onPress,
  disabled,
  align,
}: {
  label: string;
  tint: string;
  onPress?: () => void;
  disabled?: boolean;
  align: 'flex-start' | 'flex-end';
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={10}
      style={({ pressed }) => [
        { alignSelf: align },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[text.navAction, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  bar: {
    paddingHorizontal: gutter.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  side: { flex: 1 },
  title: { color: color.ink, flexShrink: 0 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
}));
