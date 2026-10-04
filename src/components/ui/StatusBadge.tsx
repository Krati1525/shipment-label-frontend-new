import React from 'react';
import styles from './StatusBadge.module.css';
import { ShipmentStatus } from '@/types/shipment';
import { cn } from '@/lib/utils';

export interface StatusBadgeProps {
  status: ShipmentStatus;
  className?: string;
  showDot?: boolean;
}

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  PROCESSING: 'Processing',
  PAUSED: 'Paused',
  ISSUE: 'Issue',
  READY: 'Ready',
  SHIPPED: 'Shipped',
};

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const label = STATUS_LABELS[status] || status;

  return (
    <span
      className={cn(styles.badge, styles[status], className)}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {showDot && <span className={styles.dot} aria-hidden="true" />}
      <span>{label}</span>
    </span>
  );
}
