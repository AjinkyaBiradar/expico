import * as Haptics from 'expo-haptics';
import { DeviceMobile, Moon, Sun } from 'phosphor-react-native';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from './ThemeProvider';
import { ThemeMode } from './themeStore';
import { fontScale, moderateScale, Radius, Spacing } from '@/utils/styling';

interface ThemeOption {
  id: ThemeMode;
  label: string;
  icon: typeof Sun;
}

const OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: DeviceMobile },
];

export function ThemeSwitch() {
  const { mode, resolvedTheme, colors, setMode } = useTheme();
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = mode === 'light' ? 0 : mode === 'dark' ? 1 : 2;

  const padding = moderateScale(3);
  const availableWidth = Math.max(0, containerWidth - padding * 2);
  const segmentWidth = availableWidth > 0 ? availableWidth / 3 : 0;

  const translateX = useSharedValue(0);

  useEffect(() => {
    if (segmentWidth > 0) {
      translateX.value = withSpring(activeIndex * segmentWidth, {
        damping: 18,
        stiffness: 180,
        mass: 0.8,
      });
    }
  }, [activeIndex, segmentWidth, translateX]);

  const animatedPillStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: segmentWidth,
    };
  });

  const handleSelect = (optionId: ThemeMode) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch {
      // Haptics fallback
    }
    setMode(optionId);
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && width !== containerWidth) {
      setContainerWidth(width);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryLight }]}>
            {mode === 'dark' ? (
              <Moon size={moderateScale(18)} color={colors.primary} weight="fill" />
            ) : mode === 'light' ? (
              <Sun size={moderateScale(18)} color={colors.warning} weight="fill" />
            ) : (
              <DeviceMobile size={moderateScale(18)} color={colors.primary} weight="bold" />
            )}
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>App Theme</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {mode === 'system'
                ? `Follows phone (${resolvedTheme === 'dark' ? 'Dark' : 'Light'})`
                : mode === 'dark'
                ? 'Permanent Dark mode'
                : 'Permanent Light mode'}
            </Text>
          </View>
        </View>
      </View>

      {/* Segmented Control Track */}
      <View
        style={[
          styles.track,
          {
            backgroundColor: colors.surfaceVariant,
            borderColor: colors.border,
          },
        ]}
        onLayout={handleLayout}>
        {/* Animated Pill Indicator (Reanimated 3) */}
        {segmentWidth > 0 && (
          <Animated.View
            style={[
              styles.animatedPill,
              {
                backgroundColor: colors.card,
                shadowColor: colors.shadowColor,
              },
              animatedPillStyle,
            ]}
          />
        )}

        {/* Option Buttons */}
        {OPTIONS.map((opt) => {
          const isSelected = mode === opt.id;
          const IconComp = opt.icon;

          return (
            <Pressable
              key={opt.id}
              style={styles.segmentBtn}
              onPress={() => handleSelect(opt.id)}>
              <IconComp
                size={moderateScale(15)}
                color={
                  isSelected
                    ? opt.id === 'light'
                      ? '#F59E0B'
                      : colors.primary
                    : colors.textMuted
                }
                weight={isSelected ? 'fill' : 'regular'}
              />
              <Text
                style={[
                  styles.segmentLabel,
                  {
                    color: isSelected ? colors.text : colors.textMuted,
                    fontWeight: isSelected ? '700' : '500',
                  },
                ]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
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
  title: {
    fontSize: fontScale(13),
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontScale(11),
    marginTop: 1,
  },
  track: {
    flexDirection: 'row',
    position: 'relative',
    borderRadius: Radius.lg,
    padding: moderateScale(3),
    borderWidth: 1,
    height: moderateScale(42),
    alignItems: 'center',
  },
  animatedPill: {
    position: 'absolute',
    top: moderateScale(3),
    bottom: moderateScale(3),
    left: moderateScale(3),
    borderRadius: Radius.md,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: moderateScale(6),
    height: '100%',
    zIndex: 1,
  },
  segmentLabel: {
    fontSize: fontScale(12),
  },
});
