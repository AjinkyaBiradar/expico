import { Tabs } from 'expo-router';
import { ChartBar, House, Wallet } from 'phosphor-react-native';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

import { moderateScale } from '@/utils/styling';

export default function TabLayout() {
  const activeColor = '#00E5FF';
  const inactiveColor = '#64748B';
  const backgroundColor = '#0D1017';
  const borderColor = '#1A202C';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarStyle: {
          backgroundColor,
          borderTopColor: borderColor,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? moderateScale(84) : moderateScale(68),
          paddingBottom: Platform.OS === 'ios' ? moderateScale(28) : moderateScale(10),
          paddingTop: moderateScale(10),
          elevation: 0,
        },
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <House
              size={moderateScale(24)}
              color={focused ? activeColor : inactiveColor}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ focused }) => (
            <ChartBar
              size={moderateScale(24)}
              color={focused ? activeColor : inactiveColor}
              weight={focused ? 'fill' : 'regular'}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallets"
        options={{
          title: 'Wallets',
          tabBarIcon: ({ focused }) => (
            <Wallet
              size={moderateScale(24)}
              color={focused ? activeColor : inactiveColor}
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
    fontSize: moderateScale(11),
    fontWeight: '600',
    marginTop: moderateScale(2),
  },
  tabBarItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
