import React from 'react';
import styles from './LoadingState.module.css';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
  variant?: 'spinner' | 'skeleton' | 'skeleton-cards';
  count?: number;
}

export function LoadingState({
  message = 'Loading data...',
  className,
  variant = 'spinner',
  count = 3,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    return (
      <div className={cn(styles.skeletonGroup, className)} aria-busy="true" aria-label={message}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.skeletonLine} />
        ))}
      </div>
    );
  }

  if (variant === 'skeleton-cards') {
    return (
      <div className={cn(styles.skeletonGroup, className)} aria-busy="true" aria-label={message}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(styles.container, className)} role="status" aria-live="polite">
      <div className={styles.spinner} aria-hidden="true" />
      <span className={styles.message}>{message}</span>
    </div>
  );
}
