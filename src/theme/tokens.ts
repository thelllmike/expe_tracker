/**
 * Design tokens transcribed from design/Ledger_-_Multi-Business_Expenses_dc.html.
 * Every value here appears literally in the export's inline styles — if a value
 * is not in that file it does not belong in this file.
 */

export const color = {
  ink: '#0F1C2E',
  muted: '#5B6B7C',
  muted2: '#6E7B88',
  paper: '#F5F3EE',
  card: '#FFFFFF',
  line: '#F0EEE8',

  green: '#0FA36B',
  greenDark: '#1B6B4D',
  greenDeep: '#20614A',
  greenSoft: '#EAF6F0',
  greenBright: '#5FE0A6', // on-ink positive figures
  greenHover: '#0B7C51',

  amber: '#E9A23B',
  amberSoft: '#FDF3E2',
  amberText: '#8A5E14',
  amberMuted: '#8A7A5E', // sub-copy inside the amber alert strip

  blue: '#3B6EF6',
  blueSoft: '#EDF1FB',
  blueDark: '#2F55BE',

  red: '#B0392C',
  redSoft: '#FBECEA',

  /** Preview screen sits on a darker ground than the rest of the app. */
  previewBackdrop: '#E4E1DA',
} as const;

/** Translucent values, kept separate because they are rgba() in the export. */
export const alpha = {
  /** Hairline + card borders on paper. */
  border: 'rgba(15,28,46,0.07)',
  borderStrong: 'rgba(15,28,46,0.1)',
  borderHeavy: 'rgba(15,28,46,0.14)',
  divider: 'rgba(15,28,46,0.06)',
  tabBorder: 'rgba(15,28,46,0.08)',
  dashed: 'rgba(15,28,46,0.18)',
  dashedLight: 'rgba(15,28,46,0.2)',
  track: 'rgba(15,28,46,0.08)',
  docRule: 'rgba(15,28,46,0.12)',
  docRuleSoft: 'rgba(15,28,46,0.1)',
  toggleOff: 'rgba(15,28,46,0.14)',

  /** On the ink surface. */
  onInk62: 'rgba(245,243,238,0.62)',
  onInk60: 'rgba(245,243,238,0.6)',
  onInk66: 'rgba(245,243,238,0.66)',
  onInk70: 'rgba(245,243,238,0.7)',
  onInk72: 'rgba(245,243,238,0.72)',
  onInk50: 'rgba(245,243,238,0.5)',
  onInk20: 'rgba(245,243,238,0.2)',
  onInk14: 'rgba(245,243,238,0.14)',
  onInk10: 'rgba(245,243,238,0.1)',
  onInk08: 'rgba(245,243,238,0.08)',
  onInk40: 'rgba(245,243,238,0.4)',

  /** Status card borders. */
  redBorder: 'rgba(192,57,43,0.3)',
  greenBorder: 'rgba(15,163,107,0.4)',
  greenBorderSoft: 'rgba(15,163,107,0.28)',
  greenFill25: 'rgba(15,163,107,0.25)',
  amberBorder: 'rgba(233,162,59,0.4)',
  amberBorderSoft: 'rgba(233,162,59,0.35)',
} as const;

/** Per-business accent, assigned by index in the design (green, blue, amber). */
export const businessAccents = [color.green, color.blue, color.amber] as const;

export const radius = {
  doc: 6,
  chip: 5,
  thumb: 6,
  tile: 9,
  input: 10,
  action: 11,
  button: 12,
  card: 14,
  panel: 16,
  hero: 18,
  pill: 999,
} as const;

/** The design's horizontal gutter is 22px on every screen except sign-in (26) and preview (20). */
export const gutter = {
  screen: 22,
  auth: 26,
  preview: 20,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const shadow = {
  /** box-shadow: 0 12px 28px rgba(15,28,46,0.12) on the invoice document. */
  document: {
    shadowColor: '#0F1C2E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
