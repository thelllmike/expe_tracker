/**
 * Design tokens transcribed from design/Ledger_-_Multi-Business_Expenses_dc.html.
 * Every value here appears literally in the export's inline styles — if a value
 * is not in that file it does not belong in this file.
 */

export type ThemeName = 'light' | 'dark';

/**
 * The light palette is the design export, value for value. The dark palette is
 * not in the export: it keeps the same roles and flips the ground, so `ink` is
 * always "the text colour on paper" and `paper` "the page behind it".
 *
 * Three roles do not flip, because the surface under them stays dark or tinted
 * in both themes: `night` (the sign-in ground), `onInk` (text on an ink panel)
 * and `onAccent` (text on a green or blue fill).
 */
const lightColor = {
  ink: '#0F1C2E',
  muted: '#5B6B7C',
  muted2: '#6E7B88',
  paper: '#F5F3EE',
  card: '#FFFFFF',
  line: '#F0EEE8',

  /** Fill of the hero / ink panels. Same as `ink` in light, a raised navy in dark. */
  inkSurface: '#0F1C2E',
  /** Sign-in, reset and splash ground — identical in both themes. */
  night: '#0F1C2E',
  /** Text on `inkSurface` and `night`. */
  onInk: '#F5F3EE',
  /** Text on a green or blue fill. */
  onAccent: '#FFFFFF',

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
};

type Palette = { [K in keyof typeof lightColor]: string };

const darkColor: Palette = {
  ink: '#F2EFE8',
  muted: '#9AA8B6',
  muted2: '#8593A1',
  paper: '#0B1422',
  card: '#152236',
  line: '#1E2C40',

  inkSurface: '#1C2F4C',
  night: '#0F1C2E',
  onInk: '#F5F3EE',
  onAccent: '#FFFFFF',

  green: '#12B076',
  greenDark: '#5FD3A0',
  greenDeep: '#7ADDB0',
  greenSoft: '#12302A',
  greenBright: '#5FE0A6',
  greenHover: '#0FA36B',

  amber: '#E9A23B',
  amberSoft: '#33270F',
  amberText: '#F0BF6B',
  amberMuted: '#C9B58F',

  blue: '#6C93FF',
  blueSoft: '#17233F',
  blueDark: '#9BB6FF',

  red: '#FF8A7A',
  redSoft: '#3A1A17',

  previewBackdrop: '#060C16',
};

/** Translucent values, kept separate because they are rgba() in the export. */
const lightAlpha = {
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
};

type Alphas = { [K in keyof typeof lightAlpha]: string };

const darkAlpha: Alphas = {
  ...lightAlpha,
  // The hairlines are ink-on-paper in the export; on a dark ground they are the
  // same idea drawn in the light text colour, a touch stronger to stay visible.
  border: 'rgba(242,239,232,0.1)',
  borderStrong: 'rgba(242,239,232,0.14)',
  borderHeavy: 'rgba(242,239,232,0.2)',
  divider: 'rgba(242,239,232,0.08)',
  tabBorder: 'rgba(242,239,232,0.1)',
  dashed: 'rgba(242,239,232,0.24)',
  dashedLight: 'rgba(242,239,232,0.26)',
  track: 'rgba(242,239,232,0.12)',
  docRule: 'rgba(242,239,232,0.16)',
  docRuleSoft: 'rgba(242,239,232,0.14)',
  toggleOff: 'rgba(242,239,232,0.2)',
  redBorder: 'rgba(255,138,122,0.4)',
};

const palettes: Record<ThemeName, { color: Palette; alpha: Alphas }> = {
  light: { color: lightColor, alpha: lightAlpha },
  dark: { color: darkColor, alpha: darkAlpha },
};

// ------------------------------------------------------------- active theme
// Styles across the app are module-level objects, so the theme cannot arrive
// through props. Instead `color` and `alpha` read through to whichever palette
// is active, and `themed()` rebuilds anything derived from them per theme. The
// provider in ./theme.tsx sets the active theme and remounts the tree.

let active: ThemeName = 'light';

export function setActiveTheme(name: ThemeName) {
  active = name;
}

export function activeTheme(): ThemeName {
  return active;
}

function live<T extends object>(pick: () => T): T {
  return new Proxy({} as T, {
    get: (_target, key) => pick()[key as keyof T],
    has: (_target, key) => key in pick(),
    ownKeys: () => Reflect.ownKeys(pick()),
    getOwnPropertyDescriptor: (_target, key) => {
      const value = pick()[key as keyof T];
      return value === undefined
        ? undefined
        : { value, enumerable: true, configurable: true, writable: false };
    },
  });
}

export const color: Palette = live(() => palettes[active].color);
export const alpha: Alphas = live(() => palettes[active].alpha);

/**
 * For anything built from `color` / `alpha` outside a render — a tone table, a
 * style sheet. The factory runs once per theme, the first time it is read.
 */
export function themed<T extends object>(factory: () => T): T {
  const cache: Partial<Record<ThemeName, T>> = {};
  return live(() => (cache[active] ??= factory()));
}

/** Per-business accent, assigned by index in the design (green, blue, amber). */
export const businessAccents: readonly string[] = themed(() => [color.green, color.blue, color.amber]);

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
