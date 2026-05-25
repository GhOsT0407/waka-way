import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from '../theme/colors';

export const COLORS = {
  PRIMARY:         '#E8541A',
  SECONDARY:       '#C4430E',
  ACCENT:          '#FF6B35',
  ERROR:           '#C0392B',
  SUCCESS:         '#2D7A4F',
  INFO:            '#1A5BDB',
  WARNING:         '#C8790A',
  BACKGROUND:      '#F8F7F5',
  SURFACE:         '#FFFFFF',
  CARD_BACKGROUND: '#FFFFFF',
  TEXT:            '#111111',
  TEXT_SECONDARY:  '#6B6B6B',
  BORDER:          '#E5E5E5',
  WHITE:           '#FFFFFF',
  BLACK:           '#000000',
  ROUTE_PATH:      '#E8541A',
  CHIP_BACKGROUND: '#FDF0EA',
} as const;

export const DARK_COLORS = {
  PRIMARY:         '#FF6B35',
  SECONDARY:       '#FF8050',
  ACCENT:          '#FF6B35',
  ERROR:           '#E05C4B',
  SUCCESS:         '#4CAF82',
  INFO:            '#4D88FF',
  WARNING:         '#F0A030',
  BACKGROUND:      '#111318',
  SURFACE:         '#1C1C1E',
  CARD_BACKGROUND: '#1C1C1E',
  TEXT:            '#F5F5F5',
  TEXT_SECONDARY:  '#9E9E9E',
  BORDER:          '#2A2A2A',
  WHITE:           '#FFFFFF',
  BLACK:           '#000000',
  ROUTE_PATH:      '#FF6B35',
  CHIP_BACKGROUND: '#2A1A10',
} as const;

type ThemeType = {
  PRIMARY: string; SECONDARY: string; ACCENT: string; ERROR: string;
  SUCCESS: string; INFO: string; WARNING: string; BACKGROUND: string;
  SURFACE: string; CARD_BACKGROUND: string; TEXT: string;
  TEXT_SECONDARY: string; BORDER: string; WHITE: string; BLACK: string;
  ROUTE_PATH: string; CHIP_BACKGROUND: string;
};

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  toggleTheme: () => void;
  // Typed access to full design token sets
  light: typeof LightColors;
  dark: typeof DarkColors;
  tokens: typeof LightColors | typeof DarkColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [manualDark, setManualDark] = useState<boolean | null>(null);

  const isDark = manualDark !== null ? manualDark : systemScheme === 'dark';
  const theme  = isDark ? DARK_COLORS : COLORS;
  const tokens = isDark ? DarkColors  : LightColors;

  const toggleTheme = () => setManualDark((prev) => (prev !== null ? !prev : !isDark));

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, light: LightColors, dark: DarkColors, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within a ThemeProvider');
  return context;
};
