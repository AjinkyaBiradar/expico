import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense, useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { migrateDbIfNeeded } from '@/db/schema';
import { initSettingsAsync, useAppTheme } from '@/utils/settings';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

function LoadingScreen({ primaryColor, textColor }: { primaryColor: string; textColor: string }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0F131C',
      }}>
      <ActivityIndicator size="large" color={primaryColor} />
      <Text
        style={{
          marginTop: 16,
          color: textColor,
          fontSize: 14,
          fontWeight: '500',
        }}>
        Starting Expico...
      </Text>
    </View>
  );
}

export default function RootLayout() {
  const { theme } = useAppTheme();

  useEffect(() => {
    initSettingsAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<LoadingScreen primaryColor={theme.primary} textColor={theme.textSecondary} />}>
        <SQLiteProvider databaseName="expico.db" onInit={migrateDbIfNeeded} useSuspense>
          <StatusBar style="light" />
          {Platform.OS === 'android' && (
            <NavigationBar hidden={true} style="light" />
          )}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: '#1C1F29' },
              headerTintColor: theme.text,
              headerTitleStyle: { color: theme.text, fontWeight: '700' },
              contentStyle: { backgroundColor: '#0F131C' },
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
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
