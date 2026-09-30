import React, { useState } from 'react';
import styles from './ShipmentCorrectionForm.module.css';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Shipment, ShipmentIssue } from '@/types/shipment';
import { ShipmentCorrectionPayload } from '@/types/api';

export interface ShipmentCorrectionFormProps {
  shipment: Shipment;
  onSaveAndResolve?: (payload: ShipmentCorrectionPayload) => void;
  isSaving?: boolean;
}

export function ShipmentCorrectionForm({
  shipment,
  onSaveAndResolve,
  isSaving = false,
}: ShipmentCorrectionFormProps) {
  // Controlled form state initialized from real backend shipment values
  const [formData, setFormData] = useState<ShipmentCorrectionPayload>({
    name: shipment.name ?? '',
    mobileNumber: shipment.mobileNumber ?? '',
    address: shipment.address ?? '',
    city: shipment.city ?? '',
    state: shipment.state ?? '',
    pincode: shipment.pincode ?? '',
    awbNumber: shipment.awbNumber ?? '',
    courierPartnerName: shipment.courierPartnerName ?? '',
    weight:
      shipment.weight !== null && shipment.weight !== undefined
        ? String(shipment.weight)
        : '',
    amount:
      shipment.amount !== null && shipment.amount !== undefined
        ? String(shipment.amount)
        : '',
  });

  // Extract issue message for a specific field directly from backend data
  const getFieldIssue = (fieldName: string): string | undefined => {
    if (!shipment.issues) return undefined;
    if (Array.isArray(shipment.issues)) {
      const match = (shipment.issues as ShipmentIssue[]).find(
        (iss) => iss.field.toLowerCase() === fieldName.toLowerCase()
      );
      return match ? match.message : undefined;
    }
    if (typeof shipment.issues === 'object') {
      const issuesRecord = shipment.issues as Record<string, string>;
      return issuesRecord[fieldName] || undefined;
    }
    return undefined;
  };

  const handleChange = (field: keyof ShipmentCorrectionPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !onSaveAndResolve) return;
    onSaveAndResolve(formData);
  };

  const hasIssues =
    shipment.issues &&
    (Array.isArray(shipment.issues)
      ? (shipment.issues as ShipmentIssue[]).length > 0
      : Object.keys(shipment.issues as Record<string, string>).length > 0);

  const issuesCount =
    shipment.issues && Array.isArray(shipment.issues)
      ? (shipment.issues as ShipmentIssue[]).length
      : shipment.issues
      ? Object.keys(shipment.issues as Record<string, string>).length
      : 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Unresolved Issues Banner */}
      {hasIssues && (
        <div className={styles.issueAlertBanner} role="alert">
          <div className={styles.issueAlertHeader}>
            <AlertTriangle size={18} />
            <span>Unresolved Label Issues ({issuesCount})</span>
          </div>
          <ul className={styles.issueList}>
            {Array.isArray(shipment.issues)
              ? (shipment.issues as ShipmentIssue[]).map((iss, i) => (
                  <li key={i}>
                    <strong>{iss.field}</strong>: {iss.message}
                  </li>
                ))
              : Object.entries(shipment.issues as Record<string, string>).map(
                  ([k, v], i) => (
                    <li key={i}>
                      <strong>{k}</strong>: {v}
                    </li>
                  )
                )}
          </ul>
        </div>
      )}

      {/* Recipient Information */}
      <div className={styles.sectionHeader}>
        <span>Consignee Details</span>
      </div>

      <div className={styles.row2}>
        <Input
          label="Customer / Recipient Name"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g. Vikram Singh"
          error={getFieldIssue('name')}
          disabled={isSaving}
        />
        <Input
          label="Mobile Number"
          value={formData.mobileNumber || ''}
          onChange={(e) => handleChange('mobileNumber', e.target.value)}
          placeholder="e.g. 9876543210"
          error={getFieldIssue('mobileNumber')}
          disabled={isSaving}
          type="tel"
        />
      </div>

      <Input
        label="Delivery Address"
        value={formData.address || ''}
        onChange={(e) => handleChange('address', e.target.value)}
        placeholder="House/flat no., street, landmark"
        error={getFieldIssue('address')}
        disabled={isSaving}
      />

      <div className={styles.row3}>
        <Input
          label="City"
          value={formData.city || ''}
          onChange={(e) => handleChange('city', e.target.value)}
          placeholder="e.g. Jaipur"
          error={getFieldIssue('city')}
          disabled={isSaving}
        />
        <Input
          label="State"
          value={formData.state || ''}
          onChange={(e) => handleChange('state', e.target.value)}
          placeholder="e.g. Rajasthan"
          error={getFieldIssue('state')}
          disabled={isSaving}
        />
        <Input
          label="Pincode"
          value={formData.pincode || ''}
          onChange={(e) => handleChange('pincode', e.target.value)}
          placeholder="e.g. 302006"
          error={getFieldIssue('pincode')}
          disabled={isSaving}
        />
      </div>

      {/* Logistics & Commercials */}
      <div className={styles.sectionHeader}>
        <span>Logistics & Commercials</span>
      </div>

      <div className={styles.row2}>
        <Input
          label="AWB Number"
          value={formData.awbNumber || ''}
          onChange={(e) => handleChange('awbNumber', e.target.value)}
          placeholder="e.g. EKR-44129984"
          error={getFieldIssue('awbNumber')}
          disabled={isSaving}
        />
        <Input
          label="Courier Partner"
          value={formData.courierPartnerName || ''}
          onChange={(e) => handleChange('courierPartnerName', e.target.value)}
          placeholder="e.g. Delhivery, Blue Dart, Ekart"
          error={getFieldIssue('courierPartnerName')}
          disabled={isSaving}
        />
      </div>

      <div className={styles.row2}>
        <Input
          label="Weight (kg)"
          value={
            formData.weight !== undefined && formData.weight !== null
              ? String(formData.weight)
              : ''
          }
          onChange={(e) => handleChange('weight', e.target.value)}
          placeholder="e.g. 1.25"
          error={getFieldIssue('weight')}
          disabled={isSaving}
          type="number"
          step="0.01"
        />
        <Input
          label="Amount (₹)"
          value={
            formData.amount !== undefined && formData.amount !== null
              ? String(formData.amount)
              : ''
          }
          onChange={(e) => handleChange('amount', e.target.value)}
          placeholder="e.g. 1450"
          error={getFieldIssue('amount')}
          disabled={isSaving}
          type="number"
          step="0.01"
        />
      </div>

      {/* Form Submission Actions */}
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSaving}
          disabled={isSaving}
          leftIcon={<ShieldCheck size={16} />}
        >
          {isSaving ? 'Saving & Verifying...' : 'Save & Resolve'}
        </Button>
      </div>
    </form>
  );
}
