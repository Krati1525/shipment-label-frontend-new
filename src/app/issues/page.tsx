'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';
import { IssueReviewPanel } from '@/components/issues/IssueReviewPanel';
import { IssueList } from '@/components/issues/IssueList';
import { Toast } from '@/components/ui/Toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, RefreshCw, Package, Info } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { ShipmentCorrectionPayload } from '@/types/api';
import { getIssues, resolveShipment } from '@/lib/shipments';

interface ToastState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

function IssuesContent() {
  const searchParams = useSearchParams();
  const urlShipmentId = searchParams.get('id');

  const [issuesList, setIssuesList] = useState<Shipment[]>([]);
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Fetch real issues from backend
  const fetchIssues = useCallback(async (preserveSelectedId?: string | null) => {
    setIsLoading(true);
    setError(null);

    try {
      const items = await getIssues();
      setIssuesList(items);

      if (items.length > 0) {
        // Prioritize: 1) explicit preserve, 2) URL query param, 3) current selection, 4) first item
        const targetId = preserveSelectedId || urlShipmentId;
        const exists = items.some((item) => item.id === targetId);

        if (exists && targetId) {
          setSelectedIssueId(targetId);
        } else {
          setSelectedIssueId(items[0].id);
        }
      } else {
        setSelectedIssueId(null);
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to load shipments needing review. Please verify the backend is running.';
      setError(message);
      setIssuesList([]);
      setSelectedIssueId(null);
    } finally {
      setIsLoading(false);
    }
  }, [urlShipmentId]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Currently active shipment
  const selectedShipment =
    issuesList.find((item) => item.id === selectedIssueId) || null;

  // Handle Save & Resolve submission
  const handleSaveAndResolve = async (payload: ShipmentCorrectionPayload) => {
    if (isSaving || !selectedShipment) return;

    setIsSaving(true);
    try {
      const updatedShipment = await resolveShipment(selectedShipment.id, payload);

      // Backend status is the authoritative source of truth
      if (updatedShipment.status === 'READY') {
        setToast({
          type: 'success',
          message: `Shipment ${updatedShipment.awbNumber || updatedShipment.id.slice(0, 8)} resolved successfully.`,
        });

        // Remove resolved shipment from the pending issues queue
        const remainingIssues = issuesList.filter(
          (item) => item.id !== updatedShipment.id
        );
        setIssuesList(remainingIssues);

        if (remainingIssues.length > 0) {
          // Select next available issue
          const currentIndex = issuesList.findIndex(
            (item) => item.id === updatedShipment.id
          );
          const nextIndex =
            currentIndex < remainingIssues.length ? currentIndex : 0;
          setSelectedIssueId(remainingIssues[nextIndex].id);
        } else {
          setSelectedIssueId(null);
        }
      } else if (updatedShipment.status === 'ISSUE') {
        // Shipment still has discrepancies according to backend validation
        setToast({
          type: 'warning',
          message:
            'Shipment still needs review. Please correct the remaining issues.',
        });

        // Update active shipment in queue with latest backend state
        setIssuesList((prev) =>
          prev.map((item) =>
            item.id === updatedShipment.id ? updatedShipment : item
          )
        );
      } else {
        // Any other backend status (e.g. PROCESSING, SHIPPED)
        setIssuesList((prev) =>
          prev.map((item) =>
            item.id === updatedShipment.id ? updatedShipment : item
          )
        );
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to save corrections. Please try again.';
      setToast({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Issues Review Workspace</h1>
          <p className={styles.subtitle}>
            Review OCR-flagged shipment labels, correct invalid or missing fields, and submit for backend verification.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchIssues(selectedIssueId)}
            disabled={isLoading || isSaving}
            leftIcon={
              <RefreshCw
                size={14}
                className={isLoading ? styles.spinning : ''}
              />
            }
          >
            Refresh Queue
          </Button>

          <Link href="/shipments">
            <Button variant="ghost" size="sm" leftIcon={<Package size={14} />}>
              View All Shipments
            </Button>
          </Link>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* State 1: Loading */}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <LoadingState message="Loading shipments needing review..." />
        </div>
      )}

      {/* State 2: Error */}
      {!isLoading && error && (
        <ErrorState
          title="Unable to load shipments needing review"
          message={error}
          onRetry={() => fetchIssues(selectedIssueId)}
        />
      )}

      {/* State 3: Empty Queue */}
      {!isLoading && !error && issuesList.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={44} color="var(--status-ready-text)" />}
          title="No shipments need review"
          description="All shipment labels have been reviewed and verified. There are currently no pending issues requiring manual intervention."
          action={
            <Link href="/shipments">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Package size={16} />}
              >
                View Shipments
              </Button>
            </Link>
          }
        />
      )}

      {/* State 4: Issues Workspace */}
      {!isLoading && !error && issuesList.length > 0 && (
        <>
          {/* Operator Notice */}
          <div className={styles.notice} role="note">
            <Info size={16} />
            <span>
              Left panel displays the original high-resolution label scan with zoom/fullscreen; right panel provides real-time field corrections validated by the backend.
            </span>
          </div>

          {/* Pending Issues Queue List */}
          <div className={styles.queueCard}>
            <div className={styles.queueHeader}>
              <div className={styles.queueTitleGroup}>
                <span className={styles.queueTitle}>
                  Pending Issues Queue ({issuesList.length})
                </span>
                <span className={styles.queueSubtitle}>
                  Select a shipment below to inspect label scan and correct fields
                </span>
              </div>
            </div>

            <IssueList
              issues={issuesList}
              selectedId={selectedIssueId}
              onSelect={(shipment) => setSelectedIssueId(shipment.id)}
            />
          </div>

          {/* 2-Column Review Panel */}
          {selectedShipment && (
            <IssueReviewPanel
              shipment={selectedShipment}
              onSaveAndResolve={handleSaveAndResolve}
              isSaving={isSaving}
            />
          )}
        </>
      )}
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '2rem' }}>
          <LoadingState message="Loading review workspace..." />
        </div>
      }
    >
      <IssuesContent />
    </Suspense>
  );
}
