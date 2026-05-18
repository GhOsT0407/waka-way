import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

export const COLORS = {
  PRIMARY: '#3B82F6',
  SECONDARY: '#2563EB',
  ACCENT: '#60A5FA',
  ERROR: '#EF4444',
  SUCCESS: '#34D399',
  INFO: '#3B82F6',
  WARNING: '#F59E0B',
  BACKGROUND: '#0F172A',
  SURFACE: '#1C2333',
  CARD_BACKGROUND: '#1C2333',
  TEXT: '#F1F5F9',
  TEXT_SECONDARY: '#94A3B8',
  BORDER: 'rgba(255,255,255,0.08)',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#3B82F6',
  CHIP_BACKGROUND: 'rgba(59,130,246,0.12)',
};

export const DARK_COLORS = {
  PRIMARY: '#3B82F6',
  SECONDARY: '#2563EB',
  ACCENT: '#60A5FA',
  ERROR: '#EF4444',
  SUCCESS: '#34D399',
  INFO: '#3B82F6',
  WARNING: '#F59E0B',
  BACKGROUND: '#0F172A',
  SURFACE: '#1C2333',
  CARD_BACKGROUND: '#1C2333',
  TEXT: '#F1F5F9',
  TEXT_SECONDARY: '#94A3B8',
  BORDER: 'rgba(255,255,255,0.08)',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#3B82F6',
  CHIP_BACKGROUND: 'rgba(59,130,246,0.12)',
};

type ThemeType = typeof COLORS;

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const theme = isDark ? DARK_COLORS : COLORS;

  return (
    <ThemeContext.Provider value={{ theme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
};
