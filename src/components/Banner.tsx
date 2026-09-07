import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { font } from '@/theme/type';

export type BannerTone = 'amber' | 'green' | 'red';

const TONES: Record<BannerTone, { bg: string; border: string; body: string }> = {
  amber: { bg: color.amberSoft, border: alpha.amberBorderSoft, body: color.amberMuted },
  green: { bg: color.greenSoft, border: alpha.greenBorderSoft, body: color.greenDeep },
  red: { bg: color.redSoft, border: alpha.redBorder, body: color.red },
};

/**
 * Tinted strip: the overdue alert on home, the "4 receipts waiting" prompt on the
 * expenses list, the export-ready note on the receipt inbox.
 */
export function Banner({
  title,
  body,
  tone = 'amber',
  right,
  inset = true,
}: {
  /** Bold ink headline. Omit for a single-line informational strip. */
  title?: string;
  body?: string;
  tone?: BannerTone;
  right?: React.ReactNode;
  inset?: boolean;
}) {
  const t = TONES[tone];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: t.bg, borderColor: t.border },
        inset && styles.inset,
      ]}
    >
      <View style={styles.grow}>
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {body ? (
          <Text style={[styles.body, { color: t.body }, title ? styles.bodySpaced : null]}>
            {body}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inset: { marginHorizontal: gutter.screen },
  grow: { flex: 1 },
  title: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.ink },
  body: { fontFamily: font.sans, fontSize: 13, lineHeight: 19.5 },
  bodySpaced: { marginTop: 2, fontSize: 12, lineHeight: 18 },
});

