import { Stack } from 'expo-router';

import { useTheme } from '@/features/theme';

export default function ModalsLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBackground },
        headerTintColor: colors.text,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
        contentStyle: { backgroundColor: colors.background },
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
