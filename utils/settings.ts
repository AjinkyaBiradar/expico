import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
  locale: string;
}

export const CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN' },
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'ar-AE' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR' },
];

export type ThemePreference = 'system' | 'light' | 'dark';
export type InsightsSegment = 'analysis' | 'wallets';

interface AppSettings {
  currencyCode: string;
  themePreference: ThemePreference;
  lastInsightsSegment?: InsightsSegment;
}

const SETTINGS_FILE = `${FileSystem.documentDirectory || ''}vaultflow_settings.json`;

let currentSettings: AppSettings = {
  currencyCode: 'INR',
  themePreference: 'dark',
  lastInsightsSegment: 'analysis',
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Initializes settings from disk on app start.
 */
export async function initSettingsAsync(): Promise<void> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(SETTINGS_FILE);
    if (fileInfo.exists) {
      const content = await FileSystem.readAsStringAsync(SETTINGS_FILE);
      const parsed = JSON.parse(content) as Partial<AppSettings>;
      if (parsed.currencyCode) {
        currentSettings.currencyCode = parsed.currencyCode;
      }
      if (parsed.themePreference) {
        currentSettings.themePreference = parsed.themePreference;
        if (parsed.themePreference === 'light' || parsed.themePreference === 'dark') {
          Appearance.setColorScheme(parsed.themePreference);
        } else {
          Appearance.setColorScheme('unspecified');
        }
      }
      if (parsed.lastInsightsSegment) {
        currentSettings.lastInsightsSegment = parsed.lastInsightsSegment;
      }
      notifyListeners();
    }
  } catch (err) {
    console.warn('[Settings] Failed to load settings from storage:', err);
  }
}

async function persistSettings(): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(SETTINGS_FILE, JSON.stringify(currentSettings));
  } catch (err) {
    console.warn('[Settings] Failed to save settings to storage:', err);
  }
}

export function getActiveCurrency(): CurrencyConfig {
  const found = CURRENCIES.find((c) => c.code === currentSettings.currencyCode);
  return found || CURRENCIES[0];
}

export function getActiveCurrencySymbol(): string {
  return getActiveCurrency().symbol;
}

export async function setActiveCurrencyAsync(code: string): Promise<void> {
  currentSettings.currencyCode = code;
  await persistSettings();
  notifyListeners();
}

export function getThemePreference(): ThemePreference {
  return currentSettings.themePreference;
}

export async function setThemePreferenceAsync(theme: ThemePreference): Promise<void> {
  currentSettings.themePreference = theme;
  if (theme === 'light' || theme === 'dark') {
    Appearance.setColorScheme(theme);
  } else {
    Appearance.setColorScheme('unspecified');
  }
  await persistSettings();
  notifyListeners();
}

export function getLastInsightsSegment(): InsightsSegment {
  return currentSettings.lastInsightsSegment || 'analysis';
}

export async function setLastInsightsSegmentAsync(segment: InsightsSegment): Promise<void> {
  currentSettings.lastInsightsSegment = segment;
  await persistSettings();
  notifyListeners();
}

let dueSoonRemindersCount = 0;
const dueSoonListeners = new Set<() => void>();

export function getDueSoonCount(): number {
  return dueSoonRemindersCount;
}

export function setDueSoonCount(count: number): void {
  dueSoonRemindersCount = count;
  dueSoonListeners.forEach((listener) => listener());
}

export function useDueSoonCount(): number {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((prev) => prev + 1);
    dueSoonListeners.add(listener);
    return () => {
      dueSoonListeners.delete(listener);
    };
  }, []);

  return dueSoonRemindersCount;
}

/**
 * React hook to access and subscribe to settings.
 */
export function useSettings() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((prev) => prev + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    currency: getActiveCurrency(),
    currencies: CURRENCIES,
    themePreference: getThemePreference(),
    lastInsightsSegment: getLastInsightsSegment(),
    dueSoonCount: dueSoonRemindersCount,
    setCurrency: setActiveCurrencyAsync,
    setThemePreference: setThemePreferenceAsync,
    setLastInsightsSegment: setLastInsightsSegmentAsync,
    setDueSoonCount,
  };
}
