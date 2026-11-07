import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors } from '@/constants/colors';
import { migrateDbIfNeeded } from '@/db/schema';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="expico.db" onInit={migrateDbIfNeeded}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#151922' },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: { color: '#FFFFFF', fontWeight: '700' },
            contentStyle: { backgroundColor: '#0B0E14' },
          }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="(modals)/add-transaction"
            options={{
              presentation: 'modal',
              title: 'New Transaction',
              headerShown: true,
            }}
          />
          <Stack.Screen
            name="(modals)/add-wallet"
            options={{
              presentation: 'modal',
              title: 'New Wallet',
              headerShown: true,
            }}
          />
        </Stack>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
