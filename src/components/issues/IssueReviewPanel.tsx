import React from 'react';
import styles from './IssueReviewPanel.module.css';
import { ImagePreview } from '@/components/ui/ImagePreview';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ShipmentCorrectionForm } from './ShipmentCorrectionForm';
import { Shipment } from '@/types/shipment';
import { ShipmentCorrectionPayload } from '@/types/api';
import { getFullImageUrl } from '@/lib/utils';
import { AlertTriangle, Hash, FileText } from 'lucide-react';

export interface IssueReviewPanelProps {
  shipment: Shipment;
  onSaveAndResolve?: (payload: ShipmentCorrectionPayload) => void;
  isSaving?: boolean;
}

export function IssueReviewPanel({
  shipment,
  onSaveAndResolve,
  isSaving = false,
}: IssueReviewPanelProps) {
  const fullImageUrl = getFullImageUrl(shipment.imageUrl);

  return (
    <div className={styles.workspace}>
      {/* Left Column: Shipment label image preview */}
      <div className={styles.leftColumn}>
        <Card>
          <CardHeader
            title="Original Label Scan"
            subtitle={shipment.originalFileName || 'Label image'}
          />
          <CardBody>
            <ImagePreview
              src={fullImageUrl}
              alt={`Label for ${shipment.name || shipment.id}`}
              maxHeight="540px"
            />
          </CardBody>
        </Card>
      </div>

      {/* Right Column: Editable extracted data form */}
      <div className={styles.rightColumn}>
        <Card>
          <div className={styles.cardTopBar}>
            <div className={styles.shipmentMeta}>
              <div className={styles.metaBadgeGroup}>
                <StatusBadge status={shipment.status} />
                <span className={styles.needsReviewPill}>
                  <AlertTriangle size={12} /> Needs Review
                </span>
              </div>
              <div className={styles.metaIdentifiers}>
                <span className={styles.metaId}>
                  <Hash size={12} /> {shipment.id}
                </span>
                {shipment.awbNumber && (
                  <span className={styles.metaAwb}>
                    AWB: <strong>{shipment.awbNumber}</strong>
                  </span>
                )}
                {shipment.originalFileName && (
                  <span className={styles.metaFilename}>
                    <FileText size={12} /> {shipment.originalFileName}
                  </span>
                )}
              </div>
            </div>
          </div>

          <CardHeader
            title="Correct Extracted Fields"
            subtitle="Fix missing or low-confidence data and submit for backend verification"
          />
          <CardBody>
            <ShipmentCorrectionForm
              key={`${shipment.id}-${shipment.updatedAt}`}
              shipment={shipment}
              onSaveAndResolve={onSaveAndResolve}
              isSaving={isSaving}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
