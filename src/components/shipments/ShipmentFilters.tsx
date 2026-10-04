import React from 'react';
import styles from './ShipmentFilters.module.css';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FileSpreadsheet, RotateCcw, Filter } from 'lucide-react';
import { ShipmentStatus } from '@/types/shipment';
import { ShipmentFilterParams } from '@/types/api';

export interface ShipmentFiltersProps {
  filters: ShipmentFilterParams;
  onChange: (
    key: keyof ShipmentFilterParams,
    value: string | number | boolean | undefined
  ) => void;
  onApply: () => void;
  onReset: () => void;
  onExportExcel: () => void;
  isExporting?: boolean;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'All Statuses (Default)' },
  { value: 'READY', label: 'Ready' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'ISSUE', label: 'Issue' },
  { value: 'SHIPPED', label: 'Shipped' },
];

const COURIER_OPTIONS = [
  { value: '', label: 'All Couriers' },
  { value: 'Delhivery', label: 'Delhivery' },
  { value: 'DTDC', label: 'DTDC' },
  { value: 'Shree Tirupati Courier', label: 'Shree Tirupati Courier' },
  { value: 'Blue Dart', label: 'Blue Dart' },
  { value: 'Ekart', label: 'Ekart' },
  { value: 'Shadowfax', label: 'Shadowfax' },
  { value: 'Xpressbees', label: 'Xpressbees' },
];

export function ShipmentFilters({
  filters,
  onChange,
  onApply,
  onReset,
  onExportExcel,
  isExporting = false,
  isLoading = false,
}: ShipmentFiltersProps) {
  return (
    <div className={styles.container}>
      <div className={styles.filterGrid}>
        <Select
          label="Status"
          value={filters.status || 'ALL'}
          onChange={(e) =>
            onChange('status', e.target.value as ShipmentStatus | 'ALL')
          }
          options={STATUS_OPTIONS}
        />

        <Select
          label="Courier"
          value={filters.courier || ''}
          onChange={(e) => onChange('courier', e.target.value)}
          options={COURIER_OPTIONS}
          disabled={isLoading}
        />

        <Input
          label="City"
          placeholder="Filter by city"
          value={filters.city || ''}
          onChange={(e) => onChange('city', e.target.value)}
          disabled={isLoading}
        />

        <Input
          label="State"
          placeholder="Filter by state"
          value={filters.state || ''}
          onChange={(e) => onChange('state', e.target.value)}
          disabled={isLoading}
        />

        <Input
          type="date"
          label="From Date"
          value={filters.fromDate || ''}
          onChange={(e) => onChange('fromDate', e.target.value)}
          disabled={isLoading}
        />

        <Input
          type="date"
          label="To Date"
          value={filters.toDate || ''}
          onChange={(e) => onChange('toDate', e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className={styles.actionsRow}>
        <div className={styles.primaryActions}>
          <Button
            variant="primary"
            size="sm"
            onClick={onApply}
            disabled={isLoading}
            leftIcon={<Filter size={14} />}
          >
            Apply Filters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={isLoading}
            leftIcon={<RotateCcw size={14} />}
          >
            Reset
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onExportExcel}
          isLoading={isExporting}
          disabled={isExporting || isLoading}
          leftIcon={<FileSpreadsheet size={15} />}
        >
          {isExporting ? 'Exporting...' : 'Export Excel'}
        </Button>
      </div>
    </div>
  );
}
