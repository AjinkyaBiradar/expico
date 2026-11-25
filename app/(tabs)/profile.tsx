import { NavigationBar } from 'expo-navigation-bar';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  CaretRight,
  Check,
  Database,
  DeviceMobile,
  EyeSlash,
  Globe,
  LockKey,
  Moon,
  Plus,
  ShieldCheck,
  Sparkle,
  Sun,
  Trash,
  User,
  Wallet as WalletIcon,
  X,
} from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/colors';
import { clearAllTransactions } from '@/db/queries';
import { useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function ProfileScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const { currency, currencies, themePreference, setCurrency, setThemePreference } = useSettings();

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && colorScheme === 'dark');
  const theme = isDark ? Colors.dark : Colors.light;

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [hideBalancesByDefault, setHideBalancesByDefault] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const toggleFullScreen = (value: boolean) => {
    setIsFullScreen(value);
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setHidden(value);
      } catch (err) {
        console.warn('Failed to toggle navigation bar:', err);
      }
    }
  };

  const handleClearAllTransactions = () => {
    Alert.alert(
      '🤖 Smart Ledger Assistant',
      `Are you sure you want to permanently clear all transactions and reset your wallets to ${currency.symbol}0.00? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All Data',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllTransactions(db);
              Alert.alert(
                '✨ Vault Reset',
                `All transaction history was deleted and balances reset to ${currency.symbol}0.00.`
              );
            } catch (err) {
              console.error('Failed to clear transactions:', err);
              Alert.alert('Error', 'Failed to clear transactions. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.surface }]} edges={['top', 'left', 'right']}>
      {Platform.OS === 'android' && (
        <NavigationBar hidden={isFullScreen} style={isDark ? 'light' : 'dark'} />
      )}
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
            <User size={moderateScale(18)} color="#003824" weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: theme.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: theme.text }]}>Profile & Settings</Text>
          </View>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: isDark ? '#1C1F29' : '#F1F5F9' }]}
          onPress={() => Alert.alert('Status', 'All security and cloud-free storage layers active.')}>
          <ShieldCheck size={moderateScale(20)} color="#10B981" weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <View style={styles.userCardGlow} />
          <View style={styles.userRow}>
            <View style={[styles.bigAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarInitial}>V</Text>
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userName, { color: theme.text }]}>Vault User</Text>
                <View style={[styles.proBadge, { backgroundColor: 'rgba(16, 185, 129, 0.2)' }]}>
                  <Sparkle size={moderateScale(12)} color="#10B981" weight="fill" />
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              </View>
              <Text style={[styles.userSub, { color: theme.textSecondary }]}>Local Ledger • Zero Telemetry</Text>
            </View>
          </View>
        </View>

        {/* Display & Screen Settings */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DISPLAY & EXPERIENCE</Text>

          {/* Theme Button Row with Permanent Persistence */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(245, 158, 11, 0.15)' }]}>
                {isDark ? (
                  <Moon size={moderateScale(18)} color="#8B5CF6" weight="fill" />
                ) : (
                  <Sun size={moderateScale(18)} color="#F59E0B" weight="fill" />
                )}
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>App Theme</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  {themePreference === 'dark'
                    ? 'Permanent Dark mode'
                    : themePreference === 'light'
                    ? 'Permanent Light mode'
                    : 'System theme'}
                </Text>
              </View>
            </View>

            <View style={[styles.themePillGroup, { backgroundColor: isDark ? '#12151E' : '#F1F5F9', borderColor: theme.border }]}>
              <Pressable
                style={[
                  styles.themePill,
                  themePreference === 'light' && [styles.themePillActive, { backgroundColor: '#FFFFFF' }],
                ]}
                onPress={() => setThemePreference('light')}>
                <Sun
                  size={moderateScale(14)}
                  color={themePreference === 'light' ? '#F59E0B' : theme.textMuted}
                  weight={themePreference === 'light' ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.themePillText,
                    {
                      color: themePreference === 'light' ? '#0F172A' : theme.textMuted,
                      fontWeight: themePreference === 'light' ? '800' : '600',
                    },
                  ]}>
                  Light
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.themePill,
                  themePreference === 'dark' && [styles.themePillActive, { backgroundColor: '#262A34' }],
                ]}
                onPress={() => setThemePreference('dark')}>
                <Moon
                  size={moderateScale(14)}
                  color={themePreference === 'dark' ? '#A78BFA' : theme.textMuted}
                  weight={themePreference === 'dark' ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.themePillText,
                    {
                      color: themePreference === 'dark' ? '#FFFFFF' : theme.textMuted,
                      fontWeight: themePreference === 'dark' ? '800' : '600',
                    },
                  ]}>
                  Dark
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <DeviceMobile size={moderateScale(18)} color="#10B981" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Full Screen (Immersive)</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Hide Android system bars</Text>
              </View>
            </View>
            <Switch
              value={isFullScreen}
              onValueChange={toggleFullScreen}
              trackColor={{ false: isDark ? '#31353F' : '#E2E8F0', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Primary Currency Row - Interactive Selector */}
          <Pressable
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={() => setShowCurrencyModal(true)}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <Globe size={moderateScale(18)} color="#6366F1" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Primary Currency</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  {currency.name} ({currency.symbol} {currency.code})
                </Text>
              </View>
            </View>
            <View style={styles.currencyBadgeRow}>
              <View style={[styles.currencySymbolBadge, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}>
                <Text style={[styles.currencyBadgeText, { color: theme.primary }]}>{currency.symbol}</Text>
              </View>
              <CaretRight size={moderateScale(18)} color={theme.textMuted} weight="bold" />
            </View>
          </Pressable>
        </View>

        {/* Privacy & Security */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PRIVACY & SECURITY</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <LockKey size={moderateScale(18)} color="#10B981" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Biometric Screen Lock</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Require authentication to view</Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={setIsBiometricEnabled}
              trackColor={{ false: isDark ? '#31353F' : '#E2E8F0', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <EyeSlash size={moderateScale(18)} color="#F59E0B" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Conceal Balances</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Default to hidden amount on open</Text>
              </View>
            </View>
            <Switch
              value={hideBalancesByDefault}
              onValueChange={setHideBalancesByDefault}
              trackColor={{ false: isDark ? '#31353F' : '#E2E8F0', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Bell size={moderateScale(18)} color="#10B981" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Budget Reminders</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Notify on 85% limit alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: isDark ? '#31353F' : '#E2E8F0', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Database & Storage */}
        <View style={[styles.sectionCard, { backgroundColor: isDark ? '#181B25' : '#FFFFFF', borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DATA & STORAGE</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                <Database size={moderateScale(18)} color="#10B981" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Local SQLite Database</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>expico.db (100% on-device)</Text>
              </View>
            </View>
            <Text style={[styles.dbStatus, { color: '#10B981' }]}>Synced</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleClearAllTransactions}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Trash size={moderateScale(18)} color="#EF4444" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: '#EF4444' }]}>Clear All Transactions</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>
                  Reset transaction logs & balances to {currency.symbol}0.00
                </Text>
              </View>
            </View>
            <CaretRight size={moderateScale(18)} color={theme.textMuted} weight="bold" />
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border }]}
            onPress={() => router.push('/(modals)/add-wallet')}>
            <WalletIcon size={moderateScale(18)} color="#10B981" weight="bold" />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>New Wallet</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => router.push('/(modals)/add-transaction')}>
            <Plus size={moderateScale(18)} color="#003824" weight="bold" />
            <Text style={[styles.actionBtnText, { color: '#003824', fontWeight: '800' }]}>New Entry</Text>
          </Pressable>
        </View>

        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          Expico VaultFlow v1.0.0 • Mobile-First Engine
        </Text>
      </ScrollView>

      {/* CURRENCY SELECTION MODAL */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowCurrencyModal(false)}>
          <Pressable
            style={[
              styles.currencyModalContent,
              { backgroundColor: isDark ? '#1C1F29' : '#FFFFFF', borderColor: theme.border },
            ]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.currencyModalHeader}>
              <View>
                <Text style={[styles.currencyModalTitle, { color: theme.text }]}>Select Currency</Text>
                <Text style={[styles.currencyModalSub, { color: theme.textSecondary }]}>
                  Used for balances, ledger entries, and statistics
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { backgroundColor: isDark ? '#262A34' : '#F1F5F9' }]}
                onPress={() => setShowCurrencyModal(false)}>
                <X size={moderateScale(18)} color={theme.text} weight="bold" />
              </Pressable>
            </View>

            <ScrollView style={styles.currencyListScroll} showsVerticalScrollIndicator={false}>
              {currencies.map((c) => {
                const isSelected = c.code === currency.code;
                return (
                  <Pressable
                    key={c.code}
                    style={[
                      styles.currencyItemRow,
                      {
                        backgroundColor: isSelected
                          ? isDark ? '#262A34' : '#E2E8F0'
                          : isDark ? '#181B25' : '#F8FAFC',
                        borderColor: isSelected ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={async () => {
                      await setCurrency(c.code);
                      setShowCurrencyModal(false);
                      Alert.alert(
                        '✨ Currency Updated',
                        `Active currency set to ${c.name} (${c.symbol} ${c.code}). All values have updated.`
                      );
                    }}>
                    <View style={[styles.currencyCodePill, { backgroundColor: isSelected ? theme.primary : isDark ? '#262A34' : '#E2E8F0' }]}>
                      <Text style={[styles.currencyCodeText, { color: isSelected ? '#003824' : theme.text }]}>
                        {c.symbol}
                      </Text>
                    </View>

                    <View style={styles.currencyInfo}>
                      <Text style={[styles.currencyName, { color: theme.text, fontWeight: isSelected ? '800' : '600' }]}>
                        {c.name}
                      </Text>
                      <Text style={[styles.currencyCodeSub, { color: theme.textSecondary }]}>
                        {c.code} • Local format
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={[styles.currencySelectedCheck, { backgroundColor: theme.primary }]}>
                        <Check size={moderateScale(14)} color="#003824" weight="bold" />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
    padding: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  userCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  userCardGlow: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bigAvatar: {
    width: moderateScale(48),
    height: moderateScale(48),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontScale(20),
    fontWeight: '800',
    color: '#003824',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  userName: {
    fontSize: fontScale(16),
    fontWeight: '700',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  proBadgeText: {
    color: '#10B981',
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userSub: {
    fontSize: fontScale(12),
    marginTop: 2,
  },
  sectionCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: fontScale(11),
    fontWeight: '800',
    letterSpacing: 1,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  iconWrap: {
    width: moderateScale(34),
    height: moderateScale(34),
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  settingDesc: {
    fontSize: fontScale(11),
    marginTop: 1,
  },
  currencyBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  currencySymbolBadge: {
    paddingHorizontal: moderateScale(8),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.md,
  },
  currencyBadgeText: {
    fontSize: fontScale(12),
    fontWeight: '800',
  },
  dbStatus: {
    fontSize: fontScale(11),
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: moderateScale(12),
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  actionBtnText: {
    fontSize: fontScale(13),
    fontWeight: '700',
  },
  themePillGroup: {
    flexDirection: 'row',
    borderRadius: Radius.full,
    padding: moderateScale(3),
    borderWidth: 1,
    gap: moderateScale(2),
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(4),
    paddingHorizontal: moderateScale(10),
    paddingVertical: moderateScale(6),
    borderRadius: Radius.full,
  },
  themePillActive: {
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  themePillText: {
    fontSize: fontScale(12),
  },
  footerText: {
    textAlign: 'center',
    fontSize: fontScale(11),
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  currencyModalContent: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    borderWidth: 1,
    padding: Spacing.lg,
    maxHeight: '80%',
    gap: Spacing.md,
  },
  currencyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  currencyModalTitle: {
    fontSize: fontScale(17),
    fontWeight: '800',
  },
  currencyModalSub: {
    fontSize: fontScale(11),
  },
  modalCloseBtn: {
    width: moderateScale(30),
    height: moderateScale(30),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyListScroll: {
    maxHeight: moderateScale(380),
  },
  currencyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  currencyCodePill: {
    width: moderateScale(36),
    height: moderateScale(36),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyCodeText: {
    fontSize: fontScale(14),
    fontWeight: '800',
  },
  currencyInfo: {
    flex: 1,
  },
  currencyName: {
    fontSize: fontScale(13),
  },
  currencyCodeSub: {
    fontSize: fontScale(11),
  },
  currencySelectedCheck: {
    width: moderateScale(24),
    height: moderateScale(24),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
