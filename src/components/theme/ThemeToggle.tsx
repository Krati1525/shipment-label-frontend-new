'use client';

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';
import styles from './ThemeToggle.module.css';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'pill' | 'icon';
  className?: string;
}

export function ThemeToggle({
  showLabel = false,
  variant = 'pill',
  className,
}: ThemeToggleProps) {
  const { theme, toggleTheme, isMounted } = useTheme();

  // If not mounted yet (SSR), render a placeholder with consistent dimensions to avoid layout shift
  if (!isMounted) {
    return (
      <button
        type="button"
        className={cn(
          styles.toggleBtn,
          variant === 'icon' && styles.iconOnly,
          className
        )}
        aria-label="Toggle theme"
        disabled
      >
        <span className={styles.iconWrapper}>
          <Sun size={16} className={styles.sunIcon} />
        </span>
        {showLabel && <span className={styles.label}>Theme</span>}
      </button>
    );
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        styles.toggleBtn,
        variant === 'icon' && styles.iconOnly,
        className
      )}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className={styles.iconWrapper}>
        {isDark ? (
          <Moon size={16} className={styles.moonIcon} />
        ) : (
          <Sun size={16} className={styles.sunIcon} />
        )}
      </span>
      {showLabel && (
        <span className={styles.label}>
          {isDark ? 'Dark Mode' : 'Light Mode'}
        </span>
      )}
    </button>
  );
}
