import React, { createContext, useContext, useState, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { WW_LIGHT, WW_DARK, type WWColors } from '../theme/colors';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  // The one design palette. Brand accents and transport-mode colours are the
  // same in both sets; only the neutral canvas flips with day/night.
  WW: WWColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Night runs 7pm–6am local time; everything else is day. Lagos doesn't
// observe DST and sits close enough to the equator that this fixed window
// tracks real dusk/dawn well enough without needing a location lookup.
const NIGHT_START_HOUR = 19;
const NIGHT_END_HOUR   = 6;

function isNightNow(): boolean {
  const hour = new Date().getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [manualDark, setManualDark] = useState<boolean | null>(null);
  // Bumping this forces a re-render so the day/night check re-evaluates —
  // isNightNow() itself isn't reactive, it just reads the clock.
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    const onAppStateChange = (state: AppStateStatus) => {
      if (state === 'active') setTick((t) => t + 1);
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, []);

  const isDark = manualDark !== null ? manualDark : isNightNow();
  const WW = isDark ? WW_DARK : WW_LIGHT;

  const toggleTheme = () => setManualDark((prev) => (prev !== null ? !prev : !isDark));

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, WW }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within a ThemeProvider');
  return context;
};
