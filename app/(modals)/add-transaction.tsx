import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Image as ImageIcon,
  Plus,
  Tag,
  Trash,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useState } from 'react';
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

import { CategoryIcon } from '@/components/CategoryIcon';
import {
  AVAILABLE_CATEGORY_COLORS,
  AVAILABLE_CATEGORY_ICONS,
  Category,
  registerCategories,
} from '@/constants/categories';
import { Colors } from '@/constants/colors';
import {
  addTransaction,
  createCategory,
  deleteCategory,
  getCategories,
  getWallets,
  Wallet,
} from '@/db/queries';
import { saveReceiptLocally } from '@/utils/fileStorage';
import { formatCurrency, formatDisplayDate, generateUUID } from '@/utils/formatters';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function AddTransactionModal() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [selectedWalletId, setSelectedWalletId] = useState<string>('');

  // Dynamic user-defined categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Add Category Modal state
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'expense' | 'income'>('expense');
  const [newCatIcon, setNewCatIcon] = useState('ForkKnife');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Date and receipt state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth());
  const [receiptLocalUri, setReceiptLocalUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load custom categories for the current type
  const loadCategories = useCallback(
    async (currentType: 'expense' | 'income') => {
      try {
        const loaded = await getCategories(db, currentType);
        setCategories(loaded);
        registerCategories(loaded);
        setSelectedCategory((prev) => {
          if (loaded.some((c) => c.id === prev)) return prev;
          return loaded.length > 0 ? loaded[0].id : '';
        });
      } catch (err) {
        console.error('Failed to load categories for transaction modal:', err);
      }
    },
    [db]
  );

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

  useEffect(() => {
    let ignore = false;
    async function fetchCategories() {
      try {
        const loaded = await getCategories(db, type);
        if (!ignore) {
          setCategories(loaded);
          registerCategories(loaded);
          setSelectedCategory((prev) => {
            if (loaded.some((c) => c.id === prev)) return prev;
            return loaded.length > 0 ? loaded[0].id : '';
          });
        }
      } catch (err) {
        console.error('Failed to load categories for transaction modal:', err);
      }
    }
    fetchCategories();
    return () => {
      ignore = true;
    };
  }, [db, type]);

  const handleTypeChange = (newType: 'expense' | 'income') => {
    setType(newType);
    loadCategories(newType);
  };

  const handleOpenAddCategory = () => {
    setNewCatName('');
    setNewCatType(type);
    setNewCatIcon(type === 'expense' ? 'ForkKnife' : 'Coins');
    setNewCatColor(type === 'expense' ? '#F43F5E' : '#10B981');
    setShowAddCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) {
      Alert.alert('Category Name Required', 'Please enter a name for your category.');
      return;
    }

    setIsSavingCategory(true);
    try {
      const id = `cat_${Date.now()}`;
      await createCategory(db, {
        id,
        name: trimmed,
        icon: newCatIcon,
        color: newCatColor,
        type: newCatType,
      });

      if (newCatType === type) {
        await loadCategories(type);
        setSelectedCategory(id);
      } else {
        setType(newCatType);
        await loadCategories(newCatType);
        setSelectedCategory(id);
      }

      setShowAddCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category:', err);
      Alert.alert('Error', 'Failed to save category');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handlePromptDeleteCategory = (cat: Category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to remove the "${cat.name}" category?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategory(db, cat.id);
              await loadCategories(type);
            } catch (err) {
              console.error('Failed to delete category:', err);
              Alert.alert('Error', 'Could not delete category');
            }
          },
        },
      ]
    );
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
    setSelectedDate(new Date(pickerYear, pickerMonth, day));
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
      Alert.alert(
        'Missing Category',
        `Please add or select an ${type} category before recording this transaction.`
      );
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
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      {/* 1. Type Switcher */}
      <View style={[styles.toggleWrap, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}>
        <Pressable
          style={[styles.toggleBtn, type === 'expense' && { backgroundColor: '#F43F5E' }]}
          onPress={() => handleTypeChange('expense')}>
          <Text style={[styles.toggleText, { color: type === 'expense' ? '#FFFFFF' : theme.textSecondary }]}>
            Expense
          </Text>
        </Pressable>

        <Pressable
          style={[styles.toggleBtn, type === 'income' && { backgroundColor: '#10B981' }]}
          onPress={() => handleTypeChange('income')}>
          <Text style={[styles.toggleText, { color: type === 'income' ? '#003824' : theme.textSecondary }]}>
            Income
          </Text>
        </Pressable>
      </View>

      {/* 2. Amount Input */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>AMOUNT</Text>
        <View style={styles.amountInputRow}>
          <Text style={[styles.currencyPrefix, { color: type === 'income' ? '#10B981' : '#F43F5E' }]}>
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
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>SELECT WALLET</Text>
          {wallets.length === 0 ? (
            <Pressable onPress={() => router.push('/(modals)/add-wallet')}>
              <Text style={[styles.createWalletLink, { color: theme.primary }]}>+ Add Wallet</Text>
            </Pressable>
          ) : null}
        </View>

        {wallets.length === 0 ? (
          <Text style={[styles.noWalletText, { color: '#F43F5E' }]}>
            No wallets found. Please create a wallet before recording transactions.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollContent}>
            {wallets.map((w) => {
              const selected = w.id === selectedWalletId;
              return (
                <Pressable
                  key={w.id}
                  style={[
                    styles.walletChip,
                    {
                      backgroundColor: selected ? (isDark ? '#262A34' : '#E2E8F0') : (isDark ? '#181B25' : '#F8FAFC'),
                      borderColor: selected ? theme.primary : theme.border,
                      borderWidth: selected ? 1.5 : 1,
                    },
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}>
                  <Text style={[styles.walletChipText, { color: theme.text }]}>
                    {w.name}
                  </Text>
                  <Text style={[styles.walletChipSub, { color: selected ? theme.primary : theme.textMuted }]}>
                    {formatCurrency(w.current_balance)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 4. Category Grid (User Custom Categories) */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            CATEGORY ({type.toUpperCase()})
          </Text>
          <Pressable style={styles.addCategoryHeaderBtn} onPress={handleOpenAddCategory}>
            <Plus size={moderateScale(14)} color={theme.primary} weight="bold" />
            <Text style={[styles.createWalletLink, { color: theme.primary }]}>Add Category</Text>
          </Pressable>
        </View>

        {categories.length === 0 ? (
          <View
            style={[
              styles.emptyCategoryCard,
              { backgroundColor: isDark ? '#181B25' : '#F8FAFC', borderColor: theme.border },
            ]}>
            <View style={[styles.emptyCatIconCircle, { backgroundColor: isDark ? '#262A34' : '#E2E8F0' }]}>
              <Tag size={moderateScale(24)} color={theme.textMuted} weight="bold" />
            </View>
            <Text style={[styles.emptyCatTitle, { color: theme.text }]}>
              No {type} categories yet
            </Text>
            <Text style={[styles.emptyCatSub, { color: theme.textMuted }]}>
              Add custom {type} categories to classify and organize your transactions.
            </Text>
            <Pressable
              style={[
                styles.addCatPrimaryBtn,
                { backgroundColor: type === 'expense' ? '#F43F5E' : '#10B981' },
              ]}
              onPress={handleOpenAddCategory}>
              <Plus
                size={moderateScale(16)}
                color={type === 'expense' ? '#FFFFFF' : '#003824'}
                weight="bold"
              />
              <Text
                style={[
                  styles.addCatPrimaryBtnText,
                  { color: type === 'expense' ? '#FFFFFF' : '#003824' },
                ]}>
                + Add {type === 'expense' ? 'Expense' : 'Income'} Category
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const selected = cat.id === selectedCategory;
              return (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.catItem,
                    {
                      borderColor: selected ? (type === 'income' ? '#10B981' : theme.primary) : theme.border,
                      borderWidth: selected ? 1.5 : 1,
                      backgroundColor: selected ? (isDark ? '#262A34' : '#EDE9FE') : (isDark ? '#181B25' : '#F8FAFC'),
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  onLongPress={() => handlePromptDeleteCategory(cat)}>
                  <View style={[styles.catIconCircle, { backgroundColor: cat.color + '22' }]}>
                    <CategoryIcon name={cat.icon} color={cat.color} size={moderateScale(16)} />
                  </View>
                  <Text
                    style={[
                      styles.catName,
                      {
                        color: selected ? (type === 'income' ? '#10B981' : theme.primary) : theme.text,
                        fontWeight: selected ? '700' : '600',
                      },
                    ]}
                    numberOfLines={1}>
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}

            {/* Quick Add Button Tile inside Grid */}
            <Pressable
              style={[
                styles.catItem,
                styles.addCatTile,
                {
                  borderColor: theme.border,
                  borderStyle: 'dashed',
                  backgroundColor: isDark ? '#181B25' : '#F8FAFC',
                },
              ]}
              onPress={handleOpenAddCategory}>
              <View style={[styles.catIconCircle, { backgroundColor: isDark ? '#262A34' : '#E2E8F0' }]}>
                <Plus size={moderateScale(14)} color={theme.primary} weight="bold" />
              </View>
              <Text style={[styles.catName, { color: theme.primary, fontWeight: '700' }]}>+ Add</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 5. Date Picker */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>TRANSACTION DATE</Text>
        <View style={styles.dateRow}>
          <Pressable
            style={[
              styles.dateQuickBtn,
              isToday(selectedDate)
                ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                : { backgroundColor: isDark ? '#181B25' : '#F1F5F9', borderColor: theme.border },
            ]}
            onPress={() => setSelectedDate(new Date())}>
            <Text style={[styles.dateQuickText, { color: isToday(selectedDate) ? '#003824' : theme.text }]}>
              Today
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.dateChangeBtn,
              { backgroundColor: isDark ? '#181B25' : '#F1F5F9', borderColor: theme.border },
            ]}
            onPress={() => {
              setPickerYear(selectedDate.getFullYear());
              setPickerMonth(selectedDate.getMonth());
              setShowDatePicker(true);
            }}>
            <CalendarBlank size={moderateScale(18)} color="#10B981" weight="bold" />
            <Text style={[styles.dateChangeText, { color: theme.text }]}>
              {formatDisplayDate(selectedDate)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 6. Note / Description */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>NOTE / DESCRIPTION</Text>
        <TextInput
          style={[styles.noteInput, { color: theme.text }]}
          placeholder="e.g. Grocery run, team lunch, freelance payout"
          placeholderTextColor={theme.textMuted}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* 7. Receipt Attachment */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>RECEIPT ATTACHMENT</Text>
        {receiptLocalUri ? (
          <View style={styles.receiptPreviewWrap}>
            <Image source={{ uri: receiptLocalUri }} style={styles.receiptThumbnail} />
            <Pressable
              style={[styles.removeReceiptBtn, { backgroundColor: '#F43F5E' }]}
              onPress={() => setReceiptLocalUri(null)}>
              <Trash size={moderateScale(16)} color="#FFFFFF" weight="bold" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.pickReceiptBtn, { backgroundColor: isDark ? '#181B25' : '#F8FAFC', borderColor: theme.border }]}
            onPress={handlePickReceipt}>
            <ImageIcon size={moderateScale(20)} color="#10B981" weight="bold" />
            <Text style={[styles.pickReceiptText, { color: theme.text }]}>Attach Receipt Image</Text>
          </Pressable>
        )}
      </View>

      {/* Submit Action */}
      <Pressable
        style={[styles.submitButton, { backgroundColor: '#10B981' }, isSubmitting && { opacity: 0.6 }]}
        disabled={isSubmitting}
        onPress={handleSubmit}>
        <Check size={moderateScale(20)} color="#003824" weight="bold" />
        <Text style={styles.submitText}>Save Transaction</Text>
      </Pressable>

      {/* ADD CATEGORY MODAL */}
      <Modal
        visible={showAddCategoryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddCategoryModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddCategoryModal(false)}>
          <Pressable
            style={[
              styles.addCatModalContent,
              { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.addCatHeader}>
              <View>
                <Text style={[styles.addCatTitle, { color: theme.text }]}>Add New Category</Text>
                <Text style={[styles.addCatSubtitle, { color: theme.textSecondary }]}>
                  Create your custom category
                </Text>
              </View>
              <Pressable
                style={[styles.closeIconBtn, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}
                onPress={() => setShowAddCategoryModal(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            {/* Type Switcher inside modal */}
            <View style={[styles.modalToggleWrap, { backgroundColor: isDark ? '#181B25' : '#F1F5F9' }]}>
              <Pressable
                style={[styles.modalToggleBtn, newCatType === 'expense' && { backgroundColor: '#F43F5E' }]}
                onPress={() => setNewCatType('expense')}>
                <Text
                  style={[
                    styles.modalToggleText,
                    { color: newCatType === 'expense' ? '#FFFFFF' : theme.textSecondary },
                  ]}>
                  Expense Category
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalToggleBtn, newCatType === 'income' && { backgroundColor: '#10B981' }]}
                onPress={() => setNewCatType('income')}>
                <Text
                  style={[
                    styles.modalToggleText,
                    { color: newCatType === 'income' ? '#003824' : theme.textSecondary },
                  ]}>
                  Income Category
                </Text>
              </Pressable>
            </View>

            {/* Category Name Input */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>CATEGORY NAME</Text>
              <TextInput
                style={[
                  styles.catTextInput,
                  {
                    color: theme.text,
                    backgroundColor: isDark ? '#181B25' : '#F8FAFC',
                    borderColor: theme.border,
                  },
                ]}
                placeholder={newCatType === 'expense' ? 'e.g. Groceries, Gym, Coffee' : 'e.g. Salary, Side Gig, Dividend'}
                placeholderTextColor={theme.textMuted}
                value={newCatName}
                onChangeText={setNewCatName}
                autoFocus
              />
            </View>

            {/* Icon Picker */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SELECT ICON</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.iconScrollRow}>
                {AVAILABLE_CATEGORY_ICONS.map((item) => {
                  const isSelected = newCatIcon === item.name;
                  return (
                    <Pressable
                      key={item.name}
                      style={[
                        styles.iconOptionBtn,
                        {
                          backgroundColor: isSelected
                            ? newCatColor + '25'
                            : isDark
                            ? '#181B25'
                            : '#F8FAFC',
                          borderColor: isSelected ? newCatColor : theme.border,
                          borderWidth: isSelected ? 2 : 1,
                        },
                      ]}
                      onPress={() => setNewCatIcon(item.name)}>
                      <CategoryIcon
                        name={item.name}
                        color={isSelected ? newCatColor : theme.textSecondary}
                        size={moderateScale(20)}
                      />
                      <Text
                        style={[
                          styles.iconOptionLabel,
                          { color: isSelected ? theme.text : theme.textMuted },
                        ]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Color Picker */}
            <View style={styles.fieldWrap}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>SELECT COLOR</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorScrollRow}>
                {AVAILABLE_CATEGORY_COLORS.map((hex) => {
                  const isSelected = newCatColor === hex;
                  return (
                    <Pressable
                      key={hex}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: hex },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setNewCatColor(hex)}>
                      {isSelected ? (
                        <Check size={moderateScale(14)} color="#FFFFFF" weight="bold" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Preview Chip */}
            <View
              style={[
                styles.previewWrap,
                { backgroundColor: isDark ? '#181B25' : '#F8FAFC', borderColor: theme.border },
              ]}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>PREVIEW</Text>
              <View style={styles.previewCardRow}>
                <View style={[styles.catIconCircle, { backgroundColor: newCatColor + '25' }]}>
                  <CategoryIcon name={newCatIcon} color={newCatColor} size={moderateScale(18)} />
                </View>
                <Text style={[styles.previewName, { color: theme.text }]}>
                  {newCatName.trim() || 'Category Name'}
                </Text>
                <View style={[styles.previewBadge, { backgroundColor: newCatColor + '20' }]}>
                  <Text style={[styles.previewBadgeText, { color: newCatColor }]}>
                    {newCatType.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Save Category Button */}
            <Pressable
              style={[
                styles.saveCategoryBtn,
                { backgroundColor: newCatType === 'expense' ? '#F43F5E' : '#10B981' },
                isSavingCategory && { opacity: 0.6 },
              ]}
              disabled={isSavingCategory}
              onPress={handleSaveCategory}>
              <Check
                size={moderateScale(18)}
                color={newCatType === 'expense' ? '#FFFFFF' : '#003824'}
                weight="bold"
              />
              <Text
                style={[
                  styles.saveCategoryBtnText,
                  { color: newCatType === 'expense' ? '#FFFFFF' : '#003824' },
                ]}>
                Save Category
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable
            style={[styles.calendarModalContent, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.calendarHeader}>
              <Pressable onPress={() => changeMonth(-1)} hitSlop={12}>
                <CaretLeft size={moderateScale(20)} color={theme.text} weight="bold" />
              </Pressable>
              <Text style={[styles.calendarMonthText, { color: theme.text }]}>
                {MONTH_NAMES[pickerMonth]} {pickerYear}
              </Text>
              <Pressable onPress={() => changeMonth(1)} hitSlop={12}>
                <CaretRight size={moderateScale(20)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            <View style={styles.daysGrid}>
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const isSelected =
                  selectedDate.getDate() === d &&
                  selectedDate.getMonth() === pickerMonth &&
                  selectedDate.getFullYear() === pickerYear;

                return (
                  <Pressable
                    key={d}
                    style={[styles.calendarDayBtn, isSelected && { backgroundColor: '#10B981' }]}
                    onPress={() => handleDateSelect(d)}>
                    <Text
                      style={[
                        styles.calendarDayText,
                        { color: isSelected ? '#003824' : theme.text, fontWeight: isSelected ? '800' : '600' },
                      ]}>
                      {d}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  toggleText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  card: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
  },
  label: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencyPrefix: {
    fontSize: fontScale(30),
    fontWeight: '800',
    marginRight: Spacing.xs,
  },
  amountInput: {
    fontSize: fontScale(32),
    fontWeight: '800',
    flex: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  addCategoryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  createWalletLink: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  noWalletText: {
    fontSize: fontScale(12),
    marginTop: Spacing.xs,
  },
  chipScrollContent: {
    gap: Spacing.sm,
    paddingVertical: moderateScale(2),
  },
  walletChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    minWidth: moderateScale(100),
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
    gap: Spacing.xs,
  },
  catItem: {
    width: '31.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.xs,
    borderRadius: Radius.md,
  },
  addCatTile: {
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  catIconCircle: {
    width: moderateScale(28),
    height: moderateScale(28),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: fontScale(11),
    flex: 1,
  },
  emptyCategoryCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  emptyCatIconCircle: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyCatTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
    marginBottom: moderateScale(2),
  },
  emptyCatSub: {
    fontSize: fontScale(11),
    textAlign: 'center',
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  addCatPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(6),
    paddingVertical: moderateScale(8),
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.full,
  },
  addCatPrimaryBtnText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateQuickBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  dateQuickText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  dateChangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  dateChangeText: {
    fontSize: fontScale(12),
    fontWeight: '600',
  },
  noteInput: {
    fontSize: fontScale(13),
    paddingVertical: Spacing.xs,
  },
  receiptPreviewWrap: {
    position: 'relative',
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  receiptThumbnail: {
    width: '100%',
    height: '100%',
  },
  removeReceiptBtn: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pickReceiptText: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(14),
    borderRadius: Radius.xl,
    marginTop: Spacing.xs,
  },
  submitText: {
    color: '#003824',
    fontSize: fontScale(16),
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  calendarModalContent: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
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
  },
  calendarDayBtn: {
    width: `${100 / 7 - 2}%`,
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayText: {
    fontSize: fontScale(12),
  },

  /* Add Category Modal Styles */
  addCatModalContent: {
    width: '100%',
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    maxHeight: '90%',
  },
  addCatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addCatTitle: {
    fontSize: fontScale(17),
    fontWeight: '800',
  },
  addCatSubtitle: {
    fontSize: fontScale(11),
    marginTop: moderateScale(2),
  },
  closeIconBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalToggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(3),
    marginTop: Spacing.xs,
  },
  modalToggleBtn: {
    flex: 1,
    paddingVertical: moderateScale(7),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  modalToggleText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  fieldWrap: {
    gap: moderateScale(4),
  },
  inputLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  catTextInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    fontSize: fontScale(14),
  },
  iconScrollRow: {
    gap: Spacing.xs,
    paddingVertical: moderateScale(4),
  },
  iconOptionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(8),
    borderRadius: Radius.lg,
    minWidth: moderateScale(56),
    gap: moderateScale(4),
  },
  iconOptionLabel: {
    fontSize: fontScale(9),
    fontWeight: '600',
  },
  colorScrollRow: {
    gap: Spacing.xs,
    paddingVertical: moderateScale(4),
  },
  colorCircle: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
  previewWrap: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    gap: moderateScale(4),
  },
  previewLabel: {
    fontSize: fontScale(9),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  previewCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewName: {
    fontSize: fontScale(13),
    fontWeight: '700',
    flex: 1,
  },
  previewBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  previewBadgeText: {
    fontSize: fontScale(9),
    fontWeight: '800',
  },
  saveCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
    paddingVertical: moderateScale(12),
    borderRadius: Radius.xl,
    marginTop: Spacing.xs,
  },
  saveCategoryBtnText: {
    fontSize: fontScale(14),
    fontWeight: '800',
  },
});
