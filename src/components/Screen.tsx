import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  TextStyle,
  StyleProp,
  ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, gutter } from '@/theme/tokens';
import { text } from '@/theme/type';

type ScreenProps = {
  children: React.ReactNode;
  /** Dark screens (sign-in) sit on ink; the preview screen on its own backdrop. */
  background?: string;
  /** Screens with a tab bar or a docked CTA render it outside the scroll view. */
  footer?: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
} & Pick<ScrollViewProps, 'refreshControl' | 'onScroll' | 'scrollEventThrottle'>;

/**
 * The design's frames are a column: safe-area top, then content, then a docked
 * footer pinned with margin-top:auto. Everything above the footer scrolls.
 */
export function Screen({
  children,
  background = color.paper,
  footer,
  scroll = true,
  contentContainerStyle,
  style,
  ...scrollProps
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // The export sets padding-top:56px for the status bar, then 8px before content.
  const paddingTop = insets.top + 8;

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        { paddingTop, paddingBottom: footer ? 24 : insets.bottom + 24 },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      {...scrollProps}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { paddingTop }, contentContainerStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: background }, style]}>
      {body}
      {footer}
    </View>
  );
}

/**
 * Serif screen title with the optional subtitle beneath, e.g.
 * "Expenses" / "62 items · $52,272 in September".
 */
export function ScreenHeader({
  title,
  subtitle,
  right,
  variant = 'default',
}: {
  title: string;
  subtitle?: string | null;
  right?: React.ReactNode;
  /** `month` is the smaller 27px serif used on home; `pl` the 29px on P&L. */
  variant?: 'default' | 'month' | 'pl';
}) {
  const titleStyle =
    variant === 'month' ? text.monthTitle : variant === 'pl' ? text.plTitle : text.screenTitle;

  return (
    <View style={[styles.header, right ? styles.headerRow : null]}>
      <View style={styles.flexShrink}>
        <Text style={titleStyle}>{title}</Text>
        {subtitle ? <Text style={[text.subtitle, styles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** ALL-CAPS 11px/600/0.16em section label. */
export function SectionLabel({
  children,
  right,
  style,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  /**
   * Callers only ever pass box spacing, but this lands on a <Text> when there is
   * no trailing element and a <View> when there is, so it must satisfy both.
   */
  style?: StyleProp<ViewStyle & TextStyle>;
}) {
  if (!right) {
    return <Text style={[text.microLabel, styles.sectionLabel, style]}>{children}</Text>;
  }
  return (
    <View style={[styles.sectionLabelRow, style]}>
      <Text style={text.microLabel}>{children}</Text>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  header: { paddingHorizontal: gutter.screen },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  subtitle: { marginTop: 4 },
  sectionLabel: { paddingHorizontal: gutter.screen },
  sectionLabelRow: {
    paddingHorizontal: gutter.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
