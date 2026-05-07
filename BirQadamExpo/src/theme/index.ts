import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';

export type AppThemeMode = 'light' | 'dark';

export type AppColorPalette = {
  background: string;
  backgroundElevated: string;
  surface: string;
  surfaceElevated: string;
  surfaceSoft: string;
  surfaceMuted: string;
  border: string;
  borderSoft: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textSoft: string;
  primary: string;
  primaryDark: string;
  primarySoft: string;
  primarySurface: string;
  primarySurfaceStrong: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  info: string;
  overlay: string;
  white: string;
  black: string;
};

export const appThemePalettes: Record<AppThemeMode, AppColorPalette> = {
  light: {
    background: '#F8FAFC',
    backgroundElevated: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSoft: '#F8FAFC',
    surfaceMuted: '#E2E8F0',
    border: '#E5E7EB',
    borderSoft: '#F1F5F9',
    borderStrong: '#CBD5E1',
    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSoft: '#94A3B8',
    primary: '#10B981',
    primaryDark: '#059669',
    primarySoft: '#34D399',
    primarySurface: '#ECFDF5',
    primarySurfaceStrong: '#D1FAE5',
    warning: '#F59E0B',
    warningSurface: '#FFF7ED',
    danger: '#EF4444',
    dangerSurface: '#FEF2F2',
    info: '#2563EB',
    overlay: 'rgba(15, 23, 42, 0.45)',
    white: '#FFFFFF',
    black: '#000000',
  },
  dark: {
    background: '#000000',
    backgroundElevated: '#050505',
    surface: '#0A0A0A',
    surfaceElevated: '#111111',
    surfaceSoft: '#151515',
    surfaceMuted: '#1A1A1A',
    border: '#262626',
    borderSoft: '#303030',
    borderStrong: '#3A3A3A',
    text: '#F8FAFC',
    textSecondary: '#E5E5E5',
    textMuted: '#D4D4D4',
    textSoft: '#9A9A9A',
    primary: '#10B981',
    primaryDark: '#059669',
    primarySoft: '#34D399',
    primarySurface: '#052E26',
    primarySurfaceStrong: '#064E3B',
    warning: '#F59E0B',
    warningSurface: '#422006',
    danger: '#EF4444',
    dangerSurface: '#3B1218',
    info: '#38BDF8',
    overlay: 'rgba(0, 0, 0, 0.82)',
    white: '#FFFFFF',
    black: '#000000',
  },
};

let currentThemeMode: AppThemeMode = 'light';

export const appColors: AppColorPalette = { ...appThemePalettes.light };

export const setAppThemeMode = (mode: AppThemeMode) => {
  currentThemeMode = mode;
  Object.assign(appColors, appThemePalettes[mode]);
};

export const getAppThemeMode = () => currentThemeMode;

export const getAppNavigationTheme = (mode: AppThemeMode = currentThemeMode): Theme => {
  const colors = appThemePalettes[mode];
  const baseTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  return {
    ...baseTheme,
    dark: mode === 'dark',
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
  };
};

export const appNavigationTheme = getAppNavigationTheme();
