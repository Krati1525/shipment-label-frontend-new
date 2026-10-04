import React, { useState, useEffect } from 'react';
import styles from './EditShipmentModal.module.css';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Shipment, ShipmentStatus } from '@/types/shipment';
import { Save, X } from 'lucide-react';

export interface EditShipmentModalProps {
  shipment: Shipment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updatedData: Partial<Shipment>) => Promise<void>;
  isSaving?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'READY', label: 'READY (Verified for dispatch)' },
  { value: 'ISSUE', label: 'ISSUE (Needs Review)' },
  { value: 'PROCESSING', label: 'PROCESSING' },
  { value: 'SHIPPED', label: 'SHIPPED (Handed over)' },
  { value: 'PAUSED', label: 'PAUSED' },
];

export function EditShipmentModal({
  shipment,
  isOpen,
  onClose,
  onSave,
  isSaving = false,
}: EditShipmentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    mobileNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    awbNumber: '',
    courierPartnerName: '',
    weight: '',
    amount: '',
    status: 'READY' as ShipmentStatus,
  });

  useEffect(() => {
    if (shipment) {
      setFormData({
        name: shipment.name || '',
        mobileNumber: shipment.mobileNumber || '',
        address: shipment.address || '',
        city: shipment.city || '',
        state: shipment.state || '',
        pincode: shipment.pincode || '',
        awbNumber: shipment.awbNumber || '',
        courierPartnerName: shipment.courierPartnerName || '',
        weight: shipment.weight !== null && shipment.weight !== undefined ? String(shipment.weight) : '',
        amount: shipment.amount !== null && shipment.amount !== undefined ? String(shipment.amount) : '',
        status: shipment.status || 'READY',
      });
    }
  }, [shipment]);

  const handleChange = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipment) return;

    const payload: Partial<Shipment> = {
      name: formData.name.trim() || undefined,
      mobileNumber: formData.mobileNumber.trim() || undefined,
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      pincode: formData.pincode.trim() || undefined,
      awbNumber: formData.awbNumber.trim() || undefined,
      courierPartnerName: formData.courierPartnerName.trim() || undefined,
      weight: formData.weight !== '' && !isNaN(Number(formData.weight)) ? Number(formData.weight) : (null as any),
      amount: formData.amount !== '' && !isNaN(Number(formData.amount)) ? Number(formData.amount) : (null as any),
      status: formData.status,
    };

    await onSave(shipment.id, payload);
  };

  if (!shipment) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Shipment ${shipment.awbNumber || shipment.id.slice(0, 8)}`}
      size="lg"
      footer={
        <div className={styles.footerActions}>
          <Button variant="secondary" size="md" onClick={onClose} disabled={isSaving} leftIcon={<X size={15} />}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSubmit}
            isLoading={isSaving}
            disabled={isSaving}
            leftIcon={<Save size={15} />}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.infoBanner}>
          <span>All fields are optional. Update any values and click &quot;Save Changes&quot;.</span>
        </div>

        <div className={styles.sectionTitle}>Recipient Details</div>
        <div className={styles.row2}>
          <Input
            label="Customer / Recipient Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. Babulal Kumawat"
          />
          <Input
            label="Mobile Number"
            value={formData.mobileNumber}
            onChange={(e) => handleChange('mobileNumber', e.target.value)}
            placeholder="e.g. 9998989906"
            type="tel"
          />
        </div>

        <Input
          label="Delivery Address"
          value={formData.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="House/flat no, street, landmark"
        />

        <div className={styles.row3}>
          <Input
            label="City"
            value={formData.city}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="e.g. Ahmedabad"
          />
          <Input
            label="State"
            value={formData.state}
            onChange={(e) => handleChange('state', e.target.value)}
            placeholder="e.g. Gujarat"
          />
          <Input
            label="Pincode"
            value={formData.pincode}
            onChange={(e) => handleChange('pincode', e.target.value)}
            placeholder="e.g. 382470"
          />
        </div>

        <div className={styles.sectionTitle}>Logistics & Tracking</div>
        <div className={styles.row2}>
          <Input
            label="AWB / Tracking Number"
            value={formData.awbNumber}
            onChange={(e) => handleChange('awbNumber', e.target.value)}
            placeholder="e.g. 224800004269"
          />
          <Input
            label="Courier Partner"
            value={formData.courierPartnerName}
            onChange={(e) => handleChange('courierPartnerName', e.target.value)}
            placeholder="e.g. Shree Tirupati Courier"
          />
        </div>

        <div className={styles.row3}>
          <Input
            label="Weight (kg)"
            value={formData.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            placeholder="Optional e.g. 1.25"
            type="number"
            step="0.01"
          />
          <Input
            label="Amount (₹)"
            value={formData.amount}
            onChange={(e) => handleChange('amount', e.target.value)}
            placeholder="Optional e.g. 500"
            type="number"
            step="0.01"
          />
          <Select
            label="Shipment Status"
            value={formData.status}
            options={STATUS_OPTIONS}
            onChange={(e) => handleChange('status', e.target.value as ShipmentStatus)}
          />
        </div>
      </form>
    </Modal>
  );
}