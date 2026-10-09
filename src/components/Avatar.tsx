import React from 'react';
import { Text, View, StyleProp, ViewStyle } from 'react-native';
import { businessAccents, color, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { initials as toInitials } from '@/lib/format';

/** Round initials chip on paper — contacts, and the user avatar on home. */
export function Avatar({
  name,
  size = 34,
  background = color.line,
  tint = color.muted,
}: {
  name: string;
  size?: number;
  background?: string;
  tint?: string;
}) {
  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: background },
      ]}
    >
      <Text style={[styles.initials, { color: tint, fontSize: size * 0.37 }]}>
        {toInitials(name)}
      </Text>
    </View>
  );
}

/**
 * Rounded-square business mark carrying the business accent, e.g. the green "M"
 * for Maple & Co. The design uses 22 / 30 / 32 / 34px depending on context.
 */
export function BusinessTile({
  name,
  accentIndex = 0,
  size = 32,
  style,
}: {
  name: string;
  accentIndex?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const tint = businessAccents[accentIndex] ?? businessAccents[0];
  // Radius tracks the tile size: 6 at 22px, 8 at 30px, 9 at 32-34px.
  const r = size <= 24 ? 6 : size <= 30 ? 8 : 9;

  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: r, backgroundColor: tint },
        style,
      ]}
    >
      <Text style={[styles.tileLetter, { fontSize: size * 0.41 }]}>
        {name.replace(/^\d+\s*/, '').charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

/** Fixed-text badge tile for banks: "CH", "N26", "AX". */
export function BadgeTile({
  label,
  background,
  tint = '#FFFFFF',
  size = 34,
}: {
  label: string;
  background: string;
  tint?: string;
  size?: number;
}) {
  return (
    <View
      style={[styles.center, { width: size, height: size, borderRadius: 9, backgroundColor: background }]}
    >
      <Text style={[styles.tileLetter, { color: tint, fontSize: label.length > 2 ? 10 : 12 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = themedStyles(() => ({
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'InstrumentSans_700Bold' },
  tileLetter: { fontFamily: 'InstrumentSans_700Bold', color: '#FFFFFF' },
}));
