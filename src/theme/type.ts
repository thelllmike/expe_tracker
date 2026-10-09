import { TextStyle } from 'react-native';
import { color, themed } from './tokens';

/**
 * Font families as registered by expo-font in app/_layout.tsx.
 * Instrument Serif ships a single weight; Instrument Sans carries 400-700.
 */
export const font = {
  sans: 'InstrumentSans_400Regular',
  sansMedium: 'InstrumentSans_500Medium',
  sansSemi: 'InstrumentSans_600SemiBold',
  sansBold: 'InstrumentSans_700Bold',
  serif: 'InstrumentSerif_400Regular',
} as const;

/**
 * Named text styles, each traced to the screen it comes from.
 * Sizes are the export's literal px values (React Native treats them as dp).
 */
export const text = themed(() => ({
  /** Serif headline number, e.g. "$31,848" on the home hero. */
  heroNumber: { fontFamily: font.serif, fontSize: 44, lineHeight: 44 } as TextStyle,
  /** Screen title, e.g. "Expenses", "Invoices", "People". */
  screenTitle: { fontFamily: font.serif, fontSize: 30, color: color.ink } as TextStyle,
  /** Home's month title — a shade smaller than the other screen titles. */
  monthTitle: { fontFamily: font.serif, fontSize: 27, color: color.ink } as TextStyle,
  /** P&L title. */
  plTitle: { fontFamily: font.serif, fontSize: 29, color: color.ink } as TextStyle,
  /** Sign-in headline. */
  authTitle: { fontFamily: font.serif, fontSize: 44, lineHeight: 47.5, color: color.onInk } as TextStyle,

  /** ALL-CAPS micro label: 11px / 600 / 0.16em, muted. */
  microLabel: {
    fontFamily: font.sansSemi,
    fontSize: 11,
    letterSpacing: 11 * 0.16,
    color: color.muted,
  } as TextStyle,
  /** Slightly tighter micro label used inside tiles and on ink. */
  microLabelSm: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.14,
    color: color.muted,
  } as TextStyle,
  /** Document micro label on the invoice PDF: 9.5px / 700 / 0.12em. */
  microLabelDoc: {
    fontFamily: font.sansBold,
    fontSize: 9.5,
    letterSpacing: 9.5 * 0.12,
    color: color.muted2,
  } as TextStyle,
  /** Table head on the compare screen: 10.5px / 600 / 0.12em. */
  tableHead: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.12,
    color: color.muted,
  } as TextStyle,

  /** Primary list row title. */
  rowTitle: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink } as TextStyle,
  /** Card title, marginally larger than a row title. */
  cardTitle: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink } as TextStyle,
  /** Secondary line under a row title. */
  rowMeta: { fontFamily: font.sans, fontSize: 11.5, color: color.muted } as TextStyle,
  /** Sub-copy under business cards on home. */
  cardMeta: { fontFamily: font.sans, fontSize: 12, color: color.muted } as TextStyle,
  /** Screen subtitle under a serif title. */
  subtitle: { fontFamily: font.sans, fontSize: 13, color: color.muted } as TextStyle,

  /** Left-hand label in a settings/detail row. */
  fieldLabel: { fontFamily: font.sans, fontSize: 13.5, color: color.muted } as TextStyle,
  /** Right-hand value in a settings/detail row. */
  fieldValue: { fontFamily: font.sansSemi, fontSize: 14, color: color.ink } as TextStyle,

  /** Amount at the right of a list row. */
  amount: { fontFamily: font.sansSemi, fontSize: 14.5, color: color.ink } as TextStyle,
  /** Serif amount on invoice and quotation cards. */
  amountSerif: { fontFamily: font.serif, fontSize: 20, color: color.ink } as TextStyle,

  /** Pill / chip label. */
  pill: { fontFamily: font.sansSemi, fontSize: 12 } as TextStyle,
  /** Business selector pill on add-expense, and the "New" button. */
  pillLg: { fontFamily: font.sansSemi, fontSize: 12.5 } as TextStyle,
  /** Status badge: 10.5px / 700 / 0.08em. */
  badge: {
    fontFamily: font.sansBold,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.08,
  } as TextStyle,

  /** Nav-bar action, e.g. "Cancel" / "Save". */
  navAction: { fontFamily: font.sansSemi, fontSize: 14 } as TextStyle,
  /** Inline green link, e.g. "Compare", "Review", "+ Add". */
  link: { fontFamily: font.sansSemi, fontSize: 12.5, color: color.green } as TextStyle,
  /** Primary CTA label. */
  cta: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.onAccent } as TextStyle,
  /** Secondary CTA label. */
  ctaSecondary: { fontFamily: font.sansSemi, fontSize: 15, color: color.ink } as TextStyle,

  /** Tab bar item — inactive. */
  tab: {
    fontFamily: font.sansSemi,
    fontSize: 9.5,
    letterSpacing: 9.5 * 0.14,
    color: color.muted2,
  } as TextStyle,
  /** Tab bar item — active. */
  tabActive: {
    fontFamily: font.sansBold,
    fontSize: 9.5,
    letterSpacing: 9.5 * 0.14,
    color: color.green,
  } as TextStyle,

  /** Body copy inside insight cards, with the design's 1.5 line-height. */
  body: { fontFamily: font.sans, fontSize: 13, lineHeight: 19.5, color: color.muted } as TextStyle,
}));
