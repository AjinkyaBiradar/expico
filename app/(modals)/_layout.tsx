import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/utils/settings';

export default function ModalsLayout() {
  const { isDark, theme } = useAppTheme();

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
