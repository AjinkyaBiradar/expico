import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Plus,
  Trash,
  User,
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

import { CategoryIcon } from '@/components/CategoryIcon';

import { Colors } from '@/constants/colors';
import { deleteWallet, getWallets, Wallet } from '@/db/queries';
import { formatCurrency } from '@/utils/formatters';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function WalletsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

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





  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Header */}
      <View style={styles.topHeaderRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <User size={moderateScale(18)} color="#003824" weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: theme.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Budgets & Wallets</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            style={[styles.addWalletHeaderBtn, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/(modals)/add-wallet')}>
            <Plus size={moderateScale(16)} color="#003824" weight="bold" />
            <Text style={styles.addWalletHeaderBtnText}>Add</Text>
          </Pressable>
        </View>
      </View>

      {/* Total Net Worth Card */}
      <View style={[styles.netWorthCard, { backgroundColor: isDark ? '#262A34' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />

        <Text style={[styles.netWorthLabel, { color: theme.textSecondary }]}>
          TOTAL LIQUID NET WORTH
        </Text>
        <Text style={[styles.netWorthAmount, { color: theme.text }]}>
          {formatCurrency(totalNetWorth)}
        </Text>
        <View style={styles.netWorthSubRow}>
          <View style={[styles.activePill, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
            <Text style={styles.activePillText}>Active Ledger</Text>
          </View>
          <Text style={[styles.netWorthSub, { color: theme.textMuted }]}>
            Across {wallets.length} account{wallets.length === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionHeading, { color: theme.text }]}>Your Accounts</Text>
    </View>
  );

  const renderWalletItem = ({ item }: { item: Wallet }) => (
    <View style={[styles.walletCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
      <View style={[styles.walletIconWrap, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
        <CategoryIcon name={item.icon} size={moderateScale(22)} color="#10B981" />
      </View>

      <View style={styles.walletDetails}>
        <Text style={[styles.walletName, { color: theme.text }]}>{item.name}</Text>
        <Text style={[styles.walletCategory, { color: theme.textSecondary }]}>
          {item.icon} Account • Primary Source
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
    <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' }]}>
      <WalletIcon size={moderateScale(44)} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No wallets found</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        Tap the &quot;+&quot; button below to add your Cash, Bank, or Savings account.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: moderateScale(80),
  },
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  topHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBranding: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  screenTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  iconButton: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  netWorthCard: {
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 4,
  },
  glowTopRight: {
    position: 'absolute',
    top: -moderateScale(40),
    right: -moderateScale(40),
    width: moderateScale(130),
    height: moderateScale(130),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -moderateScale(40),
    left: -moderateScale(40),
    width: moderateScale(110),
    height: moderateScale(110),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  netWorthLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  netWorthAmount: {
    fontSize: fontScale(32),
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: moderateScale(4),
  },
  netWorthSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: moderateScale(4),
  },
  activePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  activePillText: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  netWorthSub: {
    fontSize: fontScale(12),
  },
  sectionHeading: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  walletCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  walletIconWrap: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  walletDetails: {
    flex: 1,
  },
  walletName: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  walletCategory: {
    fontSize: fontScale(11),
    marginTop: moderateScale(2),
  },
  walletRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  walletBalance: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  deleteButton: {
    padding: Spacing.xs,
  },
  emptyContainer: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontScale(12),
    textAlign: 'center',
    lineHeight: moderateScale(17),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  addWalletHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
  },
  addWalletHeaderBtnText: {
    color: '#003824',
    fontSize: fontScale(12),
    fontWeight: '800',
  },
});
