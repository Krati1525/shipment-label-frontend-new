'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  applyPrimaryColorToDOM,
  removePrimaryColorFromDOM,
  DEFAULT_PRIMARY_COLOR,
  parseHex,
} from '@/lib/colorUtils';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  resetPrimaryColor: () => void;
  isMounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'shipmentflow_theme';
const COLOR_STORAGE_KEY = 'shipmentflow_primary_color';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light');
  const [primaryColor, setPrimaryColorState] = useState<string>(DEFAULT_PRIMARY_COLOR);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    let activeTheme: Theme = 'light';

    try {
      // 1. Resolve light/dark theme
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        activeTheme = savedTheme;
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        activeTheme = prefersDark ? 'dark' : 'light';
      }

      setThemeState(activeTheme);
      document.documentElement.setAttribute('data-theme', activeTheme);

      // 2. Resolve primary accent color
      const savedColor = localStorage.getItem(COLOR_STORAGE_KEY);
      if (savedColor && parseHex(savedColor)) {
        setPrimaryColorState(savedColor);
        applyPrimaryColorToDOM(savedColor, activeTheme === 'dark');
      }

      // 3. Listen to system theme changes if no explicit theme was stored
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (!localStorage.getItem(THEME_STORAGE_KEY)) {
          const sysTheme: Theme = e.matches ? 'dark' : 'light';
          setThemeState(sysTheme);
          document.documentElement.setAttribute('data-theme', sysTheme);

          const currentColor = localStorage.getItem(COLOR_STORAGE_KEY);
          if (currentColor && parseHex(currentColor)) {
            applyPrimaryColorToDOM(currentColor, sysTheme === 'dark');
          }
        }
      };

      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } catch {
      // Ignore storage access errors in restricted iframe environments
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore
    }
    document.documentElement.setAttribute('data-theme', newTheme);

    // Re-calculate color variables for the new theme mode if a custom primary color is active
    try {
      const savedColor = localStorage.getItem(COLOR_STORAGE_KEY);
      if (savedColor && parseHex(savedColor)) {
        applyPrimaryColorToDOM(savedColor, newTheme === 'dark');
      }
    } catch {
      // Ignore
    }
  };

  const toggleTheme = () => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  const setPrimaryColor = (color: string) => {
    if (!parseHex(color)) return;
    setPrimaryColorState(color);
    try {
      localStorage.setItem(COLOR_STORAGE_KEY, color);
    } catch {
      // Ignore
    }
    applyPrimaryColorToDOM(color, theme === 'dark');
  };

  const resetPrimaryColor = () => {
    try {
      localStorage.removeItem(COLOR_STORAGE_KEY);
    } catch {
      // Ignore
    }
    removePrimaryColorFromDOM();
    setPrimaryColorState(DEFAULT_PRIMARY_COLOR);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        primaryColor,
        setPrimaryColor,
        resetPrimaryColor,
        isMounted,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
