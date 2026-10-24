'use client';

import React, { useState, useEffect } from 'react';
import styles from './page.module.css';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { SelectedImageGrid, QueuedFile } from '@/components/upload/SelectedImageGrid';
import {
  UploadValidationErrors,
  FileValidationError,
} from '@/components/upload/UploadValidationErrors';
import { UploadedShipmentList } from '@/components/upload/UploadedShipmentList';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { UploadCloud, Trash2, ArrowRight } from 'lucide-react';
import { uploadShipments } from '@/lib/shipments';
import { Shipment } from '@/types/shipment';

type UploadState = 'IDLE' | 'SELECTING' | 'UPLOADING' | 'SUCCESS' | 'ERROR';

export default function UploadPage() {
  const [uploadState, setUploadState] = useState<UploadState>('IDLE');
  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([]);
  const [validationErrors, setValidationErrors] = useState<FileValidationError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploadedShipments, setUploadedShipments] = useState<Shipment[]>([]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      queuedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [queuedFiles]);

  const handleFilesSelected = (newFiles: File[]) => {
    setErrorMessage(null);
    const mapped: QueuedFile[] = newFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setQueuedFiles((prev) => {
      const updated = [...prev, ...mapped];
      if (updated.length > 0 && uploadState !== 'UPLOADING') {
        setUploadState('SELECTING');
      }
      return updated;
    });
  };

  const handleValidationErrors = (errors: FileValidationError[]) => {
    setValidationErrors((prev) => [...prev, ...errors]);
  };

  const handleRemoveFile = (id: string) => {
    if (uploadState === 'UPLOADING') return;
    setQueuedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const updated = prev.filter((f) => f.id !== id);
      if (updated.length === 0) {
        setUploadState('IDLE');
      }
      return updated;
    });
  };

  const handleClearAll = () => {
    if (uploadState === 'UPLOADING') return;
    queuedFiles.forEach((f) => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setQueuedFiles([]);
    setValidationErrors([]);
    setErrorMessage(null);
    setUploadState('IDLE');
  };

  const handleUpload = async () => {
    if (queuedFiles.length === 0 || uploadState === 'UPLOADING') return;

    setErrorMessage(null);
    setUploadState('UPLOADING');

    try {
      const filesToUpload = queuedFiles.map((q) => q.file);
      const response = await uploadShipments(filesToUpload);

      const items = response.data || response.shipments || [];

      // Clean up object URLs
      queuedFiles.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setQueuedFiles([]);

      // Store returned shipment information and preserve IDs for Step 15
      setUploadedShipments(items);
      setUploadState('SUCCESS');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save shipment labels to local database. Please try again.';
      setErrorMessage(message);
      setUploadState('ERROR');
      // Selected files remain intact in queuedFiles for the user to retry
    }
  };

  const handleUploadMore = () => {
    setUploadedShipments([]);
    setQueuedFiles([]);
    setValidationErrors([]);
    setErrorMessage(null);
    setUploadState('IDLE');
  };

  const isUploading = uploadState === 'UPLOADING';
  const isSuccess = uploadState === 'SUCCESS';

  return (
    <div className={styles.page}>
      <div className={styles.headerArea}>
        <h1 className={styles.title}>Upload Shipment Labels</h1>
        <p className={styles.subtitle}>
          Ingest label scans or mobile photos for OCR extraction and delivery dispatch.
        </p>
      </div>

      {/* Global API Error Toast */}
      {errorMessage && (
        <Toast
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Rejected Files Validation Feedback */}
      {validationErrors.length > 0 && (
        <UploadValidationErrors
          errors={validationErrors}
          onDismiss={() => setValidationErrors([])}
        />
      )}

      {/* If in SUCCESS state, display uploaded shipment information */}
      {isSuccess && uploadedShipments.length > 0 ? (
        <UploadedShipmentList
          shipments={uploadedShipments}
          onUploadMore={handleUploadMore}
        />
      ) : (
        <>
          {/* Dropzone */}
          <UploadDropzone
            onFilesSelected={handleFilesSelected}
            onValidationErrors={handleValidationErrors}
            disabled={isUploading}
          />

          {/* Indeterminate Loading Card during active Upload */}
          {isUploading && (
            <div className={styles.uploadingCard} role="status" aria-live="polite">
              <div className={styles.spinner} />
              <div className={styles.uploadingTitle}>
                Saving {queuedFiles.length} {queuedFiles.length === 1 ? 'label' : 'labels'} to local storage...
              </div>
              <div className={styles.uploadingSubtitle}>
                Creating shipment records with status PROCESSING in browser database. Please wait...
              </div>
            </div>
          )}

          {/* Selected Images Preview Grid */}
          {queuedFiles.length > 0 && !isUploading && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  Selected Labels ({queuedFiles.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  disabled={isUploading}
                  leftIcon={<Trash2 size={14} />}
                >
                  Clear All
                </Button>
              </div>

              <SelectedImageGrid
                files={queuedFiles}
                onRemove={handleRemoveFile}
                disabled={isUploading}
              />

              <div className={styles.actionRow}>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={isUploading || queuedFiles.length === 0}
                  isLoading={isUploading}
                  onClick={handleUpload}
                  leftIcon={<UploadCloud size={18} />}
                  rightIcon={<ArrowRight size={18} />}
                >
                  {isUploading
                    ? `Saving ${queuedFiles.length} Labels...`
                    : `Save ${queuedFiles.length} ${queuedFiles.length === 1 ? 'Label' : 'Labels'}`}
                </Button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
