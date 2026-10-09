import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { alpha, color, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { text } from '@/theme/type';

/**
 * 44×26 track, 20px knob, 3px inset — the export's exact geometry.
 * Green when on, rgba(15,28,46,0.14) when off.
 */
export function Toggle({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: boolean;
  onChange?: (next: boolean) => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={() => onChange?.(!value)}
      disabled={!onChange}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.track,
        { backgroundColor: value ? color.green : alpha.toggleOff },
        value ? styles.on : styles.off,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.knob} />
    </Pressable>
  );
}

/** Toggle wrapped in a labelled row for the settings-style panels. */
export function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[text.fieldLabel, styles.rowLabel]}>{label}</Text>
      <Toggle value={value} onChange={onChange} accessibilityLabel={label} />
    </View>
  );
}

const styles = themedStyles(() => ({
  track: {
    width: 44,
    height: 26,
    borderRadius: radius.pill,
    padding: 3,
    flexDirection: 'row',
  },
  on: { justifyContent: 'flex-end' },
  off: { justifyContent: 'flex-start' },
  knob: { width: 20, height: 20, borderRadius: radius.pill, backgroundColor: color.card },
  pressed: { opacity: 0.8 },
  row: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  // The toggle rows use ink text, not the muted field label.
  rowLabel: { color: color.ink, flexShrink: 1 },
}));
