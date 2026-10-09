import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { useAuth } from '@/data/auth';

/** Supabase's own default minimum — the same floor sign-up enforces. */
const MIN_PASSWORD = 6;

/** How long to wait for the emailed tokens to turn into a session. */
const TIMEOUT_MS = 10_000;

/**
 * Where the "forgot password" email lands, and where Settings sends a signed-in
 * user to change theirs. The recovery tokens ride in the URL fragment and are
 * turned into a session by the deep-link handler in `@/data/auth`; once there
 * is a session, a new password can be set on it.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, updatePassword, recovery, endRecovery } = useAuth();

  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  // A dead link (used, expired) is reported by the deep-link handler.
  const linkError = recovery?.error ?? null;

  useEffect(() => {
    if (session || linkError) return;
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [session, linkError]);

  const failed = session
    ? null
    : (linkError ?? (timedOut ? 'That link could not be used to reset your password.' : null));

  const valid = password.length >= MIN_PASSWORD;

  const onSave = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  const leave = () => {
    endRecovery();
    if (!session) router.replace('/sign-in');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!session) {
    return (
      <View style={styles.centered}>
        {failed ? (
          <>
            <Text style={[text.authTitle, styles.centerText]}>Link didn&apos;t work.</Text>
            <Text style={styles.centerBody}>{failed}</Text>
            <Text style={styles.centerBody}>
              Reset links expire and can only be used once. Ask for a fresh one from the sign-in
              screen.
            </Text>
            <Pressable
              onPress={leave}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, styles.ctaPrimary, styles.ctaWide, pressed && styles.pressed]}
            >
              <Text style={styles.ctaPrimaryLabel}>Back to sign in</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={color.green} size="large" />
            <Text style={styles.waiting}>Checking your link…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 44, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>L</Text>
        </View>

        {done ? (
          <>
            <Text style={[text.authTitle, styles.title]}>Password{'\n'}updated.</Text>
            <Text style={styles.lede}>
              Use the new password the next time you sign in to {session.user.email ?? 'Ledger'}.
            </Text>
            <Pressable
              onPress={() => {
                endRecovery();
                router.replace('/');
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, styles.ctaPrimary, styles.ctaSpaced, pressed && styles.pressed]}
            >
              <Text style={styles.ctaPrimaryLabel}>Continue</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[text.authTitle, styles.title]}>Choose a new{'\n'}password.</Text>
            <Text style={styles.lede}>
              {session.user.email ? `For ${session.user.email}.` : 'For your Ledger account.'}
            </Text>

            <View style={styles.field}>
              <View style={styles.fieldHead}>
                <Text style={styles.fieldLabel}>NEW PASSWORD</Text>
                <Pressable onPress={() => setReveal((v) => !v)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.reveal}>{reveal ? 'HIDE' : 'SHOW'}</Text>
                </Pressable>
              </View>
              <TextInput
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  setError(null);
                }}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                placeholderTextColor={alpha.onInk50}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoComplete="new-password"
                autoCorrect={false}
                autoFocus
                returnKeyType="go"
                onSubmitEditing={onSave}
                style={styles.input}
                accessibilityLabel="New password"
              />
            </View>

            {password.length > 0 && !valid ? (
              <Text style={styles.hint}>Passwords need at least {MIN_PASSWORD} characters.</Text>
            ) : null}

            <Pressable
              onPress={onSave}
              disabled={!valid || busy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.cta,
                styles.ctaPrimary,
                pressed && styles.pressed,
                (!valid || busy) && styles.ctaDisabled,
              ]}
            >
              <Text style={styles.ctaPrimaryLabel}>{busy ? 'Saving…' : 'Save new password'}</Text>
            </Pressable>
            <Pressable
              onPress={leave}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, styles.ctaOutline, pressed && styles.pressed]}
            >
              <Text style={styles.ctaOutlineLabel}>Not now</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: gutter.auth },

  centered: {
    flex: 1,
    backgroundColor: color.night,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  centerText: { textAlign: 'center' },
  centerBody: {
    marginTop: 14,
    fontFamily: font.sans,
    fontSize: 14.5,
    lineHeight: 23.2,
    color: alpha.onInk66,
    textAlign: 'center',
    maxWidth: 300,
  },
  waiting: { marginTop: 18, fontFamily: font.sans, fontSize: 14.5, color: alpha.onInk66 },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontFamily: font.serif, fontSize: 22, color: color.onAccent },

  title: { marginTop: 28 },
  lede: {
    marginTop: 14,
    fontFamily: font.sans,
    fontSize: 14.5,
    lineHeight: 23.2,
    color: alpha.onInk66,
    maxWidth: 280,
  },

  field: {
    marginTop: 22,
    padding: 18,
    borderRadius: radius.panel,
    backgroundColor: alpha.onInk08,
  },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.14,
    color: alpha.onInk60,
  },
  reveal: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.14,
    color: color.green,
  },
  input: {
    marginTop: 10,
    fontFamily: font.serif,
    fontSize: 24,
    color: color.onInk,
    padding: 0,
  },

  cta: {
    marginTop: 12,
    height: 54,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaSpaced: { marginTop: 28 },
  ctaWide: { marginTop: 28, paddingHorizontal: 28 },
  ctaPrimary: { backgroundColor: color.green },
  ctaPrimaryLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.onAccent },
  ctaOutline: { borderWidth: 1, borderColor: alpha.onInk20 },
  ctaOutlineLabel: { fontFamily: font.sansSemi, fontSize: 15, color: color.onInk },
  ctaDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },

  error: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: '#FF9C8F' },
  hint: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: alpha.onInk66 },
}));
