import React from 'react';
import styles from './UploadValidationErrors.module.css';
import { AlertCircle, X, XCircle } from 'lucide-react';

export interface FileValidationError {
  fileName: string;
  reason: string;
}

export interface UploadValidationErrorsProps {
  errors: FileValidationError[];
  onDismiss: () => void;
}

export function UploadValidationErrors({
  errors,
  onDismiss,
}: UploadValidationErrorsProps) {
  if (errors.length === 0) return null;

  return (
    <div className={styles.container} role="alert">
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <AlertCircle size={18} />
          <span>
            {errors.length} {errors.length === 1 ? 'file was' : 'files were'} rejected before upload
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className={styles.dismissBtn}
          aria-label="Dismiss validation warnings"
        >
          <X size={16} />
        </button>
      </div>

      <ul className={styles.errorList}>
        {errors.map((err, idx) => (
          <li key={`${err.fileName}-${idx}`} className={styles.errorItem}>
            <XCircle size={15} className={styles.crossIcon} aria-hidden="true" />
            <div className={styles.errorContent}>
              <span className={styles.fileName}>{err.fileName}</span>
              <span className={styles.reason}>{err.reason}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
