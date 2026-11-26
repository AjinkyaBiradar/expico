import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Check,
  Palette,
  Plus,
  Sparkle,
  Tag,
  Wallet as WalletIcon,
  X,
} from 'phosphor-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  getDistinctFoodMeta,
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
import { formatCurrency, formatDisplayDate, generateUUID } from '@/utils/formatters';
import { useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUICK_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

export default function AddTransactionModal() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;
  const { currency } = useSettings();

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
  const [customHex, setCustomHex] = useState('10B981');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Date state
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState<number>(new Date().getMonth());
  const [isSubmitting, setIsSubmitting] = useState(false);

  const accentColor = type === 'expense' ? '#F43F5E' : '#10B981';

  // Track colors already assigned to existing categories to prevent duplicates
  const usedCategoryColors = useMemo(() => {
    return new Set(categories.map((c) => c.color.toLowerCase()));
  }, [categories]);

  // Filter palette to omit already chosen colors, but keep the current category color
  const availablePaletteColors = useMemo(() => {
    const available = AVAILABLE_CATEGORY_COLORS.filter(
      (color) => !usedCategoryColors.has(color.toLowerCase()) || color.toLowerCase() === newCatColor.toLowerCase()
    );
    return available.length > 0 ? available : AVAILABLE_CATEGORY_COLORS;
  }, [usedCategoryColors, newCatColor]);

  // Load custom categories for current type
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
    // Pick an unused color from palette
    const defaultCol = type === 'expense' ? '#F43F5E' : '#10B981';
    const firstUnused = AVAILABLE_CATEGORY_COLORS.find(
      (c) => !usedCategoryColors.has(c.toLowerCase())
    ) || defaultCol;
    setNewCatColor(firstUnused);
    setCustomHex(firstUnused.replace('#', ''));
    setShowAddCategoryModal(true);
  };

  const handleCatNameChange = (text: string) => {
    setNewCatName(text);
    const match = getDistinctFoodMeta(text);
    if (match) {
      setNewCatIcon(match.icon);
      setNewCatColor(match.color);
      setCustomHex(match.color.replace('#', ''));
    }
  };

  const handleCustomHexInput = (text: string) => {
    const cleaned = text.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
    setCustomHex(cleaned);
    if (cleaned.length === 6 || cleaned.length === 3) {
      setNewCatColor(`#${cleaned}`);
    }
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
      '🤖 Smart Category Assistant',
      `Are you sure you want to remove the "${cat.name}" category? Existing transactions will retain their historical logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Category',
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

  const handleQuickAdd = (increment: number) => {
    const cur = parseFloat(amount) || 0;
    setAmount((cur + increment).toString());
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
      Alert.alert('Invalid Amount', `Please enter a valid amount greater than ${currency.symbol}0.`);
      return;
    }

    if (!selectedWalletId) {
      Alert.alert('Missing Wallet', 'Please create or select an account wallet first.');
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
        receipt_path: null,
        date: selectedDate.getTime(),
      });
      router.back();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      Alert.alert('Error', 'Failed to save transaction. Please try again.');
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
      {/* Modal Top Header */}
      <View style={styles.topHeaderBar}>
        <View style={styles.headerLeft}>
          <View style={[styles.headerIconGlow, { backgroundColor: `${accentColor}20` }]}>
            <Sparkle size={moderateScale(18)} color={accentColor} weight="fill" />
          </View>
          <View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>New Transaction</Text>
            <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Record a verified ledger entry
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.headerCloseBtn, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}
          onPress={() => router.back()}
          hitSlop={8}>
          <X size={moderateScale(18)} color={theme.text} weight="bold" />
        </Pressable>
      </View>

      {/* 1. Type Switcher with Smooth Visual Style */}
      <View style={[styles.toggleWrap, { backgroundColor: isDark ? '#181B25' : '#E2E8F0', borderColor: theme.border }]}>
        <Pressable
          style={[
            styles.toggleBtn,
            type === 'expense' && [styles.toggleBtnActive, { backgroundColor: '#F43F5E' }],
          ]}
          onPress={() => handleTypeChange('expense')}>
          <Text
            style={[
              styles.toggleText,
              { color: type === 'expense' ? '#FFFFFF' : theme.textSecondary, fontWeight: type === 'expense' ? '800' : '600' },
            ]}>
            Expense
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.toggleBtn,
            type === 'income' && [styles.toggleBtnActive, { backgroundColor: '#10B981' }],
          ]}
          onPress={() => handleTypeChange('income')}>
          <Text
            style={[
              styles.toggleText,
              { color: type === 'income' ? '#003824' : theme.textSecondary, fontWeight: type === 'income' ? '800' : '600' },
            ]}>
            Income
          </Text>
        </Pressable>
      </View>

      {/* 2. Amount Input Hero Card */}
      <View
        style={[
          styles.heroAmountCard,
          {
            backgroundColor: isDark ? '#1C1F29' : '#FFFFFF',
            borderColor: `${accentColor}40`,
          },
        ]}>
        <View style={styles.heroGlowAccent} />
        <Text style={[styles.cardSublabel, { color: theme.textSecondary }]}>ENTER AMOUNT</Text>

        <View style={styles.amountInputRow}>
          <Text style={[styles.currencyPrefix, { color: accentColor }]}>
            {currency.symbol}
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

        {/* Quick Amount Chips */}
        <View style={styles.quickChipsWrap}>
          {QUICK_AMOUNTS.map((val) => (
            <Pressable
              key={val}
              style={[
                styles.quickChipBtn,
                { backgroundColor: isDark ? '#262A34' : '#F1F5F9', borderColor: theme.border },
              ]}
              onPress={() => handleQuickAdd(val)}>
              <Text style={[styles.quickChipText, { color: theme.text }]}>
                +{currency.symbol}{val}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 3. Wallet Selector */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.labelWithIcon}>
            <WalletIcon size={moderateScale(15)} color={accentColor} weight="bold" />
            <Text style={[styles.sectionTitleLabel, { color: theme.textSecondary }]}>SELECT ACCOUNT</Text>
          </View>
          {wallets.length === 0 ? (
            <Pressable onPress={() => router.push('/(modals)/add-wallet')}>
              <Text style={[styles.createLinkText, { color: theme.primary }]}>+ Add Account</Text>
            </Pressable>
          ) : null}
        </View>

        {wallets.length === 0 ? (
          <Text style={[styles.noWalletText, { color: '#F43F5E' }]}>
            No accounts found. Please add an account before recording.
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
                      backgroundColor: selected
                        ? isDark ? '#262A34' : '#E2E8F0'
                        : isDark ? '#181B25' : '#F8FAFC',
                      borderColor: selected ? accentColor : theme.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                  onPress={() => setSelectedWalletId(w.id)}>
                  <View style={styles.walletChipHeader}>
                    <CategoryIcon name={w.icon} size={moderateScale(16)} color={selected ? accentColor : theme.textSecondary} />
                    <Text style={[styles.walletChipName, { color: theme.text, fontWeight: selected ? '700' : '500' }]}>
                      {w.name}
                    </Text>
                  </View>
                  <Text style={[styles.walletChipBalance, { color: selected ? accentColor : theme.textMuted }]}>
                    {formatCurrency(w.current_balance)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 4. Category Grid (User Custom Categories) */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.sectionTitleRow}>
          <View style={styles.labelWithIcon}>
            <Tag size={moderateScale(15)} color={accentColor} weight="bold" />
            <Text style={[styles.sectionTitleLabel, { color: theme.textSecondary }]}>
              CATEGORY ({type.toUpperCase()})
            </Text>
          </View>
          <Pressable style={styles.addCategoryHeaderBtn} onPress={handleOpenAddCategory}>
            <Plus size={moderateScale(14)} color={accentColor} weight="bold" />
            <Text style={[styles.createLinkText, { color: accentColor }]}>Add Category</Text>
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
              Create custom categories to organize your {type} transactions.
            </Text>
            <Pressable
              style={[
                styles.addCatPrimaryBtn,
                { backgroundColor: accentColor },
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
                      borderColor: selected ? cat.color : theme.border,
                      borderWidth: selected ? 2 : 1,
                      backgroundColor: selected
                        ? `${cat.color}20`
                        : isDark ? '#181B25' : '#F8FAFC',
                    },
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                  onLongPress={() => handlePromptDeleteCategory(cat)}>
                  <View style={[styles.catIconCircle, { backgroundColor: `${cat.color}25` }]}>
                    <CategoryIcon name={cat.icon} color={cat.color} size={moderateScale(18)} />
                  </View>
                  <Text
                    style={[
                      styles.catName,
                      {
                        color: selected ? cat.color : theme.text,
                        fontWeight: selected ? '800' : '600',
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
                <Plus size={moderateScale(14)} color={accentColor} weight="bold" />
              </View>
              <Text style={[styles.catName, { color: accentColor, fontWeight: '700' }]}>+ Add</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 5. Date Selector */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <View style={styles.labelWithIcon}>
          <CalendarBlank size={moderateScale(15)} color={accentColor} weight="bold" />
          <Text style={[styles.sectionTitleLabel, { color: theme.textSecondary }]}>TRANSACTION DATE</Text>
        </View>

        <View style={styles.dateRow}>
          <Pressable
            style={[
              styles.dateQuickBtn,
              isToday(selectedDate)
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : { backgroundColor: isDark ? '#181B25' : '#F1F5F9', borderColor: theme.border },
            ]}
            onPress={() => setSelectedDate(new Date())}>
            <Text
              style={[
                styles.dateQuickText,
                { color: isToday(selectedDate) ? (type === 'expense' ? '#FFFFFF' : '#003824') : theme.text },
              ]}>
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
            <CalendarBlank size={moderateScale(18)} color={accentColor} weight="bold" />
            <Text style={[styles.dateChangeText, { color: theme.text }]}>
              {formatDisplayDate(selectedDate)}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 6. Note / Description */}
      <View style={[styles.sectionCard, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}>
        <Text style={[styles.sectionTitleLabel, { color: theme.textSecondary }]}>NOTE / DESCRIPTION (OPTIONAL)</Text>
        <TextInput
          style={[
            styles.noteInput,
            {
              color: theme.text,
              backgroundColor: isDark ? '#181B25' : '#F8FAFC',
              borderColor: theme.border,
            },
          ]}
          placeholder="e.g. Grocery run, team lunch, freelance payout"
          placeholderTextColor={theme.textMuted}
          value={description}
          onChangeText={setDescription}
        />
      </View>

      {/* Submit Action Button */}
      <Pressable
        style={[
          styles.submitButton,
          { backgroundColor: accentColor },
          isSubmitting && { opacity: 0.6 },
        ]}
        disabled={isSubmitting}
        onPress={handleSubmit}>
        <Check size={moderateScale(20)} color={type === 'expense' ? '#FFFFFF' : '#003824'} weight="bold" />
        <Text
          style={[
            styles.submitText,
            { color: type === 'expense' ? '#FFFFFF' : '#003824' },
          ]}>
          {isSubmitting ? 'Recording Entry...' : 'Save Transaction'}
        </Text>
      </Pressable>

      {/* ADD CATEGORY MODAL WITH COLOR DEDUPLICATION & CUSTOM COLOR CHOOSER */}
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
                <Text style={[styles.addCatTitle, { color: theme.text }]}>Add Category</Text>
                <Text style={[styles.addCatSubtitle, { color: theme.textSecondary }]}>
                  Customize with an icon & unique color
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
                  Expense
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
                  Income
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
                onChangeText={handleCatNameChange}
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
                            ? `${newCatColor}25`
                            : isDark ? '#181B25' : '#F8FAFC',
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

            {/* Color Palette (Filtered to remove colors already chosen) */}
            <View style={styles.fieldWrap}>
              <View style={styles.colorHeaderRow}>
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  AVAILABLE PALETTE (DEDUPLICATED)
                </Text>
                <Text style={[styles.colorCountBadge, { color: theme.textMuted }]}>
                  {availablePaletteColors.length} unique colors
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.colorScrollRow}>
                {availablePaletteColors.map((hex) => {
                  const isSelected = newCatColor.toLowerCase() === hex.toLowerCase();
                  return (
                    <Pressable
                      key={hex}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: hex },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => {
                        setNewCatColor(hex);
                        setCustomHex(hex.replace('#', ''));
                      }}>
                      {isSelected ? (
                        <Check size={moderateScale(14)} color="#FFFFFF" weight="bold" />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* Custom Color Chooser */}
            <View style={styles.fieldWrap}>
              <View style={styles.colorHeaderRow}>
                <View style={styles.customLabelWrap}>
                  <Palette size={moderateScale(14)} color={newCatColor} weight="bold" />
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    CUSTOM COLOR CHOOSER
                  </Text>
                </View>
                <View style={[styles.hexStatusPill, { backgroundColor: `${newCatColor}20` }]}>
                  <Text style={[styles.hexStatusText, { color: newCatColor }]}>
                    {newCatColor.toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.customColorInputRow}>
                <View style={[styles.customColorSwatch, { backgroundColor: newCatColor }]}>
                  <Check size={moderateScale(14)} color="#FFFFFF" weight="bold" />
                </View>

                <View style={[styles.hexInputBox, { backgroundColor: isDark ? '#181B25' : '#F8FAFC', borderColor: theme.border }]}>
                  <Text style={[styles.hexHash, { color: theme.textSecondary }]}>#</Text>
                  <TextInput
                    style={[styles.hexTextInput, { color: theme.text }]}
                    placeholder="10B981"
                    placeholderTextColor={theme.textMuted}
                    value={customHex}
                    onChangeText={handleCustomHexInput}
                    maxLength={6}
                    autoCapitalize="characters"
                  />
                </View>

                {/* Quick Color Swatch Helpers */}
                <View style={styles.customQuickRow}>
                  {['#6366F1', '#EC4899', '#06B6D4', '#F59E0B'].map((qHex) => (
                    <Pressable
                      key={qHex}
                      style={[styles.smallSwatch, { backgroundColor: qHex }]}
                      onPress={() => {
                        setNewCatColor(qHex);
                        setCustomHex(qHex.replace('#', ''));
                      }}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Preview Chip */}
            <View
              style={[
                styles.previewWrap,
                { backgroundColor: isDark ? '#181B25' : '#F8FAFC', borderColor: theme.border },
              ]}>
              <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>LIVE PREVIEW</Text>
              <View style={styles.previewCardRow}>
                <View style={[styles.catIconCircle, { backgroundColor: `${newCatColor}25` }]}>
                  <CategoryIcon name={newCatIcon} color={newCatColor} size={moderateScale(18)} />
                </View>
                <Text style={[styles.previewName, { color: theme.text }]}>
                  {newCatName.trim() || 'Category Name'}
                </Text>
                <View style={[styles.previewBadge, { backgroundColor: `${newCatColor}20` }]}>
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
                    style={[styles.calendarDayBtn, isSelected && { backgroundColor: accentColor }]}
                    onPress={() => handleDateSelect(d)}>
                    <Text
                      style={[
                        styles.calendarDayText,
                        {
                          color: isSelected ? (type === 'expense' ? '#FFFFFF' : '#003824') : theme.text,
                          fontWeight: isSelected ? '800' : '600',
                        },
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
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconGlow: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: fontScale(18),
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  modalSubtitle: {
    fontSize: fontScale(11),
    fontWeight: '500',
  },
  headerCloseBtn: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(4),
    borderWidth: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: moderateScale(8),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  toggleBtnActive: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  toggleText: {
    fontSize: fontScale(13),
  },
  heroAmountCard: {
    borderRadius: Radius.xxl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlowAccent: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: moderateScale(100),
    height: moderateScale(100),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  cardSublabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginVertical: Spacing.xs,
  },
  currencyPrefix: {
    fontSize: fontScale(32),
    fontWeight: '800',
  },
  amountInput: {
    flex: 1,
    fontSize: fontScale(36),
    fontWeight: '800',
    padding: 0,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  quickChipBtn: {
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(5),
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  quickChipText: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  sectionCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  sectionTitleLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  createLinkText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  addCategoryHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  noWalletText: {
    fontSize: fontScale(12),
    fontWeight: '600',
    paddingVertical: Spacing.xs,
  },
  chipScrollContent: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  walletChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.lg,
    minWidth: moderateScale(130),
    gap: moderateScale(4),
  },
  walletChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  walletChipName: {
    fontSize: fontScale(13),
  },
  walletChipBalance: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  catItem: {
    width: '31%',
    aspectRatio: 1.15,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xs,
    gap: moderateScale(6),
  },
  addCatTile: {
    borderWidth: 1.5,
  },
  catIconCircle: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: fontScale(11),
    textAlign: 'center',
  },
  emptyCategoryCard: {
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  emptyCatIconCircle: {
    width: moderateScale(44),
    height: moderateScale(44),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  emptyCatTitle: {
    fontSize: fontScale(14),
    fontWeight: '700',
  },
  emptyCatSub: {
    fontSize: fontScale(11),
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: Spacing.sm,
  },
  addCatPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(8),
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
    flex: 1,
    paddingVertical: moderateScale(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  dateQuickText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  dateChangeBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(10),
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  dateChangeText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  noteInput: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    fontSize: fontScale(13),
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
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  addCatModalContent: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '90%',
    gap: Spacing.md,
  },
  addCatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addCatTitle: {
    fontSize: fontScale(16),
    fontWeight: '800',
  },
  addCatSubtitle: {
    fontSize: fontScale(11),
  },
  closeIconBtn: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalToggleWrap: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(3),
  },
  modalToggleBtn: {
    flex: 1,
    paddingVertical: moderateScale(6),
    alignItems: 'center',
    borderRadius: Radius.full,
  },
  modalToggleText: {
    fontSize: fontScale(12),
    fontWeight: '700',
  },
  fieldWrap: {
    gap: moderateScale(6),
  },
  inputLabel: {
    fontSize: fontScale(10),
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  catTextInput: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: moderateScale(10),
    fontSize: fontScale(13),
  },
  iconScrollRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  iconOptionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.md,
    minWidth: moderateScale(56),
    gap: moderateScale(4),
  },
  iconOptionLabel: {
    fontSize: fontScale(9),
    fontWeight: '600',
  },
  colorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  colorCountBadge: {
    fontSize: fontScale(10),
    fontWeight: '600',
  },
  colorScrollRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  colorCircle: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  customLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
  },
  hexStatusPill: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  hexStatusText: {
    fontSize: fontScale(10),
    fontWeight: '800',
  },
  customColorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  customColorSwatch: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hexInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
  },
  hexHash: {
    fontSize: fontScale(14),
    fontWeight: '700',
    marginRight: moderateScale(4),
  },
  hexTextInput: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '700',
    paddingVertical: moderateScale(8),
  },
  customQuickRow: {
    flexDirection: 'row',
    gap: moderateScale(4),
  },
  smallSwatch: {
    width: moderateScale(20),
    height: moderateScale(20),
    borderRadius: Radius.full,
  },
  previewWrap: {
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: moderateScale(4),
  },
  previewLabel: {
    fontSize: fontScale(9),
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  previewCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewName: {
    flex: 1,
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  previewBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(3),
    borderRadius: Radius.full,
  },
  previewBadgeText: {
    fontSize: fontScale(10),
    fontWeight: '800',
  },
  saveCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(12),
    borderRadius: Radius.xl,
  },
  saveCategoryBtnText: {
    fontSize: fontScale(14),
    fontWeight: '800',
  },
  calendarModalContent: {
    margin: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calendarMonthText: {
    fontSize: fontScale(15),
    fontWeight: '800',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: moderateScale(6),
  },
  calendarDayBtn: {
    width: '12.5%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  calendarDayText: {
    fontSize: fontScale(12),
  },
});
