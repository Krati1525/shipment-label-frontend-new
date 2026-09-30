import React, { InputHTMLAttributes, ReactNode, useId } from 'react';
import styles from './Input.module.css';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      containerClassName,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    return (
      <div className={cn(styles.container, containerClassName)}>
        {label && (
          <label htmlFor={inputId} className={styles.label}>
            <span>
              {label}
              {required && <span className={styles.required}>*</span>}
            </span>
          </label>
        )}

        <div className={styles.inputWrapper}>
          {leftIcon && <span className={styles.iconSlotLeft}>{leftIcon}</span>}

          <input
            ref={ref}
            id={inputId}
            className={cn(
              styles.input,
              Boolean(leftIcon) && styles.hasLeftIcon,
              Boolean(rightIcon) && styles.hasRightIcon,
              Boolean(error) && styles.hasError,
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : hint ? hintId : undefined
            }
            required={required}
            {...props}
          />

          {rightIcon && <span className={styles.iconSlotRight}>{rightIcon}</span>}
        </div>

        {error && (
          <div id={errorId} className={styles.errorMessage} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {!error && hint && (
          <div id={hintId} className={styles.hintText}>
            {hint}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
