import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setActiveTheme, themed } from './tokens';
import type { ThemeName } from './tokens';

/** What the user picked in Settings. `system` follows the phone. */
export type ThemePreference = 'system' | ThemeName;

const STORAGE_KEY = 'ledger.theme';

type ThemeState = {
  /** The theme on screen right now. */
  theme: ThemeName;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

/**
 * Drop-in for `StyleSheet.create` whose sheet follows the active theme: the
 * factory is re-run the first time the sheet is read under each theme.
 */
export function themedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: () => T & StyleSheet.NamedStyles<any>,
): T {
  return themed(() => StyleSheet.create(factory()) as T);
}

/**
 * Resolves the theme and remounts everything beneath it when it changes. The
 * remount is what makes module-level style sheets pick up the new palette —
 * they are read during render, and nothing else would trigger one everywhere.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [preference, setStored] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && (value === 'light' || value === 'dark' || value === 'system')) {
          setStored(value);
        }
      })
      // An unreadable preference just means following the phone.
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setStored(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const theme: ThemeName =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  // Set during render, before any child reads a colour.
  setActiveTheme(theme);

  const value = useMemo(
    () => ({ theme, preference, setPreference }),
    [theme, preference, setPreference],
  );

  // Hold the first frame until the saved choice is known, so a dark-mode user
  // is not flashed the light theme on every launch.
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      <React.Fragment key={theme}>{children}</React.Fragment>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
