import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
  InstrumentSans_700Bold,
} from '@expo-google-fonts/instrument-sans';
import { InstrumentSerif_400Regular } from '@expo-google-fonts/instrument-serif';
import { AuthProvider, useAuth } from '@/data/auth';
import { color } from '@/theme/tokens';
import { ThemeProvider, useTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();

/**
 * expo-router picks this up for anything that throws while rendering the tree.
 * Without it a crash in a child route paints a blank white screen and says
 * nothing; this at least puts the message where it can be read.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: color.night, padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#FF9C8F', fontSize: 18, marginBottom: 12 }}>Ledger failed to start</Text>
      <Text style={{ color: '#FFFFFF', fontSize: 13, lineHeight: 20 }}>{error.message}</Text>
      <Text
        onPress={() => void retry()}
        style={{ color: '#FFFFFF', fontSize: 15, marginTop: 24, textDecorationLine: 'underline' }}
      >
        Try again
      </Text>
    </View>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Financial figures should not go stale mid-session, but neither should
      // every screen refetch on focus while the user is moving around.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
    InstrumentSans_700Bold,
    InstrumentSerif_400Regular,
  });

  // The design is built on these two families, so we wait for them — but never
  // forever. A stalled font fetch used to leave `return null` on screen as a
  // blank white page with nothing in the logs; after this timeout we render in
  // the system face instead, which is ugly for a moment but always visible.
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const t = setTimeout(() => setFontTimedOut(true), 4000);
    return () => clearTimeout(t);
  }, [fontsLoaded, fontError]);

  const fontsSettled = fontsLoaded || !!fontError || fontTimedOut;

  useEffect(() => {
    if (fontsSettled) void SplashScreen.hideAsync();
  }, [fontsSettled]);

  useEffect(() => {
    if (fontError) console.warn('[ledger] font loading failed:', fontError);
    if (fontTimedOut) console.warn('[ledger] fonts timed out — using system faces');
  }, [fontError, fontTimedOut]);

  // Hold on the splash colour rather than a white void while we wait.
  if (!fontsSettled) return <View style={{ flex: 1, backgroundColor: color.night }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {/* Inside AuthProvider: a theme change remounts what is below it, and
                the session should not be re-read every time that happens. */}
            <ThemeProvider>
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Redirects between the signed-out and signed-in trees. */
function RootNavigator() {
  const { session, loading, recovery } = useAuth();
  const { theme } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  // Startup breadcrumb — a white screen is silent otherwise.
  useEffect(() => {
    console.log('[ledger] auth', {
      loading,
      signedIn: !!session,
      route: segments.join('/') || '(index)',
    });
  }, [loading, session, segments]);

  useEffect(() => {
    if (loading) return;
    // auth-callback is part of the signed-out tree: the emailed link lands there
    // with no session yet, and bouncing it to sign-in would throw the tokens away
    // before the deep-link handler could read them.
    const onAuthRoute = segments[0] === 'sign-in' || segments[0] === 'auth-callback';
    // The recovery link lands on reset-password signed out and becomes signed in
    // while the screen is open; it has to stay put through both. On a cold start
    // the link is read after the first redirect below has already fired, so a
    // pending recovery also pulls the app back to the screen.
    if (segments[0] === 'reset-password') return;
    if (recovery) {
      router.replace('/reset-password');
      return;
    }

    if (!session && !onAuthRoute) {
      router.replace('/sign-in');
    } else if (session && onAuthRoute) {
      router.replace('/');
    }
  }, [session, loading, recovery, segments, router]);

  if (loading) {
    return <View style={{ flex: 1, backgroundColor: color.night }} />;
  }

  return (
    <>
      {/* Dark icons only on the light theme's paper; the sign-in ground is always dark. */}
      <StatusBar style={session && theme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: color.paper },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
        <Stack.Screen name="auth-callback" options={{ animation: 'fade' }} />
        <Stack.Screen name="reset-password" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-expense"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="invoice/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="quotations/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="business/new" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
