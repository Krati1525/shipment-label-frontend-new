import React, { useState, useEffect } from 'react';
import styles from './IssueReviewPanel.module.css';
import { ImagePreview } from '@/components/ui/ImagePreview';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { ShipmentCorrectionForm } from './ShipmentCorrectionForm';
import { Shipment } from '@/types/shipment';
import { ShipmentCorrectionPayload } from '@/types/api';
import { getFullImageUrl } from '@/lib/utils';
import { getShipment } from '@/lib/shipments';
import { AlertTriangle, Hash, FileText, ScanLine } from 'lucide-react';

export interface IssueReviewPanelProps {
  shipment: Shipment;
  onSaveAndResolve?: (payload: ShipmentCorrectionPayload) => void;
  isSaving?: boolean;
  onReScan?: (rotationAngle?: number) => void;
  isReScanning?: boolean;
}

export function IssueReviewPanel({
  shipment,
  onSaveAndResolve,
  isSaving = false,
  onReScan,
  isReScanning = false,
}: IssueReviewPanelProps) {
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(getFullImageUrl(shipment.imageUrl));

  useEffect(() => {
    const current = getFullImageUrl(shipment.imageUrl);
    if (current) {
      setActiveImageUrl(current);
    } else if (shipment.id) {
      getShipment(shipment.id).then((fresh) => {
        if (fresh?.imageUrl) {
          setActiveImageUrl(getFullImageUrl(fresh.imageUrl));
        }
      }).catch(() => {});
    }
  }, [shipment.id, shipment.imageUrl]);

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
              src={activeImageUrl}
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
                {(shipment.trackingId || shipment.awbNumber) && (
                  <span className={styles.metaAwb}>
                    Tracking ID: <strong>{shipment.trackingId || shipment.awbNumber}</strong>
                  </span>
                )}
                {shipment.originalFileName && (
                  <span className={styles.metaFilename}>
                    <FileText size={12} /> {shipment.originalFileName}
                  </span>
                )}
              </div>
            </div>

            {/* {onReScan && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onReScan()}
                disabled={isReScanning || isSaving}
                isLoading={isReScanning}
                leftIcon={<ScanLine size={14} />}
              >
                {isReScanning ? 'Scanning...' : 'Manual OCR Re-scan'}
              </Button>
            )} */}
          </div>

          <CardHeader
            title="Correct Extracted Fields"
            subtitle="Verify extracted fields and fill any available values. All fields are optional — saving will mark this shipment Ready for dispatch."
          />
          <CardBody>
            <ShipmentCorrectionForm
              key={`${shipment.id}-${shipment.updatedAt}`}
              shipment={shipment}
              onSaveAndResolve={onSaveAndResolve}
              isSaving={isSaving}
              onReScan={onReScan}
              isReScanning={isReScanning}
            />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}