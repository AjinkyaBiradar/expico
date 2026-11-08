import { Stack } from 'expo-router';
import React from 'react';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/colors';

export default function ModalsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.surface },
      }}>
      <Stack.Screen
        name="add-transaction"
        options={{
          title: 'New Transaction',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="add-wallet"
        options={{
          title: 'New Wallet',
          headerShown: true,
        }}
      />
    </Stack>
  );
}
