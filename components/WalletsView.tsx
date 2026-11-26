import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ArrowsLeftRight,
  Check,
  Plus,
  PlusCircle,
  Trash,
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

import { CategoryIcon } from '@/components/CategoryIcon';
import { registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  addTransaction,
  deleteWallet,
  getCategories,
  getWallets,
  transferBetweenWallets,
  Wallet,
} from '@/db/queries';
import { formatCurrency, generateUUID } from '@/utils/formatters';
import { useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

interface WalletsViewProps {
  onAddWalletPress?: () => void;
}

export function WalletsView({ onAddWalletPress }: WalletsViewProps) {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { currency } = useSettings();

  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Add Money state
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

  // Transfer state
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFromId, setTransferFromId] = useState<string>('');
  const [transferToId, setTransferToId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  const loadWallets = useCallback(async () => {
    try {
      const data = await getWallets(db);
      setWallets(data);
      if (data.length >= 2) {
        if (!transferFromId) setTransferFromId(data[0].id);
        if (!transferToId) setTransferToId(data[1].id);
      }
    } catch (err) {
      console.error('Failed to load wallets:', err);
    }
  }, [db, transferFromId, transferToId]);

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

  const loadIncomeCategories = useCallback(async () => {
    try {
      const cats = await getCategories(db, 'income');
      registerCategories(cats);
      const names = cats.map((c) => c.name);
      const combined = Array.from(
        new Set([...names, 'Deposit', 'Salary', 'Freelance', 'Investment', 'Bonus', 'Other'])
      );
      setIncomeSources(combined);
      if (combined.length > 0 && !combined.includes(selectedIncomeSource)) {
        setSelectedIncomeSource(combined[0]);
      }
    } catch (err) {
      console.warn('Failed to load income categories:', err);
    }
  }, [db, selectedIncomeSource]);

  const handleDeleteWallet = (wallet: Wallet) => {
    Alert.alert(
      '🤖 Smart Vault Assistant',
      `Attention: You are about to remove "${wallet.name}" with a current balance of ${formatCurrency(
        wallet.current_balance
      )}.\n\nAll linked transactions associated with this account will also be permanently cleared from your ledger.\n\nAre you sure you want to proceed?`,
      [
        { text: 'Keep Account', style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteWallet(db, wallet.id);
              await loadWallets();
              Alert.alert(
                '✨ Account Removed',
                `"${wallet.name}" and all associated transaction logs were cleanly removed from your vault.`
              );
            } catch (err) {
              console.error('Failed to delete wallet:', err);
              Alert.alert('Assistant Error', 'Failed to delete wallet. Please try again.');
            }
          },
        },
      ]
    );
  };

  const totalNetWorth = wallets.reduce((acc, w) => acc + w.current_balance, 0);

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

  const handleConfirmAddMoney = async () => {
    if (!addMoneyTarget) return;

    const parsed = parseFloat(addAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', `Please enter a valid deposit amount greater than ${currency.symbol}0.`);
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

  const handleOpenTransfer = () => {
    if (wallets.length < 2) {
      Alert.alert('Accounts Needed', 'You need at least 2 accounts to make a transfer between them.');
      return;
    }
    setTransferFromId(wallets[0].id);
    setTransferToId(wallets[1].id);
    setTransferAmount('');
    setTransferNote('');
    setIsTransferModalOpen(true);
  };

  const handleConfirmTransfer = async () => {
    const parsed = parseFloat(transferAmount);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Amount', `Please enter a valid amount greater than ${currency.symbol}0.`);
      return;
    }
    if (transferFromId === transferToId) {
      Alert.alert('Same Account', 'Please choose different source and destination accounts.');
      return;
    }

    const fromWallet = wallets.find((w) => w.id === transferFromId);
    const toWallet = wallets.find((w) => w.id === transferToId);

    if (!fromWallet || !toWallet) {
      Alert.alert('Error', 'Account selection invalid.');
      return;
    }

    setIsTransferring(true);
    try {
      await transferBetweenWallets(db, {
        fromWalletId: transferFromId,
        toWalletId: transferToId,
        amount: parsed,
        note: transferNote.trim() || undefined,
      });

      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferNote('');
      await loadWallets();
      Alert.alert(
        '⇄ Transfer Complete',
        `Successfully transferred ${formatCurrency(parsed)} from ${fromWallet.name} to ${toWallet.name}.`
      );
    } catch (err) {
      console.error('Failed to transfer:', err);
      Alert.alert('Transfer Error', 'Failed to execute transfer. Please try again.');
    } finally {
      setIsTransferring(false);
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Total Net Worth Card */}
      <View
        style={[
          styles.netWorthCard,
          { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
        ]}>
        <View style={styles.glowTopRight} />
        <View style={styles.glowBottomLeft} />

        <View style={styles.netWorthRowTop}>
          <Text style={[styles.netWorthLabel, { color: theme.textSecondary }]}>
            TOTAL LIQUID NET WORTH
          </Text>
          <View style={[styles.activePill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
            <Text style={styles.activePillText}>Live Vault</Text>
          </View>
        </View>

        <Text style={[styles.netWorthAmount, { color: theme.text }]}>
          {formatCurrency(totalNetWorth)}
        </Text>

        <View style={styles.netWorthSubRow}>
          <Text style={[styles.netWorthSub, { color: theme.textMuted }]}>
            Across {wallets.length} account{wallets.length === 1 ? '' : 's'}
          </Text>
        </View>

        {/* Action Buttons: Add Wallet & Transfer */}
        <View style={styles.topActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              {
                backgroundColor: theme.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={() => (onAddWalletPress ? onAddWalletPress() : router.push('/(modals)/add-wallet'))}>
            <Plus size={moderateScale(16)} color="#003824" weight="bold" />
            <Text style={styles.actionBtnTextPrimary}>+ New Account</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.transferBtn,
              {
                backgroundColor: isDark ? '#262A34' : '#F1F5F9',
                borderColor: theme.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            onPress={handleOpenTransfer}>
            <ArrowsLeftRight size={moderateScale(16)} color={theme.text} weight="bold" />
            <Text style={[styles.actionBtnTextSecondary, { color: theme.text }]}>Transfer</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeadingRow}>
        <Text style={[styles.sectionHeading, { color: theme.text }]}>Your Accounts</Text>
        <Text style={[styles.accountCountBadge, { color: theme.textSecondary }]}>
          {wallets.length} registered
        </Text>
      </View>
    </View>
  );

  const renderWalletItem = ({ item }: { item: Wallet }) => (
    <View
      style={[
        styles.walletCard,
        { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
      ]}>
      <View style={styles.walletMainRow}>
        <View style={[styles.walletIconWrap, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
          <CategoryIcon name={item.icon} size={moderateScale(22)} color="#10B981" />
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

      <View style={[styles.walletCardDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />

      <View style={styles.walletActionsRow}>
        <Pressable
          style={({ pressed }) => [
            styles.addMoneyBtn,
            {
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5',
              borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#A7F3D0',
              opacity: pressed ? 0.75 : 1,
            },
          ]}
          onPress={() => handleOpenAddMoney(item)}>
          <PlusCircle size={moderateScale(16)} color="#10B981" weight="bold" />
          <Text style={styles.addMoneyBtnText}>+ Deposit Money</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' }]}>
      <WalletIcon size={moderateScale(44)} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No accounts found</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        Tap &quot;+ New Account&quot; to add your Bank, Cash, or Savings wallet.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
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

      {/* Add Money Modal */}
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
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Deposit Money</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Into {addMoneyTarget?.name}
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={handleCloseAddMoney}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
              <Text style={[styles.currencySymbol, { color: theme.text }]}>{currency.symbol}</Text>
              <TextInput
                style={[styles.modalAmountInput, { color: theme.text }]}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                value={addAmount}
                onChangeText={setAddAmount}
                autoFocus
              />
            </View>

            <View style={styles.quickChipsRow}>
              {[500, 1000, 2000, 5000].map((amt) => (
                <Pressable
                  key={amt}
                  style={[
                    styles.quickChip,
                    { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' },
                  ]}
                  onPress={() => {
                    const cur = parseFloat(addAmount) || 0;
                    setAddAmount((cur + amt).toString());
                  }}>
                  <Text style={[styles.quickChipText, { color: theme.text }]}>
                    +{currency.symbol}{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SOURCE / CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
                {incomeSources.map((src) => {
                  const isSel = selectedIncomeSource === src;
                  return (
                    <Pressable
                      key={src}
                      style={[
                        styles.sourceChip,
                        {
                          backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                        },
                      ]}
                      onPress={() => setSelectedIncomeSource(src)}>
                      <Text
                        style={[
                          styles.sourceChipText,
                          { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                        ]}>
                        {src}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="e.g. November paycheck"
                placeholderTextColor={theme.textMuted}
                value={addNote}
                onChangeText={setAddNote}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.confirmDepositBtn,
                { backgroundColor: '#10B981', opacity: pressed || isAddingMoney ? 0.8 : 1 },
              ]}
              onPress={handleConfirmAddMoney}
              disabled={isAddingMoney}>
              <Check size={moderateScale(20)} color="#003824" weight="bold" />
              <Text style={styles.confirmDepositBtnText}>
                {isAddingMoney ? 'Depositing...' : 'Confirm Deposit'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Transfer Between Wallets Modal */}
      <Modal
        visible={isTransferModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsTransferModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsTransferModalOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#262A34' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Transfer Between Accounts</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Move funds instantly without fees
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={() => setIsTransferModalOpen(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            {/* From Account */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>FROM (SOURCE)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
                {wallets.map((w) => {
                  const isSel = transferFromId === w.id;
                  return (
                    <Pressable
                      key={'from_' + w.id}
                      style={[
                        styles.accountSelectChip,
                        {
                          backgroundColor: isSel ? 'rgba(239, 68, 68, 0.15)' : isDark ? '#1C1F29' : '#F1F5F9',
                          borderColor: isSel ? '#EF4444' : 'transparent',
                        },
                      ]}
                      onPress={() => setTransferFromId(w.id)}>
                      <Text
                        style={[
                          styles.accountSelectChipText,
                          { color: isSel ? '#EF4444' : theme.text, fontWeight: isSel ? '700' : '500' },
                        ]}>
                        {w.name} ({formatCurrency(w.current_balance)})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* To Account */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TO (DESTINATION)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
                {wallets.map((w) => {
                  const isSel = transferToId === w.id;
                  return (
                    <Pressable
                      key={'to_' + w.id}
                      style={[
                        styles.accountSelectChip,
                        {
                          backgroundColor: isSel ? 'rgba(16, 185, 129, 0.15)' : isDark ? '#1C1F29' : '#F1F5F9',
                          borderColor: isSel ? '#10B981' : 'transparent',
                        },
                      ]}
                      onPress={() => setTransferToId(w.id)}>
                      <Text
                        style={[
                          styles.accountSelectChipText,
                          { color: isSel ? '#10B981' : theme.text, fontWeight: isSel ? '700' : '500' },
                        ]}>
                        {w.name} ({formatCurrency(w.current_balance)})
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Amount */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TRANSFER AMOUNT</Text>
              <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
                <Text style={[styles.currencySymbol, { color: theme.text }]}>{currency.symbol}</Text>
                <TextInput
                  style={[styles.modalAmountInput, { color: theme.text }]}
                  placeholder="0"
                  placeholderTextColor={theme.textMuted}
                  keyboardType="decimal-pad"
                  value={transferAmount}
                  onChangeText={setTransferAmount}
                />
              </View>
            </View>

            {/* Quick Chips */}
            <View style={styles.quickChipsRow}>
              {[500, 1000, 2000, 5000].map((amt) => (
                <Pressable
                  key={'t_amt_' + amt}
                  style={[styles.quickChip, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                  onPress={() => {
                    const cur = parseFloat(transferAmount) || 0;
                    setTransferAmount((cur + amt).toString());
                  }}>
                  <Text style={[styles.quickChipText, { color: theme.text }]}>
                    +{currency.symbol}{amt}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Note */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NOTE (OPTIONAL)</Text>
              <TextInput
                style={[
                  styles.noteInput,
                  {
                    backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                placeholder="e.g. Monthly savings contribution"
                placeholderTextColor={theme.textMuted}
                value={transferNote}
                onChangeText={setTransferNote}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.confirmDepositBtn,
                { backgroundColor: theme.primary, opacity: pressed || isTransferring ? 0.8 : 1 },
              ]}
              onPress={handleConfirmTransfer}
              disabled={isTransferring}>
              <ArrowsLeftRight size={moderateScale(20)} color="#003824" weight="bold" />
              <Text style={styles.confirmDepositBtnText}>
                {isTransferring ? 'Transferring...' : 'Execute Transfer'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: moderateScale(100),
  },
  header: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  netWorthCard: {
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  glowTopRight: {
    position: 'absolute',
    top: -moderateScale(40),
    right: -moderateScale(40),
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -moderateScale(40),
    left: -moderateScale(40),
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  netWorthRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  netWorthLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  activePill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  activePillText: {
    fontSize: fontScale(10),
    color: '#10B981',
    fontWeight: '700',
  },
  netWorthAmount: {
    fontSize: fontScale(30),
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: Spacing.xs,
  },
  netWorthSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  netWorthSub: {
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  topActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(11),
    borderRadius: Radius.lg,
  },
  transferBtn: {
    borderWidth: 1,
  },
  actionBtnTextPrimary: {
    color: '#003824',
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  actionBtnTextSecondary: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionHeading: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  accountCountBadge: {
    fontSize: fontScale(12),
    fontWeight: '500',
  },
  walletCard: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  walletMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletIconWrap: {
    width: moderateScale(42),
    height: moderateScale(42),
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
    marginBottom: 2,
  },
  walletCategory: {
    fontSize: fontScale(12),
  },
  walletRight: {
    alignItems: 'flex-end',
  },
  walletBalance: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  deleteButton: {
    padding: moderateScale(4),
  },
  walletCardDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  walletActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  addMoneyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  addMoneyBtnText: {
    color: '#10B981',
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  emptyContainer: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: fontScale(13),
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
    maxHeight: '85%',
  },
  sheetHandle: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: Radius.full,
    backgroundColor: '#6B7280',
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  sheetTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
  },
  sheetSub: {
    fontSize: fontScale(13),
    marginTop: 2,
  },
  closeBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  currencySymbol: {
    fontSize: fontScale(22),
    fontWeight: '700',
    marginRight: Spacing.sm,
  },
  modalAmountInput: {
    flex: 1,
    fontSize: fontScale(24),
    fontWeight: '800',
    paddingVertical: moderateScale(4),
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(7),
    borderRadius: Radius.md,
  },
  quickChipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: Spacing.xs,
  },
  sourceScroll: {
    flexDirection: 'row',
  },
  sourceChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  sourceChipText: {
    fontSize: fontScale(13),
  },
  accountSelectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.md,
    marginRight: Spacing.sm,
    borderWidth: 1.5,
  },
  accountSelectChipText: {
    fontSize: fontScale(13),
  },
  noteInput: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    borderWidth: 1,
    fontSize: fontScale(14),
  },
  confirmDepositBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(13),
    borderRadius: Radius.lg,
    marginTop: Spacing.xs,
  },
  confirmDepositBtnText: {
    color: '#003824',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
