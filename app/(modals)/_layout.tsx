import { Stack } from 'expo-router';
import React from 'react';

import { useAppTheme } from '@/utils/settings';

export default function ModalsLayout() {
  const { theme } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#1C1F29' },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text, fontWeight: '700' },
        contentStyle: { backgroundColor: '#0F131C' },
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
