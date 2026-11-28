import { router, Tabs, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Bell, ChartLineUp, Plus, SquaresFour, UserGear } from 'phosphor-react-native';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDueSoonRemindersCount } from '@/db/queries';
import { useTheme } from '@/features/theme';
import { setDueSoonCount, useDueSoonCount } from '@/utils/settings';
import { moderateScale, Radius } from '@/utils/styling';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const db = useSQLiteContext();
  const pathname = usePathname();
  const dueSoonCount = useDueSoonCount();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = await getDueSoonRemindersCount(db);
        if (mounted) {
          setDueSoonCount(count);
        }
      } catch (e) {
        console.warn('Failed to load due-soon reminders count:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [db]);

  const isRemindersTab = pathname?.includes('reminders');

  const handleCenterAction = () => {
    if (isRemindersTab) {
      router.push({ pathname: '/(tabs)/reminders', params: { openAdd: Date.now().toString() } } as any);
    } else {
      router.push('/(modals)/add-transaction');
    }
  };

  const tabBarHeight = (Platform.OS === 'ios' ? moderateScale(56) : moderateScale(58)) + insets.bottom;
  const tabBarPaddingBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? moderateScale(20) : moderateScale(6));

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: moderateScale(6),
          elevation: 12,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.45 : 0.08,
          shadowRadius: 16,
        },
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => (
            <SquaresFour
              size={moderateScale(24)}
              color={focused ? colors.tabBarActive : colors.tabBarInactive}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Insights',
          tabBarIcon: ({ focused }) => (
            <ChartLineUp
              size={moderateScale(24)}
              color={focused ? colors.tabBarActive : colors.tabBarInactive}
              weight={focused ? 'bold' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="action"
        options={{
          title: '',
          tabBarLabel: () => null,
          tabBarButton: () => (
            <View style={styles.centerFabWrapper}>
              <Pressable
                style={({ pressed }) => [
                  styles.centerFab,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.tabBarBackground,
                    shadowColor: colors.primary,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
                hitSlop={moderateScale(8)}
                onPress={handleCenterAction}>
                <Plus size={moderateScale(26)} color={colors.accentContrast} weight="bold" />
              </Pressable>
            </View>
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            handleCenterAction();
          },
        })}
      />
      <Tabs.Screen
        name="reminders"
        options={{
          title: 'Reminders',
          tabBarBadge: dueSoonCount > 0 ? dueSoonCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: colors.danger,
            color: colors.accentContrast,
            fontSize: moderateScale(10),
            fontWeight: '700',
          },
          tabBarIcon: ({ focused }) => (
            <Bell
              size={moderateScale(24)}
              color={focused ? colors.tabBarActive : colors.tabBarInactive}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <UserGear
              size={moderateScale(24)}
              color={focused ? colors.tabBarActive : colors.tabBarInactive}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    fontSize: moderateScale(10),
    fontWeight: '600',
    marginTop: moderateScale(1),
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerFabWrapper: {
    top: -moderateScale(18),
    justifyContent: 'center',
    alignItems: 'center',
    width: moderateScale(60),
    height: moderateScale(60),
  },
  centerFab: {
    width: moderateScale(52),
    height: moderateScale(52),
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: moderateScale(3),
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
});
