import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrateDbIfNeeded } from '@/db/schema';
import { ThemeProvider, useTheme, useThemeStore } from '@/features/theme';
import { initSettingsAsync } from '@/utils/settings';

// Prevent splash screen from auto-hiding before theme is loaded
SplashScreen.preventAutoHideAsync().catch(() => { });

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

function AppNavigation() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="(modals)"
        options={{
          presentation: 'modal',
          headerShown: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const isLoaded = useThemeStore((s) => s.isLoaded);
  const initThemeAsync = useThemeStore((s) => s.initThemeAsync);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Promise.all([initThemeAsync(), initSettingsAsync()]);
      } catch (err) {
        console.warn('Initialization error:', err);
      } finally {
        if (mounted) {
          await SplashScreen.hideAsync().catch(() => { });
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [initThemeAsync]);

  if (!isLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <Suspense
          fallback={
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          }>
          <SQLiteProvider databaseName="expico.db" onInit={migrateDbIfNeeded} useSuspense>
            <AppNavigation />
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
