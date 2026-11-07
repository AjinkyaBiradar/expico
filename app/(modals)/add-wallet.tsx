import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Bank, Check, CreditCard, Money, PiggyBank } from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Colors } from '@/constants/colors';
import { addWallet } from '@/db/queries';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

import { type Icon } from 'phosphor-react-native';

export interface WalletIconOption {
  id: string;
  label: string;
  Icon: Icon;
}

export const WALLET_ICONS: WalletIconOption[] = [
  { id: 'Cash', label: 'Cash', Icon: Money },
  { id: 'Bank', label: 'Bank', Icon: Bank },
  { id: 'CreditCard', label: 'Credit Card', Icon: CreditCard },
  { id: 'PiggyBank', label: 'Piggy Bank', Icon: PiggyBank },
];

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AddWalletModal() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [name, setName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('Cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a name for your wallet.');
      return;
    }

    const balanceNum = initialBalance ? parseFloat(initialBalance) : 0;
    if (isNaN(balanceNum)) {
      Alert.alert('Invalid Balance', 'Please enter a valid numeric starting balance.');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      await addWallet(db, {
        id,
        name: trimmedName,
        initial_balance: balanceNum,
        icon: selectedIcon,
      });
      router.back();
    } catch (err) {
      console.error('Failed to create wallet:', err);
      Alert.alert('Error', 'Failed to create wallet. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* Wallet Name */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Wallet Name</Text>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="e.g., Cash, HDFC Bank, Emergency Fund"
          placeholderTextColor={theme.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
        />
      </View>

      {/* Starting Balance */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Initial Balance (₹)</Text>
        <TextInput
          style={[styles.amountInput, { color: theme.text }]}
          placeholder="0.00"
          placeholderTextColor={theme.textMuted}
          keyboardType="decimal-pad"
          value={initialBalance}
          onChangeText={setInitialBalance}
        />
      </View>

      {/* Icon Selector */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Select Icon</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.iconScrollContent}>
          {WALLET_ICONS.map((item) => {
            const selected = item.id === selectedIcon;
            const IconComponent = item.Icon;
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.iconButton,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primaryLight : theme.surfaceVariant,
                  },
                ]}
                onPress={() => setSelectedIcon(item.id)}>
                <IconComponent
                  size={moderateScale(32)}
                  color={selected ? theme.primary : theme.textSecondary}
                  weight={selected ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.iconLabel,
                    { color: selected ? theme.primary : theme.textSecondary },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Submit Button */}
      <Pressable
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary },
          isSubmitting && { opacity: 0.7 },
        ]}
        disabled={isSubmitting}
        onPress={handleSubmit}>
        <Check size={moderateScale(20)} color="#FFFFFF" weight="bold" />
        <Text style={styles.submitText}>Add Wallet</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  label: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    fontSize: fontScale(16),
    paddingVertical: Spacing.xs,
  },
  amountInput: {
    fontSize: fontScale(28),
    fontWeight: '700',
    paddingVertical: Spacing.xs,
  },
  iconScrollContent: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  iconButton: {
    width: moderateScale(88),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  iconLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
    textAlign: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(14),
    borderRadius: Radius.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
});
