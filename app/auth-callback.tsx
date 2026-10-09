import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { alpha, color } from '@/theme/tokens';
import { themedStyles } from '@/theme/theme';
import { font, text } from '@/theme/type';
import { useAuth } from '@/data/auth';

/** How long to wait for the tokens to turn into a session before giving up. */
const TIMEOUT_MS = 10_000;

/**
 * Where the confirmation and magic-link emails land. The tokens ride in the URL
 * fragment and are picked up by the deep-link handler in `@/data/auth`, so this
 * screen only has to hold the user while that happens — and say something
 * useful when the link has already been used or has expired.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const url = Linking.useURL();
  const [timedOut, setTimedOut] = useState(false);

  // Supabase reports a dead link as error/error_description in the fragment.
  const linkError = (() => {
    const fragment = url?.split('#')[1];
    if (!fragment) return null;
    const params = new URLSearchParams(fragment);
    const description = params.get('error_description');
    if (!description && !params.get('error')) return null;
    return description?.replace(/\+/g, ' ') ?? 'That link is no longer valid.';
  })();

  useEffect(() => {
    if (session) router.replace('/');
  }, [session, router]);

  useEffect(() => {
    if (session || linkError) return;
    const t = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [session, linkError]);

  const failed = linkError ?? (timedOut ? 'That link could not be used to sign you in.' : null);

  return (
    <View style={styles.root}>
      {failed ? (
        <>
          <Text style={[text.authTitle, styles.title]}>Link didn&apos;t work.</Text>
          <Text style={styles.body}>{failed}</Text>
          <Text style={styles.body}>
            Confirmation links expire and can only be used once. Send yourself a fresh one.
          </Text>
          <Pressable
            onPress={() => router.replace('/sign-in')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
          >
            <Text style={styles.ctaLabel}>Back to sign in</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator color={color.green} size="large" />
          <Text style={styles.waiting}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = themedStyles(() => ({
  root: {
    flex: 1,
    backgroundColor: color.night,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  title: { textAlign: 'center' },
  body: {
    marginTop: 14,
    fontFamily: font.sans,
    fontSize: 14.5,
    lineHeight: 23.2,
    color: alpha.onInk66,
    textAlign: 'center',
    maxWidth: 300,
  },
  waiting: {
    marginTop: 18,
    fontFamily: font.sans,
    fontSize: 14.5,
    color: alpha.onInk66,
  },
  cta: {
    marginTop: 28,
    height: 54,
    paddingHorizontal: 28,
    borderRadius: 16,
    backgroundColor: color.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { fontFamily: font.sansSemi, fontSize: 15.5, color: color.onAccent },
  pressed: { opacity: 0.8 },
}));
