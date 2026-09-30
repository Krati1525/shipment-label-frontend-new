import React from 'react';
import styles from './Toast.module.css';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  type?: 'success' | 'error' | 'info' | 'warning';
  message: string;
  onClose?: () => void;
  className?: string;
}

export function Toast({ type = 'info', message, onClose, className }: ToastProps) {
  const icons = {
    success: <CheckCircle2 size={18} aria-hidden="true" />,
    error: <AlertCircle size={18} aria-hidden="true" />,
    info: <Info size={18} aria-hidden="true" />,
    warning: <AlertTriangle size={18} aria-hidden="true" />,
  };

  return (
    <div className={cn(styles.toast, styles[type], className)} role="status">
      <span aria-hidden="true">{icons[type]}</span>
      <div className={styles.message}>{message}</div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={styles.closeBtn}
          aria-label="Dismiss notification"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
