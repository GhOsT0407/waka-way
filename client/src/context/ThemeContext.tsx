import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const COLORS = {
  PRIMARY: '#2E7D32',
  SECONDARY: '#388E3C',
  ACCENT: '#4CAF50',
  ERROR: '#D32F2F',
  SUCCESS: '#2E7D32',
  INFO: '#1976D2',
  WARNING: '#FFA000',
  BACKGROUND: '#FFFFFF',
  SURFACE: '#F8F9FA',
  CARD_BACKGROUND: '#FFFFFF',
  TEXT: '#1C1B1F',
  TEXT_SECONDARY: '#444746',
  BORDER: '#E0E0E0',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#1B5E20',
  CHIP_BACKGROUND: 'rgba(46, 125, 50, 0.08)',
};

export const DARK_COLORS = {
  PRIMARY: '#81C784',
  SECONDARY: '#4CAF50',
  ACCENT: '#A5D6A7',
  ERROR: '#FF5252',
  SUCCESS: '#81C784',
  INFO: '#448AFF',
  WARNING: '#FFD740',
  BACKGROUND: '#1C1B1F',
  SURFACE: '#2A2A2A',
  CARD_BACKGROUND: '#242424',
  TEXT: '#E1E3E1',
  TEXT_SECONDARY: '#C4C7C5',
  BORDER: '#3A3A3A',
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#4CAF50',
  CHIP_BACKGROUND: 'rgba(76, 175, 80, 0.12)',
};

type ThemeType = typeof COLORS;
type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  themeMode: ThemeMode;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const THEME_PREF_KEY = '@waka_theme_mode';
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREF_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_PREF_KEY, mode);
  };

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    setThemeMode(next);
  };

  const isDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemColorScheme === 'dark');

  const theme = isDark ? DARK_COLORS : COLORS;

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, isDark, themeMode, toggleTheme, setThemeMode }}>
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
