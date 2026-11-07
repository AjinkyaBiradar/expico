import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bank,
  CreditCard,
  Money,
  PiggyBank,
  Plus,
  Trash,
  Wallet as WalletIcon,
} from 'phosphor-react-native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { deleteWallet, getWallets, Wallet } from '@/db/queries';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function WalletsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadWallets = useCallback(async () => {
    try {
      const data = await getWallets(db);
      setWallets(data);
    } catch (err) {
      console.error('Failed to load wallets:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadWallets();
    }, [loadWallets])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadWallets();
    setRefreshing(false);
  };

  const handleDeleteWallet = (wallet: Wallet) => {
    Alert.alert(
      'Delete Wallet',
      `Deleting "${wallet.name}" will also permanently remove all associated transactions. Are you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(db, wallet.id);
              await loadWallets();
            } catch (err) {
              console.error('Failed to delete wallet:', err);
              Alert.alert('Error', 'Failed to delete wallet');
            }
          },
        },
      ]
    );
  };

  const totalNetWorth = wallets.reduce((acc, w) => acc + w.current_balance, 0);

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const renderWalletIcon = (iconName: string) => {
    const size = moderateScale(24);
    const color = theme.primary;
    switch (iconName) {
      case 'Cash':
        return <Money size={size} color={color} weight="fill" />;
      case 'Bank':
        return <Bank size={size} color={color} weight="fill" />;
      case 'CreditCard':
        return <CreditCard size={size} color={color} weight="fill" />;
      case 'PiggyBank':
        return <PiggyBank size={size} color={color} weight="fill" />;
      default:
        return <WalletIcon size={size} color={color} weight="fill" />;
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>Wallets & Accounts</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Manage and track your distributed funds
      </Text>

      {/* Total Net Worth Card */}
      <View style={[styles.netWorthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.netWorthLabel, { color: theme.textSecondary }]}>Total Net Worth</Text>
        <Text style={[styles.netWorthAmount, { color: theme.text }]}>
          {formatCurrency(totalNetWorth)}
        </Text>
        <Text style={[styles.netWorthSub, { color: theme.textMuted }]}>
          Across {wallets.length} account{wallets.length === 1 ? '' : 's'}
        </Text>
      </View>

      <Text style={[styles.sectionHeading, { color: theme.text }]}>Your Accounts</Text>
    </View>
  );

  const renderWalletItem = ({ item }: { item: Wallet }) => (
    <View style={[styles.walletCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.walletIconWrap, { backgroundColor: theme.surfaceVariant }]}>
        {renderWalletIcon(item.icon)}
      </View>

      <View style={styles.walletDetails}>
        <Text style={[styles.walletName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.walletCategory, { color: theme.textSecondary }]}>
          {item.icon} Account
        </Text>
      </View>

      <View style={styles.walletRight}>
        <Text style={[styles.walletBalance, { color: theme.text }]}>
          {formatCurrency(item.current_balance)}
        </Text>
        <Pressable
          style={styles.deleteButton}
          hitSlop={8}
          onPress={() => handleDeleteWallet(item)}>
          <Trash size={moderateScale(16)} color={theme.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <WalletIcon size={moderateScale(48)} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>No wallets found</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        Tap the &quot;+&quot; button below to add your Cash, Bank, or Savings account.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={wallets}
        keyExtractor={(item) => item.id}
        renderItem={renderWalletItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      />

      {/* Floating Action Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: theme.primary }]}
        onPress={() => router.push('/add-wallet')}>
        <Plus size={moderateScale(28)} color="#FFFFFF" weight="bold" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: moderateScale(100),
  },
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: fontScale(24),
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontScale(13),
    marginTop: moderateScale(2),
    marginBottom: Spacing.md,
  },
  netWorthCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  netWorthLabel: {
    fontSize: fontScale(13),
    fontWeight: '500',
    marginBottom: Spacing.xs,
  },
  netWorthAmount: {
    fontSize: fontScale(32),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  netWorthSub: {
    fontSize: fontScale(12),
    marginTop: Spacing.xs,
  },
  sectionHeading: {
    fontSize: fontScale(17),
    fontWeight: '700',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  walletIconWrap: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  walletDetails: {
    flex: 1,
  },
  walletName: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginBottom: moderateScale(2),
  },
  walletCategory: {
    fontSize: fontScale(12),
  },
  walletRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  walletBalance: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  emptyContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: fontScale(16),
    fontWeight: '600',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontScale(13),
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  fab: {
    position: 'absolute',
    bottom: moderateScale(24),
    right: moderateScale(20),
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
});
