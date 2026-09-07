import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { alpha, color, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';

/**
 * White tile with a micro label and a figure. `serif` gives the 24px Instrument
 * Serif treatment used for REVENUE / EXPENSES; the default is the 16px sans used
 * for TAX PAYABLE / CASH POSITION.
 */
export function StatTile({
  label,
  value,
  meta,
  serif = false,
}: {
  label: string;
  value: string;
  meta?: string | null;
  serif?: boolean;
}) {
  return (
    <View style={[styles.tile, serif ? styles.tileSerif : styles.tileSans]}>
      <Text style={text.microLabelSm}>{label}</Text>
      <Text style={serif ? styles.serifValue : styles.sansValue}>{value}</Text>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

/** Row of tiles with the design's 8px gutter. */
export function StatRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/**
 * Labelled progress row for the "where it went" breakdown: fixed-width name,
 * flexible track, right-aligned amount.
 */
export function ProgressRow({
  label,
  ratio,
  value,
  tint = color.ink,
}: {
  label: string;
  ratio: number;
  value: string;
  tint?: string;
}) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={styles.progressRow}>
      <Text style={styles.progressLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: tint }]} />
      </View>
      <Text style={styles.progressValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: color.card,
    borderWidth: 1,
    borderColor: alpha.border,
  },
  tileSerif: { padding: 14 },
  tileSans: { padding: 13 },
  serifValue: { marginTop: 5, fontFamily: font.serif, fontSize: 24, color: color.ink },
  sansValue: { marginTop: 4, fontFamily: font.sansSemi, fontSize: 16, color: color.ink },
  meta: { marginTop: 2, fontFamily: font.sans, fontSize: 11, color: color.muted },

  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressLabel: { width: 88, fontFamily: font.sans, fontSize: 12.5, color: color.muted },
  track: { flex: 1, height: 7, borderRadius: radius.pill, backgroundColor: alpha.track },
  fill: { height: 7, borderRadius: radius.pill },
  progressValue: {
    width: 60,
    textAlign: 'right',
    fontFamily: font.sansSemi,
    fontSize: 12.5,
    color: color.ink,
  },
});
