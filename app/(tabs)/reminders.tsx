import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Alarm,
  ArrowsClockwise,
  Bell,
  CalendarBlank,
  Check,
  Plus,
  Trash,
  Warning,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
import { ALL_CATEGORIES, Category, registerCategories } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  createReminder,
  deleteReminder,
  getCategories,
  getReminders,
  getWallets,
  markReminderPaid,
  markReminderUnpaid,
  Reminder,
  Wallet,
} from '@/db/queries';
import { formatCurrency, generateUUID } from '@/utils/formatters';
import { useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

type ReminderSectionTab = 'all' | 'overdue' | 'today' | 'upcoming' | 'recurring';

export default function RemindersScreen() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { currency } = useSettings();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>(ALL_CATEGORIES);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReminderSectionTab>('all');

  // New Reminder Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Bills');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [frequency, setFrequency] = useState<'one-time' | 'weekly' | 'monthly' | 'yearly'>('one-time');
  const [dueDate, setDueDate] = useState<Date>(new Date());
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [rems, wals, cats] = await Promise.all([
        getReminders(db),
        getWallets(db),
        getCategories(db),
      ]);
      setReminders(rems);
      setWallets(wals);
      if (wals.length > 0 && !selectedWalletId) {
        setSelectedWalletId(wals[0].id);
      }
      if (cats.length > 0) {
        registerCategories(cats);
        setCategories(cats);
      }
    } catch (err) {
      console.error('Failed to load reminders data:', err);
    }
  }, [db, selectedWalletId]);

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

  // Grouping logic for Overdue, Today, Upcoming, Recurring
  const { overdueList, todayList, upcomingList, recurringList, paidList, startOfToday, endOfToday } = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const overdue: Reminder[] = [];
    const today: Reminder[] = [];
    const upcoming: Reminder[] = [];
    const recurring: Reminder[] = [];
    const paid: Reminder[] = [];

    reminders.forEach((r) => {
      if (r.is_paid === 1) {
        paid.push(r);
        return;
      }

      if (r.frequency && r.frequency !== 'one-time') {
        recurring.push(r);
      }

      if (r.due_date < startToday) {
        overdue.push(r);
      } else if (r.due_date >= startToday && r.due_date <= endToday) {
        today.push(r);
      } else {
        upcoming.push(r);
      }
    });

    return {
      overdueList: overdue,
      todayList: today,
      upcomingList: upcoming,
      recurringList: recurring,
      paidList: paid,
      startOfToday: startToday,
      endOfToday: endToday,
    };
  }, [reminders]);

  const totalPendingAmount = useMemo(() => {
    return reminders
      .filter((r) => r.is_paid === 0)
      .reduce((sum, r) => sum + r.amount, 0);
  }, [reminders]);

  // Open creation modal
  const handleOpenAddReminder = () => {
    setTitle('');
    setAmount('');
    setSelectedCategory(categories[0]?.name || 'Bills');
    if (wallets.length > 0) setSelectedWalletId(wallets[0].id);
    setFrequency('one-time');
    setDueDate(new Date());
    setNotes('');
    setIsModalOpen(true);
  };

  const handleSaveReminder = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Required Title', 'Please enter a title for the reminder.');
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', `Please enter a valid amount greater than ${currency.symbol}0.`);
      return;
    }

    setIsCreating(true);
    try {
      const id = generateUUID();
      await createReminder(db, {
        id,
        title: trimmedTitle,
        amount: parsedAmount,
        due_date: dueDate.getTime(),
        category: selectedCategory,
        wallet_id: selectedWalletId || null,
        frequency,
        notes: notes.trim() || null,
      });

      setIsModalOpen(false);
      await loadData();
      Alert.alert('✨ Reminder Created', `"${trimmedTitle}" set for ${formatCurrency(parsedAmount)}.`);
    } catch (err) {
      console.error('Failed to save reminder:', err);
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleTogglePaid = (reminder: Reminder) => {
    if (reminder.is_paid === 1) {
      Alert.alert('Undo Payment', `Mark "${reminder.title}" as unpaid?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Unpaid',
          onPress: async () => {
            try {
              await markReminderUnpaid(db, reminder.id);
              await loadData();
            } catch (err) {
              console.error('Failed to mark unpaid:', err);
            }
          },
        },
      ]);
      return;
    }

    const linkedWallet = wallets.find((w) => w.id === reminder.wallet_id);
    Alert.alert(
      'Mark as Paid',
      `How would you like to mark "${reminder.title}" as paid?${
        linkedWallet ? `\n\nLinked Wallet: ${linkedWallet.name} (${formatCurrency(linkedWallet.current_balance)})` : ''
      }`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid Only',
          onPress: async () => {
            try {
              await markReminderPaid(db, reminder.id, false);
              await loadData();
              Alert.alert('Paid', `"${reminder.title}" marked as settled.`);
            } catch (err) {
              console.error('Failed to mark paid:', err);
            }
          },
        },
        ...(linkedWallet
          ? [
              {
                text: `Pay & Deduct from ${linkedWallet.name}`,
                onPress: async () => {
                  try {
                    await markReminderPaid(db, reminder.id, true);
                    await loadData();
                    Alert.alert(
                      'Payment Logged',
                      `Recorded ${formatCurrency(reminder.amount)} expense on ${linkedWallet.name} and marked reminder settled.`
                    );
                  } catch (err) {
                    console.error('Failed to deduct and mark paid:', err);
                  }
                },
              },
            ]
          : []),
      ]
    );
  };

  const handleDeleteReminder = (reminder: Reminder) => {
    Alert.alert('Delete Reminder', `Are you sure you want to delete "${reminder.title}"?`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteReminder(db, reminder.id);
            await loadData();
          } catch (err) {
            console.error('Failed to delete reminder:', err);
          }
        },
      },
    ]);
  };

  const formatDateDisplay = (timestamp: number) => {
    const d = new Date(timestamp);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      d.getDate() === tomorrow.getDate() &&
      d.getMonth() === tomorrow.getMonth() &&
      d.getFullYear() === tomorrow.getFullYear();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateStr = `${months[d.getMonth()]} ${d.getDate()}`;

    if (isToday) return 'Today';
    if (isTomorrow) return 'Tomorrow';
    return dateStr;
  };

  const renderReminderCard = (item: Reminder) => {
    const isOverdue = item.is_paid === 0 && item.due_date < startOfToday;
    const isToday = item.is_paid === 0 && item.due_date >= startOfToday && item.due_date <= endOfToday;
    const isPaid = item.is_paid === 1;

    return (
      <View
        key={item.id}
        style={[
          styles.reminderCard,
          {
            backgroundColor: isDark ? '#1C1F29' : '#FFFFFF',
            borderColor: isOverdue ? 'rgba(244, 63, 94, 0.4)' : isToday ? 'rgba(245, 158, 11, 0.4)' : theme.border,
            opacity: isPaid ? 0.65 : 1,
          },
        ]}>
        <View style={styles.cardHeaderRow}>
          {/* Category Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isOverdue
                  ? 'rgba(244, 63, 94, 0.15)'
                  : isToday
                  ? 'rgba(245, 158, 11, 0.15)'
                  : isDark
                  ? '#262A34'
                  : '#F1F5F9',
              },
            ]}>
            <CategoryIcon
              name={item.category}
              size={moderateScale(20)}
              color={isOverdue ? '#F43F5E' : isToday ? '#F59E0B' : '#10B981'}
            />
          </View>

          {/* Details */}
          <View style={styles.cardDetails}>
            <View style={styles.cardTitleRow}>
              <Text style={[styles.reminderTitle, { color: theme.text, textDecorationLine: isPaid ? 'line-through' : 'none' }]}>
                {item.title}
              </Text>
              {item.frequency !== 'one-time' && (
                <View style={[styles.recurringPill, { backgroundColor: isDark ? '#262A34' : '#EEF2FF' }]}>
                  <ArrowsClockwise size={moderateScale(10)} color="#6366F1" weight="bold" />
                  <Text style={styles.recurringPillText}>{item.frequency}</Text>
                </View>
              )}
            </View>

            <View style={styles.cardSubRow}>
              <View style={styles.dateTag}>
                {isOverdue ? (
                  <WarningCircle size={moderateScale(12)} color="#F43F5E" weight="fill" />
                ) : (
                  <CalendarBlank size={moderateScale(12)} color={theme.textSecondary} />
                )}
                <Text
                  style={[
                    styles.dateTagText,
                    {
                      color: isOverdue ? '#F43F5E' : isToday ? '#F59E0B' : theme.textSecondary,
                      fontWeight: isOverdue || isToday ? '700' : '500',
                    },
                  ]}>
                  {formatDateDisplay(item.due_date)}
                </Text>
              </View>

              {item.wallet_name && (
                <Text style={[styles.walletNameText, { color: theme.textMuted }]}>
                  • {item.wallet_name}
                </Text>
              )}
            </View>
          </View>

          {/* Amount & Actions */}
          <View style={styles.cardRight}>
            <Text
              style={[
                styles.amountText,
                { color: isOverdue ? '#F43F5E' : theme.text, textDecorationLine: isPaid ? 'line-through' : 'none' },
              ]}>
              {formatCurrency(item.amount)}
            </Text>

            <View style={styles.actionIconsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.checkButton,
                  {
                    backgroundColor: isPaid ? '#10B981' : isDark ? '#262A34' : '#F1F5F9',
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
                onPress={() => handleTogglePaid(item)}>
                <Check
                  size={moderateScale(14)}
                  color={isPaid ? '#003824' : theme.textSecondary}
                  weight="bold"
                />
              </Pressable>

              <Pressable
                style={styles.deleteBtn}
                hitSlop={6}
                onPress={() => handleDeleteReminder(item)}>
                <Trash size={moderateScale(14)} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        {item.notes && (
          <Text style={[styles.notesText, { color: theme.textSecondary }]}>
            &quot;{item.notes}&quot;
          </Text>
        )}
      </View>
    );
  };

  const renderSection = (title: string, count: number, items: Reminder[], iconColor: string) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.sectionWrap} key={title}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
          <View style={[styles.sectionBadge, { backgroundColor: iconColor + '20' }]}>
            <Text style={[styles.sectionBadgeText, { color: iconColor }]}>{count}</Text>
          </View>
        </View>
        {items.map(renderReminderCard)}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <Bell size={moderateScale(18)} color="#003824" weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: theme.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Reminders & Bills</Text>
          </View>
        </View>

        <Pressable
          style={[styles.addReminderHeaderBtn, { backgroundColor: theme.primary }]}
          onPress={handleOpenAddReminder}>
          <Plus size={moderateScale(16)} color="#003824" weight="bold" />
          <Text style={styles.addReminderHeaderBtnText}>+ New</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.primary} />
        }>
        {/* Total Outstanding Card */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
          ]}>
          <View style={styles.summaryRowTop}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              PENDING COMMITMENTS
            </Text>
            {overdueList.length > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Warning size={moderateScale(12)} color="#F43F5E" weight="fill" />
                <Text style={styles.alertBadgeText}>{overdueList.length} Overdue</Text>
              </View>
            )}
          </View>

          <Text style={[styles.summaryAmount, { color: theme.text }]}>
            {formatCurrency(totalPendingAmount)}
          </Text>

          <View style={styles.summaryStatsRow}>
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: overdueList.length > 0 ? '#F43F5E' : theme.text }]}>
                {overdueList.length}
              </Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Overdue</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>{todayList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Due Today</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#10B981' }]}>{upcomingList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Upcoming</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#6366F1' }]}>{recurringList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Recurring</Text>
            </View>
          </View>
        </View>

        {/* Section Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScroll}>
          {[
            { id: 'all', label: `All (${reminders.filter((r) => r.is_paid === 0).length})` },
            { id: 'overdue', label: `Overdue (${overdueList.length})` },
            { id: 'today', label: `Today (${todayList.length})` },
            { id: 'upcoming', label: `Upcoming (${upcomingList.length})` },
            { id: 'recurring', label: `Recurring (${recurringList.length})` },
          ].map((tab) => {
            const isSel = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isSel
                      ? theme.primary
                      : isDark
                      ? '#1C1F29'
                      : '#F1F5F9',
                  },
                ]}
                onPress={() => setActiveTab(tab.id as ReminderSectionTab)}>
                <Text
                  style={[
                    styles.filterTabText,
                    {
                      color: isSel ? '#003824' : theme.textSecondary,
                      fontWeight: isSel ? '700' : '500',
                    },
                  ]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Filtered Sections Display */}
        {reminders.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' }]}>
            <Alarm size={moderateScale(48)} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Reminders Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Never miss a bill or recurring payment again. Tap &quot;+ New&quot; above to set your first reminder.
            </Text>
          </View>
        ) : (
          <>
            {(activeTab === 'all' || activeTab === 'overdue') &&
              renderSection('🚨 Overdue Bills', overdueList.length, overdueList, '#F43F5E')}

            {(activeTab === 'all' || activeTab === 'today') &&
              renderSection('⚡ Due Today', todayList.length, todayList, '#F59E0B')}

            {(activeTab === 'all' || activeTab === 'upcoming') &&
              renderSection('📅 Upcoming Scheduled', upcomingList.length, upcomingList, '#10B981')}

            {activeTab === 'recurring' &&
              renderSection('🔄 Recurring Subscriptions', recurringList.length, recurringList, '#6366F1')}

            {activeTab === 'all' && paidList.length > 0 &&
              renderSection('✅ Settled & Paid', paidList.length, paidList, '#6B7280')}
          </>
        )}
      </ScrollView>

      {/* Creation Modal Sheet */}
      <Modal
        visible={isModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsModalOpen(false)}>
          <Pressable
            style={[styles.modalSheet, { backgroundColor: isDark ? '#262A34' : '#FFFFFF' }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>New Reminder / Bill</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Keep your bills and dues organized
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={() => setIsModalOpen(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: moderateScale(450) }}>
              {/* Title */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>REMINDER TITLE</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="e.g. Electric Bill, Rent, Netflix"
                  placeholderTextColor={theme.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                />
              </View>

              {/* Amount */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>AMOUNT</Text>
                <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
                  <Text style={[styles.currencySymbol, { color: theme.text }]}>{currency.symbol}</Text>
                  <TextInput
                    style={[styles.amountTextInput, { color: theme.text }]}
                    placeholder="0"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>
              </View>

              {/* Quick Chips */}
              <View style={styles.quickChipsRow}>
                {[500, 1000, 2000, 5000].map((amt) => (
                  <Pressable
                    key={'r_amt_' + amt}
                    style={[styles.quickChip, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                    onPress={() => {
                      const cur = parseFloat(amount) || 0;
                      setAmount((cur + amt).toString());
                    }}>
                    <Text style={[styles.quickChipText, { color: theme.text }]}>
                      +{currency.symbol}{amt}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Due Date Presets */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DUE DATE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {[
                    { label: 'Today', offsetDays: 0 },
                    { label: 'Tomorrow', offsetDays: 1 },
                    { label: 'In 3 Days', offsetDays: 3 },
                    { label: 'In 1 Week', offsetDays: 7 },
                    { label: 'End of Month', offsetDays: 30 },
                  ].map((preset) => {
                    const presetDate = new Date();
                    presetDate.setDate(presetDate.getDate() + preset.offsetDays);
                    const isSel = dueDate.getDate() === presetDate.getDate() && dueDate.getMonth() === presetDate.getMonth();
                    return (
                      <Pressable
                        key={preset.label}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => {
                          const newD = new Date();
                          newD.setDate(newD.getDate() + preset.offsetDays);
                          setDueDate(newD);
                        }}>
                        <Text
                          style={[
                            styles.presetChipText,
                            { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Frequency / Recurring */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>FREQUENCY</Text>
                <View style={styles.frequencyRow}>
                  {[
                    { id: 'one-time', label: 'One-time' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' },
                  ].map((freq) => {
                    const isSel = frequency === freq.id;
                    return (
                      <Pressable
                        key={freq.id}
                        style={[
                          styles.freqBtn,
                          {
                            backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => setFrequency(freq.id as any)}>
                        <Text
                          style={[
                            styles.freqBtnText,
                            { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {freq.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>CATEGORY</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {categories.map((cat) => {
                    const isSel = selectedCategory === cat.name;
                    return (
                      <Pressable
                        key={cat.id}
                        style={[
                          styles.categorySelectChip,
                          {
                            backgroundColor: isSel ? cat.color + '25' : isDark ? '#1C1F29' : '#F1F5F9',
                            borderColor: isSel ? cat.color : 'transparent',
                          },
                        ]}
                        onPress={() => setSelectedCategory(cat.name)}>
                        <CategoryIcon name={cat.icon} size={moderateScale(16)} color={cat.color} />
                        <Text
                          style={[
                            styles.categorySelectText,
                            { color: isSel ? cat.color : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Account / Wallet */}
              {wallets.length > 0 && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>PAY FROM (ACCOUNT)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {wallets.map((w) => {
                      const isSel = selectedWalletId === w.id;
                      return (
                        <Pressable
                          key={w.id}
                          style={[
                            styles.walletSelectChip,
                            {
                              backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                            },
                          ]}
                          onPress={() => setSelectedWalletId(w.id)}>
                          <Text
                            style={[
                              styles.walletSelectText,
                              { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                            ]}>
                            {w.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Notes */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>NOTES (OPTIONAL)</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="e.g. Account number, contract info"
                  placeholderTextColor={theme.textMuted}
                  value={notes}
                  onChangeText={setNotes}
                />
              </View>
            </ScrollView>

            <Pressable
              style={({ pressed }) => [
                styles.saveReminderBtn,
                { backgroundColor: theme.primary, opacity: pressed || isCreating ? 0.8 : 1 },
              ]}
              onPress={handleSaveReminder}
              disabled={isCreating}>
              <Check size={moderateScale(20)} color="#003824" weight="bold" />
              <Text style={styles.saveReminderBtnText}>
                {isCreating ? 'Saving...' : 'Set Reminder'}
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
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
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
    fontSize: fontScale(9),
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  screenTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  addReminderHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
  },
  addReminderHeaderBtnText: {
    color: '#003824',
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: moderateScale(100),
  },
  summaryCard: {
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  summaryRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summaryLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  alertBadgeText: {
    color: '#F43F5E',
    fontSize: fontScale(10),
    fontWeight: '800',
  },
  summaryAmount: {
    fontSize: fontScale(28),
    fontWeight: '800',
    letterSpacing: -0.8,
    marginVertical: Spacing.xs,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  statSub: {
    fontSize: fontScale(10),
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: moderateScale(22),
  },
  tabsScroll: {
    marginBottom: Spacing.lg,
  },
  tabsScrollContent: {
    gap: Spacing.sm,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
  },
  filterTabText: {
    fontSize: fontScale(12),
  },
  sectionWrap: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: fontScale(15),
    fontWeight: '700',
  },
  sectionBadge: {
    paddingHorizontal: Spacing.xs + 3,
    paddingVertical: 1,
    borderRadius: Radius.full,
  },
  sectionBadgeText: {
    fontSize: fontScale(11),
    fontWeight: '800',
  },
  reminderCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
  },
  reminderTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  recurringPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  recurringPillText: {
    fontSize: fontScale(9),
    color: '#6366F1',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateTagText: {
    fontSize: fontScale(11),
  },
  walletNameText: {
    fontSize: fontScale(11),
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  amountText: {
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  actionIconsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  checkButton: {
    width: moderateScale(26),
    height: moderateScale(26),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: moderateScale(4),
  },
  notesText: {
    fontSize: fontScale(11),
    fontStyle: 'italic',
    marginTop: Spacing.xs,
    marginLeft: moderateScale(50),
  },
  emptyContainer: {
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
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
    maxHeight: '90%',
  },
  sheetHandle: {
    width: moderateScale(40),
    height: moderateScale(4),
    borderRadius: Radius.full,
    backgroundColor: '#6B7280',
    alignSelf: 'center',
    marginBottom: Spacing.md,
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
  inputGroup: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: fontScale(11),
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: Spacing.xs,
  },
  textInput: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    borderWidth: 1,
    fontSize: fontScale(14),
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  currencySymbol: {
    fontSize: fontScale(20),
    fontWeight: '700',
    marginRight: Spacing.sm,
  },
  amountTextInput: {
    flex: 1,
    fontSize: fontScale(22),
    fontWeight: '800',
    paddingVertical: moderateScale(4),
  },
  quickChipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  quickChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(6),
    borderRadius: Radius.md,
  },
  quickChipText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  chipScroll: {
    flexDirection: 'row',
  },
  presetChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  presetChipText: {
    fontSize: fontScale(12),
  },
  frequencyRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  freqBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8),
    borderRadius: Radius.md,
  },
  freqBtnText: {
    fontSize: fontScale(12),
  },
  categorySelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
    borderWidth: 1.5,
  },
  categorySelectText: {
    fontSize: fontScale(12),
  },
  walletSelectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
  },
  walletSelectText: {
    fontSize: fontScale(12),
  },
  saveReminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(13),
    borderRadius: Radius.lg,
    marginTop: Spacing.md,
  },
  saveReminderBtnText: {
    color: '#003824',
    fontSize: fontScale(15),
    fontWeight: '700',
  },
});
