import React, { ReactNode } from 'react';
import styles from './ErrorState.module.css';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = 'An error occurred',
  message = 'We could not complete your request. Please try again.',
  onRetry,
  action,
  className,
}: ErrorStateProps) {
  return (
    <div className={cn(styles.container, className)} role="alert">
      <div className={styles.iconWrapper}>
        <AlertTriangle size={24} aria-hidden="true" />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} />}
        >
          Try Again
        </Button>
      )}
      {action}
    </div>
  );
}
