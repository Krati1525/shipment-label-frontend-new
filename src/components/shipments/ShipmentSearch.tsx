import React, { ChangeEvent } from 'react';
import styles from './ShipmentSearch.module.css';
import { Search, X } from 'lucide-react';

export interface ShipmentSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
}

export function ShipmentSearch({
  value,
  onChange,
  onClear,
  placeholder = 'Search name, mobile, AWB, courier, address or OCR text...',
}: ShipmentSearchProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className={styles.container}>
      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.icon} aria-hidden="true" />
        <input
          type="text"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={styles.input}
          aria-label="Search shipments"
        />
        {value && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={onClear || (() => onChange(''))}
            aria-label="Clear search input"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
