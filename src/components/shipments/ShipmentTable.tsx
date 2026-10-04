import React from 'react';
import styles from './ShipmentTable.module.css';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Eye, Trash2, Edit2, MessageSquare, MessageCircle, ArrowUp, ArrowDown, ArrowUpDown, PackageOpen } from 'lucide-react';
import { Shipment } from '@/types/shipment';
import { formatCurrency, formatPhone, formatWeight } from '@/lib/utils';

export interface ShipmentTableProps {
  shipments: Shipment[];
  onSelectShipment: (shipment: Shipment) => void;
  isLoading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: string) => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
  onDeleteShipment?: (shipment: Shipment) => void;
  onEditShipment?: (shipment: Shipment) => void;
  onOpenSms?: (shipment: Shipment) => void;
  onOpenWhatsApp?: (shipment: Shipment) => void;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
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
  onDeleteShipment,
  onEditShipment,
  onOpenSms,
  onOpenWhatsApp,
  selectedIds = [],
  onToggleSelect,
  onToggleSelectAll,
}: ShipmentTableProps) {
  const allSelected =
    shipments.length > 0 && shipments.every((s) => selectedIds.includes(s.id));
  const someSelected =
    shipments.some((s) => selectedIds.includes(s.id)) && !allSelected;

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
              {onToggleSelectAll && (
                <th className={styles.checkboxTh}>
                  <input
                    type="checkbox"
                    className={styles.checkboxInput}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={onToggleSelectAll}
                    aria-label="Select all visible shipments"
                  />
                </th>
              )}
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
                  {onToggleSelectAll && (
                    <td className={styles.checkboxTd}>
                      <div className={styles.skeletonLine} style={{ width: '16px', height: '16px' }} />
                    </td>
                  )}
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
                const isSelected = selectedIds.includes(shipment.id);
                const location = [shipment.city, shipment.state]
                  .filter(Boolean)
                  .join(', ');
                const isReady = String(shipment.status || '').trim().toUpperCase() === 'READY';

                return (
                  <tr
                    key={shipment.id}
                    className={`${styles.tr} ${isSelected ? styles.rowSelected : ''}`}
                  >
                    {/* Checkbox */}
                    {onToggleSelect && (
                      <td className={styles.checkboxTd}>
                        <input
                          type="checkbox"
                          className={styles.checkboxInput}
                          checked={isSelected}
                          onChange={() => onToggleSelect(shipment.id)}
                          aria-label={`Select shipment ${shipment.id}`}
                        />
                      </td>
                    )}

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
                          title="View Details"
                        >
                          Details
                        </Button>
                        {onEditShipment && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditShipment(shipment);
                            }}
                            leftIcon={<Edit2 size={13} color="var(--primary)" />}
                            title="Edit shipment data"
                            aria-label={`Edit shipment ${shipment.id}`}
                          >
                            Edit
                          </Button>
                        )}
                        
                        {onOpenWhatsApp && isReady && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenWhatsApp(shipment);
                            }}
                            title="Send WhatsApp Notification"
                            aria-label={`Send WhatsApp to ${shipment.mobileNumber || 'recipient'}`}
                          >
                            <MessageCircle size={14} color="#16a34a" />
                          </Button>
                        )}
                        {onOpenSms && isReady && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenSms(shipment);
                            }}
                            title="Send Direct SMS"
                            aria-label={`Send SMS to ${shipment.mobileNumber || 'recipient'}`}
                          >
                            <MessageSquare size={14} color="var(--text-secondary)" />
                          </Button>
                        )}
                        {onDeleteShipment && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteShipment(shipment);
                            }}
                            title="Delete shipment"
                            aria-label={`Delete shipment ${shipment.id}`}
                          >
                            <Trash2 size={14} color="var(--status-issue-text)" />
                          </Button>
                        )}
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