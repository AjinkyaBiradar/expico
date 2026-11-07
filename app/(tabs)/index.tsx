import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Airplane,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Car,
  Coins,
  DotsThreeOutline,
  Eye,
  EyeSlash,
  FirstAid,
  ForkKnife,
  GameController,
  Gift,
  GraduationCap,
  House,
  Laptop,
  List,
  Plus,
  Receipt,
  ShoppingCart,
  TrendDown,
  TrendUp,
  Wallet as WalletIcon,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategoryById } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  getBalanceSummary,
  getTransactions,
  getTransactionsInRange,
  getWallets,
  TransactionWithWallet,
  Wallet,
} from '@/db/queries';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function HomeScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.dark; // Dashboard is styled in premium dark mode

  // User state
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [periodInflow, setPeriodInflow] = useState<number>(0);
  const [periodOutflow, setPeriodOutflow] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithWallet[]>([]);
  const [rangeTransactions, setRangeTransactions] = useState<TransactionWithWallet[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [previewReceiptUri, setPreviewReceiptUri] = useState<string | null>(null);

  // Chart & Period state
  const [timeFrame, setTimeFrame] = useState<'week' | 'month'>('week');
  const [periodOffset, setPeriodOffset] = useState<number>(0); // 0 = current, -1 = previous, +1 = next
  const [selectedBarIndex, setSelectedBarIndex] = useState<number | null>(null);

  // Calculate start & end of current selected period
  const { periodStart, periodEnd, periodLabel, isCurrentPeriod } = useMemo(() => {
    const now = new Date();
    const isCurrent = periodOffset === 0;

    if (timeFrame === 'week') {
      // Find Monday of the target week
      const currentDay = now.getDay();
      const daysSinceMonday = (currentDay + 6) % 7;
      const targetMonday = new Date(now);
      targetMonday.setHours(0, 0, 0, 0);
      targetMonday.setDate(now.getDate() - daysSinceMonday + periodOffset * 7);

      const targetSunday = new Date(targetMonday);
      targetSunday.setDate(targetMonday.getDate() + 6);
      targetSunday.setHours(23, 59, 59, 999);

      let label = 'This Week';
      if (periodOffset === -1) label = 'Last Week';
      else if (periodOffset < -1) label = `${Math.abs(periodOffset)} Weeks Ago`;
      else if (periodOffset === 1) label = 'Next Week';
      else if (periodOffset > 1) label = `In ${periodOffset} Weeks`;

      return {
        periodStart: targetMonday.getTime(),
        periodEnd: targetSunday.getTime(),
        periodLabel: label,
        isCurrentPeriod: isCurrent,
      };
    } else {
      // Target Month
      const targetMonth = new Date(now.getFullYear(), now.getMonth() + periodOffset, 1);
      const start = targetMonth.getTime();
      const endMonth = new Date(now.getFullYear(), now.getMonth() + periodOffset + 1, 0);
      endMonth.setHours(23, 59, 59, 999);

      let label = 'This Month';
      if (periodOffset === -1) label = 'Last Month';
      else if (periodOffset < -1) {
        label = targetMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else if (periodOffset === 1) label = 'Next Month';
      else if (periodOffset > 1) {
        label = targetMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }

      return {
        periodStart: start,
        periodEnd: endMonth.getTime(),
        periodLabel: label,
        isCurrentPeriod: isCurrent,
      };
    }
  }, [timeFrame, periodOffset]);

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      const [walletList, balanceSummary, recentList, periodTxs] = await Promise.all([
        getWallets(db),
        getBalanceSummary(db),
        getTransactions(db, 15),
        getTransactionsInRange(db, periodStart, periodEnd),
      ]);

      setWallets(walletList);

      // Filter by selected wallet if any
      if (selectedWalletId) {
        const activeWallet = walletList.find((w) => w.id === selectedWalletId);
        setTotalBalance(activeWallet ? activeWallet.current_balance : 0);

        const filteredRecent = recentList.filter((t) => t.wallet_id === selectedWalletId);
        setRecentTransactions(filteredRecent);

        const filteredPeriod = periodTxs.filter((t) => t.wallet_id === selectedWalletId);
        setRangeTransactions(filteredPeriod);

        // Sum inflow and outflow for selected wallet in period
        let inflow = 0;
        let outflow = 0;
        filteredPeriod.forEach((t) => {
          if (t.type === 'income') inflow += t.amount;
          else outflow += t.amount;
        });
        setPeriodInflow(inflow);
        setPeriodOutflow(outflow);
      } else {
        setTotalBalance(balanceSummary.totalBalance);
        setRecentTransactions(recentList);
        setRangeTransactions(periodTxs);

        let inflow = 0;
        let outflow = 0;
        periodTxs.forEach((t) => {
          if (t.type === 'income') inflow += t.amount;
          else outflow += t.amount;
        });
        setPeriodInflow(inflow);
        setPeriodOutflow(outflow);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  }, [db, selectedWalletId, periodStart, periodEnd]);

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

  const formatCurrency = (val: number) => {
    if (isBalanceHidden) return '$••••••••';
    return `$${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatStatCurrency = (val: number) => {
    if (isBalanceHidden) return '$••••';
    return `$${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Group chart bars
  const chartBars = useMemo(() => {
    if (timeFrame === 'week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const data = days.map((dayLabel, idx) => {
        const dayStart = periodStart + idx * 24 * 60 * 60 * 1000;
        const dayEnd = dayStart + 24 * 60 * 60 * 1000 - 1;

        let income = 0;
        let expense = 0;

        rangeTransactions.forEach((t) => {
          if (t.date >= dayStart && t.date <= dayEnd) {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
          }
        });

        return {
          label: dayLabel,
          income,
          expense,
        };
      });

      return data;
    } else {
      // 4 Weeks in Month
      const weeks = ['W1', 'W2', 'W3', 'W4'];
      const totalDays = 28;
      const data = weeks.map((wLabel, idx) => {
        const wStart = periodStart + idx * 7 * 24 * 60 * 60 * 1000;
        const wEnd =
          idx === 3 ? periodEnd : periodStart + (idx + 1) * 7 * 24 * 60 * 60 * 1000 - 1;

        let income = 0;
        let expense = 0;

        rangeTransactions.forEach((t) => {
          if (t.date >= wStart && t.date <= wEnd) {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
          }
        });

        return {
          label: wLabel,
          income,
          expense,
        };
      });

      return data;
    }
  }, [timeFrame, periodStart, periodEnd, rangeTransactions]);

  // Max value calculation for chart scaling (default ceiling 500)
  const maxVal = useMemo(() => {
    let max = 500;
    chartBars.forEach((b) => {
      if (b.income > max) max = b.income;
      if (b.expense > max) max = b.expense;
    });
    return Math.ceil(max / 100) * 100;
  }, [chartBars]);

  // Format relative transaction date
  const formatTxDate = (timestamp: number) => {
    const today = new Date();
    const d = new Date(timestamp);
    if (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    ) {
      return 'Today';
    }
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Yesterday';
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render category icon based on icon name
  const renderCategoryIcon = (iconName: string, color: string) => {
    const size = moderateScale(20);
    switch (iconName) {
      case 'ShoppingCart':
      case 'Bag':
        return <ShoppingCart size={size} color={color} weight="fill" />;
      case 'Car':
        return <Car size={size} color={color} weight="fill" />;
      case 'ForkKnife':
        return <ForkKnife size={size} color={color} weight="fill" />;
      case 'House':
        return <House size={size} color={color} weight="fill" />;
      case 'Receipt':
        return <Receipt size={size} color={color} weight="fill" />;
      case 'GameController':
        return <GameController size={size} color={color} weight="fill" />;
      case 'FirstAid':
        return <FirstAid size={size} color={color} weight="fill" />;
      case 'GraduationCap':
        return <GraduationCap size={size} color={color} weight="fill" />;
      case 'Airplane':
        return <Airplane size={size} color={color} weight="fill" />;
      case 'Briefcase':
        return <Briefcase size={size} color={color} weight="fill" />;
      case 'CalendarBlank':
        return <CalendarBlank size={size} color={color} weight="fill" />;
      case 'Laptop':
        return <Laptop size={size} color={color} weight="fill" />;
      case 'TrendUp':
        return <TrendUp size={size} color={color} weight="fill" />;
      case 'Gift':
        return <Gift size={size} color={color} weight="fill" />;
      case 'Coins':
        return <Coins size={size} color={color} weight="fill" />;
      default:
        return <DotsThreeOutline size={size} color={color} weight="fill" />;
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00E5FF"
          />
        }>
        {/* 1. TOP HEADER (Dashboard title with Menu & Eye toggle) */}
        <View style={styles.headerRow}>
          <Pressable
            style={styles.headerIconButton}
            onPress={() =>
              Alert.alert('Expico', 'Modern financial tracker built with Expo & SQLite.')
            }>
            <List size={moderateScale(20)} color="#FFFFFF" weight="bold" />
          </Pressable>

          <Text style={styles.headerTitle}>Dashboard</Text>

          <Pressable
            style={styles.headerIconButton}
            onPress={() => setIsBalanceHidden(!isBalanceHidden)}>
            {isBalanceHidden ? (
              <EyeSlash size={moderateScale(20)} color="#00E5FF" weight="bold" />
            ) : (
              <Eye size={moderateScale(20)} color="#FFFFFF" weight="bold" />
            )}
          </Pressable>
        </View>

        {/* 2. TOTAL BALANCE SECTION */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(totalBalance)}</Text>

          {/* Account / Wallet Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.walletPillsRow}>
            {/* "All" Chip */}
            <Pressable
              style={[
                styles.walletPill,
                selectedWalletId === null && styles.walletPillActive,
              ]}
              onPress={() => setSelectedWalletId(null)}>
              <View
                style={[
                  styles.walletDot,
                  { backgroundColor: selectedWalletId === null ? '#00E5FF' : '#64748B' },
                ]}
              />
              <Text
                style={[
                  styles.walletPillText,
                  selectedWalletId === null && styles.walletPillTextActive,
                ]}>
                All Accounts
              </Text>
            </Pressable>

            {/* Individual Wallet Pills */}
            {wallets.map((w, idx) => {
              const isSelected = w.id === selectedWalletId;
              const dotColor = idx === 0 ? '#00E5FF' : idx === 1 ? '#10B981' : '#8B5CF6';
              return (
                <Pressable
                  key={w.id}
                  style={[styles.walletPill, isSelected && styles.walletPillActive]}
                  onPress={() => setSelectedWalletId(isSelected ? null : w.id)}>
                  <View style={[styles.walletDot, { backgroundColor: dotColor }]} />
                  <Text
                    style={[
                      styles.walletPillText,
                      isSelected && styles.walletPillTextActive,
                    ]}>
                    {w.name}
                  </Text>
                </Pressable>
              );
            })}

            {/* Add Wallet Shortcut */}
            <Pressable
              style={styles.walletAddPill}
              onPress={() => router.push('/add-wallet')}>
              <Plus size={moderateScale(12)} color="#00E5FF" weight="bold" />
              <Text style={styles.walletAddPillText}>Add</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* 3. INCOME & EXPENSES 2-COLUMN CARDS */}
        <View style={styles.statsCardsRow}>
          {/* Income Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={styles.incomeIconBadge}>
                <TrendUp size={moderateScale(16)} color="#00E5FF" weight="bold" />
              </View>
              <Text style={styles.statCardLabel}>Income</Text>
            </View>
            <Text style={styles.statCardValue}>{formatStatCurrency(periodInflow)}</Text>
          </View>

          {/* Expenses Card */}
          <View style={styles.statCard}>
            <View style={styles.statCardHeader}>
              <View style={styles.expenseIconBadge}>
                <TrendDown size={moderateScale(16)} color="#8B5CF6" weight="bold" />
              </View>
              <Text style={styles.statCardLabel}>Expenses</Text>
            </View>
            <Text style={styles.statCardValue}>{formatStatCurrency(periodOutflow)}</Text>
          </View>
        </View>

        {/* 4. PERIOD NAVIGATION & DUAL-BAR CHART */}
        <View style={styles.chartCard}>
          {/* Period Header (< This Week • Current Period >) */}
          <View style={styles.periodNavRow}>
            <Pressable
              style={styles.navArrowBtn}
              hitSlop={8}
              onPress={() => setPeriodOffset((prev) => prev - 1)}>
              <CaretLeft size={moderateScale(14)} color="#FFFFFF" weight="bold" />
            </Pressable>

            <View style={styles.periodCenterCol}>
              <Text style={styles.periodTitle}>{periodLabel}</Text>
              <View style={styles.periodStatusRow}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: isCurrentPeriod ? '#00E5FF' : '#8B5CF6' },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: isCurrentPeriod ? '#00E5FF' : '#8E9BAE' },
                  ]}>
                  {isCurrentPeriod ? 'Current Period' : 'Past Period'}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.navArrowBtn,
                isCurrentPeriod && styles.navArrowBtnDisabled,
              ]}
              hitSlop={8}
              disabled={isCurrentPeriod}
              onPress={() => setPeriodOffset((prev) => prev + 1)}>
              <CaretRight
                size={moderateScale(14)}
                color={isCurrentPeriod ? '#5A677B' : '#FFFFFF'}
                weight="bold"
              />
            </Pressable>
          </View>

          {/* Segmented Toggle (Week / Month) */}
          <View style={styles.segmentedToggle}>
            <Pressable
              style={[
                styles.toggleTab,
                timeFrame === 'week' && styles.toggleTabActive,
              ]}
              onPress={() => {
                setTimeFrame('week');
                setPeriodOffset(0);
                setSelectedBarIndex(null);
              }}>
              <Text
                style={[
                  styles.toggleTabText,
                  timeFrame === 'week' && styles.toggleTabTextActive,
                ]}>
                Week
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.toggleTab,
                timeFrame === 'month' && styles.toggleTabActive,
              ]}
              onPress={() => {
                setTimeFrame('month');
                setPeriodOffset(0);
                setSelectedBarIndex(null);
              }}>
              <Text
                style={[
                  styles.toggleTabText,
                  timeFrame === 'month' && styles.toggleTabTextActive,
                ]}>
                Month
              </Text>
            </Pressable>
          </View>

          {/* Custom Dual Bar Chart */}
          <View style={styles.chartContainer}>
            {/* Horizontal Grid lines with Y-Axis Values */}
            <View style={styles.chartGridOverlay}>
              {[maxVal, Math.round(maxVal * 0.8), Math.round(maxVal * 0.6), Math.round(maxVal * 0.4), Math.round(maxVal * 0.2), 0].map(
                (stepVal, idx) => (
                  <View key={idx} style={styles.gridLineRow}>
                    <Text style={styles.yAxisLabel}>{stepVal}</Text>
                    <View style={styles.gridLine} />
                  </View>
                )
              )}
            </View>

            {/* Bars Area */}
            <View style={styles.barsContainer}>
              {chartBars.map((item, idx) => {
                const chartHeight = moderateScale(140);
                const incomeHeight = Math.max(
                  item.income > 0 ? (item.income / maxVal) * chartHeight : 0,
                  item.income > 0 ? moderateScale(6) : 0
                );
                const expenseHeight = Math.max(
                  item.expense > 0 ? (item.expense / maxVal) * chartHeight : 0,
                  item.expense > 0 ? moderateScale(6) : 0
                );

                const isSelected = selectedBarIndex === idx;

                return (
                  <Pressable
                    key={idx}
                    style={styles.barGroup}
                    onPress={() =>
                      setSelectedBarIndex(isSelected ? null : idx)
                    }>
                    {/* Tooltip on select */}
                    {isSelected && (
                      <View style={styles.barTooltip}>
                        <Text style={styles.barTooltipText}>
                          +{formatStatCurrency(item.income)} / -{formatStatCurrency(item.expense)}
                        </Text>
                      </View>
                    )}

                    {/* The Bar Columns */}
                    <View style={styles.barColumnsRow}>
                      {/* Purple bar (Expense) */}
                      {expenseHeight > 0 && (
                        <View
                          style={[
                            styles.bar,
                            {
                              height: expenseHeight,
                              backgroundColor: '#8B5CF6',
                            },
                          ]}
                        />
                      )}

                      {/* Cyan bar (Income) */}
                      {incomeHeight > 0 && (
                        <View
                          style={[
                            styles.bar,
                            {
                              height: incomeHeight,
                              backgroundColor: '#00E5FF',
                            },
                          ]}
                        />
                      )}

                      {/* Fallback tiny dot if zero */}
                      {incomeHeight === 0 && expenseHeight === 0 && (
                        <View style={styles.barPlaceholderDot} />
                      )}
                    </View>

                    {/* Day / Week Label */}
                    <Text
                      style={[
                        styles.xAxisLabel,
                        isSelected && styles.xAxisLabelSelected,
                      ]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* 5. RECENT TRANSACTIONS FEED */}
        <View style={styles.recentSection}>
          <View style={styles.recentHeaderRow}>
            <Text style={styles.recentSectionTitle}>Recent Transactions</Text>
            <Pressable
              onPress={() => router.push('/analytics')}
              hitSlop={10}
              style={styles.viewAllRow}>
              <Text style={styles.viewAllText}>View All</Text>
              <ArrowUpRight size={moderateScale(14)} color="#00E5FF" weight="bold" />
            </Pressable>
          </View>

          {recentTransactions.length === 0 ? (
            <View style={styles.emptyFeedBox}>
              <Receipt size={moderateScale(36)} color="#5A677B" />
              <Text style={styles.emptyFeedText}>No transactions yet</Text>
              <Text style={styles.emptyFeedSub}>Tap the + button below to add your first expense</Text>
            </View>
          ) : (
            recentTransactions.map((tx) => {
              const cat = getCategoryById(tx.category);
              const isIncome = tx.type === 'income';
              const accentColor = cat.color;

              return (
                <Pressable
                  key={tx.id}
                  style={styles.transactionCard}
                  onPress={() => {
                    if (tx.receipt_path) {
                      setPreviewReceiptUri(tx.receipt_path);
                    }
                  }}>
                  {/* Left accent color stripe */}
                  <View style={[styles.txAccentStripe, { backgroundColor: accentColor }]} />

                  {/* Icon Box */}
                  <View
                    style={[
                      styles.txIconBox,
                      { backgroundColor: `${accentColor}20` },
                    ]}>
                    {renderCategoryIcon(cat.icon, accentColor)}
                  </View>

                  {/* Transaction Details */}
                  <View style={styles.txInfoCol}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.description || cat.name}
                    </Text>
                    <Text style={styles.txMeta} numberOfLines={1}>
                      {formatTxDate(tx.date)} • {cat.name}
                    </Text>
                  </View>

                  {/* Amount on Right */}
                  <View style={styles.txAmountCol}>
                    <Text
                      style={[
                        styles.txAmountText,
                        { color: isIncome ? '#00E5FF' : '#FFFFFF' },
                      ]}>
                      {isIncome ? '+' : '-'}{formatStatCurrency(tx.amount)}
                    </Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* 6. FLOATING ACTION BUTTON (Cyan Glow Circle +) */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/add-transaction')}>
        <Plus size={moderateScale(28)} color="#0B0E14" weight="bold" />
      </Pressable>

      {/* Receipt Image Preview Modal */}
      <Modal
        visible={Boolean(previewReceiptUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewReceiptUri(null)}>
        <View style={styles.previewOverlay}>
          <Pressable
            style={styles.closePreviewBtn}
            onPress={() => setPreviewReceiptUri(null)}>
            <X size={moderateScale(24)} color="#FFFFFF" weight="bold" />
          </Pressable>
          {previewReceiptUri ? (
            <Image
              source={{ uri: previewReceiptUri }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0E14',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: moderateScale(110),
  },

  // 1. Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  headerIconButton: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: Radius.full,
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222836',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontScale(20),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // 2. Total Balance Section
  balanceSection: {
    marginTop: Spacing.md,
  },
  balanceLabel: {
    fontSize: fontScale(13),
    color: '#8E9BAE',
    fontWeight: '500',
  },
  balanceAmount: {
    fontSize: fontScale(38),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
    marginTop: moderateScale(4),
    marginBottom: Spacing.md,
  },
  walletPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222836',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    gap: moderateScale(6),
  },
  walletPillActive: {
    borderColor: '#00E5FF',
    backgroundColor: '#00E5FF15',
  },
  walletDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: Radius.full,
  },
  walletPillText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#8E9BAE',
  },
  walletPillTextActive: {
    color: '#FFFFFF',
  },
  walletAddPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161B26',
    borderWidth: 1,
    borderColor: '#222836',
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(7),
    gap: moderateScale(4),
  },
  walletAddPillText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    color: '#00E5FF',
  },

  // 3. Stats Cards Row
  statsCardsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#202736',
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  statCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  incomeIconBadge: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseIconBadge: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statCardLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#8E9BAE',
  },
  statCardValue: {
    fontSize: fontScale(19),
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },

  // 4. Period & Chart Card
  chartCard: {
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#202736',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  periodNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  navArrowBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    backgroundColor: '#1E2533',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowBtnDisabled: {
    opacity: 0.4,
  },
  periodCenterCol: {
    alignItems: 'center',
  },
  periodTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
    color: '#FFFFFF',
  },
  periodStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(5),
    marginTop: moderateScale(2),
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: Radius.full,
  },
  statusText: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },

  // Segmented toggle
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: '#0F131C',
    borderRadius: Radius.full,
    padding: moderateScale(3),
    marginBottom: Spacing.lg,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  toggleTabActive: {
    backgroundColor: '#00E5FF',
  },
  toggleTabText: {
    fontSize: fontScale(13),
    fontWeight: '600',
    color: '#8E9BAE',
  },
  toggleTabTextActive: {
    color: '#0B0E14',
    fontWeight: '800',
  },

  // Chart
  chartContainer: {
    height: moderateScale(180),
    position: 'relative',
    marginTop: Spacing.xs,
  },
  chartGridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: moderateScale(25),
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  yAxisLabel: {
    fontSize: fontScale(9),
    color: '#5A677B',
    width: moderateScale(26),
    textAlign: 'right',
  },
  gridLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#1C2331',
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: moderateScale(34),
    paddingBottom: moderateScale(25),
  },
  barGroup: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  barTooltip: {
    position: 'absolute',
    top: -moderateScale(28),
    backgroundColor: '#1E2533',
    paddingHorizontal: Spacing.xs,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: '#00E5FF',
    zIndex: 10,
  },
  barTooltipText: {
    fontSize: fontScale(10),
    color: '#FFFFFF',
    fontWeight: '700',
  },
  barColumnsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: moderateScale(3),
  },
  bar: {
    width: moderateScale(7),
    borderTopLeftRadius: moderateScale(3),
    borderTopRightRadius: moderateScale(3),
  },
  barPlaceholderDot: {
    width: moderateScale(4),
    height: moderateScale(4),
    borderRadius: Radius.full,
    backgroundColor: '#232A38',
    marginBottom: moderateScale(4),
  },
  xAxisLabel: {
    position: 'absolute',
    bottom: -moderateScale(20),
    fontSize: fontScale(11),
    fontWeight: '600',
    color: '#64748B',
  },
  xAxisLabelSelected: {
    color: '#00E5FF',
    fontWeight: '700',
  },

  // 5. Recent Transactions Feed
  recentSection: {
    marginTop: Spacing.xl,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  recentSectionTitle: {
    fontSize: fontScale(18),
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  viewAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  viewAllText: {
    fontSize: fontScale(13),
    fontWeight: '700',
    color: '#00E5FF',
  },
  emptyFeedBox: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#151922',
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: '#202736',
    gap: Spacing.xs,
  },
  emptyFeedText: {
    fontSize: fontScale(14),
    fontWeight: '600',
    color: '#8E9BAE',
    marginTop: Spacing.xs,
  },
  emptyFeedSub: {
    fontSize: fontScale(12),
    color: '#5A677B',
    textAlign: 'center',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151922',
    borderWidth: 1,
    borderColor: '#202736',
    borderRadius: Radius.lg,
    marginBottom: Spacing.sm,
    paddingVertical: moderateScale(12),
    paddingRight: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  txAccentStripe: {
    width: moderateScale(4),
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  txIconBox: {
    width: moderateScale(42),
    height: moderateScale(42),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
  },
  txInfoCol: {
    flex: 1,
  },
  txTitle: {
    fontSize: fontScale(15),
    fontWeight: '600',
    color: '#FFFFFF',
  },
  txMeta: {
    fontSize: fontScale(12),
    color: '#8E9BAE',
    marginTop: moderateScale(2),
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontSize: fontScale(15),
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // 6. FAB
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? moderateScale(22) : moderateScale(14),
    alignSelf: 'center',
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    zIndex: 99,
  },

  // Modal
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  closePreviewBtn: {
    position: 'absolute',
    top: moderateScale(48),
    right: moderateScale(24),
    zIndex: 10,
    padding: Spacing.xs,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
});
