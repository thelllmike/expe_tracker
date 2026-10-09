import React, { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { NEEDS_CONFIRMATION, useAuth } from '@/data/auth';

const STEPS = [
  'Name your businesses',
  'Set currency and tax',
  'Link a bank or start manually',
];

/** Supabase's own default minimum. */
const MIN_PASSWORD = 6;

type Mode = 'signin' | 'signup';
type Status = 'idle' | 'busy' | 'google' | 'linkSent' | 'resetting';

/**
 * Screen 14. Email and password against Supabase, with Google alongside and the
 * magic link kept as a fallback. A new account is confirmed by email before it
 * can sign in, so sign-up ends on the "check your inbox" panel rather than in
 * the app.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const {
    signInWithPassword,
    signUpWithPassword,
    resendConfirmation,
    sendMagicLink,
    sendPasswordReset,
    signInWithGoogle,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  /** Set once the confirmation mail is out — the form is replaced by the notice. */
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [resent, setResent] = useState(false);
  /** Outcome of "Forgot password?", shown right under the link that caused it. */
  const [resetNote, setResetNote] = useState<{ ok: boolean; text: string } | null>(null);

  const signup = mode === 'signup';
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= MIN_PASSWORD;
  const nameValid = !signup || name.trim().length > 0;
  const canSubmit = emailValid && passwordValid && nameValid && status !== 'busy';

  const fail = (e: unknown, fallback: string) => {
    if (e instanceof Error && e.message === NEEDS_CONFIRMATION) {
      setNeedsConfirm(true);
      setError('That email is not confirmed yet. Check your inbox for the link.');
      return;
    }
    setError(e instanceof Error ? e.message : fallback);
  };

  const reset = () => {
    setError(null);
    setNeedsConfirm(false);
    setResent(false);
    setResetNote(null);
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setStatus('busy');
    reset();
    try {
      if (signup) {
        const outcome = await signUpWithPassword({ email, password, fullName: name });
        // 'session' means confirmation is switched off in the project — the auth
        // listener picks the session up and the root layout routes onward.
        if (outcome === 'confirm') setAwaitingConfirm(true);
      } else {
        await signInWithPassword({ email, password });
      }
    } catch (e) {
      fail(e, signup ? 'Could not create the account.' : 'Could not sign in.');
    } finally {
      setStatus('idle');
    }
  };

  const onResend = async () => {
    setStatus('busy');
    setError(null);
    try {
      await resendConfirmation(email);
      setResent(true);
    } catch (e) {
      fail(e, 'Could not resend the email.');
    } finally {
      setStatus('idle');
    }
  };

  const onMagicLink = async () => {
    if (!emailValid) {
      setError('Enter your email address first.');
      return;
    }
    setStatus('busy');
    reset();
    try {
      await sendMagicLink(email);
      setStatus('linkSent');
      return;
    } catch (e) {
      fail(e, 'Could not send the link.');
    }
    setStatus('idle');
  };

  const onForgotPassword = async () => {
    // The keyboard otherwise sits on top of the answer.
    Keyboard.dismiss();
    reset();
    if (!emailValid) {
      setResetNote({ ok: false, text: 'Type your email address above first, then tap Forgot password.' });
      return;
    }
    setStatus('resetting');
    try {
      await sendPasswordReset(email);
      setResetNote({
        ok: true,
        text: `Reset link sent to ${email.trim()}. Open the email on this phone and tap the link — check spam if it is not in your inbox.`,
      });
    } catch (e) {
      setResetNote({
        ok: false,
        text: e instanceof Error ? e.message : 'Could not send the reset email.',
      });
    } finally {
      setStatus('idle');
    }
  };

  const onGoogle = async () => {
    setStatus('google');
    reset();
    try {
      await signInWithGoogle();
    } catch (e) {
      fail(e, 'Google sign-in failed.');
    } finally {
      setStatus('idle');
    }
  };

  const switchMode = () => {
    setMode(signup ? 'signin' : 'signup');
    setPassword('');
    reset();
    setStatus('idle');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 44 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>L</Text>
        </View>

        {awaitingConfirm ? (
          <ConfirmNotice
            email={email.trim()}
            resent={resent}
            busy={status === 'busy'}
            error={error}
            onResend={onResend}
            onBack={() => {
              setAwaitingConfirm(false);
              setMode('signin');
              setPassword('');
              reset();
            }}
            bottomInset={insets.bottom}
          />
        ) : (
          <>
            <Text style={[text.authTitle, styles.title]}>
              {signup ? 'Start your\nledger.' : 'Every business,\none ledger.'}
            </Text>
            <Text style={styles.lede}>
              {signup
                ? 'Create an account and confirm your email. Then add your first business.'
                : 'Track spend, watch profit and send invoices for as many businesses as you run.'}
            </Text>

            {signup ? (
              <Field label="NAME">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={alpha.onInk50}
                  autoCapitalize="words"
                  autoComplete="name"
                  autoCorrect={false}
                  returnKeyType="next"
                  style={styles.input}
                  accessibilityLabel="Your name"
                />
              </Field>
            ) : null}

            <Field label="EMAIL">
              <TextInput
                value={email}
                onChangeText={(next) => {
                  setEmail(next);
                  if (status === 'linkSent') setStatus('idle');
                  reset();
                }}
                placeholder="you@business.com"
                placeholderTextColor={alpha.onInk50}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                inputMode="email"
                returnKeyType="next"
                style={styles.input}
                accessibilityLabel="Email address"
              />
            </Field>

            <Field
              label="PASSWORD"
              trailing={
                <Pressable onPress={() => setReveal((v) => !v)} accessibilityRole="button" hitSlop={8}>
                  <Text style={styles.reveal}>{reveal ? 'HIDE' : 'SHOW'}</Text>
                </Pressable>
              }
            >
              <TextInput
                value={password}
                onChangeText={(next) => {
                  setPassword(next);
                  reset();
                }}
                placeholder={signup ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                placeholderTextColor={alpha.onInk50}
                secureTextEntry={!reveal}
                autoCapitalize="none"
                autoComplete={signup ? 'new-password' : 'current-password'}
                autoCorrect={false}
                returnKeyType="go"
                onSubmitEditing={onSubmit}
                style={styles.input}
                accessibilityLabel="Password"
              />
            </Field>

            {signup && password.length > 0 && !passwordValid ? (
              <Text style={styles.hint}>
                Passwords need at least {MIN_PASSWORD} characters.
              </Text>
            ) : null}

            {!signup ? (
              <Pressable
                onPress={onForgotPassword}
                accessibilityRole="button"
                disabled={status === 'busy' || status === 'resetting'}
                hitSlop={8}
                style={styles.forgot}
              >
                <Text style={styles.forgotLabel}>
                  {status === 'resetting' ? 'Sending reset link…' : 'Forgot password?'}
                </Text>
              </Pressable>
            ) : null}
            {!signup && resetNote ? (
              <View style={[styles.resetNote, !resetNote.ok && styles.resetNoteError]}>
                <Text style={[styles.resetNoteText, !resetNote.ok && styles.resetNoteTextError]}>
                  {resetNote.text}
                </Text>
              </View>
            ) : null}

            <PrimaryButton
              label={
                status === 'busy'
                  ? signup
                    ? 'Creating account…'
                    : 'Signing in…'
                  : signup
                    ? 'Create account'
                    : 'Sign in'
              }
              onPress={onSubmit}
              disabled={!canSubmit}
            />
            <OutlineButton
              label={status === 'google' ? 'Opening Google…' : 'Continue with Google'}
              onPress={onGoogle}
              disabled={status === 'google'}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            {needsConfirm ? (
              <Pressable onPress={onResend} accessibilityRole="button" disabled={status === 'busy'}>
                <Text style={styles.link}>
                  {resent ? 'Confirmation email sent.' : 'Resend the confirmation email'}
                </Text>
              </Pressable>
            ) : null}
            {status === 'linkSent' ? (
              <Text style={styles.hint}>
                Link sent. Open it on this device and Ledger will sign you in.
              </Text>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>
                {signup ? 'Already have an account?' : 'New to Ledger?'}
              </Text>
              <Pressable onPress={switchMode} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.switchLink}>{signup ? 'Sign in' : 'Create an account'}</Text>
              </Pressable>
            </View>

            {!signup ? (
              <Pressable onPress={onMagicLink} accessibilityRole="button" hitSlop={8}>
                <Text style={styles.linkMuted}>Email me a sign-in link instead</Text>
              </Pressable>
            ) : null}

            <View style={styles.steps}>
              <Text style={styles.fieldLabel}>SET UP IN THREE STEPS</Text>
              <View style={styles.stepList}>
                {STEPS.map((label, i) => (
                  <View key={label} style={styles.step}>
                    <View style={[styles.stepBullet, i === 0 && styles.stepBulletActive]}>
                      <Text style={styles.stepNumber}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.stepLabel, i > 0 && styles.stepLabelMuted]}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.terms, { marginBottom: insets.bottom + 24 }]}>
              By continuing you agree to the terms and privacy policy.
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** The "check your inbox" panel shown after a successful sign-up. */
function ConfirmNotice({
  email,
  resent,
  busy,
  error,
  onResend,
  onBack,
  bottomInset,
}: {
  email: string;
  resent: boolean;
  busy: boolean;
  error: string | null;
  onResend: () => void;
  onBack: () => void;
  bottomInset: number;
}) {
  return (
    <>
      <Text style={[text.authTitle, styles.title]}>Confirm your{'\n'}email.</Text>
      <Text style={styles.lede}>
        We sent a link to {email}. Open it on this device and Ledger will sign you in.
      </Text>

      <View style={styles.notice}>
        <Text style={styles.fieldLabel}>NEXT</Text>
        <Text style={styles.noticeBody}>
          The link expires after a while. If it does, come back here and send a new one.
        </Text>
      </View>

      <PrimaryButton
        label={resent ? 'Email sent' : busy ? 'Sending…' : 'Resend the email'}
        onPress={onResend}
        disabled={busy || resent}
      />
      <OutlineButton label="Back to sign in" onPress={onBack} />

      {error ? <Text style={[styles.error, { marginBottom: bottomInset + 24 }]}>{error}</Text> : null}
      {!error ? <View style={{ height: bottomInset + 24 }} /> : null}
    </>
  );
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {trailing}
      </View>
      {children}
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.cta,
        styles.ctaPrimary,
        pressed && styles.pressed,
        disabled && styles.ctaDisabled,
      ]}
    >
      <Text style={styles.ctaPrimaryLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function OutlineButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.cta,
        styles.ctaOutline,
        pressed && styles.pressed,
        disabled && styles.ctaDisabled,
      ]}
    >
      <Text style={styles.ctaOutlineLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = themedStyles(() => ({
  root: { flex: 1, backgroundColor: color.night },
  content: { paddingHorizontal: gutter.auth },

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
    marginTop: 14,
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

  notice: {
    marginTop: 28,
    padding: 18,
    borderRadius: radius.panel,
    backgroundColor: alpha.onInk08,
  },
  noticeBody: {
    marginTop: 10,
    fontFamily: font.sans,
    fontSize: 14,
    lineHeight: 22,
    color: alpha.onInk72,
  },

  cta: {
    marginTop: 12,
    height: 54,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ctaPrimary: { backgroundColor: color.green },
  ctaPrimaryLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.onAccent },
  ctaOutline: { borderWidth: 1, borderColor: alpha.onInk20 },
  ctaOutlineLabel: { fontFamily: font.sansSemi, fontSize: 15, color: color.onInk },
  ctaDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },

  error: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: '#FF9C8F' },
  hint: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: alpha.onInk66 },
  link: {
    marginTop: 12,
    fontFamily: font.sansSemi,
    fontSize: 13.5,
    color: color.green,
  },
  forgot: { marginTop: 12, alignSelf: 'flex-end' },
  forgotLabel: { fontFamily: font.sansSemi, fontSize: 13, color: color.green },
  resetNote: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.green,
    backgroundColor: alpha.onInk08,
  },
  resetNoteError: { borderColor: '#FF9C8F' },
  resetNoteText: { fontFamily: font.sans, fontSize: 13.5, lineHeight: 20, color: color.onInk },
  resetNoteTextError: { color: '#FF9C8F' },
  linkMuted: {
    marginTop: 16,
    fontFamily: font.sans,
    fontSize: 13.5,
    color: alpha.onInk66,
    textDecorationLine: 'underline',
  },

  switchRow: { marginTop: 22, flexDirection: 'row', alignItems: 'center', gap: 7 },
  switchText: { fontFamily: font.sans, fontSize: 13.5, color: alpha.onInk66 },
  switchLink: { fontFamily: font.sansSemi, fontSize: 13.5, color: color.green },

  steps: { marginTop: 34, paddingTop: 22, borderTopWidth: 1, borderTopColor: alpha.onInk14 },
  stepList: { marginTop: 14, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepBullet: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: alpha.onInk14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBulletActive: { backgroundColor: color.green },
  stepNumber: { fontFamily: font.sansBold, fontSize: 11.5, color: color.onAccent },
  stepLabel: { fontFamily: font.sans, fontSize: 14, color: color.onInk },
  stepLabelMuted: { color: alpha.onInk72 },

  terms: {
    marginTop: 34,
    fontFamily: font.sans,
    fontSize: 11.5,
    lineHeight: 17.25,
    color: alpha.onInk50,
  },
}));
