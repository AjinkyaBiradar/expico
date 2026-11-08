import { NavigationBar } from 'expo-navigation-bar';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import {
  Bell,
  CaretRight,
  CurrencyInr,
  Database,
  DeviceMobile,
  EyeSlash,
  LockKey,
  Moon,
  Plus,
  ShieldCheck,
  Sparkle,
  Sun,
  Trash,
  User,
  Wallet as WalletIcon,
} from 'phosphor-react-native';
import React, { useState } from 'react';
import {
  Alert,
  Appearance,
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
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

export default function ProfileScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? Colors.dark : Colors.light;

  const [isFullScreen, setIsFullScreen] = useState(true);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [hideBalancesByDefault, setHideBalancesByDefault] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

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
      'Clear All Transactions',
      'Are you sure you want to permanently delete all transactions and reset your wallet balance to ₹0.00? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllTransactions(db);
              Alert.alert('Cleared', 'All transactions have been deleted and balances reset to ₹0.00.');
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

          {/* Theme Button Row */}
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
                  {isDark ? 'Dark theme active' : 'Light theme active'}
                </Text>
              </View>
            </View>

            <View style={[styles.themePillGroup, { backgroundColor: isDark ? '#12151E' : '#F1F5F9', borderColor: theme.border }]}>
              <Pressable
                style={[
                  styles.themePill,
                  !isDark && [styles.themePillActive, { backgroundColor: '#FFFFFF' }],
                ]}
                onPress={() => Appearance.setColorScheme('light')}>
                <Sun
                  size={moderateScale(14)}
                  color={!isDark ? '#F59E0B' : theme.textMuted}
                  weight={!isDark ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.themePillText,
                    { color: !isDark ? '#0F172A' : theme.textMuted, fontWeight: !isDark ? '800' : '600' },
                  ]}>
                  Light
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.themePill,
                  isDark && [styles.themePillActive, { backgroundColor: '#262A34' }],
                ]}
                onPress={() => Appearance.setColorScheme('dark')}>
                <Moon
                  size={moderateScale(14)}
                  color={isDark ? '#A78BFA' : theme.textMuted}
                  weight={isDark ? 'fill' : 'regular'}
                />
                <Text
                  style={[
                    styles.themePillText,
                    { color: isDark ? '#FFFFFF' : theme.textMuted, fontWeight: isDark ? '800' : '600' },
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

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                <CurrencyInr size={moderateScale(18)} color="#6366F1" weight="bold" />
              </View>
              <View>
                <Text style={[styles.settingLabel, { color: theme.text }]}>Primary Currency</Text>
                <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Indian Rupee (₹ INR)</Text>
              </View>
            </View>
            <CaretRight size={moderateScale(18)} color={theme.textMuted} weight="bold" />
          </View>
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
                  Reset transaction logs & balances to ₹0.00
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
    paddingVertical: Spacing.xs,
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
    paddingTop: Spacing.sm,
    paddingBottom: moderateScale(90),
    gap: Spacing.md,
  },
  userCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  userCardGlow: {
    position: 'absolute',
    top: -moderateScale(40),
    right: -moderateScale(40),
    width: moderateScale(120),
    height: moderateScale(120),
    borderRadius: Radius.full,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  bigAvatar: {
    width: moderateScale(50),
    height: moderateScale(50),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: fontScale(22),
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
    fontWeight: '800',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: moderateScale(3),
    paddingHorizontal: moderateScale(6),
    paddingVertical: moderateScale(2),
    borderRadius: Radius.full,
  },
  proBadgeText: {
    color: '#10B981',
    fontSize: fontScale(9),
    fontWeight: '800',
  },
  userSub: {
    fontSize: fontScale(12),
    marginTop: moderateScale(2),
  },
  sectionCard: {
    borderRadius: Radius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: fontScale(10),
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
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
    fontWeight: '700',
  },
  settingDesc: {
    fontSize: fontScale(11),
    marginTop: moderateScale(1),
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
});
