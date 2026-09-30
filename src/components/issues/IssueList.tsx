import React from 'react';
import styles from './IssueList.module.css';
import { AlertTriangle, ChevronRight, FileText } from 'lucide-react';
import { Shipment, ShipmentIssue } from '@/types/shipment';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, getFullImageUrl } from '@/lib/utils';

export interface IssueListProps {
  issues: Shipment[];
  selectedId: string | null;
  onSelect: (shipment: Shipment) => void;
}

export function IssueList({ issues, selectedId, onSelect }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className={styles.emptyQueue}>
        No issues currently pending review.
      </div>
    );
  }

  return (
    <div className={styles.list} role="list" aria-label="Shipments requiring review">
      {issues.map((shipment) => {
        const isSelected = shipment.id === selectedId;
        const issuesCount = Array.isArray(shipment.issues)
          ? (shipment.issues as ShipmentIssue[]).length
          : shipment.issues
          ? Object.keys(shipment.issues as Record<string, string>).length
          : 1;

        const location = [shipment.city, shipment.state].filter(Boolean).join(', ');
        const fullImg = getFullImageUrl(shipment.imageUrl);

        return (
          <button
            key={shipment.id}
            type="button"
            className={cn(styles.item, isSelected && styles.active)}
            onClick={() => onSelect(shipment)}
            aria-selected={isSelected}
          >
            {/* Thumbnail */}
            <div className={styles.thumbnailWrapper}>
              {fullImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={fullImg}
                  alt={shipment.originalFileName || 'Label preview'}
                  className={styles.thumbnail}
                  onError={(e) => {
                    // Hide broken image and allow container fallback
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <FileText size={22} className={styles.fallbackIcon} />
              )}
            </div>

            {/* Item Details */}
            <div className={styles.itemInfo}>
              <div className={styles.topRow}>
                <span className={styles.title}>
                  {shipment.name || 'Missing Recipient Name'}
                </span>
                <StatusBadge status={shipment.status} showDot={false} />
              </div>

              <div className={styles.metaRow}>
                <span className={styles.filename} title={shipment.originalFileName}>
                  {shipment.originalFileName}
                </span>
                <span className={styles.metaDivider}>•</span>
                <span>AWB: {shipment.awbNumber || 'Missing'}</span>
                {shipment.courierPartnerName && (
                  <>
                    <span className={styles.metaDivider}>•</span>
                    <span>{shipment.courierPartnerName}</span>
                  </>
                )}
                {location && (
                  <>
                    <span className={styles.metaDivider}>•</span>
                    <span>{location}</span>
                  </>
                )}
              </div>

              <div className={styles.bottomRow}>
                <span className={styles.issueTag}>
                  <AlertTriangle size={12} />
                  {issuesCount} {issuesCount === 1 ? 'issue flagged' : 'issues flagged'}
                </span>
              </div>
            </div>

            <ChevronRight size={18} className={styles.chevron} />
          </button>
        );
      })}
    </div>
  );
}
