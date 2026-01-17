import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const COLORS = {
  PRIMARY: '#2E7D32',     // Forest Green
  SECONDARY: '#388E3C',   // Darker Green
  ACCENT: '#4CAF50',      // Bright Green
  ERROR: '#D32F2F',
  SUCCESS: '#2E7D32',
  INFO: '#1976D2',
  WARNING: '#FFA000',
  BACKGROUND: '#FFFFFF',  // Light Background
  SURFACE: '#FFFFFF',     // White Surface
  CARD_BACKGROUND: '#FFFFFF',
  TEXT: '#1C1B1F',        // High emphasis text - Light Mode Primary
  TEXT_SECONDARY: '#444746', // Medium emphasis text - Light Mode Secondary
  BORDER: '#E0E0E0',      // Light border
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#1B5E20',  // Dark Green for routes
  CHIP_BACKGROUND: 'rgba(46, 125, 50, 0.08)', // Very faint brand green tint
};

export const DARK_COLORS = {
  PRIMARY: '#81C784',      // Light Green
  SECONDARY: '#4CAF50',    // Bright Green
  ACCENT: '#A5D6A7',       // Lighter Green
  ERROR: '#FF5252',
  SUCCESS: '#81C784',
  INFO: '#448AFF',
  WARNING: '#FFD740',
  BACKGROUND: '#1C1B1F',   // Dark Background
  SURFACE: '#1C1B1F',      // Dark Surface
  CARD_BACKGROUND: '#212121',
  TEXT: '#E1E3E1',         // Light text - Dark Mode Primary
  TEXT_SECONDARY: '#C4C7C5', // Secondary text - Dark Mode Secondary
  BORDER: '#333333',       // Dark border
  WHITE: '#FFFFFF',
  BLACK: '#000000',
  ROUTE_PATH: '#4CAF50',   // Bright Green for routes
  CHIP_BACKGROUND: 'rgba(76, 175, 80, 0.12)', // Faint brand green tint for dark mode
};

type ThemeType = typeof COLORS;

interface ThemeContextType {
  theme: ThemeType;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('theme');
      if (savedTheme !== null) {
        setIsDark(savedTheme === 'dark');
      } else {
        // First launch - detect system theme
        setIsDark(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
      // Fallback to system theme
      setIsDark(systemColorScheme === 'dark');
    }
  };

  const toggleTheme = async () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    try {
      await AsyncStorage.setItem('theme', newIsDark ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  };

  const theme = isDark ? DARK_COLORS : COLORS;

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme }}>
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