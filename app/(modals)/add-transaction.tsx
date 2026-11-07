import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Image as ImageIcon,
  Trash,
} from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/constants/categories';
import { Colors } from '@/constants/colors';
import { addTransaction, getWallets, Wallet } from '@/db/queries';
import { saveReceiptLocally } from '@/utils/fileStorage';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AddTransactionModal() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? Colors.dark : Colors.light;

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(EXPENSE_CATEGORIES[0]?.id || '');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth());
  const [receiptLocalUri, setReceiptLocalUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        const loadedWallets = await getWallets(db);
        setWallets(loadedWallets);
        if (loadedWallets.length > 0) {
          setSelectedWalletId(loadedWallets[0].id);
        }
      } catch (err) {
        console.error('Failed to load wallets for transaction modal:', err);
      }
    }
    init();
  }, [db]);

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    const newCategories = newType === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    setSelectedCategory(newCategories[0]?.id || '');
  };

  const handlePickReceipt = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Expico needs access to your photos to attach receipts.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const savedPath = await saveReceiptLocally(result.assets[0].uri);
        setReceiptLocalUri(savedPath);
      } catch (err) {
        console.error('Failed to store receipt locally:', err);
        Alert.alert('Error', 'Failed to store receipt image locally');
      }
    }
  };

  const handleDateSelect = (day: number) => {
    const newDate = new Date(pickerYear, pickerMonth, day);
    setSelectedDate(newDate);
    setShowDatePicker(false);
  };

  const changeMonth = (direction: number) => {
    let newMonth = pickerMonth + direction;
    let newYear = pickerYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setPickerMonth(newMonth);
    setPickerYear(newYear);
  };

  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive transaction amount.');
      return;
    }

    if (!selectedWalletId) {
      Alert.alert('Missing Wallet', 'Please create or select a wallet first.');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('Missing Category', 'Please select a transaction category.');
      return;
    }

    setIsSubmitting(true);
    try {
      const id = generateUUID();
      await addTransaction(db, {
        id,
        wallet_id: selectedWalletId,
        type,
        amount: parsedAmount,
        category: selectedCategory,
        description: description.trim() || null,
        receipt_path: receiptLocalUri,
        date: selectedDate.getTime(),
      });
      router.back();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      Alert.alert('Error', 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return 'Today';
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear()
    ) {
      return 'Yesterday';
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* 1. Segmented Control / Toggle */}
      <View style={[styles.toggleWrap, { backgroundColor: theme.surfaceVariant }]}>
        <Pressable
          style={[
            styles.toggleBtn,
            type === 'expense' && { backgroundColor: theme.expense },
          ]}
          onPress={() => handleTypeChange('expense')}>
          <Text
            style={[
              styles.toggleText,
              { color: type === 'expense' ? '#FFFFFF' : theme.textSecondary },
            ]}>
            Expense
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.toggleBtn,
            type === 'income' && { backgroundColor: theme.income },
          ]}
          onPress={() => handleTypeChange('income')}>
          <Text
            style={[
              styles.toggleText,
              { color: type === 'income' ? '#FFFFFF' : theme.textSecondary },
            ]}>
            Income
          </Text>
        </Pressable>
      </View>

      {/* 2. Amount Input with Currency Symbol */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Amount</Text>
        <View style={styles.amountInputRow}>
          <Text
            style={[
              styles.currencyPrefix,
              { color: type === 'income' ? theme.income : theme.expense },
            ]}>
            ₹
          </Text>
          <TextInput
            style={[styles.amountInput, { color: theme.text }]}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            autoFocus
          />
        </View>
      </View>

      {/* 3. Wallet Selector */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Select Wallet</Text>
          {wallets.length === 0 ? (
            <Pressable onPress={() => router.push('/add-wallet')}>
              <Text style={[styles.createWalletLink, { color: theme.primary }]}>+ Add Wallet</Text>
            </Pressable>
          ) : null}
        </View>

        {wallets.length === 0 ? (
          <Text style={[styles.noWalletText, { color: theme.expense }]}>
            No wallets found. Please add a wallet before creating transactions.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScrollContent}>
            {wallets.map((w) => {
              const selected = w.id === selectedWalletId;
              return (
                <Pressable
                  key={w.id}
                  style={[
                    styles.walletChip,
                    {
                      backgroundColor: selected ? theme.primary : theme.surfaceVariant,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}>
                  <Text
                    style={[
                      styles.walletChipText,
                      { color: selected ? '#FFFFFF' : theme.text },
                    ]}>
                    {w.name}
                  </Text>
                  <Text
                    style={[
                      styles.walletChipSub,
                      { color: selected ? 'rgba(255,255,255,0.85)' : theme.textMuted },
                    ]}>
                    ₹{w.current_balance.toFixed(2)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 4. Category Selector */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Category</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => {
            const selected = cat.id === selectedCategory;
            return (
              <Pressable
                key={cat.id}
                style={[
                  styles.catItem,
                  {
                    borderColor: selected ? theme.primary : theme.border,
                    backgroundColor: selected ? theme.primaryLight : theme.surfaceVariant,
                  },
                ]}
                onPress={() => setSelectedCategory(cat.id)}>
                <View style={[styles.catIconCircle, { backgroundColor: cat.color }]}>
                  <Text style={styles.catInitial}>{cat.name.charAt(0)}</Text>
                </View>
                <Text
                  style={[
                    styles.catName,
                    { color: selected ? theme.primary : theme.text },
                  ]}
                  numberOfLines={1}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 5. Date Picker */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Transaction Date</Text>
        <View style={styles.dateRow}>
          <Pressable
            style={[
              styles.dateQuickBtn,
              isToday(selectedDate)
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
            ]}
            onPress={() => setSelectedDate(new Date())}>
            <Text
              style={[
                styles.dateQuickText,
                { color: isToday(selectedDate) ? '#FFFFFF' : theme.text },
              ]}>
              Today
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.dateChangeBtn,
              { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
            ]}
            onPress={() => {
              setPickerYear(selectedDate.getFullYear());
              setPickerMonth(selectedDate.getMonth());
              setShowDatePicker(true);
            }}>
            <CalendarBlank size={moderateScale(18)} color={theme.primary} />
            <Text style={[styles.dateChangeText, { color: theme.text }]}>
              {formatDateDisplay(selectedDate)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 6. Note / Description Input */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Note / Description</Text>
        <TextInput
          style={[styles.noteInput, { color: theme.text }]}
          placeholder="e.g., Grocery shopping, weekly dinner"
          placeholderTextColor={theme.textMuted}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* 7. Receipt Attachment */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>Receipt Attachment</Text>
        {receiptLocalUri ? (
          <View style={styles.receiptPreviewWrap}>
            <Image source={{ uri: receiptLocalUri }} style={styles.receiptThumbnail} />
            <Pressable
              style={[styles.removeReceiptBtn, { backgroundColor: theme.expense }]}
              onPress={() => setReceiptLocalUri(null)}>
              <Trash size={moderateScale(16)} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.pickReceiptBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
            onPress={handlePickReceipt}>
            <ImageIcon size={moderateScale(20)} color={theme.primary} />
            <Text style={[styles.pickReceiptText, { color: theme.text }]}>Attach Receipt Image</Text>
          </Pressable>
        )}
      </View>

      {/* Submit Button */}
      <Pressable
        style={[
          styles.submitButton,
          { backgroundColor: theme.primary },
          isSubmitting && { opacity: 0.7 },
        ]}
        disabled={isSubmitting}
        onPress={handleSubmit}>
        <Check size={moderateScale(20)} color="#FFFFFF" weight="bold" />
        <Text style={styles.submitText}>Save Transaction</Text>
      </Pressable>

      {/* Custom Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable
            style={[styles.calendarModalContent, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => changeMonth(-1)} hitSlop={12}>
                <CaretLeft size={moderateScale(20)} color={theme.text} />
              </Pressable>
              <Text style={[styles.calendarMonthText, { color: theme.text }]}>
                {monthNames[pickerMonth]} {pickerYear}
              </Text>
              <Pressable onPress={() => changeMonth(1)} hitSlop={12}>
                <CaretRight size={moderateScale(20)} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const isSelected =
                  selectedDate.getDate() === day &&
                  selectedDate.getMonth() === pickerMonth &&
                  selectedDate.getFullYear() === pickerYear;

                return (
                  <Pressable
                    key={day}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleDateSelect(day)}>
                    <Text
                      style={[
                        styles.dayCellText,
                        { color: isSelected ? '#FFFFFF' : theme.text },
                      ]}>
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              style={[styles.calendarCloseBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => setShowDatePicker(false)}>
              <Text style={[styles.calendarCloseText, { color: theme.text }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(4),
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: moderateScale(10),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  toggleText: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  card: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  label: {
    fontSize: fontScale(12),
    fontWeight: '600',
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  currencyPrefix: {
    fontSize: fontScale(32),
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    fontSize: fontScale(32),
    fontWeight: '800',
    paddingVertical: Spacing.xs,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  createWalletLink: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  noWalletText: {
    fontSize: fontScale(13),
    marginTop: Spacing.xs,
  },
  chipScrollContent: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  walletChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: moderateScale(110),
  },
  walletChipText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  walletChipSub: {
    fontSize: fontScale(11),
    marginTop: moderateScale(2),
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  catItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  catIconCircle: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: fontScale(11),
  },
  catName: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  dateQuickBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateQuickText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  dateChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  dateChangeText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  noteInput: {
    fontSize: fontScale(14),
    paddingVertical: Spacing.xs,
  },
  receiptPreviewWrap: {
    position: 'relative',
    marginTop: Spacing.xs,
    alignSelf: 'flex-start',
  },
  receiptThumbnail: {
    width: moderateScale(140),
    height: moderateScale(140),
    borderRadius: Radius.md,
  },
  removeReceiptBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.full,
  },
  pickReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  pickReceiptText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: moderateScale(14),
    borderRadius: Radius.md,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  calendarModalContent: {
    width: '100%',
    maxWidth: moderateScale(340),
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  calendarMonthText: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(6),
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  dayCell: {
    width: moderateScale(38),
    height: moderateScale(38),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCellText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  calendarCloseBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  calendarCloseText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
});
