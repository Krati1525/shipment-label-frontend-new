'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { ProcessingShipmentList } from '@/components/processing/ProcessingShipmentList';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import {
  ArrowRight,
  AlertTriangle,
  RotateCcw,
  Package,
  CheckCircle2,
  XCircle,
  UploadCloud,
} from 'lucide-react';
import { runBatchOcr, extractBatch, getShipment } from '@/lib/shipments';
import { ProcessingShipmentItem } from '@/types/shipment';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ProcessingContent() {
  const searchParams = useSearchParams();
  const rawIds = (searchParams.get('ids') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const validIds = rawIds.filter((id) => UUID_REGEX.test(id));
  const hasInvalidFormat = rawIds.length > 0 && validIds.length < rawIds.length;

  const [items, setItems] = useState<ProcessingShipmentItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStageMessage, setCurrentStageMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Prevent duplicate execution on initial mount or re-renders
  const hasStartedRef = useRef<boolean>(false);

  useEffect(() => {
    if (rawIds.length === 0) return;
    if (validIds.length === 0) return;
    if (hasStartedRef.current) return;

    hasStartedRef.current = true;
    initializeAndProcess(validIds);
  }, []);

  const initializeAndProcess = async (ids: string[]) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setCurrentStageMessage('Verifying shipment state in database...');

    try {
      // 1. Fetch current status of all shipments to check if any are already completed
      const initialShipments = await Promise.all(
        ids.map(async (id) => {
          try {
            const s = await getShipment(id);
            return {
              shipmentId: s.id,
              originalFileName: s.originalFileName || `Shipment #${s.id.slice(0, 8)}`,
              imageUrl: s.imageUrl,
              stage: (s.status === 'READY' || s.status === 'ISSUE' || s.status === 'SHIPPED'
                ? 'COMPLETE'
                : 'WAITING') as ProcessingShipmentItem['stage'],
              status: s.status,
              hasIssues: s.hasIssues,
              issues: (s.issues as Record<string, string>) || null,
              extractedFields: s.name || s.awbNumber ? {
                name: s.name,
                mobileNumber: s.mobileNumber,
                awbNumber: s.awbNumber,
                courierPartnerName: s.courierPartnerName,
                city: s.city,
              } : null,
              rawOcrText: s.rawOcrText,
            };
          } catch {
            return {
              shipmentId: id,
              originalFileName: `Shipment #${id.slice(0, 8)}`,
              imageUrl: null,
              stage: 'ERROR' as ProcessingShipmentItem['stage'],
              status: 'PROCESSING' as const,
              error: 'Failed to fetch shipment details from server.',
            };
          }
        })
      );

      setItems(initialShipments);

      // 2. Identify which shipments still require OCR & extraction
      const pendingIds = initialShipments
        .filter((item) => item.status === 'PROCESSING' && item.stage !== 'ERROR')
        .map((item) => item.shipmentId);

      if (pendingIds.length === 0) {
        // All shipments were already completed
        setIsProcessing(false);
        setCurrentStageMessage('All shipments have already completed processing.');
        return;
      }

      await executePipeline(pendingIds);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to connect to server. Please check backend connection.';
      setErrorMessage(msg);
      setIsProcessing(false);
    }
  };

  const executePipeline = async (idsToProcess: string[]) => {
    setIsProcessing(true);
    setErrorMessage(null);

    // --- STEP 1: BATCH OCR ---
    setCurrentStageMessage('Reading shipment labels (Batch OCR in progress)...');
    setItems((prev) =>
      prev.map((item) =>
        idsToProcess.includes(item.shipmentId)
          ? { ...item, stage: 'OCR', error: null }
          : item
      )
    );

    let ocrSucceededIds: string[] = [];

    try {
      const ocrResponse = await runBatchOcr(idsToProcess);
      const results = ocrResponse.results || [];

      // Update each item with OCR result
      setItems((prev) =>
        prev.map((item) => {
          const res = results.find((r) => r.shipmentId === item.shipmentId);
          if (!res) return item;

          if (res.success === false) {
            return {
              ...item,
              stage: 'ERROR',
              error: res.error || 'OCR text extraction failed for this image.',
            };
          }

          ocrSucceededIds.push(item.shipmentId);
          return {
            ...item,
            rawOcrText: res.rawOcrText,
            // Status remains PROCESSING until extraction determines status
            status: 'PROCESSING',
          };
        })
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Batch OCR request failed. Please ensure the backend is reachable.';
      setErrorMessage(msg);
      setItems((prev) =>
        prev.map((item) =>
          idsToProcess.includes(item.shipmentId)
            ? { ...item, stage: 'ERROR', error: msg }
            : item
        )
      );
      setIsProcessing(false);
      return;
    }

    if (ocrSucceededIds.length === 0) {
      setIsProcessing(false);
      setCurrentStageMessage('OCR failed for all requested labels.');
      return;
    }

    // --- STEP 2: BATCH EXTRACTION ---
    setCurrentStageMessage('Extracting and validating shipment fields...');
    setItems((prev) =>
      prev.map((item) =>
        ocrSucceededIds.includes(item.shipmentId)
          ? { ...item, stage: 'EXTRACTION' }
          : item
      )
    );

    try {
      const extResponse = await extractBatch(ocrSucceededIds);
      const extResults = extResponse.results || [];

      setItems((prev) =>
        prev.map((item) => {
          const res = extResults.find((r) => r.shipmentId === item.shipmentId);
          if (!res) return item;

          if (res.success === false) {
            return {
              ...item,
              stage: 'ERROR',
              error: res.error || 'Structured field extraction failed.',
            };
          }

          // Use real backend status (READY or ISSUE)
          return {
            ...item,
            stage: 'COMPLETE',
            status: res.status || (res.hasIssues ? 'ISSUE' : 'READY'),
            hasIssues: res.hasIssues,
            issues: res.issues || null,
            extractedFields: res.data || null,
          };
        })
      );

      setCurrentStageMessage('Processing completed.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Extraction request failed. Please check backend connection.';
      setErrorMessage(msg);
      setItems((prev) =>
        prev.map((item) =>
          ocrSucceededIds.includes(item.shipmentId)
            ? { ...item, stage: 'ERROR', error: msg }
            : item
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryFailed = () => {
    if (isProcessing) return;
    const failedIds = items
      .filter((i) => i.stage === 'ERROR' || (i.status === 'PROCESSING' && i.stage !== 'COMPLETE'))
      .map((i) => i.shipmentId);

    if (failedIds.length > 0) {
      executePipeline(failedIds);
    }
  };

  // Missing or invalid ID checks
  if (rawIds.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard} role="alert">
          <AlertTriangle size={36} color="var(--status-issue-text)" />
          <div className={styles.errorText}>
            <h2 className={styles.errorTitle}>No Shipments Selected</h2>
            <p className={styles.errorDesc}>
              No shipment IDs were provided in the URL query. Please upload shipment label images first to trigger processing.
            </p>
          </div>
          <Link href="/upload">
            <Button variant="primary" size="md" leftIcon={<UploadCloud size={16} />}>
              Go to Upload Page
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (hasInvalidFormat) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard} role="alert">
          <AlertTriangle size={36} color="var(--status-issue-text)" />
          <div className={styles.errorText}>
            <h2 className={styles.errorTitle}>Invalid Shipment ID Format</h2>
            <p className={styles.errorDesc}>
              One or more shipment IDs in the URL do not match the expected UUID format. Please return to the upload screen and try again.
            </p>
          </div>
          <Link href="/upload">
            <Button variant="primary" size="md" leftIcon={<UploadCloud size={16} />}>
              Return to Upload
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Summary counts
  const totalCount = items.length;
  const readyCount = items.filter((i) => i.status === 'READY').length;
  const issuesCount = items.filter((i) => i.status === 'ISSUE').length;
  const failedCount = items.filter((i) => i.stage === 'ERROR').length;
  const isAllComplete = !isProcessing && items.length > 0 && items.every((i) => i.stage === 'COMPLETE' || i.stage === 'ERROR');

  return (
    <div className={styles.page}>
      <div className={styles.headerArea}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Processing Labels</h1>
          <p className={styles.subtitle}>
            Extracting OCR text and parsing logistics entities (AWB, mobile, courier, address).
          </p>
        </div>
      </div>

      {/* Error notification */}
      {errorMessage && (
        <Toast
          type="error"
          message={errorMessage}
          onClose={() => setErrorMessage(null)}
        />
      )}

      {/* Active Pipeline Status Banner */}
      {isProcessing && (
        <div className={styles.pipelineBanner} role="status" aria-live="polite">
          <div className={styles.pipelineSpinner} />
          <div className={styles.pipelineText}>
            <span className={styles.pipelineTitle}>Pipeline Active</span>
            <span className={styles.pipelineSubtitle}>{currentStageMessage}</span>
          </div>
        </div>
      )}

      {/* Summary Statistics Cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total Labels</span>
          <span className={`${styles.summaryValue} ${styles.totalValue}`}>{totalCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Ready</span>
          <span className={`${styles.summaryValue} ${styles.readyValue}`}>{readyCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Needs Review</span>
          <span className={`${styles.summaryValue} ${styles.issuesValue}`}>{issuesCount}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Failed</span>
          <span className={`${styles.summaryValue} ${styles.failedValue}`}>{failedCount}</span>
        </div>
      </div>

      {/* Action buttons on completion */}
      {isAllComplete && (
        <div className={styles.actionRow}>
          {failedCount > 0 && (
            <Button
              variant="secondary"
              size="md"
              onClick={handleRetryFailed}
              leftIcon={<RotateCcw size={16} />}
            >
              Retry Failed ({failedCount})
            </Button>
          )}

          {issuesCount > 0 && (
            <Link href="/issues">
              <Button
                variant="danger"
                size="md"
                leftIcon={<AlertTriangle size={16} />}
                rightIcon={<ArrowRight size={16} />}
              >
                Review Issues ({issuesCount})
              </Button>
            </Link>
          )}

          <Link href="/shipments">
            <Button
              variant="primary"
              size="md"
              leftIcon={<Package size={16} />}
              rightIcon={<ArrowRight size={16} />}
            >
              View All Shipments
            </Button>
          </Link>
        </div>
      )}

      {/* Shipment Pipeline Items List */}
      <ProcessingShipmentList items={items} />
    </div>
  );
}

export default function ProcessingPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading processing queue..." />}>
      <ProcessingContent />
    </Suspense>
  );
}
