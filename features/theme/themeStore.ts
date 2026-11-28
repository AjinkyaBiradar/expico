import * as FileSystem from 'expo-file-system/legacy';
import * as SystemUI from 'expo-system-ui';
import { Appearance, Platform } from 'react-native';
import { create } from 'zustand';

import { ResolvedTheme } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  systemColorScheme: ResolvedTheme;
  isLoaded: boolean;
  initThemeAsync: () => Promise<void>;
  setMode: (mode: ThemeMode) => Promise<void>;
  updateSystemColorScheme: (scheme: ResolvedTheme) => void;
}

const STORAGE_KEY = 'vaultflow_theme_mode';

function getStorageFilePath(): string | null {
  if (Platform.OS === 'web') return null;
  const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  return dir ? `${dir}vaultflow_theme_mode.json` : null;
}

function resolveInitialSystemScheme(): ResolvedTheme {
  const scheme = Appearance.getColorScheme();
  return scheme === 'light' ? 'light' : 'dark';
}

function resolveEagerMode(): ThemeMode {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // ignore
    }
  }
  return 'system';
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: resolveEagerMode(),
  systemColorScheme: resolveInitialSystemScheme(),
  isLoaded: Platform.OS === 'web',

  initThemeAsync: async () => {
    try {
      let savedMode: ThemeMode | null = null;

      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          savedMode = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
        }
      } else {
        const filePath = getStorageFilePath();
        if (filePath) {
          const info = await FileSystem.getInfoAsync(filePath);
          if (info.exists) {
            const raw = await FileSystem.readAsStringAsync(filePath);
            const parsed = JSON.parse(raw);
            if (parsed && parsed.mode) {
              savedMode = parsed.mode;
            }
          }
        }
      }

      const activeMode: ThemeMode =
        savedMode === 'light' || savedMode === 'dark' || savedMode === 'system'
          ? savedMode
          : 'system';

      const initialSystemScheme = resolveInitialSystemScheme();
      const resolved = activeMode === 'system' ? initialSystemScheme : activeMode;

      if (activeMode === 'system') {
        Appearance.setColorScheme('unspecified');
      } else {
        Appearance.setColorScheme(activeMode);
      }

      SystemUI.setBackgroundColorAsync(resolved === 'dark' ? '#0F131C' : '#F8FAFC').catch(() => {});

      set({
        mode: activeMode,
        systemColorScheme: initialSystemScheme,
        isLoaded: true,
      });
    } catch (err) {
      console.warn('[ThemeStore] Failed to initialize theme:', err);
      set({ isLoaded: true });
    }
  },

  setMode: async (nextMode: ThemeMode) => {
    const current = get();
    if (current.mode === nextMode) return;

    const resolved = nextMode === 'system' ? current.systemColorScheme : nextMode;

    if (nextMode === 'system') {
      Appearance.setColorScheme('unspecified');
    } else {
      Appearance.setColorScheme(nextMode);
    }

    SystemUI.setBackgroundColorAsync(resolved === 'dark' ? '#0F131C' : '#F8FAFC').catch(() => {});

    set({ mode: nextMode });

    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, nextMode);
        }
      } else {
        const filePath = getStorageFilePath();
        if (filePath) {
          await FileSystem.writeAsStringAsync(filePath, JSON.stringify({ mode: nextMode }));
        }
      }
    } catch (err) {
      console.warn('[ThemeStore] Failed to persist theme mode:', err);
    }
  },

  updateSystemColorScheme: (scheme: ResolvedTheme) => {
    const current = get();
    if (current.systemColorScheme === scheme) return;

    set({ systemColorScheme: scheme });

    if (current.mode === 'system') {
      SystemUI.setBackgroundColorAsync(scheme === 'dark' ? '#0F131C' : '#F8FAFC').catch(() => {});
    }
  },
}));
