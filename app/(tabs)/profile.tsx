import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as NavigationBar from 'expo-navigation-bar';
import {
  Bell,
  CaretRight,
  Check,
  Database,
  DeviceMobile,
  EyeSlash,
  Globe,
  LockKey,
  Plus,
  ShieldCheck,
  Sparkle,
  Trash,
  User,
  Wallet as WalletIcon,
  X,
} from 'phosphor-react-native';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { clearAllTransactions } from '@/db/queries';
import { ThemeSwitch, useTheme } from '@/features/theme';
import { useSettings } from '@/utils/settings';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function ProfileScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const { currency, currencies, setCurrency } = useSettings();

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [hideBalancesByDefault, setHideBalancesByDefault] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);

  const toggleFullScreen = (value: boolean) => {
    setIsFullScreen(value);
    if (Platform.OS === 'android') {
      try {
        NavigationBar.setVisibilityAsync(value ? 'hidden' : 'visible').catch(() => {});
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
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <User size={moderateScale(18)} color={colors.accentContrast} weight="bold" />
          </View>
          <View>
            <Text style={[styles.appBranding, { color: colors.textSecondary }]}>VAULTFLOW</Text>
            <Text style={[styles.screenTitle, { color: colors.text }]}>Profile & Settings</Text>
          </View>
        </View>

        <Pressable
          style={[styles.iconButton, { backgroundColor: colors.surfaceVariant }]}
          onPress={() => Alert.alert('Status', 'All security and cloud-free storage layers active.')}>
          <ShieldCheck size={moderateScale(20)} color={colors.primary} weight="bold" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* User Card */}
        <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.userCardGlow, { backgroundColor: colors.primaryLight }]} />
          <View style={styles.userRow}>
            <View style={[styles.bigAvatar, { backgroundColor: colors.primary }]}>
              <Text style={[styles.avatarInitial, { color: colors.accentContrast }]}>V</Text>
            </View>
            <View style={styles.userInfo}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userName, { color: colors.text }]}>Vault User</Text>
                <View style={[styles.proBadge, { backgroundColor: colors.primaryLight }]}>
                  <Sparkle size={moderateScale(12)} color={colors.primary} weight="fill" />
                  <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
                </View>
              </View>
              <Text style={[styles.userSub, { color: colors.textSecondary }]}>Local Ledger • Zero Telemetry</Text>
            </View>
          </View>
        </View>

        {/* Display & Screen Settings */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DISPLAY & EXPERIENCE</Text>

          {/* Theme Segmented Switch with Animated Indicator and Haptics */}
          <ThemeSwitch />

          <View style={[styles.settingDivider, { backgroundColor: colors.borderSubtle }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <DeviceMobile size={moderateScale(18)} color={colors.primary} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Full Screen (Immersive)</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Hide Android system bars</Text>
              </View>
            </View>
            <Switch
              value={isFullScreen}
              onValueChange={toggleFullScreen}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor={colors.card}
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
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Globe size={moderateScale(18)} color={colors.primary} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Primary Currency</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  {currency.name} ({currency.symbol} {currency.code})
                </Text>
              </View>
            </View>
            <View style={styles.currencyBadgeRow}>
              <View style={[styles.currencySymbolBadge, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.currencyBadgeText, { color: colors.primary }]}>{currency.symbol}</Text>
              </View>
              <CaretRight size={moderateScale(18)} color={colors.textMuted} weight="bold" />
            </View>
          </Pressable>
        </View>

        {/* Privacy & Security */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PRIVACY & SECURITY</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <LockKey size={moderateScale(18)} color={colors.primary} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Biometric Screen Lock</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Require authentication to view</Text>
              </View>
            </View>
            <Switch
              value={isBiometricEnabled}
              onValueChange={setIsBiometricEnabled}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.warningLight }]}>
                <EyeSlash size={moderateScale(18)} color={colors.warning} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Conceal Balances</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Default to hidden amount on open</Text>
              </View>
            </View>
            <Switch
              value={hideBalancesByDefault}
              onValueChange={setHideBalancesByDefault}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Bell size={moderateScale(18)} color={colors.primary} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Budget Reminders</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>Notify on 85% limit alerts</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.surfaceVariant, true: colors.primary }}
              thumbColor={colors.card}
            />
          </View>
        </View>

        {/* Database & Storage */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>DATA & STORAGE</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
                <Database size={moderateScale(18)} color={colors.primary} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Local SQLite Database</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>expico.db (100% on-device)</Text>
              </View>
            </View>
            <Text style={[styles.dbStatus, { color: colors.primary }]}>Synced</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.settingRow,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={handleClearAllTransactions}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: colors.dangerLight }]}>
                <Trash size={moderateScale(18)} color={colors.danger} weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: colors.danger }]}>Clear All Transactions</Text>
                <Text style={[styles.settingDesc, { color: colors.textSecondary }]}>
                  Reset transaction logs & balances to {currency.symbol}0.00
                </Text>
              </View>
            </View>
            <CaretRight size={moderateScale(18)} color={colors.textMuted} weight="bold" />
          </Pressable>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push('/(modals)/add-wallet')}>
            <WalletIcon size={moderateScale(18)} color={colors.primary} weight="bold" />
            <Text style={[styles.actionBtnText, { color: colors.text }]}>New Wallet</Text>
          </Pressable>

          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/(modals)/add-transaction')}>
            <Plus size={moderateScale(18)} color={colors.accentContrast} weight="bold" />
            <Text style={[styles.actionBtnText, { color: colors.accentContrast, fontWeight: '800' }]}>New Entry</Text>
          </Pressable>
        </View>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          Expico VaultFlow v1.0.0 • Mobile-First Engine
        </Text>
      </ScrollView>

      {/* CURRENCY SELECTION MODAL */}
      <Modal
        visible={showCurrencyModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCurrencyModal(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowCurrencyModal(false)}>
          <Pressable
            style={[
              styles.currencyModalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.currencyModalHeader}>
              <View>
                <Text style={[styles.currencyModalTitle, { color: colors.text }]}>Select Currency</Text>
                <Text style={[styles.currencyModalSub, { color: colors.textSecondary }]}>
                  Used for balances, ledger entries, and statistics
                </Text>
              </View>
              <Pressable
                style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => setShowCurrencyModal(false)}>
                <X size={moderateScale(18)} color={colors.text} weight="bold" />
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
                          ? colors.surfaceVariant
                          : colors.card,
                        borderColor: isSelected ? colors.primary : colors.border,
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
                    <View style={[styles.currencyCodePill, { backgroundColor: isSelected ? colors.primary : colors.surfaceVariant }]}>
                      <Text style={[styles.currencyCodeText, { color: isSelected ? colors.accentContrast : colors.text }]}>
                        {c.symbol}
                      </Text>
                    </View>

                    <View style={styles.currencyInfo}>
                      <Text style={[styles.currencyName, { color: colors.text, fontWeight: isSelected ? '800' : '600' }]}>
                        {c.name}
                      </Text>
                      <Text style={[styles.currencyCodeSub, { color: colors.textSecondary }]}>
                        {c.code} • Local format
                      </Text>
                    </View>

                    {isSelected && (
                      <View style={[styles.currencySelectedCheck, { backgroundColor: colors.primary }]}>
                        <Check size={moderateScale(14)} color={colors.accentContrast} weight="bold" />
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
  settingDivider: {
    height: 1,
    marginVertical: Spacing.sm,
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
  footerText: {
    textAlign: 'center',
    fontSize: fontScale(11),
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
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
