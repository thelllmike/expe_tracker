import React from 'react';
import { Text, View, StyleProp, ViewStyle } from 'react-native';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';

/** Dark surface used for the home hero, the P&L net card and the tax card. */
export function InkPanel({
  children,
  variant = 'hero',
  inset = true,
  style,
}: {
  children: React.ReactNode;
  /** hero = 18px radius / 20px padding; card = 14px radius / 16px padding. */
  variant?: 'hero' | 'card';
  inset?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.panel,
        variant === 'hero' ? styles.hero : styles.card,
        inset && styles.inset,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** ALL-CAPS label at 62% paper — the standard heading inside an ink panel. */
export function InkLabel({ children, small = false }: { children: React.ReactNode; small?: boolean }) {
  return (
    <Text style={[small ? text.microLabelSm : text.microLabel, styles.inkLabel]}>{children}</Text>
  );
}

/** Serif figure on ink, optionally with a trailing delta in bright green. */
export function InkFigure({
  value,
  size = 44,
  delta,
  tint = color.onInk,
}: {
  value: string;
  size?: number;
  delta?: string | null;
  tint?: string;
}) {
  return (
    <View style={styles.figureRow}>
      <Text style={{ fontFamily: font.serif, fontSize: size, lineHeight: size * 1.02, color: tint }}>
        {value}
      </Text>
      {delta ? <Text style={styles.delta}>{delta}</Text> : null}
    </View>
  );
}

/**
 * IN / OUT split bar. `ratio` is 0–1 of the widest row, matching the design where
 * IN fills the track completely and OUT is drawn proportionally against it.
 */
export function InkBarRow({
  label,
  ratio,
  value,
  tint,
}: {
  label: string;
  ratio: number;
  value: string;
  tint: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${clamped * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

/** Hairline-separated footer inside an ink panel. */
export function InkFooter({ children }: { children: React.ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

export function InkFooterText({
  children,
  strong = false,
}: {
  children: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <Text style={[styles.footerText, strong && styles.footerStrong]}>{children}</Text>
  );
}

const styles = themedStyles(() => ({
  panel: { backgroundColor: color.inkSurface },
  hero: { borderRadius: radius.hero, padding: 20 },
  card: { borderRadius: radius.card, padding: 16 },
  inset: { marginHorizontal: gutter.screen },
  inkLabel: { color: alpha.onInk62 },
  figureRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 6 },
  delta: { fontFamily: font.sansSemi, fontSize: 13, color: color.greenBright },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 44, fontFamily: font.sans, fontSize: 11, color: alpha.onInk62 },
  barTrack: { flex: 1, height: 8, borderRadius: radius.pill, backgroundColor: alpha.onInk14 },
  barFill: { height: 8, borderRadius: radius.pill },
  barValue: {
    width: 74,
    textAlign: 'right',
    fontFamily: font.sansSemi,
    fontSize: 13,
    color: color.onInk,
  },
  footer: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: alpha.onInk14,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontFamily: font.sans, fontSize: 12.5, color: alpha.onInk70 },
  footerStrong: { fontFamily: font.sansSemi, color: color.onInk },
}));
