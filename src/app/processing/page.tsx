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
  UploadCloud,
  Pause,
  Play,
} from 'lucide-react';
import {
  runBatchOcr,
  extractBatch,
  getShipment,
  getShipments,
  pauseBatch,
  resumeBatch,
} from '@/lib/shipments';
import { ProcessingShipmentItem, Shipment } from '@/types/shipment';

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
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStageMessage, setCurrentStageMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const pipelineRunningRef = useRef<boolean>(false);

  const handlePause = async () => {
    setIsPaused(true);
    isPausedRef.current = true;
    setCurrentStageMessage('Processing paused by user.');
    const pendingIds = items
      .filter((i) => i.stage !== 'COMPLETE' && i.stage !== 'ERROR')
      .map((i) => i.shipmentId);

    setItems((prev) =>
      prev.map((item) =>
        pendingIds.includes(item.shipmentId)
          ? { ...item, stage: 'PAUSED' }
          : item
      )
    );

    if (pendingIds.length > 0) {
      try {
        await pauseBatch(pendingIds);
      } catch (e) {
        console.warn('Pause batch failed:', e);
      }
    }
  };

  const handleResume = async () => {
    setIsPaused(false);
    isPausedRef.current = false;
    setCurrentStageMessage('Resuming processing pipeline...');
    const pendingIds = items
      .filter((i) => i.stage !== 'COMPLETE' && i.stage !== 'ERROR')
      .map((i) => i.shipmentId);
    if (pendingIds.length > 0) {
      try {
        await resumeBatch(pendingIds);
        executePipeline(pendingIds);
      } catch (e) {
        console.warn('Resume batch failed:', e);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadQueue = async () => {
      setIsLoadingQueue(true);
      setErrorMessage(null);

      try {
        let targetIds: string[] = [];

        if (rawIds.length > 0) {
          if (validIds.length > 0) {
            targetIds = validIds;
          } else if (hasInvalidFormat) {
            // Only invalid IDs provided in query
            if (isMounted) {
              setIsLoadingQueue(false);
            }
            return;
          }
        } else {
          // No IDs in URL: Recover pending shipments from IndexedDB (e.g. after refresh or direct navigation)
          try {
            const pendingList = await getShipments({ status: 'PROCESSING', limit: 100 });
            if (pendingList && pendingList.data && pendingList.data.length > 0) {
              targetIds = pendingList.data.map((s) => s.id);
            }
          } catch (dbErr) {
            console.warn('Could not query pending shipments from local DB:', dbErr);
          }
        }

        if (!isMounted) return;

        if (targetIds.length === 0) {
          setItems([]);
          setIsLoadingQueue(false);
          return;
        }

        // Fetch shipment records
        const loadedShipments = await Promise.all(
          targetIds.map(async (id) => {
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
                issues: (s.issues as ProcessingShipmentItem['issues']) || null,
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
                error: `Shipment #${id.slice(0, 8)} not found in database.`,
              };
            }
          })
        );

        if (!isMounted) return;

        setItems(loadedShipments);

        // Identify which shipments still require OCR & extraction
        const pendingIds = loadedShipments
          .filter((item) => item.status === 'PROCESSING' && item.stage !== 'ERROR')
          .map((item) => item.shipmentId);

        if (pendingIds.length > 0 && !pipelineRunningRef.current) {
          executePipeline(pendingIds);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to load shipments from database.';
        setErrorMessage(msg);
      } finally {
        if (isMounted) {
          setIsLoadingQueue(false);
        }
      }
    };

    loadQueue();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const executePipeline = async (idsToProcess: string[]) => {
    if (pipelineRunningRef.current) return;
    pipelineRunningRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      // 1. Fetch current records from IndexedDB to accurately identify which need OCR vs direct extraction
      const records = await Promise.all(
        idsToProcess.map(async (id) => {
          try {
            return await getShipment(id);
          } catch {
            return null;
          }
        })
      );

      const validRecords = records.filter((r): r is Shipment => r !== null);
      if (validRecords.length === 0) {
        setIsProcessing(false);
        pipelineRunningRef.current = false;
        return;
      }

      const needsOcrIds: string[] = [];
      const hasOcrIds: string[] = [];

      for (const r of validRecords) {
        if (r.rawOcrText && r.rawOcrText.trim().length > 15) {
          hasOcrIds.push(r.id);
        } else {
          needsOcrIds.push(r.id);
        }
      }

      // Update UI stage immediately
      setItems((prev) =>
        prev.map((item) => {
          if (needsOcrIds.includes(item.shipmentId)) {
            return { ...item, stage: 'OCR', error: null };
          }
          if (hasOcrIds.includes(item.shipmentId)) {
            return { ...item, stage: 'EXTRACTION', error: null };
          }
          return item;
        })
      );

      const ocrSucceededIds: string[] = [...hasOcrIds];

      // --- STEP 1: LOCAL BATCH OCR (for items needing OCR) ---
      if (needsOcrIds.length > 0) {
        setCurrentStageMessage(
          `Reading ${needsOcrIds.length} label${needsOcrIds.length > 1 ? 's' : ''} (OCR in progress)...`
        );

        const ocrResponse = await runBatchOcr(needsOcrIds, {
          onItemProgress: (info) => {
            setCurrentStageMessage(info.stageMessage);
          },
          shouldPause: () => isPausedRef.current,
        });

        const results = ocrResponse.results || [];
        for (const res of results) {
          if (res.success && res.rawOcrText) {
            ocrSucceededIds.push(res.shipmentId);
          }
        }

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

            return {
              ...item,
              rawOcrText: res.rawOcrText,
              stage: 'EXTRACTION',
              status: 'PROCESSING',
            };
          })
        );
      }

      if (isPausedRef.current) {
        setCurrentStageMessage('Processing paused by user.');
        setIsProcessing(false);
        pipelineRunningRef.current = false;
        return;
      }

      if (ocrSucceededIds.length === 0) {
        setCurrentStageMessage('OCR failed for all requested labels.');
        setIsProcessing(false);
        pipelineRunningRef.current = false;
        return;
      }

      // --- STEP 2: STRUCTURED FIELD EXTRACTION & VALIDATION ---
      setCurrentStageMessage('Extracting logistics entities and validating fields...');

      const extractionResponse = await extractBatch(ocrSucceededIds);
      const extResults = extractionResponse.results || [];

      setItems((prev) =>
        prev.map((item) => {
          const res = extResults.find((r) => r.shipmentId === item.shipmentId);
          if (!res) return item;

          if (!res.success) {
            return {
              ...item,
              stage: 'ERROR',
              error: res.error || 'Field extraction failed for this shipment.',
            };
          }

          return {
            ...item,
            stage: 'COMPLETE',
            status: res.status || 'ISSUE',
            hasIssues: res.hasIssues ?? false,
            issues: (res.issues as ProcessingShipmentItem['issues']) || null,
            extractedFields: res.extractedFields || res.data || null,
          };
        })
      );

      setCurrentStageMessage('Processing completed: OCR and structured field extraction finished.');
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Processing pipeline failed.';
      setErrorMessage(msg);
      setItems((prev) =>
        prev.map((item) =>
          idsToProcess.includes(item.shipmentId)
            ? { ...item, stage: 'ERROR', error: msg }
            : item
        )
      );
    } finally {
      setIsProcessing(false);
      pipelineRunningRef.current = false;
    }
  };

  const handleRetryFailed = () => {
    if (isProcessing) return;
    const failedIds = items
      .filter((i) => i.stage === 'ERROR' || i.status === 'PROCESSING')
      .map((i) => i.shipmentId);

    if (failedIds.length > 0) {
      executePipeline(failedIds);
    }
  };

  // 1. Loading queue state
  if (isLoadingQueue) {
    return <LoadingState message="Loading processing queue..." />;
  }

  // 2. Invalid ID format check
  if (hasInvalidFormat && items.length === 0) {
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

  // 3. Database error state with empty queue
  if (errorMessage && items.length === 0) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard} role="alert">
          <AlertTriangle size={36} color="var(--status-issue-text)" />
          <div className={styles.errorText}>
            <h2 className={styles.errorTitle}>Unable to Load Queue</h2>
            <p className={styles.errorDesc}>{errorMessage}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button variant="primary" size="md" onClick={() => window.location.reload()} leftIcon={<RotateCcw size={16} />}>
              Retry
            </Button>
            <Link href="/upload">
              <Button variant="secondary" size="md" leftIcon={<UploadCloud size={16} />}>
                Return to Upload
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 4. Empty queue state
  if (items.length === 0) {
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

        <div className={styles.emptyCard}>
          <Package size={44} color="var(--primary)" />
          <div className={styles.errorText}>
            <h2 className={styles.emptyTitle}>Processing Queue Empty</h2>
            <p className={styles.emptyDesc}>
              There are no shipment labels currently waiting in the processing queue. Upload new label images to start OCR and entity extraction.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Link href="/upload">
              <Button variant="primary" size="md" leftIcon={<UploadCloud size={16} />}>
                Upload New Labels
              </Button>
            </Link>
            <Link href="/shipments">
              <Button variant="secondary" size="md" leftIcon={<Package size={16} />}>
                View All Shipments
              </Button>
            </Link>
          </div>
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
            <span className={styles.pipelineTitle}>{isPaused ? 'Pipeline Paused' : 'Pipeline Active'}</span>
            <span className={styles.pipelineSubtitle}>{currentStageMessage}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', zIndex: 5 }}>
            {isPaused ? (
              <Button variant="primary" size="sm" onClick={handleResume} leftIcon={<Play size={14} />}>
                Resume
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handlePause} leftIcon={<Pause size={14} />}>
                Pause
              </Button>
            )}
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
