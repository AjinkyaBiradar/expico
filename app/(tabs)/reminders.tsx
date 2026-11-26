import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Alarm,
  ArrowCounterClockwise,
  ArrowsClockwise,
  Bell,
  CaretLeft,
  CaretRight,
  Check,
  CheckCircle,
  Clock,
  Plus,
  Trash,
  Warning,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ReminderSectionTab = 'all' | 'overdue' | 'today' | 'tomorrow' | 'later' | 'done';
type FrequencyType = 'once' | 'daily' | 'weekly';

interface QuickSuggestion {
  title: string;
  category: string;
  icon: string;
  hours: number;
  minutes: number;
  frequency: FrequencyType;
  emoji: string;
}

const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { title: 'Drink water', category: 'Health', icon: 'Drop', hours: 9, minutes: 0, frequency: 'daily', emoji: '💧' },
  { title: 'Take vitamins', category: 'Health', icon: 'FirstAid', hours: 8, minutes: 30, frequency: 'daily', emoji: '💊' },
  { title: 'Workout', category: 'Fitness', icon: 'TrendUp', hours: 18, minutes: 0, frequency: 'daily', emoji: '🏋️' },
  { title: 'Call home', category: 'Family', icon: 'DeviceMobile', hours: 19, minutes: 30, frequency: 'weekly', emoji: '📞' },
  { title: 'Study', category: 'Education', icon: 'GraduationCap', hours: 16, minutes: 0, frequency: 'daily', emoji: '📚' },
];

export default function RemindersScreen() {
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { currency, setDueSoonCount } = useSettings();
  const params = useLocalSearchParams<{ openAdd?: string }>();

  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>(ALL_CATEGORIES);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<ReminderSectionTab>('all');

  // Deletion with Undo state
  const [deletedReminder, setDeletedReminder] = useState<Reminder | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // New Reminder Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Bills');
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [frequency, setFrequency] = useState<FrequencyType>('once');

  // Date and Time picker state
  const [selectedDateOffset, setSelectedDateOffset] = useState<number>(0); // 0 = Today, 1 = Tomorrow, etc.
  const [selectedHour, setSelectedHour] = useState<number>(9);
  const [selectedMinute, setSelectedMinute] = useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');
  const [notes, setNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Quick feedback toast (e.g. "Completed! Jumped to tomorrow at 9:00 AM")
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    setFeedbackToast(msg);
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

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

  // Open creation modal
  const handleOpenAddReminder = useCallback(() => {
    setTitle('');
    setAmount('');
    setSelectedCategory(categories[0]?.name || 'General');
    if (wallets.length > 0) setSelectedWalletId(wallets[0].id);
    setFrequency('once');
    setSelectedDateOffset(0);

    const now = new Date();
    const currentH = now.getHours();
    const period = currentH >= 12 ? 'PM' : 'AM';
    const displayH = currentH % 12 === 0 ? 12 : currentH % 12;
    setSelectedHour(displayH);
    setSelectedMinute(now.getMinutes() > 30 ? 0 : 30);
    setSelectedPeriod(period);
    setNotes('');
    setIsModalOpen(true);
  }, [categories, wallets]);

  // Listen to openAdd trigger from center FAB or notifications
  useEffect(() => {
    if (params.openAdd) {
      const timer = setTimeout(() => {
        handleOpenAddReminder();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [params.openAdd, handleOpenAddReminder]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Grouping logic: Overdue, Today, Tomorrow, Later, Done
  const {
    overdueList,
    todayList,
    tomorrowList,
    laterList,
    doneList,
    startOfToday,
    endOfToday,
    endOfTomorrow,
  } = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endTomorrow = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999).getTime();

    const overdue: Reminder[] = [];
    const todayGroup: Reminder[] = [];
    const tomorrowGroup: Reminder[] = [];
    const later: Reminder[] = [];
    const done: Reminder[] = [];

    reminders.forEach((r) => {
      if (r.is_paid === 1) {
        done.push(r);
        return;
      }

      if (r.due_date < startToday) {
        overdue.push(r);
      } else if (r.due_date >= startToday && r.due_date <= endToday) {
        todayGroup.push(r);
      } else if (r.due_date > endToday && r.due_date <= endTomorrow) {
        tomorrowGroup.push(r);
      } else {
        later.push(r);
      }
    });

    return {
      overdueList: overdue,
      todayList: todayGroup,
      tomorrowList: tomorrowGroup,
      laterList: later,
      doneList: done,
      startOfToday: startToday,
      endOfToday: endToday,
      endOfTomorrow: endTomorrow,
    };
  }, [reminders]);

  // Update tab badge count for "due soon" (Overdue + Today + Tomorrow)
  useEffect(() => {
    const dueSoon = overdueList.length + todayList.length + tomorrowList.length;
    setDueSoonCount(dueSoon);
  }, [overdueList.length, todayList.length, tomorrowList.length, setDueSoonCount]);

  const totalPendingAmount = useMemo(() => {
    return reminders
      .filter((r) => r.is_paid === 0 && r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);
  }, [reminders]);

  const handleApplySuggestion = (suggestion: QuickSuggestion) => {
    setTitle(suggestion.title);
    setSelectedCategory(suggestion.category);
    setFrequency(suggestion.frequency);
    const displayH = suggestion.hours % 12 === 0 ? 12 : suggestion.hours % 12;
    const period = suggestion.hours >= 12 ? 'PM' : 'AM';
    setSelectedHour(displayH);
    setSelectedMinute(suggestion.minutes);
    setSelectedPeriod(period);
    setAmount('');
  };

  const calculateTargetDueDate = (): number => {
    const target = new Date();
    target.setDate(target.getDate() + selectedDateOffset);

    let h24 = selectedHour % 12;
    if (selectedPeriod === 'PM') h24 += 12;

    target.setHours(h24, selectedMinute, 0, 0);
    return target.getTime();
  };

  const handleSaveReminder = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      Alert.alert('Required Title', 'Please enter a reminder title or tap a quick suggestion.');
      return;
    }

    const parsedAmount = parseFloat(amount);
    const safeAmount = isNaN(parsedAmount) || parsedAmount < 0 ? 0 : parsedAmount;
    const dueTime = calculateTargetDueDate();

    setIsCreating(true);
    try {
      const id = generateUUID();
      await createReminder(db, {
        id,
        title: trimmedTitle,
        amount: safeAmount,
        due_date: dueTime,
        category: selectedCategory,
        wallet_id: safeAmount > 0 && selectedWalletId ? selectedWalletId : null,
        frequency,
        notes: notes.trim() || null,
      });

      setIsModalOpen(false);
      await loadData();
      showToast(`Reminder set for ${trimmedTitle}`);
    } catch (err) {
      console.error('Failed to save reminder:', err);
      Alert.alert('Error', 'Failed to save reminder. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  // Complete / Finish task
  const handleToggleComplete = async (reminder: Reminder) => {
    if (reminder.is_paid === 1) {
      // Re-activate / un-finish
      try {
        await markReminderUnpaid(db, reminder.id);
        await loadData();
        showToast(`Restored "${reminder.title}"`);
      } catch (err) {
        console.error('Failed to restore reminder:', err);
      }
      return;
    }

    // Complete task: Repeating ones jump to their next time!
    if (reminder.frequency === 'daily' || reminder.frequency === 'weekly') {
      try {
        await markReminderPaid(db, reminder.id, false);
        await loadData();
        const nextTimeStr = formatTimeDisplay(reminder.due_date);
        const nextDayLabel = reminder.frequency === 'daily' ? 'tomorrow' : 'next week';
        showToast(`Completed! Jumped to ${nextDayLabel} at ${nextTimeStr}`);
      } catch (err) {
        console.error('Failed to jump reminder:', err);
      }
    } else {
      // Once / non-repeating: mark done
      try {
        await markReminderPaid(db, reminder.id, false);
        await loadData();
        showToast(`Finished "${reminder.title}"`);
      } catch (err) {
        console.error('Failed to mark reminder done:', err);
      }
    }
  };

  // Delete with Undo
  const handleDeleteWithUndo = (reminder: Reminder) => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    // Remove from local list immediately
    setReminders((prev) => prev.filter((r) => r.id !== reminder.id));
    setDeletedReminder(reminder);

    // Schedule actual database deletion after 4.5s
    undoTimeoutRef.current = setTimeout(async () => {
      try {
        await deleteReminder(db, reminder.id);
      } catch (err) {
        console.error('Failed to delete reminder from db:', err);
      }
      setDeletedReminder(null);
    }, 4500);
  };

  const handleUndoDelete = () => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    if (deletedReminder) {
      setReminders((prev) => [...prev, deletedReminder].sort((a, b) => a.due_date - b.due_date));
      setDeletedReminder(null);
      showToast('Deletion undone');
    }
  };

  const formatTimeDisplay = (timestamp: number) => {
    const d = new Date(timestamp);
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minStr} ${period}`;
  };

  const formatDateLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  const renderReminderCard = (item: Reminder) => {
    const isOverdue = item.is_paid === 0 && item.due_date < startOfToday;
    const isToday = item.is_paid === 0 && item.due_date >= startOfToday && item.due_date <= endOfToday;
    const isTomorrow = item.is_paid === 0 && item.due_date > endOfToday && item.due_date <= endOfTomorrow;
    const isDone = item.is_paid === 1;

    const timeStr = formatTimeDisplay(item.due_date);
    const dateLabel = isToday
      ? `Today at ${timeStr}`
      : isTomorrow
      ? `Tomorrow at ${timeStr}`
      : isOverdue
      ? `Overdue • ${formatDateLabel(item.due_date)} ${timeStr}`
      : `${formatDateLabel(item.due_date)} at ${timeStr}`;

    return (
      <View
        key={item.id}
        style={[
          styles.reminderCard,
          {
            backgroundColor: isDark ? '#1C1F29' : '#FFFFFF',
            borderColor: isOverdue
              ? 'rgba(244, 63, 94, 0.45)'
              : isToday
              ? 'rgba(245, 158, 11, 0.4)'
              : theme.border,
            opacity: isDone ? 0.6 : 1,
          },
        ]}>
        <View style={styles.cardHeaderRow}>
          {/* Tick Circle Button to finish/unfinish task */}
          <Pressable
            style={({ pressed }) => [styles.tickCircleBtn, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={moderateScale(8)}
            onPress={() => handleToggleComplete(item)}>
            {isDone ? (
              <CheckCircle size={moderateScale(24)} color="#10B981" weight="fill" />
            ) : (
              <View
                style={[
                  styles.uncheckCircle,
                  {
                    borderColor: isOverdue ? '#F43F5E' : theme.textMuted,
                  },
                ]}
              />
            )}
          </Pressable>

          {/* Details */}
          <View style={styles.cardDetails}>
            <View style={styles.cardTitleRow}>
              <Text
                style={[
                  styles.reminderTitle,
                  {
                    color: theme.text,
                    textDecorationLine: isDone ? 'line-through' : 'none',
                  },
                ]}>
                {item.title}
              </Text>

              {item.frequency !== 'once' && item.frequency !== 'one-time' && (
                <View style={[styles.repeatBadge, { backgroundColor: isDark ? '#262A34' : '#EEF2FF' }]}>
                  <ArrowsClockwise size={moderateScale(10)} color="#6366F1" weight="bold" />
                  <Text style={styles.repeatBadgeText}>
                    {item.frequency === 'daily' ? 'Every day' : item.frequency === 'weekly' ? 'Every week' : item.frequency}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.cardSubRow}>
              <View style={styles.dateTag}>
                {isOverdue ? (
                  <WarningCircle size={moderateScale(12)} color="#F43F5E" weight="fill" />
                ) : (
                  <Clock size={moderateScale(12)} color={theme.textSecondary} />
                )}
                <Text
                  style={[
                    styles.dateTagText,
                    {
                      color: isOverdue ? '#F43F5E' : isToday ? '#F59E0B' : theme.textSecondary,
                      fontWeight: isOverdue || isToday ? '700' : '500',
                    },
                  ]}>
                  {dateLabel}
                </Text>
              </View>

              {item.category && item.category !== 'General' && (
                <Text style={[styles.categoryTagText, { color: theme.textMuted }]}>
                  • {item.category}
                </Text>
              )}
            </View>
          </View>

          {/* Amount (if any) & Delete */}
          <View style={styles.cardRight}>
            {item.amount > 0 && (
              <Text
                style={[
                  styles.amountText,
                  {
                    color: isOverdue ? '#F43F5E' : theme.text,
                    textDecorationLine: isDone ? 'line-through' : 'none',
                  },
                ]}>
                {formatCurrency(item.amount)}
              </Text>
            )}

            <Pressable
              style={styles.deleteBtn}
              hitSlop={moderateScale(8)}
              onPress={() => handleDeleteWithUndo(item)}>
              <Trash size={moderateScale(15)} color={theme.textMuted} />
            </Pressable>
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
            <Text style={[styles.screenTitle, { color: theme.text }]}>Reminders & Tasks</Text>
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
        {/* Total Overview Card */}
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
          ]}>
          <View style={styles.summaryRowTop}>
            <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
              TASKS & REMINDERS DUE SOON
            </Text>
            {overdueList.length > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: 'rgba(244, 63, 94, 0.15)' }]}>
                <Warning size={moderateScale(12)} color="#F43F5E" weight="fill" />
                <Text style={styles.alertBadgeText}>{overdueList.length} Overdue</Text>
              </View>
            )}
          </View>

          <View style={styles.summaryCountRow}>
            <Text style={[styles.summaryCountText, { color: theme.text }]}>
              {overdueList.length + todayList.length + tomorrowList.length}
            </Text>
            <Text style={[styles.summaryCountUnit, { color: theme.textSecondary }]}>due soon</Text>
            {totalPendingAmount > 0 && (
              <Text style={[styles.summaryAmountText, { color: theme.primary }]}>
                • {formatCurrency(totalPendingAmount)}
              </Text>
            )}
          </View>

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
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Today</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#0EA5E9' }]}>{tomorrowList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Tomorrow</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#8B5CF6' }]}>{laterList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Later</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statVal, { color: '#10B981' }]}>{doneList.length}</Text>
              <Text style={[styles.statSub, { color: theme.textMuted }]}>Done</Text>
            </View>
          </View>
        </View>

        {/* Section Segmented Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsScrollContent}
          style={styles.tabsScroll}>
          {[
            { id: 'all', label: `All (${reminders.filter((r) => r.is_paid === 0).length})` },
            { id: 'overdue', label: `Overdue (${overdueList.length})` },
            { id: 'today', label: `Today (${todayList.length})` },
            { id: 'tomorrow', label: `Tomorrow (${tomorrowList.length})` },
            { id: 'later', label: `Later (${laterList.length})` },
            { id: 'done', label: `Done (${doneList.length})` },
          ].map((tab) => {
            const isSel = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={[
                  styles.filterTab,
                  {
                    backgroundColor: isSel ? theme.primary : isDark ? '#1C1F29' : '#F1F5F9',
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

        {/* Groups Display: Overdue, Today, Tomorrow, Later, Done */}
        {reminders.length === 0 ? (
          <View style={[styles.emptyContainer, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF' }]}>
            <Alarm size={moderateScale(48)} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Reminders</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Tap &quot;+ New&quot; or the centre &quot;+&quot; button to add a task, habit, or bill reminder.
            </Text>
          </View>
        ) : (
          <>
            {(activeTab === 'all' || activeTab === 'overdue') &&
              renderSection('🚨 Overdue', overdueList.length, overdueList, '#F43F5E')}

            {(activeTab === 'all' || activeTab === 'today') &&
              renderSection('⚡ Today', todayList.length, todayList, '#F59E0B')}

            {(activeTab === 'all' || activeTab === 'tomorrow') &&
              renderSection('🌅 Tomorrow', tomorrowList.length, tomorrowList, '#0EA5E9')}

            {(activeTab === 'all' || activeTab === 'later') &&
              renderSection('📅 Later', laterList.length, laterList, '#8B5CF6')}

            {(activeTab === 'all' || activeTab === 'done') &&
              renderSection('✅ Done', doneList.length, doneList, '#10B981')}
          </>
        )}
      </ScrollView>

      {/* Floating Undo Toast Banner */}
      {deletedReminder && (
        <View style={[styles.undoToast, { backgroundColor: isDark ? '#262A34' : '#0F172A' }]}>
          <Text style={styles.undoToastText}>Reminder deleted</Text>
          <Pressable style={styles.undoBtn} onPress={handleUndoDelete}>
            <ArrowCounterClockwise size={moderateScale(14)} color="#10B981" weight="bold" />
            <Text style={styles.undoBtnText}>UNDO</Text>
          </Pressable>
        </View>
      )}

      {/* Floating Action Feedback Toast */}
      {feedbackToast && !deletedReminder && (
        <View style={[styles.feedbackToast, { backgroundColor: isDark ? '#262A34' : '#0F172A' }]}>
          <CheckCircle size={moderateScale(16)} color="#10B981" weight="fill" />
          <Text style={styles.feedbackToastText}>{feedbackToast}</Text>
        </View>
      )}

      {/* Add Reminder Modal Sheet */}
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
                <Text style={[styles.sheetTitle, { color: theme.text }]}>Add Reminder</Text>
                <Text style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Type anything or pick a quick suggestion
                </Text>
              </View>
              <Pressable
                style={[styles.closeBtn, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
                onPress={() => setIsModalOpen(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: moderateScale(480) }}>
              {/* Quick Suggestions Chips */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>QUICK SUGGESTIONS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {QUICK_SUGGESTIONS.map((item) => (
                    <Pressable
                      key={item.title}
                      style={[
                        styles.quickSuggestionChip,
                        {
                          backgroundColor:
                            title === item.title
                              ? 'rgba(16, 185, 129, 0.2)'
                              : isDark
                              ? '#1C1F29'
                              : '#F1F5F9',
                          borderColor: title === item.title ? '#10B981' : 'transparent',
                        },
                      ]}
                      onPress={() => handleApplySuggestion(item)}>
                      <Text style={styles.quickSuggestionEmoji}>{item.emoji}</Text>
                      <Text
                        style={[
                          styles.quickSuggestionText,
                          {
                            color: title === item.title ? '#10B981' : theme.text,
                            fontWeight: title === item.title ? '700' : '500',
                          },
                        ]}>
                        {item.title}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Title Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>REMINDER / TASK TITLE</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: isDark ? '#1C1F29' : '#F8FAFC',
                      color: theme.text,
                      borderColor: theme.border,
                    },
                  ]}
                  placeholder="e.g. Drink water, Call mom, Rent bill"
                  placeholderTextColor={theme.textMuted}
                  value={title}
                  onChangeText={setTitle}
                  autoFocus
                />
              </View>

              {/* Date Presets */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>DATE</Text>
                <View style={styles.segmentRow}>
                  {[
                    { label: 'Today', offset: 0 },
                    { label: 'Tomorrow', offset: 1 },
                    { label: 'In 2 Days', offset: 2 },
                    { label: 'In 1 Week', offset: 7 },
                  ].map((d) => {
                    const isSel = selectedDateOffset === d.offset;
                    return (
                      <Pressable
                        key={d.label}
                        style={[
                          styles.segmentButton,
                          {
                            backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => setSelectedDateOffset(d.offset)}>
                        <Text
                          style={[
                            styles.segmentButtonText,
                            { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {d.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Time Picker (Interactive Hour, Minute, AM/PM) */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>TIME</Text>

                {/* Quick Time Presets */}
                <View style={[styles.segmentRow, { marginBottom: Spacing.sm }]}>
                  {[
                    { label: 'Morning (9 AM)', h: 9, m: 0, p: 'AM' as const },
                    { label: 'Noon (12 PM)', h: 12, m: 0, p: 'PM' as const },
                    { label: 'Evening (6 PM)', h: 6, m: 0, p: 'PM' as const },
                    { label: 'Night (9 PM)', h: 9, m: 0, p: 'PM' as const },
                  ].map((preset) => {
                    const isSel =
                      selectedHour === preset.h &&
                      selectedMinute === preset.m &&
                      selectedPeriod === preset.p;
                    return (
                      <Pressable
                        key={preset.label}
                        style={[
                          styles.timePresetChip,
                          {
                            backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => {
                          setSelectedHour(preset.h);
                          setSelectedMinute(preset.m);
                          setSelectedPeriod(preset.p);
                        }}>
                        <Text
                          style={[
                            styles.timePresetChipText,
                            { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Interactive Time Selector */}
                <View
                  style={[
                    styles.timePickerContainer,
                    { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC', borderColor: theme.border },
                  ]}>
                  {/* Hour Selector */}
                  <View style={styles.timeComponent}>
                    <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>HOUR</Text>
                    <View style={styles.timeValueControls}>
                      <Pressable
                        style={styles.timeArrowBtn}
                        onPress={() => setSelectedHour((prev) => (prev <= 1 ? 12 : prev - 1))}>
                        <CaretLeft size={moderateScale(16)} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.timeValText, { color: theme.text }]}>
                        {selectedHour < 10 ? `0${selectedHour}` : selectedHour}
                      </Text>
                      <Pressable
                        style={styles.timeArrowBtn}
                        onPress={() => setSelectedHour((prev) => (prev >= 12 ? 1 : prev + 1))}>
                        <CaretRight size={moderateScale(16)} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  <Text style={[styles.timeColon, { color: theme.text }]}>:</Text>

                  {/* Minute Selector */}
                  <View style={styles.timeComponent}>
                    <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>MIN</Text>
                    <View style={styles.timeValueControls}>
                      <Pressable
                        style={styles.timeArrowBtn}
                        onPress={() => setSelectedMinute((prev) => (prev === 0 ? 45 : prev - 15))}>
                        <CaretLeft size={moderateScale(16)} color={theme.text} />
                      </Pressable>
                      <Text style={[styles.timeValText, { color: theme.text }]}>
                        {selectedMinute < 10 ? `0${selectedMinute}` : selectedMinute}
                      </Text>
                      <Pressable
                        style={styles.timeArrowBtn}
                        onPress={() => setSelectedMinute((prev) => (prev === 45 ? 0 : prev + 15))}>
                        <CaretRight size={moderateScale(16)} color={theme.text} />
                      </Pressable>
                    </View>
                  </View>

                  {/* AM / PM Toggle */}
                  <View style={styles.ampmToggleWrap}>
                    <Pressable
                      style={[
                        styles.ampmBtn,
                        selectedPeriod === 'AM' && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setSelectedPeriod('AM')}>
                      <Text
                        style={[
                          styles.ampmText,
                          {
                            color: selectedPeriod === 'AM' ? '#003824' : theme.textSecondary,
                            fontWeight: selectedPeriod === 'AM' ? '800' : '600',
                          },
                        ]}>
                        AM
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.ampmBtn,
                        selectedPeriod === 'PM' && { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setSelectedPeriod('PM')}>
                      <Text
                        style={[
                          styles.ampmText,
                          {
                            color: selectedPeriod === 'PM' ? '#003824' : theme.textSecondary,
                            fontWeight: selectedPeriod === 'PM' ? '800' : '600',
                          },
                        ]}>
                        PM
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Repeat: Once, Every day, Every week */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>REPEAT</Text>
                <View style={styles.segmentRow}>
                  {[
                    { id: 'once' as const, label: 'Once' },
                    { id: 'daily' as const, label: 'Every day' },
                    { id: 'weekly' as const, label: 'Every week' },
                  ].map((r) => {
                    const isSel = frequency === r.id;
                    return (
                      <Pressable
                        key={r.id}
                        style={[
                          styles.segmentButton,
                          {
                            backgroundColor: isSel ? '#10B981' : isDark ? '#1C1F29' : '#F1F5F9',
                          },
                        ]}
                        onPress={() => setFrequency(r.id)}>
                        <Text
                          style={[
                            styles.segmentButtonText,
                            { color: isSel ? '#003824' : theme.text, fontWeight: isSel ? '700' : '500' },
                          ]}>
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Optional Amount */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>AMOUNT (OPTIONAL)</Text>
                <View style={[styles.currencyInputBox, { backgroundColor: isDark ? '#1C1F29' : '#F8FAFC' }]}>
                  <Text style={[styles.currencySymbol, { color: theme.text }]}>{currency.symbol}</Text>
                  <TextInput
                    style={[styles.amountTextInput, { color: theme.text }]}
                    placeholder="0.00"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
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

              {/* Optional Notes */}
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
                  placeholder="e.g. Bring water bottle, contract ID"
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
    paddingBottom: moderateScale(110),
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
  summaryCountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  summaryCountText: {
    fontSize: fontScale(30),
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  summaryCountUnit: {
    fontSize: fontScale(14),
    fontWeight: '600',
  },
  summaryAmountText: {
    fontSize: fontScale(14),
    fontWeight: '700',
    marginLeft: Spacing.xs,
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
  tickCircleBtn: {
    marginRight: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: {
    width: moderateScale(22),
    height: moderateScale(22),
    borderRadius: Radius.full,
    borderWidth: 2,
  },
  cardDetails: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  reminderTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  repeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  repeatBadgeText: {
    fontSize: fontScale(9),
    color: '#6366F1',
    fontWeight: '700',
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
  categoryTagText: {
    fontSize: fontScale(11),
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: Spacing.xs,
  },
  amountText: {
    fontSize: fontScale(14),
    fontWeight: '800',
  },
  deleteBtn: {
    padding: moderateScale(4),
  },
  notesText: {
    fontSize: fontScale(11),
    fontStyle: 'italic',
    marginTop: Spacing.xs,
    marginLeft: moderateScale(36),
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
  undoToast: {
    position: 'absolute',
    bottom: moderateScale(24),
    left: Spacing.lg,
    right: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: moderateScale(12),
    borderRadius: Radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  undoToastText: {
    color: '#FFFFFF',
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(4),
  },
  undoBtnText: {
    color: '#10B981',
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  feedbackToast: {
    position: 'absolute',
    bottom: moderateScale(24),
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: moderateScale(10),
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    elevation: 6,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  feedbackToastText: {
    color: '#FFFFFF',
    fontSize: fontScale(12),
    fontWeight: '700',
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
    maxHeight: '92%',
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
  chipScroll: {
    flexDirection: 'row',
  },
  quickSuggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(7),
    borderRadius: Radius.full,
    marginRight: Spacing.sm,
    borderWidth: 1.5,
  },
  quickSuggestionEmoji: {
    fontSize: fontScale(14),
  },
  quickSuggestionText: {
    fontSize: fontScale(12),
  },
  textInput: {
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    borderWidth: 1,
    fontSize: fontScale(14),
  },
  segmentRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(8),
    borderRadius: Radius.md,
  },
  segmentButtonText: {
    fontSize: fontScale(12),
  },
  timePresetChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(6),
    borderRadius: Radius.sm,
  },
  timePresetChipText: {
    fontSize: fontScale(10),
  },
  timePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  timeComponent: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: fontScale(9),
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  timeValueControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeArrowBtn: {
    padding: moderateScale(4),
  },
  timeValText: {
    fontSize: fontScale(20),
    fontWeight: '800',
    minWidth: moderateScale(30),
    textAlign: 'center',
  },
  timeColon: {
    fontSize: fontScale(22),
    fontWeight: '800',
    paddingTop: moderateScale(14),
  },
  ampmToggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
    marginLeft: Spacing.xs,
  },
  ampmBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(6),
  },
  ampmText: {
    fontSize: fontScale(11),
  },
  currencyInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  currencySymbol: {
    fontSize: fontScale(18),
    fontWeight: '700',
    marginRight: Spacing.sm,
  },
  amountTextInput: {
    flex: 1,
    fontSize: fontScale(18),
    fontWeight: '700',
    paddingVertical: moderateScale(6),
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
