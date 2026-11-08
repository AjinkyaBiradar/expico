import { NavigationBar } from 'expo-navigation-bar';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React, { Suspense } from 'react';
import { ActivityIndicator, Platform, Text, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/colors';
import { migrateDbIfNeeded } from '@/db/schema';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

function LoadingScreen({ isDark, primaryColor, textColor }: { isDark: boolean; primaryColor: string; textColor: string }) {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: isDark ? '#0F131C' : '#FFFFFF',
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<LoadingScreen isDark={isDark} primaryColor={theme.primary} textColor={theme.textSecondary} />}>
        <SQLiteProvider databaseName="expico.db" onInit={migrateDbIfNeeded} useSuspense>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          {Platform.OS === 'android' && (
            <NavigationBar hidden={true} style={isDark ? 'light' : 'dark'} />
          )}
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' },
              headerTintColor: theme.text,
              headerTitleStyle: { color: theme.text, fontWeight: '700' },
              contentStyle: { backgroundColor: theme.surface },
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
