import React from 'react';
import Link from 'next/link';
import styles from './RecentShipments.module.css';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArrowRight, Eye, UploadCloud } from 'lucide-react';
import { formatCurrency, formatPhone, formatDate } from '@/lib/utils';
import { Shipment } from '@/types/shipment';

export interface RecentShipmentsProps {
  shipments?: Shipment[];
  isLoading?: boolean;
  onViewShipment?: (shipment: Shipment) => void;
}

export function RecentShipments({
  shipments = [],
  isLoading = false,
  onViewShipment,
}: RecentShipmentsProps) {
  return (
    <Card>
      <CardHeader
        title="Recent Shipments"
        subtitle="Latest label extractions and status changes"
        action={
          <Link href="/shipments">
            <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
              View All
            </Button>
          </Link>
        }
      />
      <CardBody flush>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Customer</th>
                <th className={styles.th}>AWB Number</th>
                <th className={styles.th}>Courier</th>
                <th className={styles.th}>Destination</th>
                <th className={styles.th}>Amount</th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // 5 Skeleton placeholder rows while real data is loading
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`skeleton-${idx}`} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.customerCell}>
                        <span className={styles.skeletonCell} style={{ width: '9rem', marginBottom: '0.25rem' }} />
                        <span className={styles.skeletonCell} style={{ width: '6rem' }} />
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '7rem' }} />
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '5.5rem' }} />
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '8rem' }} />
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '4.5rem' }} />
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '5rem' }} />
                    </td>
                    <td className={styles.td}>
                      <span className={styles.skeletonCell} style={{ width: '4.5rem', borderRadius: '1rem' }} />
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right' }}>
                      <span className={styles.skeletonCell} style={{ width: '3.5rem' }} />
                    </td>
                  </tr>
                ))
              ) : shipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.tdEmpty}>
                    <EmptyState
                      title="No shipments yet."
                      description="Upload your first shipment labels to get started."
                      action={
                        <Link href="/upload">
                          <Button variant="primary" size="sm" leftIcon={<UploadCloud size={14} />}>
                            Upload Labels
                          </Button>
                        </Link>
                      }
                    />
                  </td>
                </tr>
              ) : (
                shipments.map((s) => (
                  <tr key={s.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.customerCell}>
                        <span className={styles.customerName}>{s.name || 'Unnamed Recipient'}</span>
                        <span className={styles.customerMobile}>{formatPhone(s.mobileNumber)}</span>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={styles.mono}>{s.awbNumber || '—'}</span>
                    </td>
                    <td className={styles.td}>{s.courierPartnerName || '—'}</td>
                    <td className={styles.td}>
                      {s.city && s.state ? `${s.city}, ${s.state}` : s.city || s.state || '—'}
                    </td>
                    <td className={styles.td}>{formatCurrency(s.amount)}</td>
                    <td className={styles.td}>{formatDate(s.date || s.createdAt)}</td>
                    <td className={styles.td}>
                      <StatusBadge status={s.status} />
                    </td>
                    <td className={styles.td} style={{ textAlign: 'right' }}>
                      <Link href={`/shipments?id=${s.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            if (onViewShipment) {
                              e.preventDefault();
                              onViewShipment(s);
                            }
                          }}
                          leftIcon={<Eye size={14} />}
                        >
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}

