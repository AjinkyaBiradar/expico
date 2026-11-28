import { NavigationBar } from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

import { ResolvedTheme, ThemeTokens, getTokens } from './tokens';
import { ThemeMode, useThemeStore } from './themeStore';

export interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  isDark: boolean;
  colors: ThemeTokens;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore((s) => s.mode);
  const systemColorScheme = useThemeStore((s) => s.systemColorScheme);
  const setMode = useThemeStore((s) => s.setMode);
  const updateSystemColorScheme = useThemeStore((s) => s.updateSystemColorScheme);

  const nativeScheme = useColorScheme();

  // Listen to system color scheme changes from React Native hook
  useEffect(() => {
    const nextScheme: ResolvedTheme = nativeScheme === 'light' ? 'light' : 'dark';
    updateSystemColorScheme(nextScheme);
  }, [nativeScheme, updateSystemColorScheme]);

  // Listen to Appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      const nextScheme: ResolvedTheme = colorScheme === 'light' ? 'light' : 'dark';
      updateSystemColorScheme(nextScheme);
    });
    return () => subscription.remove();
  }, [updateSystemColorScheme]);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    return mode === 'system' ? systemColorScheme : mode;
  }, [mode, systemColorScheme]);

  const isDark = resolvedTheme === 'dark';
  const colors = useMemo(() => getTokens(resolvedTheme), [resolvedTheme]);

  // Sync root system UI background
  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  const value = useMemo(
    () => ({
      mode,
      resolvedTheme,
      isDark,
      colors,
      setMode,
    }),
    [mode, resolvedTheme, isDark, colors, setMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {Platform.OS === 'android' && (
        <NavigationBar hidden={true} style={isDark ? 'light' : 'dark'} />
      )}
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
