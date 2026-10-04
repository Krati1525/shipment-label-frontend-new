'use client';

import React from 'react';
import styles from './DeleteConfirmationModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Shipment } from '@/types/shipment';
import { Trash2, AlertTriangle } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isLoading?: boolean;
  // For single shipment delete:
  shipment?: Shipment | null;
  // For bulk shipment delete:
  shipments?: Shipment[];
  totalCount?: number;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  shipment,
  shipments = [],
  totalCount,
}: DeleteConfirmationModalProps) {
  const isBulk = Boolean(shipments.length > 0 || (totalCount && totalCount > 1));
  const effectiveCount = totalCount || (isBulk ? shipments.length : 1);
  const singleLabel = shipment?.name || shipment?.awbNumber || (shipment?.id ? `ID #${shipment.id.slice(0, 8)}` : 'this shipment');

  const titleNode = (
    <div className={styles.headerWrapper}>
      <div className={styles.iconBadge} aria-hidden="true">
        <Trash2 size={18} />
      </div>
      <div className={styles.titleGroup}>
        <span className={styles.titleText}>
          {isBulk ? `Delete ${effectiveCount} Shipments` : 'Delete Shipment'}
        </span>
        <span className={styles.badge}>Irreversible</span>
      </div>
    </div>
  );

  const footerNode = (
    <div className={styles.footerActions}>
      <Button
        variant="secondary"
        size="md"
        onClick={onClose}
        disabled={isLoading}
      >
        Cancel
      </Button>
      <Button
        variant="danger"
        size="md"
        onClick={onConfirm}
        isLoading={isLoading}
        disabled={isLoading}
        leftIcon={<Trash2 size={16} />}
      >
        {isBulk ? `Delete ${effectiveCount} Shipments` : 'Delete Shipment'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isLoading && onClose()}
      title={titleNode}
      footer={footerNode}
      size="md"
    >
      <div className={styles.bodyContainer}>
        {isBulk ? (
          <>
            <p className={styles.description}>
              Are you sure you want to permanently delete the{' '}
              <span className={styles.highlightText}>{effectiveCount} selected shipments</span>?
            </p>

            {shipments.length > 0 && (
              <div className={styles.bulkList}>
                {shipments.slice(0, 5).map((s) => (
                  <div key={s.id} className={styles.bulkRow}>
                    <div className={styles.bulkRowInfo}>
                      <span className={styles.bulkRowPrimary}>
                        {s.name || 'Unnamed Recipient'}
                      </span>
                      <span className={styles.bulkRowSecondary}>
                        <span className={styles.mono}>{s.awbNumber || s.id.slice(0, 8)}</span>
                        {s.courierPartnerName && <span>• {s.courierPartnerName}</span>}
                        {s.city && <span>• {s.city}</span>}
                      </span>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
                {effectiveCount > 5 && (
                  <div className={styles.moreIndicator}>
                    + {effectiveCount - 5} more shipment{effectiveCount - 5 === 1 ? '' : 's'} selected
                  </div>
                )}
              </div>
            )}

            <div className={styles.warningAlert} role="alert">
              <AlertTriangle size={18} className={styles.warningIcon} />
              <div className={styles.warningText}>
                <span className={styles.warningHeading}>Permanent Deletion:</span>
                <span>
                  All {effectiveCount} database records and their corresponding uploaded label scan images will be completely erased. This action cannot be reversed.
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className={styles.description}>
              Are you sure you want to permanently delete shipment{' '}
              <span className={styles.highlightText}>"{singleLabel}"</span>?
            </p>

            {shipment && (
              <div className={styles.detailsCard}>
                <div className={styles.detailsGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>AWB Number</span>
                    <span className={`${styles.detailValue} ${styles.mono}`}>
                      {shipment.awbNumber || '—'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Status</span>
                    <div style={{ marginTop: '0.125rem' }}>
                      <StatusBadge status={shipment.status} />
                    </div>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Recipient</span>
                    <span className={styles.detailValue}>
                      {shipment.name || 'Unnamed Recipient'}
                    </span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Courier Partner</span>
                    <span className={styles.detailValue}>
                      {shipment.courierPartnerName || '—'}
                    </span>
                  </div>
                  <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                    <span className={styles.detailLabel}>Destination</span>
                    <span className={styles.detailValue}>
                      {[shipment.city, shipment.state].filter(Boolean).join(', ') || '—'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className={styles.warningAlert} role="alert">
              <AlertTriangle size={18} className={styles.warningIcon} />
              <div className={styles.warningText}>
                <span className={styles.warningHeading}>Permanent Deletion:</span>
                <span>
                  This shipment record and its uploaded label scan on the server will be permanently deleted. This action cannot be undone.
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
