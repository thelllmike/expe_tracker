import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthState = {
  session: Session | null;
  /** True until the persisted session has been read back from storage. */
  loading: boolean;
  sendMagicLink: (email: string) => Promise<void>;
  /** Resolves 'confirm' when Supabase requires the emailed link before signing in. */
  signUpWithPassword: (a: Credentials & { fullName: string }) => Promise<'session' | 'confirm'>;
  signInWithPassword: (a: Credentials) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export type Credentials = { email: string; password: string };

/** Supabase's wording for an account that exists but has not clicked the link. */
export const NEEDS_CONFIRMATION = 'email-not-confirmed';

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /**
   * Both the magic link and the OAuth callback come back as a deep link carrying
   * the tokens in the URL fragment. Native has no `detectSessionInUrl`, so parse
   * them here and hand them to supabase-js.
   */
  const consumeAuthUrl = useCallback(async (url: string) => {
    const fragment = url.split('#')[1];
    if (!fragment) return false;
    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return false;

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;
    return true;
  }, []);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      void consumeAuthUrl(url);
    });
    // A cold start from a magic link arrives as the initial URL, not an event.
    void Linking.getInitialURL().then((url) => {
      if (url) void consumeAuthUrl(url);
    });
    return () => sub.remove();
  }, [consumeAuthUrl]);

  const signUpWithPassword = useCallback(
    async ({ email, password, fullName }: Credentials & { fullName: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: Linking.createURL('/auth-callback'),
          // The signup trigger reads full_name out of raw_user_meta_data to fill
          // in the profile row and its initials.
          data: { full_name: fullName.trim() },
        },
      });
      if (error) throw error;
      // With email confirmation on, signUp returns a user but no session.
      return data.session ? 'session' : 'confirm';
    },
    [],
  );

  const signInWithPassword = useCallback(async ({ email, password }: Credentials) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      // Surface the unconfirmed case as a code the screen can offer a resend for.
      if (/confirm/i.test(error.message)) throw new Error(NEEDS_CONFIRMATION);
      throw error;
    }
  }, []);

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: { emailRedirectTo: Linking.createURL('/auth-callback') },
    });
    if (error) throw error;
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: Linking.createURL('/auth-callback') },
    });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = Linking.createURL('/auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error('Google sign-in did not return an authorization URL.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      await consumeAuthUrl(result.url);
    }
  }, [consumeAuthUrl]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(
    () => ({
      session,
      loading,
      sendMagicLink,
      signUpWithPassword,
      signInWithPassword,
      resendConfirmation,
      signInWithGoogle,
      signOut,
    }),
    [
      session,
      loading,
      sendMagicLink,
      signUpWithPassword,
      signInWithPassword,
      resendConfirmation,
      signInWithGoogle,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
