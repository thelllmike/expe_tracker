import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, color, gutter, radius } from '@/theme/tokens';
import { font, text } from '@/theme/type';
import { useAuth } from '@/data/auth';

const STEPS = [
  'Name your businesses',
  'Set currency and tax',
  'Link a bank or start manually',
];

/**
 * Screen 14. The design shows a phone + Apple flow; the stack is Supabase email
 * and Google, so the same layout carries an email field and a Google button.
 */
export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { sendMagicLink, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'google'>('idle');
  const [error, setError] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const onSendLink = async () => {
    if (!emailValid || status === 'sending') return;
    setStatus('sending');
    setError(null);
    try {
      await sendMagicLink(email);
      setStatus('sent');
    } catch (e) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : 'Could not send the link.');
    }
  };

  const onGoogle = async () => {
    setStatus('google');
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setStatus('idle');
    }
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

        <Text style={[text.authTitle, styles.title]}>Every business,{'\n'}one ledger.</Text>
        <Text style={styles.lede}>
          Track spend, watch profit and send invoices for as many businesses as you run.
        </Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>EMAIL</Text>
          <TextInput
            value={email}
            onChangeText={(next) => {
              setEmail(next);
              if (status === 'sent') setStatus('idle');
            }}
            placeholder="you@business.com"
            placeholderTextColor={alpha.onInk50}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            inputMode="email"
            returnKeyType="go"
            onSubmitEditing={onSendLink}
            style={styles.input}
            accessibilityLabel="Email address"
          />
        </View>

        <PrimaryButton
          label={
            status === 'sending' ? 'Sending…' : status === 'sent' ? 'Link sent — check your inbox' : 'Send me a link'
          }
          onPress={onSendLink}
          disabled={!emailValid || status === 'sending'}
        />
        <OutlineButton
          label={status === 'google' ? 'Opening Google…' : 'Continue with Google'}
          onPress={onGoogle}
          disabled={status === 'google'}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {status === 'sent' ? (
          <Text style={styles.hint}>
            Open the link on this device and Ledger will sign you in.
          </Text>
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
      </ScrollView>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.ink },
  content: { paddingHorizontal: gutter.auth },

  logo: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: { fontFamily: font.serif, fontSize: 22, color: color.card },

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
    marginTop: 36,
    padding: 18,
    borderRadius: radius.panel,
    backgroundColor: alpha.onInk08,
  },
  fieldLabel: {
    fontFamily: font.sansSemi,
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.14,
    color: alpha.onInk60,
  },
  input: {
    marginTop: 10,
    fontFamily: font.serif,
    fontSize: 24,
    color: color.paper,
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
  ctaPrimary: { backgroundColor: color.green },
  ctaPrimaryLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.card },
  ctaOutline: { borderWidth: 1, borderColor: alpha.onInk20 },
  ctaOutlineLabel: { fontFamily: font.sansSemi, fontSize: 15, color: color.paper },
  ctaDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },

  error: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: '#FF9C8F' },
  hint: { marginTop: 14, fontFamily: font.sans, fontSize: 13, color: alpha.onInk66 },

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
  stepNumber: { fontFamily: font.sansBold, fontSize: 11.5, color: color.card },
  stepLabel: { fontFamily: font.sans, fontSize: 14, color: color.paper },
  stepLabelMuted: { color: alpha.onInk72 },

  terms: {
    marginTop: 34,
    fontFamily: font.sans,
    fontSize: 11.5,
    lineHeight: 17.25,
    color: alpha.onInk50,
  },
});
