import React, { useState } from 'react';
import styles from './ShipmentCorrectionForm.module.css';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertTriangle, ShieldCheck, ScanLine } from 'lucide-react';
import { Shipment, ShipmentIssue } from '@/types/shipment';
import { ShipmentCorrectionPayload } from '@/types/api';

export interface ShipmentCorrectionFormProps {
  shipment: Shipment;
  onSaveAndResolve?: (payload: ShipmentCorrectionPayload) => void;
  isSaving?: boolean;
  onReScan?: () => void;
  isReScanning?: boolean;
}

export function ShipmentCorrectionForm({
  shipment,
  onSaveAndResolve,
  isSaving = false,
  onReScan,
  isReScanning = false,
}: ShipmentCorrectionFormProps) {
  // Controlled form state initialized from backend shipment values
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
  // All fields are optional: "Missing" on optional fields does not show as a blocking validation error
  const getFieldIssue = (fieldName: string): string | undefined => {
    if (!shipment.issues) return undefined;
    let message: string | undefined;
    if (Array.isArray(shipment.issues)) {
      const match = (shipment.issues as ShipmentIssue[]).find(
        (iss) => iss.field.toLowerCase() === fieldName.toLowerCase()
      );
      message = match ? match.message : undefined;
    } else if (typeof shipment.issues === 'object') {
      message = (shipment.issues as Record<string, string>)[fieldName];
    }

    if (message === 'Missing') {
      return undefined;
    }
    return message;
  };

  const handleChange = (field: keyof ShipmentCorrectionPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !onSaveAndResolve) return;
    onSaveAndResolve(formData);
  };

  const rawIssues = shipment.issues;
  // Filter out pure "Missing" notices so optional fields don't alarm user
  const issuesList = rawIssues
    ? Array.isArray(rawIssues)
      ? (rawIssues as ShipmentIssue[]).filter((iss) => iss.message !== 'Missing')
      : Object.entries(rawIssues as Record<string, string>).filter(
          ([, v]) => v !== 'Missing'
        )
    : [];

  const hasGenuineIssues = issuesList.length > 0;

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* Unresolved Genuine Issues Banner */}
      {hasGenuineIssues && (
        <div className={styles.issueAlertBanner} role="alert">
          <div className={styles.issueAlertHeader}>
            <AlertTriangle size={18} />
            <span>Label Discrepancies ({issuesList.length})</span>
          </div>
          <ul className={styles.issueList}>
            {Array.isArray(rawIssues)
              ? (issuesList as ShipmentIssue[]).map((iss, i) => (
                  <li key={i}>
                    <strong>{iss.field}</strong>: {iss.message}
                  </li>
                ))
              : (issuesList as [string, string][]).map(([k, v], i) => (
                  <li key={i}>
                    <strong>{k}</strong>: {v}
                  </li>
                ))}
          </ul>
        </div>
      )}

      {/* Recipient Information */}
      <div className={styles.sectionHeader}>
        <span>Consignee Details (All Fields Optional)</span>
      </div>

      <div className={styles.row2}>
        <Input
          label="Customer / Recipient Name"
          value={formData.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="e.g. Babulal Kumawat"
          error={getFieldIssue('name')}
          disabled={isSaving || isReScanning}
        />
        <Input
          label="Mobile Number"
          value={formData.mobileNumber || ''}
          onChange={(e) => handleChange('mobileNumber', e.target.value)}
          placeholder="e.g. 9998989906"
          error={getFieldIssue('mobileNumber')}
          disabled={isSaving || isReScanning}
          type="tel"
        />
      </div>

      <Input
        label="Delivery Address"
        value={formData.address || ''}
        onChange={(e) => handleChange('address', e.target.value)}
        placeholder="House/flat no., street, landmark"
        error={getFieldIssue('address')}
        disabled={isSaving || isReScanning}
      />

      <div className={styles.row3}>
        <Input
          label="City"
          value={formData.city || ''}
          onChange={(e) => handleChange('city', e.target.value)}
          placeholder="e.g. Ahmedabad"
          error={getFieldIssue('city')}
          disabled={isSaving || isReScanning}
        />
        <Input
          label="State"
          value={formData.state || ''}
          onChange={(e) => handleChange('state', e.target.value)}
          placeholder="e.g. Gujarat"
          error={getFieldIssue('state')}
          disabled={isSaving || isReScanning}
        />
        <Input
          label="Pincode"
          value={formData.pincode || ''}
          onChange={(e) => handleChange('pincode', e.target.value)}
          placeholder="e.g. 382470"
          error={getFieldIssue('pincode')}
          disabled={isSaving || isReScanning}
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
          placeholder="e.g. 224800004269"
          error={getFieldIssue('awbNumber')}
          disabled={isSaving || isReScanning}
        />
        <Input
          label="Courier Partner"
          value={formData.courierPartnerName || ''}
          onChange={(e) => handleChange('courierPartnerName', e.target.value)}
          placeholder="e.g. Shree Tirupati, India Post, Delhivery"
          error={getFieldIssue('courierPartnerName')}
          disabled={isSaving || isReScanning}
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
          placeholder="Optional e.g. 1.25"
          error={getFieldIssue('weight')}
          disabled={isSaving || isReScanning}
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
          placeholder="Optional e.g. 1450"
          error={getFieldIssue('amount')}
          disabled={isSaving || isReScanning}
          type="number"
          step="0.01"
        />
      </div>

      {/* Form Submission Actions */}
      <div className={styles.actions} style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        {/* {onReScan && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={onReScan}
            disabled={isSaving || isReScanning}
            isLoading={isReScanning}
            leftIcon={<ScanLine size={16} />}
          >
            {isReScanning ? 'Re-scanning Label...' : 'Manual OCR Re-scan'}
          </Button>
        )} */}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSaving}
          disabled={isSaving || isReScanning}
          leftIcon={<ShieldCheck size={16} />}
        >
          {isSaving ? 'Saving & Verifying...' : 'Save & Resolve'}
        </Button>
      </div>
    </form>
  );
}