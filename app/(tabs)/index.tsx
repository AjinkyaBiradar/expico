import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  CalendarBlank,
  CaretDown,
  Eye,
  EyeSlash,
  Trash,
  User,
} from 'phosphor-react-native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryIcon } from '@/components/CategoryIcon';
import { getCategoryById, registerCategories } from '@/constants/categories';
import {
  deleteTransaction,
  getBalanceSummary,
  getCategories,
  getTransactions,
  TransactionWithWallet,
} from '@/db/queries';
import {
  formatDisplayDate,
  formatDisplayTime,
  formatCurrency as safeFormatCurrency,
  formatStatCurrency as safeFormatStatCurrency,
} from '@/utils/formatters';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';
import { useAppTheme } from '@/utils/settings';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { isDark, theme } = useAppTheme();

  // Real-time state
  const [transactions, setTransactions] = useState<TransactionWithWallet[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // UI state
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [selectedFilterCat, setSelectedFilterCat] = useState<string>('all');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [activeWeekCycle, setActiveWeekCycle] = useState<'thisWeek' | 'lastWeek'>('thisWeek');
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

  // Load live data from SQLite
  const loadData = useCallback(async () => {
    try {
      const [balanceSummary, txList, catList] = await Promise.all([
        getBalanceSummary(db),
        getTransactions(db, 1000),
        getCategories(db),
      ]);

      setTotalBalance(balanceSummary.totalBalance);
      setTotalIncome(balanceSummary.totalIncome);
      setTotalExpense(balanceSummary.totalExpense);
      setTransactions(txList);
      registerCategories(catList);
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

  // Currency format with null/undefined safety
  const formatCurrency = (val: number | null | undefined) => {
    return safeFormatCurrency(val, isBalanceHidden);
  };

  const formatStatCurrency = (val: number | null | undefined) => {
    return safeFormatStatCurrency(val, isBalanceHidden);
  };

  // Calculate active week date boundaries (Monday to Sunday)
  const weekRange = useMemo(() => {
    const now = new Date();
    const currentDay = (now.getDay() + 6) % 7; // 0=Mon, 1=Tue, ..., 6=Sun
    const thisMonday = new Date(now);
    thisMonday.setHours(0, 0, 0, 0);
    thisMonday.setDate(now.getDate() - currentDay);

    const targetMonday = new Date(thisMonday);
    if (activeWeekCycle === 'lastWeek') {
      targetMonday.setDate(thisMonday.getDate() - 7);
    }

    const start = targetMonday.getTime();
    const end = start + 7 * 86400000;
    return { start, end };
  }, [activeWeekCycle]);

  // Dynamic Weekly Spending Activity strictly computed from database transactions
  const weeklyData = useMemo(() => {
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayChars = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    const days = dayNames.map((name, idx) => {
      const dayDate = new Date(weekRange.start + idx * 86400000);
      const dateStr = dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        day: dayChars[idx],
        name,
        dateStr,
        full: `${name}, ${dateStr}`,
        timestamp: dayDate.getTime(),
        heightPct: 6,
        amount: 0,
        isPeak: false,
      };
    });

    transactions.forEach((tx) => {
      if (tx.type === 'expense' && tx.date >= weekRange.start && tx.date < weekRange.end) {
        const txDayIdx = Math.floor((tx.date - weekRange.start) / 86400000);
        if (txDayIdx >= 0 && txDayIdx < 7) {
          days[txDayIdx].amount += tx.amount;
        }
      }
    });

    const maxAmt = Math.max(...days.map((d) => d.amount), 0);
    days.forEach((d) => {
      d.heightPct = maxAmt > 0 && d.amount > 0 ? Math.max(14, Math.round((d.amount / maxAmt) * 96)) : 6;
      d.isPeak = maxAmt > 0 && d.amount === maxAmt;
    });

    return days;
  }, [transactions, weekRange]);

  const avgPerDay = useMemo(() => {
    const totalWk = weeklyData.reduce((acc, d) => acc + d.amount, 0);
    return Math.round(totalWk / 7);
  }, [weeklyData]);

  // Dynamic category allocation stream computed from database
  const categoryAllocations = useMemo(() => {
    const cycleExpenses = transactions.filter(
      (t) => t.type === 'expense' && t.date >= weekRange.start && t.date < weekRange.end
    );
    const targetExpenses = cycleExpenses.length > 0 ? cycleExpenses : transactions.filter((t) => t.type === 'expense');
    const totalExp = targetExpenses.reduce((acc, t) => acc + t.amount, 0);
    if (totalExp === 0) return [];

    const map: Record<string, number> = {};
    targetExpenses.forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });

    return Object.entries(map).map(([catId, amt]) => {
      const cat = getCategoryById(catId);
      const pct = Math.round((amt / totalExp) * 100);
      return { id: catId, name: cat.name, color: cat.color, pct, amount: amt };
    });
  }, [transactions, weekRange]);

  // Filter categories available from existing transactions
  const availableFilterCategories = useMemo(() => {
    const cats = Array.from(new Set(transactions.map((t) => t.category)));
    return ['all', ...cats];
  }, [transactions]);

  // Distinct months present in transactions (e.g. "All Months", "Nov 2026", "Oct 2026")
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      monthsSet.add(d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    });
    return ['all', ...Array.from(monthsSet)];
  }, [transactions]);

  // Filtered transactions reacting to selected chart day, month filter, and category
  const filteredTransactions = useMemo(() => {
    let list = transactions;

    if (selectedDayIndex !== null && weeklyData[selectedDayIndex]) {
      const dayStart = weeklyData[selectedDayIndex].timestamp;
      const dayEnd = dayStart + 86400000;
      list = list.filter((tx) => tx.date >= dayStart && tx.date < dayEnd);
    }

    if (selectedMonthFilter !== 'all') {
      list = list.filter((tx) => {
        const d = new Date(tx.date);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) === selectedMonthFilter;
      });
    }

    if (selectedFilterCat !== 'all') {
      list = list.filter((tx) => tx.category === selectedFilterCat);
    }

    return list;
  }, [transactions, selectedDayIndex, weeklyData, selectedMonthFilter, selectedFilterCat]);

  // Grouped by Date and Month dynamically across all months
  const groupedTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groupsMap = new Map<string, TransactionWithWallet[]>();

    filteredTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      d.setHours(0, 0, 0, 0);

      let title: string;
      if (d.getTime() === today.getTime()) {
        title = `Today • ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else if (d.getTime() === yesterday.getTime()) {
        title = `Yesterday • ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else {
        title = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!groupsMap.has(title)) {
        groupsMap.set(title, []);
      }
      groupsMap.get(title)!.push(tx);
    });

    return Array.from(groupsMap.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [filteredTransactions]);

  const handleDeleteTransaction = (tx: TransactionWithWallet) => {
    const isExpense = tx.type === 'expense';
    const impactNote = isExpense
      ? `Crediting ${formatCurrency(tx.amount)} back to your "${tx.wallet_name}" wallet.`
      : `Deducting ${formatCurrency(tx.amount)} from your "${tx.wallet_name}" wallet.`;

    Alert.alert(
      '🤖 Smart Ledger Assistant',
      `You are about to remove this ${tx.type.toUpperCase()} transaction:\n\n• Category: ${tx.category}\n• Amount: ${formatCurrency(tx.amount)}\n• Account: ${tx.wallet_name}\n\n${impactNote}\n\nWould you like to confirm this deletion?`,
      [
        { text: 'Keep Transaction', style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(db, tx.id);
              await loadData();
              Alert.alert(
                '✨ Ledger Synchronized',
                `Successfully removed the transaction.\n${formatCurrency(tx.amount)} was adjusted in "${tx.wallet_name}".`
              );
            } catch (err) {
              console.error('Failed to delete transaction:', err);
              Alert.alert('Assistant Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
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
              <Text style={[styles.periodPillText, { color: theme.text }]}>
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
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
                onPress={() => {
                  setActiveWeekCycle('thisWeek');
                  setSelectedDayIndex(null);
                }}>
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
                onPress={() => {
                  setActiveWeekCycle('lastWeek');
                  setSelectedDayIndex(null);
                }}>
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

          {/* Peak / Selection Tooltip Header */}
          <View style={styles.peakTooltipRow}>
            {selectedDayIndex !== null && weeklyData[selectedDayIndex] ? (
              <View style={[styles.peakBadge, { backgroundColor: isDark ? '#262A34' : '#E0F2FE' }]}>
                <View
                  style={[
                    styles.peakDot,
                    { backgroundColor: weeklyData[selectedDayIndex].isPeak ? '#F43F5E' : '#0284C7' },
                  ]}
                />
                <Text style={[styles.peakText, { color: theme.text }]}>
                  {weeklyData[selectedDayIndex].full}: {formatCurrency(weeklyData[selectedDayIndex].amount)}
                  {weeklyData[selectedDayIndex].isPeak ? ' (Peak)' : ''}
                </Text>
                <Pressable hitSlop={8} onPress={() => setSelectedDayIndex(null)}>
                  <Text style={[styles.clearFilterText, { color: theme.primary }]}>✕ Clear</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.peakHintText, { color: theme.textMuted }]}>
                Tap any day to view details & filter ledger
              </Text>
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
                  onPress={() => setSelectedDayIndex(selectedDayIndex === idx ? null : idx)}>
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
                        color: isSelected
                          ? '#10B981'
                          : col.isPeak
                            ? '#F43F5E'
                            : theme.textSecondary,
                        fontWeight: isSelected || col.isPeak ? '700' : '500',
                      },
                    ]}>
                    {col.day}
                  </Text>
                  {isSelected && (
                    <View style={[styles.activeDayDot, { backgroundColor: '#10B981' }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Category Allocation Pill Stream */}
          <View style={styles.allocationPillsRow}>
            {categoryAllocations.length > 0 ? (
              categoryAllocations.map((alloc) => {
                const isSelected = selectedFilterCat === alloc.id;
                return (
                  <Pressable
                    key={alloc.id}
                    style={[
                      styles.allocPill,
                      {
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(16, 185, 129, 0.25)' : '#D1FAE5')
                          : (isDark ? '#262A34' : '#F1F5F9'),
                        borderColor: isSelected ? '#10B981' : 'transparent',
                        borderWidth: 1,
                      },
                    ]}
                    onPress={() => setSelectedFilterCat(isSelected ? 'all' : alloc.id)}>
                    <View style={[styles.allocDot, { backgroundColor: alloc.color }]} />
                    <Text style={[styles.allocText, { color: theme.text }]}>
                      {alloc.name} {alloc.pct}%
                    </Text>
                  </Pressable>
                );
              })
            ) : (
              <Text style={{ color: theme.textMuted, fontSize: fontScale(11) }}>
                No category expenses logged for this cycle
              </Text>
            )}
          </View>
        </View>

        {/* 5. ALL TRANSACTIONS (WITH DATE & ALL MONTHS) */}
        <View style={styles.transactionsSection}>
          <View style={styles.txHeaderRow}>
            <View>
              <View style={styles.sectionTitleWithCount}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>All Transactions</Text>
                <View style={[styles.countBadge, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
                  <Text style={[styles.countBadgeText, { color: theme.primary }]}>
                    {filteredTransactions.length}
                  </Text>
                </View>
              </View>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                {selectedDayIndex !== null && weeklyData[selectedDayIndex]
                  ? `Filtered: ${weeklyData[selectedDayIndex].full}`
                  : selectedMonthFilter !== 'all'
                    ? `Showing ${selectedMonthFilter} entries`
                    : 'All months with verified date logs'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/(tabs)/analytics')}>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>ANALYTICS</Text>
            </Pressable>
          </View>

          {/* Filters: Month Selector and Category Selector */}
          <View style={styles.filterScrollsWrap}>
            {/* Month Filter Scroll Bar */}
            {availableMonths.length > 2 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
                {availableMonths.map((m) => {
                  const active = selectedMonthFilter === m;
                  return (
                    <Pressable
                      key={`m-${m}`}
                      style={[
                        styles.monthFilterBtn,
                        active
                          ? { backgroundColor: theme.primary }
                          : { backgroundColor: isDark ? '#262A34' : '#F1F5F9' },
                      ]}
                      onPress={() => setSelectedMonthFilter(m)}>
                      <CalendarBlank
                        size={moderateScale(12)}
                        color={active ? '#003824' : theme.textSecondary}
                        weight={active ? 'bold' : 'regular'}
                      />
                      <Text
                        style={[
                          styles.monthFilterText,
                          { color: active ? '#003824' : theme.textSecondary, fontWeight: active ? '700' : '600' },
                        ]}>
                        {m === 'all' ? 'All Months' : m}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {/* Filter Category Scroll Bar */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
              {availableFilterCategories.map((cat) => {
                const active = selectedFilterCat === cat;
                const catInfo = cat !== 'all' ? getCategoryById(cat) : null;
                const label = cat === 'all' ? 'All Categories' : catInfo?.name || cat;

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
          </View>

          {/* Grouped Transactions List Across All Months */}
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
                              {formatDisplayDate(tx.date)} • {formatDisplayTime(tx.date)} •{' '}
                              {tx.wallet_name || 'Main Wallet'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.txRight}>
                          <Text
                            style={[
                              styles.txAmount,
                              { color: isIncome ? '#10B981' : theme.text },
                            ]}>
                            {isIncome ? '+' : '-'}
                            {formatCurrency(tx.amount)}
                          </Text>
                          <Pressable
                            style={({ pressed }) => [
                              styles.txDeleteBtn,
                              {
                                opacity: pressed ? 0.6 : 1,
                                backgroundColor: isDark ? 'rgba(244, 63, 94, 0.15)' : '#FFE4E6',
                              },
                            ]}
                            hitSlop={8}
                            onPress={() => handleDeleteTransaction(tx)}>
                            <Trash size={moderateScale(15)} color="#F43F5E" />
                          </Pressable>
                        </View>
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
                No entries found for the selected month or category.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
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
  peakHintText: {
    fontSize: fontScale(11),
    fontStyle: 'italic',
  },
  clearFilterText: {
    fontSize: fontScale(11),
    fontWeight: '700',
    marginLeft: Spacing.xs,
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
  activeDayDot: {
    width: moderateScale(4),
    height: moderateScale(4),
    borderRadius: Radius.full,
    marginTop: moderateScale(2),
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
  sectionTitleWithCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countBadge: {
    paddingHorizontal: moderateScale(7),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: fontScale(10),
    fontWeight: '800',
  },
  seeAllText: {
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  filterScrollsWrap: {
    gap: moderateScale(4),
  },
  monthFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(5),
    borderRadius: Radius.full,
  },
  monthFilterText: {
    fontSize: fontScale(11),
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
  txRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  txDeleteBtn: {
    padding: moderateScale(6),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
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
});
