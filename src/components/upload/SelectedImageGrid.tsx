import React from 'react';
import styles from './SelectedImageGrid.module.css';
import { X, Image as ImageIcon } from 'lucide-react';
import { formatFileSize } from '@/lib/utils';

export interface QueuedFile {
  id: string;
  file: File;
  previewUrl: string;
}

export interface SelectedImageGridProps {
  files: QueuedFile[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function SelectedImageGrid({
  files,
  onRemove,
  disabled = false,
}: SelectedImageGridProps) {
  if (files.length === 0) return null;

  return (
    <div className={styles.grid}>
      {files.map((item) => (
        <div key={item.id} className={styles.itemCard}>
          <div className={styles.thumbnailContainer}>
            {item.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className={styles.thumbnail}
              />
            ) : (
              <div className={styles.thumbnailFallback}>
                <ImageIcon size={32} />
              </div>
            )}

            {!disabled && (
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.file.name}`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.itemMeta}>
            <span className={styles.fileName} title={item.file.name}>
              {item.file.name}
            </span>
            <span className={styles.fileSize}>
              {formatFileSize(item.file.size)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
