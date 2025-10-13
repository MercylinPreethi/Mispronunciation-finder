/**
 * Material Design 3 Color System
 * Professional color palette with semantic naming
 */

// Primary Brand Colors - Material Design 3
const primary = {
  main: '#6366F1',      // Indigo 500
  light: '#818CF8',     // Indigo 400
  dark: '#4F46E5',      // Indigo 600
  surface: '#EEF2FF',   // Indigo 50
  onSurface: '#312E81', // Indigo 900
};

const secondary = {
  main: '#8B5CF6',      // Purple 500
  light: '#A78BFA',     // Purple 400
  dark: '#7C3AED',      // Purple 600
  surface: '#F5F3FF',   // Purple 50
  onSurface: '#4C1D95', // Purple 900
};

const tertiary = {
  main: '#EC4899',      // Pink 500
  light: '#F472B6',     // Pink 400
  dark: '#DB2777',      // Pink 600
  surface: '#FDF2F8',   // Pink 50
  onSurface: '#831843', // Pink 900
};

// Semantic Colors
const success = {
  main: '#10B981',      // Green 500
  light: '#34D399',     // Green 400
  dark: '#059669',      // Green 600
  surface: '#ECFDF5',   // Green 50
  onSurface: '#064E3B', // Green 900
};

const warning = {
  main: '#F59E0B',      // Amber 500
  light: '#FBBF24',     // Amber 400
  dark: '#D97706',      // Amber 600
  surface: '#FFFBEB',   // Amber 50
  onSurface: '#78350F', // Amber 900
};

const error = {
  main: '#EF4444',      // Red 500
  light: '#F87171',     // Red 400
  dark: '#DC2626',      // Red 600
  surface: '#FEF2F2',   // Red 50
  onSurface: '#7F1D1D', // Red 900
};

const info = {
  main: '#3B82F6',      // Blue 500
  light: '#60A5FA',     // Blue 400
  dark: '#2563EB',      // Blue 600
  surface: '#EFF6FF',   // Blue 50
  onSurface: '#1E3A8A', // Blue 900
};

// Neutral Colors
const neutral = {
  50: '#FAFAFA',
  100: '#F5F5F5',
  200: '#E5E5E5',
  300: '#D4D4D4',
  400: '#A3A3A3',
  500: '#737373',
  600: '#525252',
  700: '#404040',
  800: '#262626',
  900: '#171717',
  950: '#0A0A0A',
};

// Gray Scale (Slate)
const gray = {
  50: '#F8FAFC',
  100: '#F1F5F9',
  200: '#E2E8F0',
  300: '#CBD5E1',
  400: '#94A3B8',
  500: '#64748B',
  600: '#475569',
  700: '#334155',
  800: '#1E293B',
  900: '#0F172A',
  950: '#020617',
};

// Surface & Background
const surface = {
  background: '#F8F9FE',
  paper: '#FFFFFF',
  card: '#FFFFFF',
  elevated: '#FFFFFF',
  overlay: 'rgba(15, 23, 42, 0.7)',
};

// Text Colors
const text = {
  primary: '#1F2937',
  secondary: '#6B7280',
  tertiary: '#9CA3AF',
  disabled: '#D1D5DB',
  inverse: '#FFFFFF',
};

// Borders & Dividers
const border = {
  light: '#F3F4F6',
  main: '#E5E7EB',
  dark: '#D1D5DB',
  focus: '#6366F1',
};

// Shadows (Material Design 3 Elevation)
const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  '2xl': {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 32,
    elevation: 15,
  },
};

// Gradients
const gradients = {
  primary: ['#6366F1', '#8B5CF6'],
  secondary: ['#8B5CF6', '#EC4899'],
  brand: ['#6366F1', '#8B5CF6', '#EC4899'],
  success: ['#10B981', '#059669'],
  warning: ['#F59E0B', '#D97706'],
  error: ['#EF4444', '#DC2626'],
  ocean: ['#3B82F6', '#2DD4BF'],
  sunset: ['#F59E0B', '#EC4899'],
  night: ['#1E293B', '#0F172A'],
};

// Export organized color system
export const MaterialColors = {
  primary,
  secondary,
  tertiary,
  success,
  warning,
  error,
  info,
  neutral,
  gray,
  surface,
  text,
  border,
  shadows,
  gradients,
};

// Legacy support - keep existing exports
const tintColorLight = '#6366F1';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#1F2937',
    background: '#F8F9FE',
    tint: tintColorLight,
    icon: '#6B7280',
    tabIconDefault: '#9CA3AF',
    tabIconSelected: tintColorLight,
    card: '#FFFFFF',
    border: '#E5E7EB',
    notification: '#EF4444',
  },
  dark: {
    text: '#F9FAFB',
    background: '#0F172A',
    tint: tintColorDark,
    icon: '#9CA3AF',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorDark,
    card: '#1E293B',
    border: '#334155',
    notification: '#F87171',
  },
};

// Spacing System (Material Design 3)
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
  '6xl': 80,
};

// Border Radius (Material Design 3)
export const BorderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
};

// Typography (Material Design 3)
export const Typography = {
  // Display
  displayLarge: {
    fontSize: 57,
    lineHeight: 64,
    fontWeight: '400' as const,
    letterSpacing: -0.25,
  },
  displayMedium: {
    fontSize: 45,
    lineHeight: 52,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  displaySmall: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '400' as const,
    letterSpacing: 0,
  },
  
  // Headline
  headlineLarge: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  
  // Title
  titleLarge: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '600' as const,
    letterSpacing: 0,
  },
  titleMedium: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  
  // Body
  bodyLarge: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
    letterSpacing: 0.4,
  },
  
  // Label
  labelLarge: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
};
