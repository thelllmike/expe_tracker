import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter } from '@/theme/tokens';

/**
 * White footer pinned to the bottom with a hairline above it — the "Save expense"
 * and "Save draft / Send invoice" bars. The export pads 14px top, 34px bottom;
 * on device the bottom padding becomes the home-indicator inset.
 */
export function DockedBar({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 20) + 14 }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 14,
    paddingHorizontal: gutter.screen,
    backgroundColor: color.card,
    borderTopWidth: 1,
    borderTopColor: alpha.tabBorder,
    flexDirection: 'row',
    gap: 10,
  },
});
