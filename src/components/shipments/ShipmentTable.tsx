import React from 'react';
import styles from './ShipmentTable.module.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Eye, ArrowUp, ArrowDown, ArrowUpDown, PackageOpen } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { formatCurrency, formatPhone, formatWeight, cn } from '@/lib/utils';

export interface ShipmentTableProps {
  shipments: Shipment[];
  onSelectShipment: (shipment: Shipment) => void;
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export function ShipmentTable({
  shipments,
  onSelectShipment,
  isLoading = false,
  sortBy,
  sortOrder,
  onSortChange,
  onResetFilters,
  isFiltered = false,
}: ShipmentTableProps) {


  const renderSortIndicator = (field: string) => {
    if (sortBy === field) {
      return sortOrder === 'asc' ? (
        <ArrowUp size={13} className={styles.activeSortIcon} />
      ) : (
        <ArrowDown size={13} className={styles.activeSortIcon} />
      );
    }
    return <ArrowUpDown size={13} className={styles.mutedSortIcon} />;
  };

  // Render Empty State
  if (!isLoading && shipments.length === 0) {
    return (
      <div className={styles.tableContainer}>
        <EmptyState
          icon={<PackageOpen size={36} color="var(--text-muted)" />}
          title={isFiltered ? 'No shipments match filters' : 'No shipments found'}
          description={
            isFiltered
              ? 'No shipments match your current search query or active filter criteria.'
              : 'There are currently no shipments found in the system for this view.'
          }
          action={
            isFiltered && onResetFilters ? (
              <Button variant="secondary" size="sm" onClick={onResetFilters}>
                Clear All Filters
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('name')}
                  aria-label="Sort by customer name"
                >
                  <span>Customer</span>
                  {renderSortIndicator('name')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('awbNumber')}
                  aria-label="Sort by AWB number"
                >
                  <span>AWB Number</span>
                  {renderSortIndicator('awbNumber')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('courierPartnerName')}
                  aria-label="Sort by courier partner"
                >
                  <span>Courier Partner</span>
                  {renderSortIndicator('courierPartnerName')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('city')}
                  aria-label="Sort by destination city"
                >
                  <span>City / State</span>
                  {renderSortIndicator('city')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('pincode')}
                  aria-label="Sort by pincode"
                >
                  <span>Pincode</span>
                  {renderSortIndicator('pincode')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('weight')}
                  aria-label="Sort by weight"
                >
                  <span>Weight</span>
                  {renderSortIndicator('weight')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('amount')}
                  aria-label="Sort by declared amount"
                >
                  <span>Amount</span>
                  {renderSortIndicator('amount')}
                </button>
              </th>
              <th className={styles.th}>
                <button
                  type="button"
                  className={styles.thSortButton}
                  onClick={() => onSortChange?.('status')}
                  aria-label="Sort by status"
                >
                  <span>Status</span>
                  {renderSortIndicator('status')}
                </button>
              </th>
              <th className={styles.th} style={{ textAlign: 'right' }}>
                <span>Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading Skeleton Rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className={styles.skeletonRow}>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '120px' }} />
                    <div className={styles.skeletonSubline} style={{ width: '80px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '100px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '90px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '110px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '60px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '70px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonLine} style={{ width: '80px' }} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonBadge} />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.skeletonButton} />
                  </td>
                </tr>
              ))
            ) : (
              shipments.map((shipment) => {
                const location = [shipment.city, shipment.state]
                  .filter(Boolean)
                  .join(', ');

                return (
                  <tr key={shipment.id} className={styles.tr}>
                    {/* Customer */}
                    <td className={styles.td}>
                      <div className={styles.customerBlock}>
                        <span className={styles.customerName}>
                          {shipment.name || 'Unnamed Recipient'}
                        </span>
                        <span className={styles.customerPhone}>
                          {formatPhone(shipment.mobileNumber)}
                        </span>
                      </div>
                    </td>

                    {/* AWB Number */}
                    <td className={styles.td}>
                      <span className={styles.mono}>
                        {shipment.awbNumber || '—'}
                      </span>
                    </td>

                    {/* Courier Partner */}
                    <td className={styles.td}>
                      <span className={styles.cellText}>
                        {shipment.courierPartnerName || '—'}
                      </span>
                    </td>

                    {/* City / State */}
                    <td className={styles.td}>
                      <span className={styles.cellText}>{location || '—'}</span>
                    </td>

                    {/* Pincode */}
                    <td className={styles.td}>
                      <span className={styles.cellText}>
                        {shipment.pincode || '—'}
                      </span>
                    </td>

                    {/* Weight */}
                    <td className={styles.td}>
                      <span className={styles.cellText}>
                        {formatWeight(shipment.weight)}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className={styles.td}>
                      <span className={styles.amountText}>
                        {formatCurrency(shipment.amount)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className={styles.td}>
                      <StatusBadge status={shipment.status} />
                    </td>

                    {/* Actions */}
                    <td className={styles.td}>
                      <div className={styles.actionsCell}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectShipment(shipment)}
                          leftIcon={<Eye size={14} />}
                        >
                          Details
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
