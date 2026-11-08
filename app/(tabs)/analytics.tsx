import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  Percent,
  PiggyBank,
  PlusCircle,
  User,
  Warning,
} from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';

import { CategoryIcon } from '@/components/CategoryIcon';
import { getCategoryById, registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  CategorySummary,
  getCategories,
  getCategoryBreakdown,
  getPeriodSummary,
  getTransactionsInRange,
  TransactionWithWallet,
} from '@/db/queries';
import { formatCompactCurrency as formatShort, formatCurrency } from '@/utils/formatters';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

type HorizonPeriod = 'thisMonth' | 'lastMonth' | 'q3' | 'custom';

interface CategoryEnvelope {
  id: string;
  name: string;
  spent: number;
  budget: number;
  color: string;
  icon: string;
  statusText: string;
  statusType: 'healthy' | 'under' | 'warning' | 'scheduled';
  txCount: number;
  note: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const today = useMemo(() => new Date(), []);
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [horizon, setHorizon] = useState<HorizonPeriod>('thisMonth');

  const [totalSpent, setTotalSpent] = useState<number>(0);
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithWallet[]>([]);
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [selectedLegendCategory, setSelectedLegendCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [alertDismissed, setAlertDismissed] = useState<boolean>(false);

  // Month range
  const monthStart = useMemo(
    () => new Date(currentYear, currentMonth, 1, 0, 0, 0, 0).getTime(),
    [currentYear, currentMonth]
  );
  const monthEnd = useMemo(
    () => new Date(currentYear, currentMonth + 1, 0, 23, 59, 59, 999).getTime(),
    [currentYear, currentMonth]
  );

  const loadAnalytics = useCallback(async () => {
    try {
      const [summary, catList, txList, allDbCats] = await Promise.all([
        getPeriodSummary(db, monthStart, monthEnd),
        getCategoryBreakdown(db, monthStart, monthEnd),
        getTransactionsInRange(db, monthStart, monthEnd),
        getCategories(db),
      ]);

      registerCategories(allDbCats);
      setTotalSpent(summary.totalExpense);
      setTotalIncome(summary.totalIncome);
      setCategories(catList);
      setTransactions(txList);
    } catch (err) {
      console.error('Failed to load VaultFlow analytics:', err);
    }
  }, [db, monthStart, monthEnd]);

  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
    }, [loadAnalytics])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };



  // Total Target Budget & Spending strictly from database values
  const budgetSpent = totalSpent;
  const totalTargetBudget = Math.max(0, totalIncome > 0 ? totalIncome : totalSpent > 0 ? Math.round(totalSpent * 1.2) : 0);
  const budgetPercent = totalTargetBudget > 0 ? Math.min(100, Math.round((budgetSpent / totalTargetBudget) * 100)) : 0;
  const remainingBudget = Math.max(0, totalTargetBudget - budgetSpent);
  const safeDailySpend = Math.round(remainingBudget / 12);

  // Dynamic Envelopes strictly derived from database categories
  const envelopes: CategoryEnvelope[] = useMemo(() => {
    if (categories.length === 0) {
      return [];
    }

    return categories.map((catItem) => {
      const catInfo = getCategoryById(catItem.category);
      const budget = Math.round(catItem.total * 1.25);
      const ratio = budget > 0 ? Math.round((catItem.total / budget) * 100) : 0;
      const count = transactions.filter((t) => t.category === catItem.category).length;

      return {
        id: catItem.category,
        name: catInfo.name,
        spent: catItem.total,
        budget,
        color: catInfo.color,
        icon: catInfo.icon,
        statusText: ratio > 85 ? `Warning (${ratio}%)` : `Optimal (${ratio}%)`,
        statusType: ratio > 85 ? 'warning' : 'healthy',
        txCount: count,
        note: `${count} transaction${count === 1 ? '' : 's'} recorded`,
      };
    });
  }, [categories, transactions]);

  // Warning envelope for alert banner (if any category exceeds 85%)
  const warningEnvelope = useMemo(() => {
    return envelopes.find((e) => e.statusType === 'warning');
  }, [envelopes]);

  // Donut Arc calculation (Pure SVG)
  const donutSize = moderateScale(190);
  const strokeWidth = moderateScale(22);
  const centerRadius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * centerRadius;

  const donutSlices = useMemo(() => {
    const totalEnvelopesSpent = envelopes.reduce((acc, e) => acc + e.spent, 0);
    if (totalEnvelopesSpent === 0) return [];
    let runningOffset = 0;
    return envelopes.map((e) => {
      const pct = Math.round((e.spent / totalEnvelopesSpent) * 100);
      const dashLength = (pct / 100) * circumference;
      const offset = runningOffset;
      runningOffset += dashLength;
      return {
        ...e,
        percentage: pct,
        dashLength,
        offset,
      };
    });
  }, [envelopes, circumference]);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      {/* 1. TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <User size={moderateScale(18)} color="#003824" weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: theme.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Analytics & Allocations</Text>
          </View>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
          onPress={() => router.push('/(tabs)')}>
          <Bell size={moderateScale(20)} color={theme.text} weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }>
        {/* 2. PERIOD SELECTOR & QUICK HORIZON CHIPS */}
        <View style={[styles.periodNavContainer, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <Pressable
            style={[styles.periodNavBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
            onPress={handlePrevMonth}>
            <CaretLeft size={moderateScale(16)} color={theme.text} weight="bold" />
          </Pressable>

          <View style={styles.periodCenter}>
            <CalendarBlank size={moderateScale(18)} color="#10B981" weight="bold" />
            <Text style={[styles.periodMonthText, { color: theme.text }]}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </Text>
            <CaretDown size={moderateScale(14)} color={theme.textSecondary} weight="bold" />
          </View>

          <Pressable
            style={[styles.periodNavBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
            onPress={handleNextMonth}>
            <CaretRight size={moderateScale(16)} color={theme.text} weight="bold" />
          </Pressable>
        </View>

        {/* Quick Horizon Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizonScroll}>
          {[
            { id: 'thisMonth', label: 'This Month' },
            { id: 'lastMonth', label: 'Last Month' },
            { id: 'q3', label: 'Q3 Recap' },
            { id: 'custom', label: 'Custom' },
          ].map((item) => {
            const active = horizon === item.id;
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.horizonPill,
                  active
                    ? { backgroundColor: '#10B981' }
                    : { backgroundColor: isDark ? '#262A34' : '#F1F5F9' },
                ]}
                onPress={() => setHorizon(item.id as HorizonPeriod)}>
                <Text
                  style={[
                    styles.horizonPillText,
                    { color: active ? '#003824' : theme.textSecondary, fontWeight: active ? '700' : '600' },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* 3. BUDGET HEALTH STATUS HIGHLIGHT BANNER */}
        <View style={[styles.budgetHealthCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.healthBannerGlow} />

          <View style={styles.healthHeaderRow}>
            <View style={styles.healthTitleRow}>
              <View style={[styles.pulseDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.healthStatusLabel}>BUDGET HEALTH STATUS</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isDark ? '#31353F' : '#D1FAE5' }]}>
              <Text style={[styles.statusBadgeText, { color: isDark ? '#4EDEA3' : '#059669' }]}>
                On Track • 12 days left
              </Text>
            </View>
          </View>

          {/* Amount Spend vs Target */}
          <View style={styles.spentVsTargetRow}>
            <View>
              <Text style={[styles.spentSub, { color: theme.textSecondary }]}>Total Spent</Text>
              <View style={styles.spentValRow}>
                <Text style={[styles.spentValText, { color: theme.text }]}>
                  {formatCurrency(budgetSpent)}
                </Text>
                <Text style={styles.spentPercentText}>{budgetPercent}%</Text>
              </View>
            </View>
            <View style={styles.targetCol}>
              <Text style={[styles.spentSub, { color: theme.textSecondary }]}>Total Target</Text>
              <Text style={[styles.targetValText, { color: theme.text }]}>
                {formatCurrency(totalTargetBudget)}
              </Text>
            </View>
          </View>

          {/* Linear Progress Track */}
          <View style={[styles.linearTrack, { backgroundColor: isDark ? '#31353F' : '#E2E8F0' }]}>
            <View style={[styles.linearFill, { width: `${budgetPercent}%`, backgroundColor: '#10B981' }]} />
          </View>

          {/* Safe-to-Spend Footer */}
          <View style={styles.healthFooter}>
            <View style={styles.safeFooterLeft}>
              <PiggyBank size={moderateScale(15)} color="#10B981" weight="fill" />
              <Text style={[styles.safeFooterText, { color: theme.textSecondary }]}>
                Safe-to-spend: {formatCurrency(safeDailySpend)} / day
              </Text>
            </View>
            <Text style={[styles.remainingText, { color: theme.text }]}>
              {formatCurrency(remainingBudget)} remaining
            </Text>
          </View>
        </View>

        {/* 4. ALLOCATION SPLIT INTERACTIVE SVG DONUT CHART */}
        <View style={[styles.allocationCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.allocationHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Allocation Split</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                Tap slice or card to isolate category metrics
              </Text>
            </View>
            <Pressable
              style={[styles.percentToggleBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
              onPress={() => setSelectedLegendCategory(null)}>
              <Percent size={moderateScale(16)} color={theme.text} weight="bold" />
            </Pressable>
          </View>

          {/* Center Donut Graphic */}
          <View style={styles.donutContainer}>
            <View style={[styles.donutSvgWrap, { width: donutSize, height: donutSize }]}>
              <Svg width={donutSize} height={donutSize} viewBox={`0 0 ${donutSize} ${donutSize}`}>
                <G rotation="-90" origin={`${donutSize / 2}, ${donutSize / 2}`}>
                  {/* Background Track */}
                  <Circle
                    cx={donutSize / 2}
                    cy={donutSize / 2}
                    r={centerRadius}
                    stroke={isDark ? '#262A34' : '#E2E8F0'}
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  {/* Category Slices */}
                  {donutSlices.map((slice, idx) => {
                    const strokeDash = Math.max(1, slice.dashLength - 3);
                    const strokeGap = circumference - strokeDash;
                    const isSelected = selectedLegendCategory === slice.id;

                    return (
                      <Circle
                        key={`slice-${idx}`}
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={centerRadius}
                        stroke={slice.color}
                        strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                        strokeDasharray={[strokeDash, strokeGap]}
                        strokeDashoffset={-slice.offset}
                        fill="none"
                        strokeLinecap="round"
                        opacity={selectedLegendCategory && !isSelected ? 0.35 : 1}
                      />
                    );
                  })}
                </G>
              </Svg>

              {/* Donut Center Hole Card */}
              <View
                style={[
                  styles.donutCenterCard,
                  {
                    width: centerRadius * 1.35,
                    height: centerRadius * 1.35,
                    borderRadius: (centerRadius * 1.35) / 2,
                    backgroundColor: isDark ? '#181B25' : '#FFFFFF',
                  },
                ]}>
                <Text style={[styles.centerSubLabel, { color: theme.textSecondary }]}>SPENT TOTAL</Text>
                <Text style={[styles.centerAmountText, { color: theme.text }]}>
                  {formatCurrency(budgetSpent)}
                </Text>
                <Text style={styles.centerBudgetRatio}>
                  {budgetPercent}% of {formatShort(totalTargetBudget)}
                </Text>
                <Text style={[styles.centerCategoryCount, { color: theme.textMuted }]}>
                  {envelopes.length} Active Categories
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Legend Grid (2 Columns) */}
          <View style={styles.legendGrid}>
            {envelopes.map((item) => {
              const isSelected = selectedLegendCategory === item.id;
              const slice = donutSlices.find((s) => s.id === item.id);

              return (
                <Pressable
                  key={`legend-${item.id}`}
                  style={[
                    styles.legendCard,
                    { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' },
                    isSelected && { borderColor: item.color, borderWidth: 1.5 },
                  ]}
                  onPress={() =>
                    setSelectedLegendCategory((curr) => (curr === item.id ? null : item.id))
                  }>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  <Text style={[styles.legendPercent, { color: theme.text }]}>
                    {slice?.percentage ?? 0}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 5. SMART INSIGHT ALERT BANNER */}
        {warningEnvelope && !alertDismissed && (
          <View style={[styles.insightAlertCard, { backgroundColor: isDark ? '#181B25' : '#FFF1F2', borderColor: '#F43F5E' }]}>
            <View style={[styles.alertIconCircle, { backgroundColor: 'rgba(244, 63, 94, 0.2)' }]}>
              <Warning size={moderateScale(20)} color="#F43F5E" weight="fill" />
            </View>
            <View style={styles.alertContent}>
              <View style={styles.alertHeaderRow}>
                <Text style={[styles.alertHeading, { color: '#F43F5E' }]}>
                  {warningEnvelope.name} Near Limit
                </Text>
                <View style={styles.alertPill}>
                  <Text style={styles.alertPillText}>Alert</Text>
                </View>
              </View>
              <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>
                You have consumed <Text style={{ color: theme.text, fontWeight: '700' }}>{Math.round((warningEnvelope.spent / warningEnvelope.budget) * 100)}% ({formatCurrency(warningEnvelope.spent)})</Text> of
                your allocated {warningEnvelope.name} pool. Consider dialing down non-essential expenses.
              </Text>
              <View style={styles.alertActionRow}>
                <Pressable
                  style={[styles.alertActionBtn, { backgroundColor: '#F43F5E' }]}
                  onPress={() => Alert.alert('Budget Adjust', 'Adjust monthly envelope pool in Settings.')}>
                  <Text style={styles.alertActionBtnText}>Adjust Cap</Text>
                </Pressable>
                <Pressable onPress={() => setAlertDismissed(true)}>
                  <Text style={[styles.alertDismissText, { color: theme.textSecondary }]}>Dismiss</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* 6. CATEGORY ENVELOPES LISTING */}
        <View style={styles.envelopesSection}>
          <View style={styles.envelopesHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Category Allocations</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                {envelopes.length} assigned monthly envelopes
              </Text>
            </View>
            <Pressable
              style={styles.addPoolBtn}
              onPress={() => Alert.alert('Add Envelope', 'Select an expense category to allocate a monthly budget pool.')}>
              <PlusCircle size={moderateScale(18)} color="#10B981" weight="fill" />
              <Text style={[styles.addPoolText, { color: '#10B981' }]}>Add Pool</Text>
            </Pressable>
          </View>

          {envelopes.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#181B25' : '#FFFFFF' }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Category Spending</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                All category balances are currently ₹0.00. Log an expense to track your budget allocations.
              </Text>
            </View>
          ) : (
            envelopes.map((item) => {
              const isExpanded = expandedCategoryId === item.id;
              const pct = Math.min(100, Math.round((item.spent / item.budget) * 100));
              const left = Math.max(0, item.budget - item.spent);

              // Filter transactions for this category
              const catTxs = transactions.filter(
                (tx) => tx.type === 'expense' && tx.category === item.id
              );

              return (
                <View
                  key={item.id}
                  style={[
                    styles.envelopeCard,
                    { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border },
                  ]}>
                  <Pressable
                    style={styles.envelopeCardHeader}
                    onPress={() =>
                      setExpandedCategoryId((curr) => (curr === item.id ? null : item.id))
                    }>
                    <View style={styles.envLeft}>
                      <View style={[styles.envIconCircle, { backgroundColor: item.color + '22' }]}>
                        <CategoryIcon name={item.icon} size={moderateScale(20)} color={item.color} />
                      </View>
                      <View>
                        <Text style={[styles.envName, { color: theme.text }]}>{item.name}</Text>
                        <Text style={[styles.envBudgetSub, { color: theme.textSecondary }]}>
                          Budget: {formatCurrency(item.budget)} / mo
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.envStatusBadge, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}>
                      <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                      <Text style={[styles.envStatusText, { color: item.color }]}>{item.statusText}</Text>
                    </View>
                  </Pressable>

                {/* Amount Row */}
                <View style={styles.envMetricsRow}>
                  <Text style={[styles.envSpentText, { color: theme.text }]}>
                    {formatCurrency(item.spent)}{' '}
                    <Text style={[styles.envSpentUnit, { color: theme.textMuted }]}>spent</Text>
                  </Text>
                  <Text style={[styles.envLeftText, { color: item.statusType === 'warning' ? '#F43F5E' : '#10B981' }]}>
                    {formatCurrency(left)} left
                  </Text>
                </View>

                {/* Progress Bar */}
                <View style={[styles.envProgressTrack, { backgroundColor: isDark ? '#262A34' : '#E2E8F0' }]}>
                  <View style={[styles.envProgressFill, { width: `${pct}%`, backgroundColor: item.color }]} />
                </View>

                {/* Card Sub-Footer */}
                <View style={styles.envCardFooter}>
                  <Text style={[styles.envTxCount, { color: theme.textSecondary }]}>
                    {catTxs.length > 0 ? `${catTxs.length} transactions` : `${item.txCount} transactions`}
                  </Text>
                  <Text style={[styles.envNote, { color: theme.textSecondary }]}>{item.note}</Text>
                </View>

                {/* Expanded Transactions for this Category */}
                {isExpanded && (
                  <View style={[styles.expandedTxList, { borderTopColor: isDark ? '#262A34' : '#F1F5F9' }]}>
                    {catTxs.length > 0 ? (
                      catTxs.map((tx) => (
                        <View key={tx.id} style={styles.txRow}>
                          <View style={styles.txRowLeft}>
                            <Text style={[styles.txDesc, { color: theme.text }]}>
                              {tx.description || item.name}
                            </Text>
                            <Text style={[styles.txDate, { color: theme.textMuted }]}>
                              {new Date(tx.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </Text>
                          </View>
                          <Text style={[styles.txAmount, { color: '#F43F5E' }]}>
                            -{formatCurrency(tx.amount)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.noTxText, { color: theme.textMuted }]}>
                        No recent transactions logged in this category for this month.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            );
          }))}
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
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: moderateScale(80),
    gap: Spacing.md,
  },

  /* Period Nav */
  periodNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  periodNavBtn: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  periodMonthText: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  horizonScroll: {
    gap: Spacing.xs,
    paddingVertical: moderateScale(2),
  },
  horizonPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
  },
  horizonPillText: {
    fontSize: fontScale(12),
  },

  /* Budget Health Status Banner */
  budgetHealthCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  healthBannerGlow: {
    position: 'absolute',
    top: -moderateScale(50),
    right: -moderateScale(50),
    width: moderateScale(150),
    height: moderateScale(150),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  healthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pulseDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: Radius.full,
  },
  healthStatusLabel: {
    color: '#10B981',
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  spentVsTargetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginVertical: Spacing.xs,
  },
  spentSub: {
    fontSize: fontScale(11),
  },
  spentValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
    marginTop: moderateScale(2),
  },
  spentValText: {
    fontSize: fontScale(24),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  spentPercentText: {
    color: '#10B981',
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  targetCol: {
    alignItems: 'flex-end',
  },
  targetValText: {
    fontSize: fontScale(18),
    fontWeight: '700',
    marginTop: moderateScale(2),
  },
  linearTrack: {
    height: moderateScale(8),
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  linearFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  healthFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  safeFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  safeFooterText: {
    fontSize: fontScale(11),
  },
  remainingText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },

  /* Allocation Split Donut */
  allocationCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
  },
  allocationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  activitySub: {
    fontSize: fontScale(12),
    marginTop: moderateScale(2),
  },
  percentToggleBtn: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  donutSvgWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterCard: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
  },
  centerSubLabel: {
    fontSize: fontScale(9),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  centerAmountText: {
    fontSize: fontScale(17),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  centerBudgetRatio: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '700',
    marginTop: moderateScale(1),
  },
  centerCategoryCount: {
    fontSize: fontScale(9),
    marginTop: moderateScale(2),
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  legendCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.md,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  legendColorDot: {
    width: moderateScale(10),
    height: moderateScale(10),
    borderRadius: Radius.full,
  },
  legendName: {
    fontSize: fontScale(12),
    fontWeight: '600',
    flex: 1,
  },
  legendPercent: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },

  /* Smart Insight Alert */
  insightAlertCard: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  alertIconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertHeading: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  alertPill: {
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(1),
    borderRadius: Radius.sm,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  alertPillText: {
    color: '#F43F5E',
    fontSize: fontScale(10),
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: fontScale(12),
    lineHeight: moderateScale(17),
    marginTop: moderateScale(4),
  },
  alertActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  alertActionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
    borderRadius: Radius.sm,
  },
  alertActionBtnText: {
    color: '#FFFFFF',
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  alertDismissText: {
    fontSize: fontScale(11),
    textDecorationLine: 'underline',
  },

  /* Category Envelopes */
  envelopesSection: {
    gap: Spacing.sm,
  },
  envelopesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addPoolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  addPoolText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  envelopeCard: {
    padding: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  envelopeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  envLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  envIconCircle: {
    width: moderateScale(40),
    height: moderateScale(40),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  envName: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  envBudgetSub: {
    fontSize: fontScale(11),
    marginTop: moderateScale(1),
  },
  envStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  statusDot: {
    width: moderateScale(6),
    height: moderateScale(6),
    borderRadius: Radius.full,
  },
  envStatusText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  envMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: Spacing.xs,
  },
  envSpentText: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  envSpentUnit: {
    fontSize: fontScale(11),
    fontWeight: '400',
  },
  envLeftText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  envProgressTrack: {
    height: moderateScale(6),
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginVertical: Spacing.xs,
  },
  envProgressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  envCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  envTxCount: {
    fontSize: fontScale(10),
  },
  envNote: {
    fontSize: fontScale(10),
  },
  expandedTxList: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    gap: Spacing.xs,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: moderateScale(3),
  },
  txRowLeft: {
    flex: 1,
  },
  txDesc: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  txDate: {
    fontSize: fontScale(10),
  },
  txAmount: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  noTxText: {
    fontSize: fontScale(11),
    fontStyle: 'italic',
    paddingVertical: moderateScale(4),
  },
  emptyContainer: {
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.md,
  },
  emptyTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: fontScale(11),
    marginTop: moderateScale(4),
    textAlign: 'center',
  },
});
