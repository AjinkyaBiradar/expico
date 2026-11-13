import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Check,
  Plus,
  PlusCircle,
  Trash,
  User,
  Wallet as WalletIcon,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/CategoryIcon';
import { registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import { addTransaction, deleteWallet, getCategories, getWallets, Wallet } from '@/db/queries';
import { formatCurrency, generateUUID } from '@/utils/formatters';
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

  // Add Money to Existing Budget state
  const [addMoneyTarget, setAddMoneyTarget] = useState<Wallet | null>(null);
  const [addAmount, setAddAmount] = useState<string>('');
  const [addNote, setAddNote] = useState<string>('');
  const [selectedIncomeSource, setSelectedIncomeSource] = useState<string>('Deposit');
  const [incomeSources, setIncomeSources] = useState<string[]>([
    'Deposit',
    'Salary',
    'Freelance',
    'Investment',
    'Bonus',
    'Other',
  ]);
  const [isAddingMoney, setIsAddingMoney] = useState<boolean>(false);

  const loadIncomeCategories = useCallback(async () => {
    try {
      const cats = await getCategories(db, 'income');
      registerCategories(cats);
      const names = cats.map((c) => c.name);
      const combined = Array.from(new Set([...names, 'Deposit', 'Salary', 'Freelance', 'Investment', 'Bonus', 'Other']));
      setIncomeSources(combined);
      if (combined.length > 0 && !combined.includes(selectedIncomeSource)) {
        setSelectedIncomeSource(combined[0]);
      }
    } catch (err) {
      console.warn('Failed to load income categories:', err);
    }
  }, [db, selectedIncomeSource]);

  const handleOpenAddMoney = (wallet: Wallet) => {
    setAddMoneyTarget(wallet);
    setAddAmount('');
    setAddNote('');
    loadIncomeCategories();
  };

  const handleCloseAddMoney = () => {
    setAddMoneyTarget(null);
    setAddAmount('');
    setAddNote('');
  };

  const handleQuickAdd = (increment: number) => {
    const current = parseFloat(addAmount) || 0;
    setAddAmount((current + increment).toString());
  };

  const handleConfirmAddMoney = async () => {
    if (!addMoneyTarget) return;

    const parsed = parseFloat(addAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid deposit amount greater than ₹0.');
      return;
    }

    setIsAddingMoney(true);
    try {
      const txId = generateUUID();
      await addTransaction(db, {
        id: txId,
        wallet_id: addMoneyTarget.id,
        type: 'income',
        amount: parsed,
        category: selectedIncomeSource || 'Deposit',
        description: addNote.trim() || `Deposit to ${addMoneyTarget.name}`,
        date: Date.now(),
      });

      handleCloseAddMoney();
      await loadWallets();
      Alert.alert('Success', `Successfully deposited ${formatCurrency(parsed)} into ${addMoneyTarget.name}.`);
    } catch (err) {
      console.error('Failed to add money:', err);
      Alert.alert('Error', 'Failed to deposit money. Please try again.');
    } finally {
      setIsAddingMoney(false);
    }
  };





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
      <View style={styles.walletMainRow}>
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

      <View style={[styles.walletCardDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />

      <View style={styles.walletActionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.addMoneyBtn,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#A7F3D0',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={() => handleOpenAddMoney(item)}>
          <PlusCircle size={moderateScale(16)} color="#10B981" weight="bold" />
          <Text style={styles.addMoneyBtnText}>Add Money</Text>
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

      {/* Add Money Modal Sheet */}
      <Modal
        visible={addMoneyTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={handleCloseAddMoney}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseAddMoney}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#262A34' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Add Money</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Deposit funds into {addMoneyTarget?.name}
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={handleCloseAddMoney}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            {/* Currency Input Box */}
            <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
              <Text style={[styles.currencySymbol, { color: theme.text }]}>₹</Text>
              <TextInput
                style={[styles.modalAmountInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                value={addAmount}
                onChangeText={setAddAmount}
                autoFocus
              />
            </View>

            {/* Quick Amount Chips */}
            <View style={styles.quickChipsRow}>
              {[500, 1000, 2000, 5000].map((amt) => (
                <Pressable
                  key={amt}
                  style={[
                    styles.quickChip,
                    { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' },
                  ]}
                  onPress={() => handleQuickAdd(amt)}>
                  <Text style={[styles.quickChipText, { color: theme.text }]}>+₹{amt}</Text>
                </Pressable>
              ))}
            </View>

            {/* Income Source / Category */}
            <Text style={[styles.inputSectionLabel, { color: theme.textSecondary }]}>SOURCE / CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sourceChipsRow}>
              {incomeSources.map((source) => {
                const isSelected = selectedIncomeSource === source;
                return (
                  <Pressable
                    key={source}
                    style={[
                      styles.sourceChip,
                      isSelected
                        ? { backgroundColor: '#10B981' }
                        : { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' },
                    ]}
                    onPress={() => setSelectedIncomeSource(source)}>
                    <Text
                      style={[
                        styles.sourceChipText,
                        { color: isSelected ? '#003824' : theme.text, fontWeight: isSelected ? '700' : '600' },
                      ]}>
                      {source}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Note / Description (Optional) */}
            <Text style={[styles.inputSectionLabel, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
              NOTE (OPTIONAL)
            </Text>
            <TextInput
              style={[
                styles.noteInput,
                {
                  backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="e.g. Monthly salary, bonus, payout"
              placeholderTextColor={theme.textMuted}
              value={addNote}
              onChangeText={setAddNote}
            />

            {/* Submit Button */}
            <Pressable
              style={({ pressed }) => [
                styles.confirmDepositBtn,
                {
                  opacity: pressed || isAddingMoney || !addAmount || parseFloat(addAmount) <= 0 ? 0.6 : 1,
                  backgroundColor: '#10B981',
                },
              ]}
              disabled={isAddingMoney || !addAmount || parseFloat(addAmount) <= 0}
              onPress={handleConfirmAddMoney}>
              <Check size={moderateScale(18)} color="#003824" weight="bold" />
              <Text style={styles.confirmDepositText}>
                {isAddingMoney
                  ? 'Adding Money...'
                  : `Deposit ₹${addAmount || '0'} to ${addMoneyTarget?.name || 'Budget'}`}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  walletMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletCardDivider: {
    height: 1,
    marginVertical: Spacing.sm,
  },
  walletActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
    paddingVertical: moderateScale(7),
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  addMoneyBtnText: {
    color: '#10B981',
    fontSize: fontScale(12),
    fontWeight: '700',
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

  /* Add Money Modal Sheet */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  sheetHandle: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: Radius.full,
    backgroundColor: '#86948A',
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  sheetSub: {
    fontSize: fontScale(12),
    marginTop: moderateScale(2),
  },
  closeBtn: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    gap: Spacing.xs,
  },
  currencySymbol: {
    fontSize: fontScale(30),
    fontWeight: '800',
  },
  modalAmountInput: {
    fontSize: fontScale(32),
    fontWeight: '800',
    minWidth: moderateScale(140),
    textAlign: 'center',
  },
  quickChipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  quickChip: {
    flex: 1,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  inputSectionLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  sourceChipsRow: {
    gap: Spacing.xs,
    paddingVertical: moderateScale(2),
  },
  sourceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(6),
    borderRadius: Radius.full,
  },
  sourceChipText: {
    fontSize: fontScale(12),
  },
  noteInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    fontSize: fontScale(13),
  },
  confirmDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(12),
    borderRadius: Radius.full,
    marginTop: Spacing.xs,
  },
  confirmDepositText: {
    color: '#003824',
    fontSize: fontScale(14),
    fontWeight: '800',
  },
});
