import React from 'react';
import Link from 'next/link';
import styles from './ProcessingShipmentList.module.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Image as ImageIcon,
  Clock,
  ArrowRight,
  Pause,
} from 'lucide-react';
import { ProcessingShipmentItem } from '@/types/shipment';
import { getFullImageUrl } from '@/lib/utils';

export interface ProcessingShipmentListProps {
  items: ProcessingShipmentItem[];
}

export function ProcessingShipmentList({ items }: ProcessingShipmentListProps) {
  if (items.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No shipments selected for processing.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {items.map((item) => {
        const fullImg = getFullImageUrl(item.imageUrl);
        const isComplete = item.stage === 'COMPLETE';
        const isOcr = item.stage === 'OCR';
        const isExtract = item.stage === 'EXTRACTION';
        const isError = item.stage === 'ERROR';
        const isWaiting = item.stage === 'WAITING';
        const isPaused = item.stage === 'PAUSED';

        return (
          <div key={item.shipmentId} className={styles.itemCard}>
            {/* Thumbnail */}
            <div className={styles.thumbnailContainer}>
              {fullImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fullImg}
                  alt={item.originalFileName}
                  className={styles.thumbnail}
                />
              ) : (
                <div className={styles.thumbnailPlaceholder}>
                  <ImageIcon size={28} />
                </div>
              )}
            </div>

            {/* Content */}
            <div className={styles.itemContent}>
              <div className={styles.itemHeader}>
                <div className={styles.fileNameGroup}>
                  <span className={styles.fileName}>{item.originalFileName}</span>
                  <span className={styles.shipmentId}>ID: {item.shipmentId}</span>
                </div>
                <StatusBadge status={item.status} />
              </div>

              {/* Progress and status info */}
              <div className={styles.pipelineDetails}>
                {/* WAITING State */}
                {isWaiting && (
                  <div className={styles.stageRow}>
                    <Clock size={16} color="var(--text-muted)" />
                    <span>Waiting in processing queue...</span>
                  </div>
                )}

                {/* PAUSED State */}
                {isPaused && (
                  <div className={styles.stageRow} style={{ color: '#d97706' }}>
                    <Pause size={16} />
                    <span>Pipeline paused for this shipment</span>
                  </div>
                )}

                {/* OCR State */}
                {isOcr && (
                  <div className={`${styles.stageRow} ${styles.stageActive}`}>
                    <div className={styles.spinner} />
                    <span>Reading shipment label (OCR in progress)...</span>
                  </div>
                )}

                {/* Extraction State */}
                {isExtract && (
                  <>
                    <div className={`${styles.stageRow} ${styles.stageSuccess}`}>
                      <CheckCircle2 size={16} />
                      <span>OCR recognition completed</span>
                    </div>
                    <div className={`${styles.stageRow} ${styles.stageActive}`}>
                      <div className={styles.spinner} />
                      <span>Extracting and validating entity fields...</span>
                    </div>
                  </>
                )}

                {/* COMPLETE State: READY, ISSUE, or Phase 3 OCR COMPLETE */}
                {isComplete && (
                  <>
                    <div className={`${styles.stageRow} ${styles.stageSuccess}`}>
                      <CheckCircle2 size={16} />
                      <span>OCR recognition completed</span>
                    </div>

                    {item.status !== 'PROCESSING' && (
                      <div className={`${styles.stageRow} ${styles.stageSuccess}`}>
                        <CheckCircle2 size={16} />
                        <span>Extraction completed</span>
                      </div>
                    )}

                    {item.status === 'PROCESSING' && item.rawOcrText && (
                      <div className={styles.stageRow} style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <span>Text recognized ({item.rawOcrText.length} characters)</span>
                      </div>
                    )}

                    {item.status === 'READY' && (
                      <div className={`${styles.stageRow} ${styles.stageSuccess}`}>
                        <CheckCircle2 size={16} />
                        <strong>✓ Ready for dispatch</strong>
                      </div>
                    )}

                    {item.status === 'ISSUE' && (
                      <div className={`${styles.stageRow} ${styles.stageIssue}`}>
                        <AlertTriangle size={16} />
                        <strong>⚠ Needs Review</strong>
                      </div>
                    )}
                  </>
                )}

                {/* ERROR State */}
                {isError && (
                  <div className={`${styles.stageRow} ${styles.stageError}`}>
                    <XCircle size={16} />
                    <span>✕ Processing failed: {item.error || 'Unexpected error during processing'}</span>
                  </div>
                )}

                {/* Issues details if ISSUE status */}
                {item.status === 'ISSUE' && item.issues && (
                  <div className={styles.issuesBox}>
                    <span>Flagged data discrepancies:</span>
                    <ul className={styles.issuesList}>
                      {Array.isArray(item.issues)
                        ? item.issues.map((iss, idx) => (
                            <li key={idx}>
                              <strong>{iss.field}</strong>: {iss.message}
                            </li>
                          ))
                        : Object.entries(item.issues).map(([field, reason]) => (
                            <li key={field}>
                              <strong>{field}</strong>: {String(reason)}
                            </li>
                          ))}
                    </ul>
                  </div>
                )}

                {/* Preview of extracted fields if available */}
                {(item.status === 'READY' || item.status === 'ISSUE') && item.extractedFields && (
                  <div className={styles.extractedDataPreview}>
                    {item.extractedFields.name && (
                      <span className={styles.extractedItem}>
                        Customer: <strong>{String(item.extractedFields.name)}</strong>
                      </span>
                    )}
                    {item.extractedFields.awbNumber && (
                      <span className={styles.extractedItem}>
                        AWB: <strong>{String(item.extractedFields.awbNumber)}</strong>
                      </span>
                    )}
                    {item.extractedFields.courierPartnerName && (
                      <span className={styles.extractedItem}>
                        Courier: <strong>{String(item.extractedFields.courierPartnerName)}</strong>
                      </span>
                    )}
                    {item.extractedFields.city && (
                      <span className={styles.extractedItem}>
                        City: <strong>{String(item.extractedFields.city)}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action for items needing review */}
              {item.status === 'ISSUE' && isComplete && (
                <div className={styles.itemActions}>
                  <Link href={`/issues?id=${item.shipmentId}`}>
                    <Button variant="danger" size="sm" rightIcon={<ArrowRight size={14} />}>
                      Review Issue in Workspace
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
