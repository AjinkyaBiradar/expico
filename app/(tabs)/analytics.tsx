import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  ChartDonut,
  Percent,
  PlusCircle,
  Trash,
  User,
  Wallet as WalletIcon,
  Warning,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G } from 'react-native-svg';

import { CategoryIcon } from '@/components/CategoryIcon';
import { WalletsView } from '@/components/WalletsView';
import { getCategoryById, registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  CategorySummary,
  deleteTransaction,
  getCategories,
  getCategoryBreakdown,
  getPeriodSummary,
  getTransactionsInRange,
  TransactionWithWallet,
} from '@/db/queries';
import { formatCurrency } from '@/utils/formatters';
import { InsightsSegment, useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

type HorizonPeriod = 'thisMonth' | 'lastMonth' | 'q3' | 'custom';

interface CategoryEnvelope {
  id: string;
  name: string;
  spent: number;
  percentage: number;
  color: string;
  icon: string;
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

  const { width: screenWidth } = useWindowDimensions();
  const { lastInsightsSegment, setLastInsightsSegment } = useSettings();
  const [activeSegment, setActiveSegment] = useState<InsightsSegment>(lastInsightsSegment || 'analysis');
  const horizontalScrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  // Synchronize on initial mount if remembered segment is wallets
  useEffect(() => {
    if (lastInsightsSegment === 'wallets') {
      const timer = setTimeout(() => {
        horizontalScrollRef.current?.scrollTo({ x: screenWidth, animated: false });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [lastInsightsSegment, screenWidth]);

  const handleSelectSegment = (segment: InsightsSegment) => {
    setActiveSegment(segment);
    setLastInsightsSegment(segment);
    horizontalScrollRef.current?.scrollTo({
      x: segment === 'analysis' ? 0 : screenWidth,
      animated: true,
    });
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / (screenWidth || 1));
    const targetSegment: InsightsSegment = pageIndex === 0 ? 'analysis' : 'wallets';
    if (targetSegment !== activeSegment) {
      setActiveSegment(targetSegment);
      setLastInsightsSegment(targetSegment);
    }
  };

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
  const [isOtherExpanded, setIsOtherExpanded] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

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

  const handleDeleteTransaction = (tx: TransactionWithWallet) => {
    Alert.alert(
      'Delete Transaction',
      `Are you sure you want to delete this transaction of ${formatCurrency(tx.amount)}? Your account balance will be updated automatically.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTransaction(db, tx.id);
              await loadAnalytics();
            } catch (err) {
              console.error('Failed to delete transaction:', err);
              Alert.alert('Error', 'Failed to delete transaction. Please try again.');
            }
          },
        },
      ]
    );
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

  const handleSelectHorizon = (selected: HorizonPeriod) => {
    setHorizon(selected);
    const now = new Date();
    if (selected === 'thisMonth') {
      setCurrentYear(now.getFullYear());
      setCurrentMonth(now.getMonth());
    } else if (selected === 'lastMonth') {
      if (now.getMonth() === 0) {
        setCurrentYear(now.getFullYear() - 1);
        setCurrentMonth(11);
      } else {
        setCurrentYear(now.getFullYear());
        setCurrentMonth(now.getMonth() - 1);
      }
    } else if (selected === 'q3') {
      setCurrentYear(now.getFullYear());
      setCurrentMonth(8); // September (Q3 end)
    } else if (selected === 'custom') {
      Alert.alert('Custom Period', 'Use the month navigation controls above to select any custom period.');
    }
  };

  // Budget calculations: Target budget from income or standard period baseline of 600
  const targetBudget = totalIncome > 0 ? totalIncome : 600;
  const isOverBudget = targetBudget > 0 && totalSpent > targetBudget;
  const overageAmount = Math.max(0, totalSpent - targetBudget);
  const budgetRatio = targetBudget > 0 ? (totalSpent / targetBudget) * 100 : 0;
  const displayBudgetPercentage = Math.round(budgetRatio);
  const remainingBudget = Math.max(0, targetBudget - totalSpent);

  // Dynamic Envelopes strictly derived from database categories, sorted by spent descending
  const envelopes: CategoryEnvelope[] = useMemo(() => {
    if (categories.length === 0) {
      return [];
    }

    const totalExpense = categories.reduce((sum, c) => sum + c.total, 0);

    const list = categories.map((catItem) => {
      const catInfo = getCategoryById(catItem.category);
      const percentage = totalExpense > 0 ? Math.round((catItem.total / totalExpense) * 100) : 0;
      const count = transactions.filter((t) => t.category === catItem.category).length;

      return {
        id: catItem.category,
        name: catInfo.name,
        spent: catItem.total,
        percentage,
        color: catInfo.color,
        icon: catInfo.icon,
        txCount: count,
        note: `${count} transaction${count === 1 ? '' : 's'} recorded`,
      };
    });

    return list.sort((a, b) => b.spent - a.spent);
  }, [categories, transactions]);

  // Donut Arc calculation (Pure SVG)
  // Reduced to Top 5 categories plus "Other" (tap to expand)
  const donutSize = moderateScale(190);
  const strokeWidth = moderateScale(22);
  const centerRadius = (donutSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * centerRadius;

  const { donutCategories, otherCategories } = useMemo(() => {
    if (envelopes.length <= 5) {
      return { donutCategories: envelopes, otherCategories: [] };
    }

    const top5 = envelopes.slice(0, 5);
    const others = envelopes.slice(5);
    const totalExpense = envelopes.reduce((sum, e) => sum + e.spent, 0);
    const otherSpent = others.reduce((sum, e) => sum + e.spent, 0);
    const otherPct = totalExpense > 0 ? Math.round((otherSpent / totalExpense) * 100) : 0;
    const otherTxCount = others.reduce((sum, e) => sum + e.txCount, 0);

    const otherEnvelope: CategoryEnvelope = {
      id: 'other_grouped',
      name: 'Other',
      spent: otherSpent,
      percentage: otherPct,
      color: '#86948A',
      icon: 'DotsThreeOutline',
      txCount: otherTxCount,
      note: `${others.length} smaller categories`,
    };

    return {
      donutCategories: [...top5, otherEnvelope],
      otherCategories: others,
    };
  }, [envelopes]);

  const donutSlices = useMemo(() => {
    const totalDonutSpent = donutCategories.reduce((acc, e) => acc + e.spent, 0);
    if (totalDonutSpent === 0) return [];
    let runningOffset = 0;
    return donutCategories.map((e) => {
      const pct = Math.round((e.spent / totalDonutSpent) * 100);
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
  }, [donutCategories, circumference]);

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
            <Text style={[styles.screenTitle, { color: theme.text }]}>Insights & Wallets</Text>
          </View>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
          onPress={() => router.push('/(tabs)/reminders' as any)}>
          <Bell size={moderateScale(20)} color={theme.text} weight="bold" />
        </Pressable>
      </View>

      {/* 2. STICKY TOP SEGMENTED CONTROL: Analysis | Wallets */}
      <View
        style={[
          styles.stickySegmentContainer,
          { backgroundColor: theme.surface, borderBottomColor: theme.border },
        ]}>
        <View
          style={[
            styles.mainSegmentWrap,
            { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' },
          ]}>
          <Pressable
            style={[
              styles.mainSegmentBtn,
              activeSegment === 'analysis' && [
                styles.mainSegmentBtnActive,
                { backgroundColor: isDark ? '#262A34' : '#FFFFFF' },
              ],
            ]}
            onPress={() => handleSelectSegment('analysis')}>
            <ChartDonut
              size={moderateScale(16)}
              color={activeSegment === 'analysis' ? '#10B981' : theme.textSecondary}
              weight={activeSegment === 'analysis' ? 'bold' : 'regular'}
            />
            <Text
              style={[
                styles.mainSegmentBtnText,
                {
                  color: activeSegment === 'analysis' ? (isDark ? '#FFFFFF' : '#0F172A') : theme.textSecondary,
                  fontWeight: activeSegment === 'analysis' ? '800' : '600',
                },
              ]}>
              Analysis
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.mainSegmentBtn,
              activeSegment === 'wallets' && [
                styles.mainSegmentBtnActive,
                { backgroundColor: isDark ? '#262A34' : '#FFFFFF' },
              ],
            ]}
            onPress={() => handleSelectSegment('wallets')}>
            <WalletIcon
              size={moderateScale(16)}
              color={activeSegment === 'wallets' ? '#10B981' : theme.textSecondary}
              weight={activeSegment === 'wallets' ? 'bold' : 'regular'}
            />
            <Text
              style={[
                styles.mainSegmentBtnText,
                {
                  color: activeSegment === 'wallets' ? (isDark ? '#FFFFFF' : '#0F172A') : theme.textSecondary,
                  fontWeight: activeSegment === 'wallets' ? '800' : '600',
                },
              ]}>
              Wallets
            </Text>
          </Pressable>
        </View>
      </View>

      {/* SWIPEABLE HORIZONTAL PAGER */}
      <ScrollView
        ref={horizontalScrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        style={styles.horizontalPager}>
        {/* PAGE 1: ANALYSIS */}
        <View style={{ width: screenWidth, flex: 1 }}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
            }>
            {/* 3. PERIOD SELECTOR & CLEAN SEGMENTED CONTROL */}
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

        {/* Clean Segmented Control replacing loose horizontal pills */}
        <View
          style={[
            styles.segmentedControlWrap,
            { backgroundColor: isDark ? '#181B25' : '#F1F5F9', borderColor: theme.border },
          ]}>
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
                  styles.segmentBtn,
                  active && [
                    styles.segmentBtnActive,
                    { backgroundColor: isDark ? '#262A34' : '#FFFFFF' },
                  ],
                ]}
                onPress={() => handleSelectHorizon(item.id as HorizonPeriod)}>
                <Text
                  style={[
                    styles.segmentBtnText,
                    {
                      color: active ? (isDark ? '#FFFFFF' : '#0F172A') : theme.textSecondary,
                      fontWeight: active ? '800' : '600',
                    },
                  ]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 3. BUDGET HEALTH CARD WITH ACCURATE OVER-BUDGET WARNING STATE */}
        <View
          style={[
            styles.budgetHealthCard,
            {
              backgroundColor: isDark ? '#181B25' : '#FFFFFF',
              borderColor: isOverBudget ? 'rgba(244, 63, 94, 0.45)' : theme.border,
            },
          ]}>
          <View
            style={[
              styles.healthBannerGlow,
              { backgroundColor: isOverBudget ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.1)' },
            ]}
          />

          <View style={styles.healthHeaderRow}>
            <View style={styles.healthTitleRow}>
              <View
                style={[
                  styles.pulseDot,
                  { backgroundColor: isOverBudget ? '#F43F5E' : '#10B981' },
                ]}
              />
              <Text
                style={[
                  styles.healthStatusLabel,
                  { color: isOverBudget ? '#F43F5E' : '#10B981' },
                ]}>
                BUDGET HEALTH
              </Text>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isOverBudget
                    ? 'rgba(244, 63, 94, 0.18)'
                    : budgetRatio >= 85
                    ? 'rgba(245, 158, 11, 0.18)'
                    : isDark
                    ? '#31353F'
                    : '#D1FAE5',
                },
              ]}>
              {isOverBudget && (
                <Warning size={moderateScale(12)} color="#F43F5E" weight="fill" style={{ marginRight: 3 }} />
              )}
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isOverBudget
                      ? '#F43F5E'
                      : budgetRatio >= 85
                      ? '#F59E0B'
                      : isDark
                      ? '#4EDEA3'
                      : '#059669',
                    fontWeight: '800',
                  },
                ]}>
                {isOverBudget ? 'OVER BUDGET' : budgetRatio >= 85 ? 'NEAR LIMIT' : 'ON TRACK'}
              </Text>
            </View>
          </View>

          {/* Spent vs Target Row */}
          <View style={styles.spentVsTargetRow}>
            <View>
              <Text style={[styles.spentSub, { color: theme.textSecondary }]}>Total Spent</Text>
              <View style={styles.spentValRow}>
                <Text style={[styles.spentValText, { color: isOverBudget ? '#F43F5E' : theme.text }]}>
                  {formatCurrency(totalSpent)}
                </Text>
              </View>
            </View>

            <View style={styles.targetColRight}>
              <Text style={[styles.spentSub, { color: theme.textSecondary, textAlign: 'right' }]}>
                Target Limit
              </Text>
              <Text style={[styles.targetValText, { color: theme.text }]}>
                {formatCurrency(targetBudget)}
              </Text>
            </View>
          </View>

          {/* Progress Bar with Color Warning */}
          <View style={[styles.healthProgressTrack, { backgroundColor: isDark ? '#262A34' : '#E2E8F0' }]}>
            <View
              style={[
                styles.healthProgressFill,
                {
                  width: `${Math.min(100, budgetRatio)}%`,
                  backgroundColor: isOverBudget ? '#F43F5E' : budgetRatio >= 85 ? '#F59E0B' : '#10B981',
                },
              ]}
            />
          </View>

          {/* Health Footer / Overage Detail */}
          <View style={styles.healthFooterRow}>
            <Text
              style={[
                styles.healthFooterText,
                { color: isOverBudget ? '#F43F5E' : theme.textSecondary, fontWeight: isOverBudget ? '700' : '500' },
              ]}>
              {isOverBudget
                ? `+${formatCurrency(overageAmount)} over budget (${displayBudgetPercentage}% used)`
                : `${formatCurrency(remainingBudget)} remaining (${100 - displayBudgetPercentage}% free)`}
            </Text>
            <Text style={[styles.healthCategoriesCount, { color: theme.textMuted }]}>
              {envelopes.length} active {envelopes.length === 1 ? 'category' : 'categories'}
            </Text>
          </View>

          {/* Warning State Banner if Over Budget */}
          {isOverBudget && (
            <View style={[styles.overBudgetWarningBanner, { backgroundColor: isDark ? 'rgba(244, 63, 94, 0.12)' : '#FFE4E6' }]}>
              <Warning size={moderateScale(16)} color="#F43F5E" weight="bold" />
              <Text style={[styles.warningBannerText, { color: '#F43F5E' }]}>
                Spending has exceeded your target by {formatCurrency(overageAmount)}. Review allocations below to curb discretionary expenses.
              </Text>
            </View>
          )}
        </View>

        {/* 4. ALLOCATION SPLIT INTERACTIVE SVG DONUT CHART (TOP 5 + OTHER) */}
        <View style={[styles.allocationCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.allocationHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Allocation Split</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                Top 5 spending categories + Other
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
                  {/* Category Slices (Top 5 + Other) */}
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
                <Text style={[styles.centerAmountText, { color: isOverBudget ? '#F43F5E' : theme.text }]}>
                  {formatCurrency(totalSpent)}
                </Text>
                <Text style={[styles.centerCategoryCount, { color: theme.textMuted }]}>
                  {envelopes.length} Total Categories
                </Text>
              </View>
            </View>
          </View>

          {/* Interactive Legend Grid (Top 5 + Other) */}
          <View style={styles.legendGrid}>
            {donutCategories.map((item) => {
              const isSelected = selectedLegendCategory === item.id;
              const slice = donutSlices.find((s) => s.id === item.id);
              const isOther = item.id === 'other_grouped';

              return (
                <Pressable
                  key={`legend-${item.id}`}
                  style={[
                    styles.legendCard,
                    { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' },
                    isSelected && { borderColor: item.color, borderWidth: 1.5 },
                  ]}
                  onPress={() => {
                    if (isOther) {
                      setIsOtherExpanded((prev) => !prev);
                      setSelectedLegendCategory((curr) => (curr === item.id ? null : item.id));
                    } else {
                      setSelectedLegendCategory((curr) => (curr === item.id ? null : item.id));
                    }
                  }}>
                  <View style={styles.legendLeft}>
                    <View style={[styles.legendColorDot, { backgroundColor: item.color }]} />
                    <View style={styles.legendTextWrap}>
                      <Text style={[styles.legendName, { color: theme.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {isOther && (
                        <Text style={[styles.tapToExpandText, { color: theme.primary }]}>
                          {isOtherExpanded ? 'Tap to close' : 'Tap to expand'}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.legendRight}>
                    <Text style={[styles.legendPercent, { color: theme.text }]}>
                      {slice?.percentage ?? 0}%
                    </Text>
                    {isOther && (
                      isOtherExpanded ? (
                        <CaretUp size={moderateScale(12)} color={theme.primary} weight="bold" />
                      ) : (
                        <CaretDown size={moderateScale(12)} color={theme.primary} weight="bold" />
                      )
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Expanded Other Breakdown (When user taps "Other" to expand) */}
          {isOtherExpanded && otherCategories.length > 0 && (
            <View
              style={[
                styles.otherBreakdownCard,
                { backgroundColor: isDark ? '#141720' : '#F1F5F9', borderColor: theme.border },
              ]}>
              <View style={styles.otherBreakdownHeader}>
                <View style={styles.otherHeaderTitleRow}>
                  <Text style={[styles.otherBreakdownTitle, { color: theme.text }]}>
                    Other Categories Breakdown ({otherCategories.length})
                  </Text>
                </View>
                <Pressable hitSlop={8} onPress={() => setIsOtherExpanded(false)}>
                  <Text style={[styles.collapseLinkText, { color: theme.primary }]}>Collapse ✕</Text>
                </Pressable>
              </View>

              <View style={styles.otherCategoriesList}>
                {otherCategories.map((otherItem) => (
                  <View
                    key={`other-item-${otherItem.id}`}
                    style={[
                      styles.otherCategoryRow,
                      { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
                    ]}>
                    <View style={styles.otherRowLeft}>
                      <View style={[styles.otherIconSquircle, { backgroundColor: `${otherItem.color}25` }]}>
                        <CategoryIcon name={otherItem.icon} size={moderateScale(16)} color={otherItem.color} />
                      </View>
                      <View>
                        <Text style={[styles.otherCatName, { color: theme.text }]}>{otherItem.name}</Text>
                        <Text style={[styles.otherCatCount, { color: theme.textMuted }]}>
                          {otherItem.txCount} txs
                        </Text>
                      </View>
                    </View>
                    <View style={styles.otherRowRight}>
                      <Text style={[styles.otherCatSpent, { color: theme.text }]}>
                        {formatCurrency(otherItem.spent)}
                      </Text>
                      <Text style={[styles.otherCatPct, { color: otherItem.color }]}>
                        {otherItem.percentage}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 5. ALL CATEGORY ALLOCATIONS LISTING */}
        <View style={styles.envelopesSection}>
          <View style={styles.envelopesHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Category Allocations</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                {envelopes.length} active spending {envelopes.length === 1 ? 'category' : 'categories'}
              </Text>
            </View>
            <Pressable
              style={styles.addPoolBtn}
              onPress={() => router.push('/(modals)/add-transaction')}>
              <PlusCircle size={moderateScale(18)} color="#10B981" weight="fill" />
              <Text style={[styles.addPoolText, { color: '#10B981' }]}>Add Category</Text>
            </Pressable>
          </View>

          {envelopes.length === 0 ? (
            <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#181B25' : '#FFFFFF' }]}>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Category Spending</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                All category balances are currently {formatCurrency(0)}. Log an expense to track your spending allocations.
              </Text>
            </View>
          ) : (
            envelopes.map((item) => {
              const isExpanded = expandedCategoryId === item.id;

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
                      <View style={[styles.envIconCircle, { backgroundColor: `${item.color}25` }]}>
                        <CategoryIcon name={item.icon} size={moderateScale(20)} color={item.color} />
                      </View>
                      <View>
                        <Text style={[styles.envName, { color: theme.text }]}>{item.name}</Text>
                      </View>
                    </View>
                    {isExpanded ? (
                      <CaretUp size={moderateScale(16)} color={theme.textSecondary} />
                    ) : (
                      <CaretDown size={moderateScale(16)} color={theme.textSecondary} />
                    )}
                  </Pressable>

                  {/* Amount Row */}
                  <View style={styles.envMetricsRow}>
                    <Text style={[styles.envSpentText, { color: theme.text }]}>
                      {formatCurrency(item.spent)}{' '}
                      <Text style={[styles.envSpentUnit, { color: theme.textMuted }]}>spent</Text>
                    </Text>
                    <Text style={[styles.envPercentageText, { color: item.color }]}>
                      {item.percentage}%
                    </Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={[styles.envProgressTrack, { backgroundColor: isDark ? '#262A34' : '#E2E8F0' }]}>
                    <View
                      style={[
                        styles.envProgressFill,
                        { width: `${Math.min(100, item.percentage)}%`, backgroundColor: item.color },
                      ]}
                    />
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
                    <View style={[styles.expandedTxList, { borderTopColor: theme.border }]}>
                      {catTxs.length === 0 ? (
                        <Text style={[styles.noTxText, { color: theme.textMuted }]}>
                          No transactions found for this category in this cycle.
                        </Text>
                      ) : (
                        catTxs.map((tx) => (
                          <View key={tx.id} style={styles.txRow}>
                            <View style={styles.txRowLeft}>
                              <Text style={[styles.txDesc, { color: theme.text }]}>
                                {tx.description || item.name}
                              </Text>
                              <Text style={[styles.txDate, { color: theme.textMuted }]}>
                                {new Date(tx.date).toLocaleDateString([], {
                                  month: 'short',
                                  day: 'numeric',
                                })} • {tx.wallet_name || 'Main Wallet'}
                              </Text>
                            </View>
                            <View style={styles.txRowRight}>
                              <Text style={[styles.txAmount, { color: '#F43F5E' }]}>
                                -{formatCurrency(tx.amount)}
                              </Text>
                              <Pressable
                                style={styles.txDeleteMiniBtn}
                                hitSlop={8}
                                onPress={() => handleDeleteTransaction(tx)}>
                                <Trash size={moderateScale(13)} color="#F43F5E" />
                              </Pressable>
                            </View>
                          </View>
                        ))
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
          </ScrollView>
        </View>

        {/* PAGE 2: WALLETS */}
        <View style={{ width: screenWidth, flex: 1 }}>
          <WalletsView onAddWalletPress={() => router.push('/(modals)/add-wallet')} />
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
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  stickySegmentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: moderateScale(6),
    borderBottomWidth: 1,
  },
  mainSegmentWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(4),
  },
  mainSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.full,
  },
  mainSegmentBtnActive: {
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  mainSegmentBtnText: {
    fontSize: fontScale(13),
  },
  horizontalPager: {
    flex: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBranding: {
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  screenTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  iconButton: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  periodNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.sm,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  periodNavBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
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
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  segmentedControlWrap: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    padding: moderateScale(3),
    borderWidth: 1,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
  },
  segmentBtnActive: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  segmentBtnText: {
    fontSize: fontScale(11),
  },

  /* Budget Health Card */
  budgetHealthCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
    gap: Spacing.xs,
  },
  healthBannerGlow: {
    position: 'absolute',
    top: -moderateScale(50),
    right: -moderateScale(50),
    width: moderateScale(150),
    height: moderateScale(150),
    borderRadius: Radius.full,
  },
  healthHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  statusBadgeText: {
    fontSize: fontScale(10),
  },
  spentVsTargetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Spacing.xs,
  },
  targetColRight: {
    alignItems: 'flex-end',
  },
  spentSub: {
    fontSize: fontScale(11),
    fontWeight: '500',
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
  targetValText: {
    fontSize: fontScale(16),
    fontWeight: '700',
    marginTop: moderateScale(2),
  },
  healthProgressTrack: {
    height: moderateScale(7),
    borderRadius: Radius.full,
    overflow: 'hidden',
    marginVertical: Spacing.xs,
  },
  healthProgressFill: {
    height: '100%',
    borderRadius: Radius.full,
  },
  healthFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthFooterText: {
    fontSize: fontScale(11),
  },
  healthCategoriesCount: {
    fontSize: fontScale(10),
  },
  overBudgetWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: Radius.md,
    marginTop: Spacing.xs,
  },
  warningBannerText: {
    flex: 1,
    fontSize: fontScale(11),
    fontWeight: '600',
    lineHeight: 16,
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
    fontWeight: '800',
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
  legendTextWrap: {
    flex: 1,
  },
  legendName: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  tapToExpandText: {
    fontSize: fontScale(9),
    fontWeight: '700',
  },
  legendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(2),
  },
  legendPercent: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  otherBreakdownCard: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  otherBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
    paddingBottom: moderateScale(4),
  },
  otherHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  otherBreakdownTitle: {
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  collapseLinkText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  otherCategoriesList: {
    gap: moderateScale(4),
  },
  otherCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  otherRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  otherIconSquircle: {
    width: moderateScale(26),
    height: moderateScale(26),
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherCatName: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  otherCatCount: {
    fontSize: fontScale(9),
  },
  otherRowRight: {
    alignItems: 'flex-end',
  },
  otherCatSpent: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  otherCatPct: {
    fontSize: fontScale(9),
    fontWeight: '700',
  },

  /* Category Allocations */
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
  envPercentageText: {
    fontSize: fontScale(13),
    fontWeight: '800',
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
  txRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  txAmount: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  txDeleteMiniBtn: {
    padding: moderateScale(4),
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
