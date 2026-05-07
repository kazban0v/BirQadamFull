import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { type AppThemeMode, setAppThemeMode } from '../theme';

const THEME_STORAGE_KEY = '@birqadam:theme_mode';

interface ThemeState {
  mode: AppThemeMode;
  isLoaded: boolean;
  isDarkTheme: boolean;
  loadTheme: () => Promise<void>;
  setThemeMode: (mode: AppThemeMode) => Promise<void>;
  toggleTheme: (enabled: boolean) => Promise<void>;
}

const normalizeThemeMode = (value: string | null): AppThemeMode =>
  value === 'dark' ? 'dark' : 'light';

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'light',
  isLoaded: false,
  isDarkTheme: false,

  loadTheme: async () => {
    const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    const mode = normalizeThemeMode(storedMode);

    setAppThemeMode(mode);
    set({ mode, isDarkTheme: mode === 'dark', isLoaded: true });
  },

  setThemeMode: async (mode: AppThemeMode) => {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    setAppThemeMode(mode);
    set({ mode, isDarkTheme: mode === 'dark', isLoaded: true });
  },

  toggleTheme: async (enabled: boolean) => {
    const mode: AppThemeMode = enabled ? 'dark' : 'light';
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    setAppThemeMode(mode);
    set({ mode, isDarkTheme: enabled, isLoaded: true });
  },
}));
