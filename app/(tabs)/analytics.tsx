import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Airplane,
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  Car,
  ChartBar,
  ChartPieSlice,
  Coins,
  DotsThreeOutline,
  FirstAid,
  ForkKnife,
  GameController,
  Gift,
  GraduationCap,
  House,
  Laptop,
  Receipt,
  ShoppingCart,
  TrendUp,
  Wallet,
} from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getCategoryById } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  CategorySummary,
  getCategoryBreakdown,
  getPeriodSummary,
  getTransactionsInRange,
  TransactionWithWallet,
} from '@/db/queries';
import { fontScale, moderateScale, Radius, Spacing, windowWidth } from '@/utils/styling';

type TimeRangeKey = 'month' | 'threeMonths' | 'ytd';

interface TimeRangeOption {
  key: TimeRangeKey;
  label: string;
}

const TIME_RANGES: TimeRangeOption[] = [
  { key: 'month', label: 'This Month' },
  { key: 'threeMonths', label: 'Last 3 Months' },
  { key: 'ytd', label: 'Year-to-Date' },
];

export default function AnalyticsScreen() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('month');
  const [totalIncome, setTotalIncome] = useState<number>(0);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithWallet[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate start & end timestamp for selected range
  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    const end = now.getTime();
    let start = 0;

    if (selectedRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    } else if (selectedRange === 'threeMonths') {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      start = threeMonthsAgo.getTime();
    } else if (selectedRange === 'ytd') {
      start = new Date(now.getFullYear(), 0, 1).getTime();
    }

    return { startDate: start, endDate: end };
  }, [selectedRange]);

  const loadAnalytics = useCallback(async () => {
    try {
      const [periodSummary, catBreakdown, txList] = await Promise.all([
        getPeriodSummary(db, startDate, endDate),
        getCategoryBreakdown(db, startDate, endDate),
        getTransactionsInRange(db, startDate, endDate),
      ]);

      setTotalIncome(periodSummary.totalIncome);
      setTotalExpense(periodSummary.totalExpense);
      setCategories(catBreakdown);
      setTransactions(txList);
    } catch (err) {
      console.error('Failed to load analytics data:', err);
    }
  }, [db, startDate, endDate]);

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

  const netSavings = totalIncome - totalExpense;
  const savingsRate =
    totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  const formatCurrency = (amount: number) => {
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Build dual-bar chart data: Income (Green) vs Expense (Red)
  const chartData = useMemo(() => {
    if (transactions.length === 0) return [];

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    if (selectedRange === 'month') {
      // Group by weeks of the month: W1 (1-7), W2 (8-14), W3 (15-21), W4 (22+)
      const weeks = [
        { label: 'W1', income: 0, expense: 0 },
        { label: 'W2', income: 0, expense: 0 },
        { label: 'W3', income: 0, expense: 0 },
        { label: 'W4', income: 0, expense: 0 },
      ];

      transactions.forEach((tx) => {
        const day = new Date(tx.date).getDate();
        let weekIndex = 0;
        if (day <= 7) weekIndex = 0;
        else if (day <= 14) weekIndex = 1;
        else if (day <= 21) weekIndex = 2;
        else weekIndex = 3;

        if (tx.type === 'income') {
          weeks[weekIndex].income += tx.amount;
        } else {
          weeks[weekIndex].expense += tx.amount;
        }
      });

      const formatted: {
        value: number;
        label?: string;
        spacing?: number;
        labelWidth?: number;
        frontColor: string;
      }[] = [];

      weeks.forEach((w) => {
        formatted.push({
          value: w.income,
          label: w.label,
          spacing: moderateScale(2),
          labelWidth: moderateScale(30),
          frontColor: theme.income,
        });
        formatted.push({
          value: w.expense,
          frontColor: theme.expense,
        });
      });

      return formatted;
    }

    // For Last 3 Months & Year-to-Date: Group by Year-Month
    const monthMap = new Map<string, { label: string; income: number; expense: number }>();

    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthMap.has(key)) {
        monthMap.set(key, { label: monthNames[d.getMonth()], income: 0, expense: 0 });
      }
      const item = monthMap.get(key)!;
      if (tx.type === 'income') {
        item.income += tx.amount;
      } else {
        item.expense += tx.amount;
      }
    });

    const formatted: {
      value: number;
      label?: string;
      spacing?: number;
      labelWidth?: number;
      frontColor: string;
    }[] = [];

    Array.from(monthMap.values()).forEach((m) => {
      formatted.push({
        value: m.income,
        label: m.label,
        spacing: moderateScale(2),
        labelWidth: moderateScale(30),
        frontColor: theme.income,
      });
      formatted.push({
        value: m.expense,
        frontColor: theme.expense,
      });
    });

    return formatted;
  }, [transactions, selectedRange, theme]);

  const renderCategoryIcon = (iconName: string, color: string) => {
    const size = moderateScale(18);
    switch (iconName) {
      case 'ForkKnife':
        return <ForkKnife size={size} color={color} weight="fill" />;
      case 'ShoppingCart':
        return <ShoppingCart size={size} color={color} weight="fill" />;
      case 'Car':
        return <Car size={size} color={color} weight="fill" />;
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

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.title, { color: theme.text }]}>Analytics & Reports</Text>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Track your financial flow and category habits
      </Text>

      {/* 1. Time Range Selector Segmented Buttons */}
      <View style={[styles.rangeSegmentWrap, { backgroundColor: theme.surfaceVariant }]}>
        {TIME_RANGES.map((r) => {
          const selected = r.key === selectedRange;
          return (
            <Pressable
              key={r.key}
              style={[
                styles.rangeSegmentBtn,
                selected && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedRange(r.key)}>
              <Text
                style={[
                  styles.rangeSegmentText,
                  { color: selected ? '#FFFFFF' : theme.textSecondary },
                ]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 2. Financial Health Summary Card */}
      <View style={[styles.healthCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.healthHeader}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Financial Health</Text>
          <View
            style={[
              styles.rateBadge,
              {
                backgroundColor:
                  savingsRate > 20
                    ? theme.incomeLight
                    : savingsRate < 0
                    ? theme.expenseLight
                    : theme.surfaceVariant,
              },
            ]}>
            <Text
              style={[
                styles.rateBadgeText,
                {
                  color:
                    savingsRate > 20
                      ? theme.income
                      : savingsRate < 0
                      ? theme.expense
                      : theme.textSecondary,
                },
              ]}>
              {savingsRate}% Savings Rate
            </Text>
          </View>
        </View>

        <View style={styles.healthStatsRow}>
          <View style={styles.healthStatCol}>
            <View style={styles.healthStatLabelRow}>
              <ArrowDownLeft size={moderateScale(14)} color={theme.income} weight="bold" />
              <Text style={[styles.healthStatLabel, { color: theme.textSecondary }]}>Income</Text>
            </View>
            <Text style={[styles.healthStatValue, { color: theme.income }]}>
              {formatCurrency(totalIncome)}
            </Text>
          </View>

          <View style={[styles.healthDivider, { backgroundColor: theme.border }]} />

          <View style={styles.healthStatCol}>
            <View style={styles.healthStatLabelRow}>
              <ArrowUpRight size={moderateScale(14)} color={theme.expense} weight="bold" />
              <Text style={[styles.healthStatLabel, { color: theme.textSecondary }]}>Expenses</Text>
            </View>
            <Text style={[styles.healthStatValue, { color: theme.expense }]}>
              {formatCurrency(totalExpense)}
            </Text>
          </View>
        </View>

        <View style={[styles.netSavingsBanner, { backgroundColor: theme.surfaceVariant }]}>
          <Text style={[styles.netSavingsLabel, { color: theme.textSecondary }]}>Net Savings</Text>
          <Text
            style={[
              styles.netSavingsValue,
              { color: netSavings >= 0 ? theme.income : theme.expense },
            ]}>
            {netSavings >= 0 ? '+' : ''}{formatCurrency(netSavings)}
          </Text>
        </View>
      </View>

      {/* 3. Bar Chart (Inflow vs Outflow) */}
      <View style={[styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.chartHeaderRow}>
          <View>
            <Text style={[styles.cardTitle, { color: theme.text }]}>Inflow vs Outflow</Text>
            <Text style={[styles.chartSub, { color: theme.textMuted }]}>
              {selectedRange === 'month' ? 'Weekly Comparison' : 'Monthly Trend'}
            </Text>
          </View>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.income }]} />
              <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Income</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.expense }]} />
              <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>Expense</Text>
            </View>
          </View>
        </View>

        {chartData.length > 0 ? (
          <View style={styles.chartWrap}>
            <BarChart
              data={chartData}
              barWidth={moderateScale(12)}
              spacing={moderateScale(18)}
              roundedTop
              roundedBottom
              hideRules
              xAxisThickness={1}
              yAxisThickness={0}
              xAxisColor={theme.border}
              yAxisTextStyle={{ color: theme.textMuted, fontSize: fontScale(9) }}
              xAxisLabelTextStyle={{ color: theme.textSecondary, fontSize: fontScale(10) }}
              noOfSections={3}
              width={windowWidth - moderateScale(88)}
              height={moderateScale(150)}
            />
          </View>
        ) : (
          <View style={styles.chartEmpty}>
            <ChartBar size={moderateScale(32)} color={theme.textMuted} />
            <Text style={[styles.chartEmptyText, { color: theme.textMuted }]}>
              No flow data for this period
            </Text>
          </View>
        )}
      </View>

      {/* 4. Category Spending Breakdown Header */}
      <Text style={[styles.sectionHeading, { color: theme.text }]}>Category Breakdown</Text>
    </View>
  );

  const renderCategoryItem = ({ item }: { item: CategorySummary }) => {
    const categoryInfo = getCategoryById(item.category);
    const percentage =
      totalExpense > 0 ? Math.round((item.total / totalExpense) * 100) : 0;

    return (
      <View style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.catHeader}>
          <View style={styles.catLeft}>
            <View style={[styles.catIconCircle, { backgroundColor: categoryInfo.color + '20' }]}>
              {renderCategoryIcon(categoryInfo.icon, categoryInfo.color)}
            </View>
            <View>
              <Text style={[styles.catName, { color: theme.text }]}>{categoryInfo.name}</Text>
              <Text style={[styles.catPercent, { color: theme.textMuted }]}>
                {percentage}% of spending
              </Text>
            </View>
          </View>

          <Text style={[styles.catAmount, { color: theme.text }]}>
            {formatCurrency(item.total)}
          </Text>
        </View>

        {/* Horizontal Progress Bar */}
        <View style={[styles.progressTrack, { backgroundColor: theme.surfaceVariant }]}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${Math.min(100, Math.max(3, percentage))}%`,
                backgroundColor: categoryInfo.color,
              },
            ]}
          />
        </View>
      </View>
    );
  };

  // 5. Friendly Empty State
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <ChartPieSlice size={moderateScale(48)} color={theme.textMuted} />
      <Text style={[styles.emptyTitle, { color: theme.textSecondary }]}>
        No expenses found
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        There are no tracked expense transactions in the &quot;
        {TIME_RANGES.find((r) => r.key === selectedRange)?.label}&quot; timeframe.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={categories}
        keyExtractor={(item) => item.category}
        renderItem={renderCategoryItem}
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
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
  rangeSegmentWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(4),
    marginBottom: Spacing.md,
  },
  rangeSegmentBtn: {
    flex: 1,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  rangeSegmentText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  healthCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  rateBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
    borderRadius: Radius.full,
  },
  rateBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  healthStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  healthStatCol: {
    flex: 1,
  },
  healthStatLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: moderateScale(2),
  },
  healthStatLabel: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  healthStatValue: {
    fontSize: fontScale(18),
    fontWeight: '700',
  },
  healthDivider: {
    width: 1,
    height: moderateScale(38),
    marginHorizontal: Spacing.md,
  },
  netSavingsBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  netSavingsLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  netSavingsValue: {
    fontSize: fontScale(16),
    fontWeight: '800',
  },
  chartCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  chartSub: {
    fontSize: fontScale(11),
    marginTop: moderateScale(1),
  },
  legendRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  legendDot: {
    width: moderateScale(8),
    height: moderateScale(8),
    borderRadius: Radius.full,
  },
  legendLabel: {
    fontSize: fontScale(11),
    fontWeight: '600',
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  chartEmptyText: {
    fontSize: fontScale(13),
  },
  sectionHeading: {
    fontSize: fontScale(17),
    fontWeight: '700',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  catCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  catHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  catIconCircle: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  catPercent: {
    fontSize: fontScale(11),
    marginTop: moderateScale(1),
  },
  catAmount: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  progressTrack: {
    height: moderateScale(6),
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: Radius.full,
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
});
