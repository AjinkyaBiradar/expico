import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CaretDown,
  Check,
  Eye,
  EyeSlash,
  Plus,
  ShieldCheck,
  User,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
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
import { Category, getCategoryById, registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  addTransaction,
  getBalanceSummary,
  getCategories,
  getTransactions,
  getWallets,
  TransactionWithWallet,
  Wallet,
} from '@/db/queries';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';
import {
  formatCurrency as safeFormatCurrency,
  formatStatCurrency as safeFormatStatCurrency,
  generateUUID,
} from '@/utils/formatters';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  // Real-time state
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // UI state
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [selectedFilterCat, setSelectedFilterCat] = useState<string>('all');
  const [activeWeekCycle, setActiveWeekCycle] = useState<'thisWeek' | 'lastWeek'>('thisWeek');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Quick Log Drawer Modal State
  const [isQuickLogOpen, setIsQuickLogOpen] = useState<boolean>(false);
  const [quickAmount, setQuickAmount] = useState<string>('');
  const [expenseCategories, setExpenseCategories] = useState<Category[]>([]);
  const [quickCategory, setQuickCategory] = useState<string>('');

  // Load live data from SQLite
  const loadData = useCallback(async () => {
    try {
      const [walletList, balanceSummary, txList, catList] = await Promise.all([
        getWallets(db),
        getBalanceSummary(db),
        getTransactions(db, 30),
        getCategories(db),
      ]);

      setWallets(walletList);
      setTotalBalance(balanceSummary.totalBalance);
      setTotalIncome(balanceSummary.totalIncome);
      setTotalExpense(balanceSummary.totalExpense);
      setTransactions(txList);
      registerCategories(catList);
      const expCats = catList.filter((c) => c.type === 'expense');
      setExpenseCategories(expCats);
      setQuickCategory((prev) => {
        if (expCats.some((c) => c.id === prev)) return prev;
        return expCats.length > 0 ? expCats[0].id : '';
      });
    } catch (err) {
      console.error('Failed to load VaultFlow dashboard data:', err);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Safe-to-spend calculation - strictly starts at 0 if no balance
  const safeToSpend = useMemo(() => {
    const daysRemaining = 12;
    const remainingBudget = Math.max(0, totalBalance * 0.25);
    return Math.round(remainingBudget / daysRemaining);
  }, [totalBalance]);

  // Currency format with null/undefined safety
  const formatCurrency = (val: number | null | undefined) => {
    return safeFormatCurrency(val, isBalanceHidden);
  };

  const formatStatCurrency = (val: number | null | undefined) => {
    return safeFormatStatCurrency(val, isBalanceHidden);
  };

  // Dynamic Weekly Spending Activity strictly computed from database transactions
  const weeklyData = useMemo(() => {
    const days = [
      { day: 'M', full: 'Mon', heightPct: 4, amount: 0, isPeak: false },
      { day: 'T', full: 'Tue', heightPct: 4, amount: 0, isPeak: false },
      { day: 'W', full: 'Wed', heightPct: 4, amount: 0, isPeak: false },
      { day: 'T', full: 'Thu', heightPct: 4, amount: 0, isPeak: false },
      { day: 'F', full: 'Fri', heightPct: 4, amount: 0, isPeak: false },
      { day: 'S', full: 'Sat', heightPct: 4, amount: 0, isPeak: false },
      { day: 'S', full: 'Sun', heightPct: 4, amount: 0, isPeak: false },
    ];

    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - currentDay);
    const startOfWeek = monday.getTime();

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.date >= startOfWeek) {
        const d = new Date(tx.date);
        const dayIdx = (d.getDay() + 6) % 7;
        if (dayIdx >= 0 && dayIdx < 7) {
          days[dayIdx].amount += tx.amount;
        }
      }
    });

    const maxAmt = Math.max(...days.map((d) => d.amount), 0);
    days.forEach((d) => {
      d.heightPct = maxAmt > 0 && d.amount > 0 ? Math.max(14, Math.round((d.amount / maxAmt) * 96)) : 4;
      d.isPeak = maxAmt > 0 && d.amount === maxAmt;
    });

    return days;
  }, [transactions]);

  const avgPerDay = useMemo(() => {
    const totalWk = weeklyData.reduce((acc, d) => acc + d.amount, 0);
    return Math.round(totalWk / 7);
  }, [weeklyData]);

  // Dynamic category allocation stream computed from database
  const categoryAllocations = useMemo(() => {
    const expenses = transactions.filter((t) => t.type === 'expense');
    const totalExp = expenses.reduce((acc, t) => acc + t.amount, 0);
    if (totalExp === 0) return [];

    const map: Record<string, number> = {};
    expenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

    return Object.entries(map).map(([catId, amt]) => {
      const cat = getCategoryById(catId);
      const pct = Math.round((amt / totalExp) * 100);
      return { id: catId, name: cat.name, color: cat.color, pct, amount: amt };
    });
  }, [transactions]);

  // Filter categories available from existing transactions
  const availableFilterCategories = useMemo(() => {
    const cats = Array.from(new Set(transactions.map((t) => t.category)));
    return ['all', ...cats];
  }, [transactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (selectedFilterCat === 'all') return transactions;
    return transactions.filter((tx) => tx.category === selectedFilterCat);
  }, [transactions, selectedFilterCat]);

  // Grouped by Date (Today vs Yesterday / Prior)
  const groupedTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayItems: TransactionWithWallet[] = [];
    const yesterdayItems: TransactionWithWallet[] = [];
    const olderItems: TransactionWithWallet[] = [];

    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      txDate.setHours(0, 0, 0, 0);

      if (txDate.getTime() === today.getTime()) {
        todayItems.push(tx);
      } else if (txDate.getTime() === yesterday.getTime()) {
        yesterdayItems.push(tx);
      } else {
        olderItems.push(tx);
      }
    });

    const todayStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const yesterdayStr = yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    return [
      { title: `Today, ${todayStr}`, data: todayItems },
      { title: `Yesterday, ${yesterdayStr}`, data: yesterdayItems },
      { title: 'Earlier This Month', data: olderItems },
    ].filter((group) => group.data.length > 0);
  }, [filteredTransactions]);

  // Quick Log Transaction Submit
  const handleQuickLogSubmit = async () => {
    const amt = parseFloat(quickAmount);
    if (isNaN(amt) || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid expense amount.');
      return;
    }

    if (wallets.length === 0) {
      Alert.alert('No Wallet Found', 'Please create a wallet first.');
      return;
    }

    if (!quickCategory) {
      Alert.alert('No Category', 'Please select or add an expense category first.');
      return;
    }

    try {
      const targetWallet = wallets[0];
      const newTxId = generateUUID();
      const catInfo = getCategoryById(quickCategory);
      await addTransaction(db, {
        id: newTxId,
        wallet_id: targetWallet.id,
        type: 'expense',
        amount: amt,
        category: quickCategory,
        description: `Quick ${catInfo.name}`,
        date: Date.now(),
      });

      setQuickAmount('');
      setIsQuickLogOpen(false);
      await loadData();
    } catch (err) {
      console.error('Failed to log quick expense:', err);
      Alert.alert('Error', 'Could not record quick expense.');
    }
  };



  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      {/* 1. VAULTFLOW TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <User size={moderateScale(18)} color="#003824" weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: theme.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Dashboard</Text>
          </View>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
          onPress={() => Alert.alert('Notifications', 'All your accounts and limits are on track!')}>
          <Bell size={moderateScale(20)} color={theme.text} weight="bold" />
          <View style={styles.notificationDot} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }>
        {/* 2. REMAINING / TOTAL AVAILABLE BALANCE CARD */}
        <View style={[styles.balanceCard, { backgroundColor: isDark ? '#262A34' : '#FFFFFF', borderColor: theme.border }]}>
          {/* Subtle Ambient Radial Radiance */}
          <View style={styles.glowTopRight} />
          <View style={styles.glowBottomLeft} />

          {/* Sub-header */}
          <View style={styles.balanceSubHeader}>
            <View style={styles.balanceLabelGroup}>
              <Text style={[styles.balanceCardLabel, { color: theme.textSecondary }]}>
                TOTAL AVAILABLE BALANCE
              </Text>
              <Pressable
                style={styles.eyeBtn}
                onPress={() => setIsBalanceHidden((prev) => !prev)}>
                {isBalanceHidden ? (
                  <EyeSlash size={moderateScale(16)} color={theme.textSecondary} weight="bold" />
                ) : (
                  <Eye size={moderateScale(16)} color={theme.textSecondary} weight="bold" />
                )}
              </Pressable>
            </View>

            <View style={[styles.periodPill, { backgroundColor: isDark ? '#31353F' : '#F1F5F9' }]}>
              <Text style={[styles.periodPillText, { color: theme.text }]}>October 2026</Text>
              <CaretDown size={moderateScale(12)} color={theme.textSecondary} weight="bold" />
            </View>
          </View>

          {/* Main Balance Display */}
          <Text style={[styles.balanceAmountText, { color: theme.text }]}>
            {formatCurrency(totalBalance)}
          </Text>

          {/* Month over Month Badge */}
          <View style={styles.momRow}>
            <View style={[styles.momBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
              <Text style={styles.momBadgeText}>Ledger Active</Text>
            </View>
            <Text style={[styles.momSubtext, { color: theme.textSecondary }]}>Real-time Balance</Text>
          </View>

          {/* Safe-to-Spend Pill Banner */}
          <View style={[styles.safeToSpendBanner, { backgroundColor: isDark ? '#181B25' : '#F8FAFC' }]}>
            <View style={styles.safeLeft}>
              <View style={[styles.shieldCircle, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <ShieldCheck size={moderateScale(14)} color="#10B981" weight="fill" />
              </View>
              <Text style={[styles.safeLabel, { color: theme.textSecondary }]}>Daily Safe-to-Spend</Text>
            </View>
            <View style={styles.safeRight}>
              <Text style={[styles.safeAmount, { color: theme.text }]}>
                {formatStatCurrency(safeToSpend)}
              </Text>
              <View style={[styles.optimalBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={styles.optimalText}>Optimal</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. SPLIT INCOME & EXPENSE CARDS */}
        <View style={styles.splitCardsRow}>
          {/* Total Income */}
          <View style={[styles.splitCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
            <View style={styles.splitCardHeader}>
              <View style={[styles.splitIconCircle, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                <ArrowUpRight size={moderateScale(18)} color="#10B981" weight="bold" />
              </View>
              <View style={[styles.statChangeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Text style={[styles.statChangeText, { color: '#10B981' }]}>Income</Text>
              </View>
            </View>
            <Text style={[styles.splitCardLabel, { color: theme.textSecondary }]}>TOTAL INCOME</Text>
            <Text style={[styles.splitCardValue, { color: '#4EDEA3' }]}>
              +{formatStatCurrency(totalIncome)}
            </Text>
          </View>

          {/* Total Expenses */}
          <View style={[styles.splitCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
            <View style={styles.splitCardHeader}>
              <View style={[styles.splitIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
                <ArrowDownLeft size={moderateScale(18)} color="#F43F5E" weight="bold" />
              </View>
              <View style={[styles.statChangeBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Text style={[styles.statChangeText, { color: '#F43F5E' }]}>Expenses</Text>
              </View>
            </View>
            <Text style={[styles.splitCardLabel, { color: theme.textSecondary }]}>TOTAL EXPENSES</Text>
            <Text style={[styles.splitCardValue, { color: '#FFB2B7' }]}>
              -{formatStatCurrency(totalExpense)}
            </Text>
          </View>
        </View>

        {/* 4. WEEKLY SPENDING ACTIVITY SECTION */}
        <View style={[styles.activitySection, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.activityHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Weekly Spending Activity</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                Avg {formatStatCurrency(avgPerDay)} / day this cycle
              </Text>
            </View>

            {/* Cycle Pill Toggle */}
            <View style={[styles.cycleToggleWrap, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
              <Pressable
                style={[styles.cycleBtn, activeWeekCycle === 'thisWeek' && styles.cycleBtnActive]}
                onPress={() => setActiveWeekCycle('thisWeek')}>
                <Text
                  style={[
                    styles.cycleText,
                    { color: activeWeekCycle === 'thisWeek' ? '#003824' : theme.textSecondary },
                  ]}>
                  This Week
                </Text>
              </Pressable>
              <Pressable
                style={[styles.cycleBtn, activeWeekCycle === 'lastWeek' && styles.cycleBtnActive]}
                onPress={() => setActiveWeekCycle('lastWeek')}>
                <Text
                  style={[
                    styles.cycleText,
                    { color: activeWeekCycle === 'lastWeek' ? '#003824' : theme.textSecondary },
                  ]}>
                  Last Week
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Peak Tooltip Header */}
          <View style={styles.peakTooltipRow}>
            {selectedDayIndex !== null && weeklyData[selectedDayIndex] && (
              <View style={[styles.peakBadge, { backgroundColor: isDark ? '#31353F' : '#FEE2E2' }]}>
                <View style={[styles.peakDot, { backgroundColor: '#F43F5E' }]} />
                <Text style={[styles.peakText, { color: theme.text }]}>
                  {weeklyData[selectedDayIndex].isPeak ? 'Peak ' : ''}
                  {formatStatCurrency(weeklyData[selectedDayIndex].amount)}
                </Text>
              </View>
            )}
          </View>

          {/* 7 Columns Weekly Chart */}
          <View style={styles.chartBarsContainer}>
            {weeklyData.map((col, idx) => {
              const isSelected = selectedDayIndex === idx;

              return (
                <Pressable
                  key={`day-${idx}`}
                  style={styles.chartCol}
                  onPress={() => setSelectedDayIndex(idx)}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${col.heightPct}%` },
                        col.isPeak
                          ? { backgroundColor: '#F43F5E' }
                          : isSelected
                          ? { backgroundColor: '#10B981' }
                          : { backgroundColor: isDark ? '#31353F' : '#E2E8F0' },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      {
                        color: col.isPeak
                          ? '#F43F5E'
                          : isSelected
                          ? '#10B981'
                          : theme.textSecondary,
                        fontWeight: isSelected || col.isPeak ? '700' : '500',
                      },
                    ]}>
                    {col.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Category Allocation Pill Stream */}
          <View style={styles.allocationPillsRow}>
            {categoryAllocations.length > 0 ? (
              categoryAllocations.map((alloc) => (
                <View key={alloc.id} style={[styles.allocPill, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
                  <View style={[styles.allocDot, { backgroundColor: alloc.color }]} />
                  <Text style={[styles.allocText, { color: theme.text }]}>
                    {alloc.name} {alloc.pct}%
                  </Text>
                </View>
              ))
            ) : (
              <Text style={{ color: theme.textMuted, fontSize: fontScale(11) }}>
                No category expenses logged yet (0% allocated)
              </Text>
            )}
          </View>
        </View>

        {/* 5. ALL TRANSACTIONS DONE (RECENT TRANSACTIONS) */}
        <View style={styles.transactionsSection}>
          <View style={styles.txHeaderRow}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Transactions</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                Real-time ledger updates
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/analytics')}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>SEE ALL</Text>
            </Pressable>
          </View>

          {/* Filter Category Scroll Bar */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {availableFilterCategories.map((cat) => {
              const active = selectedFilterCat === cat;
              const catInfo = cat !== 'all' ? getCategoryById(cat) : null;
              const label = cat === 'all' ? 'All' : catInfo?.name || cat;

              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryFilterBtn,
                    active
                      ? { backgroundColor: '#10B981' }
                      : { backgroundColor: isDark ? '#262A34' : '#F1F5F9' },
                  ]}
                  onPress={() => setSelectedFilterCat(cat)}>
                  <Text
                    style={[
                      styles.categoryFilterText,
                      { color: active ? '#003824' : theme.textSecondary, fontWeight: active ? '700' : '600' },
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Grouped Transactions List */}
          {groupedTransactions.length > 0 ? (
            groupedTransactions.map((group, gIdx) => (
              <View key={`group-${gIdx}`} style={styles.dateGroupContainer}>
                <Text style={[styles.dateGroupTitle, { color: theme.textSecondary }]}>
                  {group.title.toUpperCase()}
                </Text>
                <View style={styles.dateGroupCards}>
                  {group.data.map((tx) => {
                    const isIncome = tx.type === 'income';
                    const categoryInfo = getCategoryById(tx.category);

                    return (
                      <View
                        key={tx.id}
                        style={[
                          styles.transactionCard,
                          { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
                        ]}>
                        <View style={styles.txLeft}>
                          <View
                            style={[
                              styles.txIconSquircle,
                              { backgroundColor: isDark ? '#262A34' : '#F1F5F9' },
                            ]}>
                            <CategoryIcon name={categoryInfo.icon} size={moderateScale(20)} color={categoryInfo.color} />
                          </View>
                          <View style={styles.txDetails}>
                            <View style={styles.txTitleRow}>
                              <Text style={[styles.txTitle, { color: theme.text }]} numberOfLines={1}>
                                {tx.description || categoryInfo.name}
                              </Text>
                              <View
                                style={[
                                  styles.txCategoryTag,
                                  { backgroundColor: isDark ? '#262A34' : '#F1F5F9' },
                                ]}>
                                <Text style={[styles.txCategoryTagText, { color: categoryInfo.color }]}>
                                  {categoryInfo.name}
                                </Text>
                              </View>
                            </View>
                            <Text style={[styles.txSubtext, { color: theme.textMuted }]}>
                              {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                              {tx.wallet_name || 'Main Wallet'}
                            </Text>
                          </View>
                        </View>

                        <Text
                          style={[
                            styles.txAmount,
                            { color: isIncome ? '#10B981' : theme.text },
                          ]}>
                          {isIncome ? '+' : '-'}
                          {formatCurrency(tx.amount)}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Transactions Found</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                No expenses matched the &quot;{selectedFilterCat}&quot; category.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 7. QUICK ACTION DRAWER MODAL SHEET */}
      <Modal visible={isQuickLogOpen} transparent animationType="slide" onRequestClose={() => setIsQuickLogOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsQuickLogOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#262A34' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Log Quick Expense</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Instantly update your safe-to-spend target
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={() => setIsQuickLogOpen(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            {/* Currency Input Box */}
            <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
              <Text style={[styles.currencySymbol, { color: theme.text }]}>₹</Text>
              <TextInput
                style={[styles.currencyInput, { color: theme.text }]}
                placeholder="0.00"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
                autoFocus
                value={quickAmount}
                onChangeText={setQuickAmount}
              />
            </View>

            {/* Quick Category Grid */}
            {expenseCategories.length === 0 ? (
              <View style={styles.quickEmptyWrap}>
                <Text style={[styles.quickEmptyText, { color: theme.textMuted }]}>
                  No expense categories created yet.
                </Text>
                <Pressable
                  style={[styles.quickAddCategoryBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                  onPress={() => {
                    setIsQuickLogOpen(false);
                    router.push('/(modals)/add-transaction');
                  }}>
                  <Plus size={moderateScale(14)} color={theme.primary} weight="bold" />
                  <Text style={[styles.quickAddCategoryBtnText, { color: theme.primary }]}>
                    + Add Category in Transaction Modal
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickCategoryRow}>
                {expenseCategories.map((item) => {
                  const isSelected = quickCategory === item.id;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.quickCatBtn,
                        { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' },
                        isSelected && { borderColor: '#10B981', borderWidth: 1.5 },
                      ]}
                      onPress={() => setQuickCategory(item.id)}>
                      <CategoryIcon name={item.icon} size={moderateScale(22)} color={item.color} weight="fill" />
                      <Text style={[styles.quickCatText, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Record Expense Button */}
            <Pressable style={[styles.confirmRecordBtn, { backgroundColor: '#10B981' }]} onPress={handleQuickLogSubmit}>
              <Check size={moderateScale(20)} color="#003824" weight="bold" />
              <Text style={styles.confirmRecordText}>Record Expense</Text>
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
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
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
    position: 'relative',
  },
  notificationDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: Radius.full,
    backgroundColor: '#10B981',
    position: 'absolute',
    top: moderateScale(8),
    right: moderateScale(10),
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: moderateScale(90),
    gap: Spacing.md,
  },

  /* 1. BALANCE CARD */
  balanceCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
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
    width: moderateScale(140),
    height: moderateScale(140),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: -moderateScale(40),
    left: -moderateScale(40),
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  balanceSubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  balanceLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  balanceCardLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  eyeBtn: {
    padding: moderateScale(4),
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
    borderRadius: Radius.full,
  },
  periodPillText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  balanceAmountText: {
    fontSize: fontScale(30),
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: moderateScale(3),
  },
  momRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  momBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  momBadgeText: {
    color: '#10B981',
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  momSubtext: {
    fontSize: fontScale(11),
  },
  safeToSpendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
  },
  safeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  shieldCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  safeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  safeAmount: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  optimalBadge: {
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  optimalText: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '700',
  },

  /* 2. SPLIT CARDS */
  splitCardsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  splitCard: {
    flex: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
  },
  splitCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  splitIconCircle: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statChangeBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  statChangeText: {
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  splitCardLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: Spacing.xs,
  },
  splitCardValue: {
    fontSize: fontScale(16),
    fontWeight: '800',
    marginTop: moderateScale(2),
  },

  /* 3. ACTIVITY SECTION */
  activitySection: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  activitySub: {
    fontSize: fontScale(12),
    marginTop: moderateScale(2),
  },
  cycleToggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(2),
  },
  cycleBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
    borderRadius: Radius.full,
  },
  cycleBtnActive: {
    backgroundColor: '#10B981',
  },
  cycleText: {
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  peakTooltipRow: {
    height: moderateScale(24),
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: moderateScale(36),
    marginVertical: moderateScale(4),
  },
  peakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.md,
  },
  peakDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: Radius.full,
  },
  peakText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  chartBarsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: moderateScale(110),
    paddingHorizontal: Spacing.xs,
  },
  chartCol: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: moderateScale(6),
  },
  barTrack: {
    width: moderateScale(18),
    height: '80%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: Radius.sm,
    borderTopRightRadius: Radius.sm,
  },
  barLabel: {
    fontSize: fontScale(11),
  },
  allocationPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.xs,
  },
  allocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
    borderRadius: Radius.full,
  },
  allocDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: Radius.full,
  },
  allocText: {
    fontSize: fontScale(10),
    fontWeight: '600',
  },

  /* 4. TRANSACTIONS SECTION */
  transactionsSection: {
    gap: Spacing.sm,
  },
  txHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  filterPillsScroll: {
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
  categoryFilterBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(6),
    borderRadius: Radius.full,
  },
  categoryFilterText: {
    fontSize: fontScale(11),
  },
  dateGroupContainer: {
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  dateGroupTitle: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 1,
    paddingHorizontal: Spacing.xs,
  },
  dateGroupCards: {
    gap: Spacing.xs,
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  txLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  txIconSquircle: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetails: {
    flex: 1,
  },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  txTitle: {
    fontSize: fontScale(13),
    fontWeight: '700',
    maxWidth: '65%',
  },
  txCategoryTag: {
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(1),
    borderRadius: Radius.sm,
  },
  txCategoryTagText: {
    fontSize: fontScale(9),
    fontWeight: '700',
  },
  txSubtext: {
    fontSize: fontScale(10),
    marginTop: moderateScale(2),
  },
  txAmount: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  emptyContainer: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: fontScale(11),
    marginTop: moderateScale(4),
  },

  /* 5. FLOATING QUICK ACTION BUTTON */
  floatingActionContainer: {
    position: 'absolute',
    bottom: moderateScale(16),
    right: Spacing.md,
    zIndex: 40,
  },
  quickAddFab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    borderRadius: Radius.full,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  quickAddFabText: {
    color: '#003824',
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 0.6,
  },

  /* 6. DRAWER MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? moderateScale(38) : Spacing.xl,
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
    fontSize: fontScale(16),
    fontWeight: '800',
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
  currencyInput: {
    fontSize: fontScale(32),
    fontWeight: '800',
    minWidth: moderateScale(120),
    textAlign: 'center',
  },
  quickCategoryGrid: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  quickCategoryRow: {
    gap: Spacing.xs,
    paddingVertical: moderateScale(4),
  },
  quickEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  quickEmptyText: {
    fontSize: fontScale(12),
  },
  quickAddCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.full,
  },
  quickAddCategoryBtnText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  quickCatBtn: {
    minWidth: moderateScale(72),
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    gap: moderateScale(4),
  },
  quickCatText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  confirmRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(14),
    borderRadius: Radius.lg,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  confirmRecordText: {
    color: '#003824',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
