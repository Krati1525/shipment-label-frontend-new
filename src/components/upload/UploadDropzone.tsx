import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import styles from './UploadDropzone.module.css';
import { UploadCloud, FileImage, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

import { FileValidationError } from './UploadValidationErrors';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function isAcceptedFileType(file: File): boolean {
  if (file.type && ACCEPTED_MIME_TYPES.includes(file.type.toLowerCase())) {
    return true;
  }
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onValidationErrors?: (errors: FileValidationError[]) => void;
  disabled?: boolean;
}

export function UploadDropzone({
  onFilesSelected,
  onValidationErrors,
  disabled = false,
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndAddFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const validFiles: File[] = [];
    const errors: FileValidationError[] = [];

    Array.from(fileList).forEach((file) => {
      if (!isAcceptedFileType(file)) {
        errors.push({
          fileName: file.name,
          reason: 'Unsupported file type. Please upload JPG, PNG, or WEBP.',
        });
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push({
          fileName: file.name,
          reason: 'File exceeds the 10 MB limit.',
        });
        return;
      }
      validFiles.push(file);
    });

    if (errors.length > 0 && onValidationErrors) {
      onValidationErrors(errors);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (!disabled) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    validateAndAddFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={cn(styles.dropzone, isDragOver && styles.dragOver)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          fileInputRef.current?.click();
        }
      }}
      aria-label="Upload shipment label images by dragging or browsing"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className={styles.fileInput}
        onChange={handleFileInputChange}
        disabled={disabled}
      />

      <div className={styles.iconCircle}>
        <UploadCloud size={32} />
      </div>

      <div className={styles.instructions}>
        <h3 className={styles.title}>Drag & drop shipment label images</h3>
        <p className={styles.subtitle}>
          Upload single or multiple shipping labels for automatic OCR text extraction
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        Browse Files
      </Button>

      <div className={styles.metaInfo}>
        <span className={styles.metaItem}>
          <FileImage size={14} /> Accepted: JPG, PNG, WEBP
        </span>
        <span className={styles.metaItem}>
          <ShieldAlert size={14} /> Max size: 10 MB per image
        </span>
      </div>
    </div>
  );
}
