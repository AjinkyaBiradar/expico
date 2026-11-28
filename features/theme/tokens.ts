export type ResolvedTheme = 'light' | 'dark';

export interface ThemeTokens {
  background: string;
  card: string;
  surface: string;
  surfaceElevated: string;
  surfaceVariant: string;
  headerBackground: string;
  tabBarBackground: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  accentContrast: string;
  income: string;
  incomeLight: string;
  danger: string;
  dangerLight: string;
  expense: string;
  expenseLight: string;
  warning: string;
  warningLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  shadowColor: string;
  overlay: string;
  categoryOther: string;
  tint: string;
  tabIconDefault: string;
  tabIconSelected: string;
}

export const darkTokens: ThemeTokens = {
  background: '#0F131C',
  card: '#1C1F29',
  surface: '#1C1F29',
  surfaceElevated: '#1F2432',
  surfaceVariant: '#262A34',
  headerBackground: '#1C1F29',
  tabBarBackground: '#0B0E17',
  tabBarBorder: '#1C1F29',
  tabBarActive: '#4EDEA3',
  tabBarInactive: '#86948A',
  primary: '#4EDEA3',
  primaryDark: '#10B981',
  primaryLight: 'rgba(78, 222, 163, 0.15)',
  accent: '#4EDEA3',
  accentContrast: '#003824',
  income: '#4EDEA3',
  incomeLight: 'rgba(78, 222, 163, 0.15)',
  danger: '#FFB2B7',
  dangerLight: 'rgba(244, 63, 94, 0.18)',
  expense: '#FFB2B7',
  expenseLight: 'rgba(255, 178, 183, 0.15)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.18)',
  text: '#DFE2EF',
  textSecondary: '#BBCABF',
  textMuted: '#86948A',
  border: '#262A34',
  borderSubtle: '#181B25',
  shadowColor: '#000000',
  overlay: 'rgba(0, 0, 0, 0.65)',
  categoryOther: '#86948A',
  tint: '#4EDEA3',
  tabIconDefault: '#86948A',
  tabIconSelected: '#4EDEA3',
};

export const lightTokens: ThemeTokens = {
  background: '#F8FAFC',
  card: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceVariant: '#F1F5F9',
  headerBackground: '#FFFFFF',
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#10B981',
  tabBarInactive: '#64748B',
  primary: '#10B981',
  primaryDark: '#059669',
  primaryLight: '#D1FAE5',
  accent: '#10B981',
  accentContrast: '#FFFFFF',
  income: '#059669',
  incomeLight: '#D1FAE5',
  danger: '#E11D48',
  dangerLight: '#FFE4E6',
  expense: '#E11D48',
  expenseLight: '#FFE4E6',
  warning: '#D97706',
  warningLight: '#FEF3C7',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  shadowColor: '#64748B',
  overlay: 'rgba(15, 23, 42, 0.45)',
  categoryOther: '#94A3B8',
  tint: '#10B981',
  tabIconDefault: '#64748B',
  tabIconSelected: '#10B981',
};

export function getTokens(theme: ResolvedTheme): ThemeTokens {
  return theme === 'light' ? lightTokens : darkTokens;
}
