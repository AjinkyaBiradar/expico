import { router, Tabs, usePathname } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Bell, ChartLineUp, Plus, SquaresFour, UserGear } from 'phosphor-react-native';
import React, { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDueSoonRemindersCount } from '@/db/queries';
import { setDueSoonCount, useAppTheme, useDueSoonCount } from '@/utils/settings';
import { moderateScale, Radius } from '@/utils/styling';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isDark, theme } = useAppTheme();
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
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          backgroundColor: isDark ? '#0B0E17' : '#FFFFFF',
          borderTopColor: isDark ? '#1C1F29' : '#E2E8F0',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: moderateScale(6),
          elevation: 12,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.45 : 0.06,
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
              color={focused ? theme.primary : theme.tabIconDefault}
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
              color={focused ? theme.primary : theme.tabIconDefault}
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
                    backgroundColor: theme.primary,
                    borderColor: isDark ? '#0B0E17' : '#FFFFFF',
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
                hitSlop={moderateScale(8)}
                onPress={handleCenterAction}>
                <Plus size={moderateScale(26)} color="#003824" weight="bold" />
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
            backgroundColor: '#F43F5E',
            color: '#FFFFFF',
            fontSize: moderateScale(10),
            fontWeight: '700',
          },
          tabBarIcon: ({ focused }) => (
            <Bell
              size={moderateScale(24)}
              color={focused ? theme.primary : theme.tabIconDefault}
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
              color={focused ? theme.primary : theme.tabIconDefault}
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
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
  },
});
