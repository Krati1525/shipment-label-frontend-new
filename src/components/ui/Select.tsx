import React, { SelectHTMLAttributes, useId } from 'react';
import styles from './Select.module.css';
import { cn } from '@/lib/utils';
import { ChevronDown, AlertCircle } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      options,
      children,
      containerClassName,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;

    return (
      <div className={cn(styles.container, containerClassName)}>
        {label && (
          <label htmlFor={selectId} className={styles.label}>
            <span>{label}</span>
            {required && <span className={styles.required}>*</span>}
          </label>
        )}

        <div className={styles.selectWrapper}>
          <select
            ref={ref}
            id={selectId}
            className={cn(
              styles.select,
              Boolean(error) && styles.hasError,
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            required={required}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <span className={styles.caret} aria-hidden="true">
            <ChevronDown size={16} />
          </span>
        </div>

        {error && (
          <div id={errorId} className={styles.errorMessage} role="alert">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
