import React from 'react';
import styles from './UploadedShipmentList.module.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { CheckCircle2, ArrowRight, PlusCircle, Info } from 'lucide-react';
import { Shipment } from '@/types/shipment';

import Link from 'next/link';

export interface UploadedShipmentListProps {
  shipments: Shipment[];
  onUploadMore: () => void;
}

export function UploadedShipmentList({
  shipments,
  onUploadMore,
}: UploadedShipmentListProps) {
  const idsQuery = shipments.map((s) => s.id).join(',');
  const processingUrl = `/processing?ids=${encodeURIComponent(idsQuery)}`;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.successIconCircle}>
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.headerText}>
            <h3>Upload Successful</h3>
            <p>
              {shipments.length} {shipments.length === 1 ? 'shipment label' : 'shipment labels'} uploaded successfully
            </p>
          </div>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Label File</th>
                <th className={styles.th}>Shipment ID</th>
                <th className={styles.th}>Initial Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr key={shipment.id} className={styles.tr}>
                  <td className={styles.td}>
                    <span className={styles.fileName}>
                      {shipment.originalFileName || 'Label image'}
                    </span>
                  </td>
                  <td className={styles.td}>
                    <span className={styles.mono}>{shipment.id}</span>
                  </td>
                  <td className={styles.td}>
                    <StatusBadge status={shipment.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.noteBox}>
          <Info size={16} />
          <span>
            Initial status is <strong>PROCESSING</strong>. Click <strong>Continue to Processing</strong> to trigger OCR text extraction and automated entity parsing.
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <Button
          variant="secondary"
          size="md"
          onClick={onUploadMore}
          leftIcon={<PlusCircle size={16} />}
        >
          Upload More Labels
        </Button>

        <div className={styles.nextStepGroup}>
          <Link href={processingUrl}>
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight size={16} />}
            >
              Continue to Processing
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
