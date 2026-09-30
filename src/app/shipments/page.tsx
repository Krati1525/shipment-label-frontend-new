'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { ShipmentSearch } from '@/components/shipments/ShipmentSearch';
import { ShipmentFilters } from '@/components/shipments/ShipmentFilters';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { Pagination } from '@/components/shipments/Pagination';
import { ShipmentDetailsDrawer } from '@/components/shipments/ShipmentDetailsDrawer';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { Shipment, Pagination as PaginationType, ShipmentStatus } from '@/types/shipment';
import { ShipmentFilterParams } from '@/types/api';
import { getShipments, exportShipments, downloadBlob, markShipmentShipped } from '@/lib/shipments';

interface ToastState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const DEFAULT_FILTERS: ShipmentFilterParams = {
  search: '',
  status: 'READY', // Authoritative backend default
  courier: '',
  city: '',
  state: '',
  fromDate: '',
  toDate: '',
  page: 1,
  limit: 10,
  sortBy: 'date',
  sortOrder: 'desc',
};

function ShipmentsContent() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ShipmentFilterParams>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState<string>('');
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [pagination, setPagination] = useState<PaginationType>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });

  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Sync with URL query parameters (?status=... and ?id=...) on mount or URL change
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const idParam = searchParams.get('id');

    if (statusParam) {
      const upper = statusParam.toUpperCase();
      if (['PROCESSING', 'ISSUE', 'READY', 'SHIPPED', 'ALL'].includes(upper)) {
        setFilters((prev) => {
          if (prev.status === upper) return prev;
          return {
            ...prev,
            status: upper as ShipmentStatus | 'ALL',
            page: 1,
          };
        });
      }
    }

    if (idParam) {
      setSelectedShipmentId(idParam);
      setIsDrawerOpen(true);
    }
  }, [searchParams]);

  // Mark Shipped confirmation modal state
  const [shipmentToShip, setShipmentToShip] = useState<Shipment | null>(null);
  const [isShipping, setIsShipping] = useState(false);

  // Network and action states
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Request sequence ID to prevent race conditions on rapid search/filter typing
  const latestRequestIdRef = useRef(0);

  // Fetch real shipments from backend
  const fetchShipments = useCallback(async (currentFilters: ShipmentFilterParams) => {
    const requestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await getShipments(currentFilters);

      // Discard stale responses if a newer request was dispatched
      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setShipments(response.data || []);
      setPagination(
        response.pagination || {
          page: currentFilters.page || 1,
          limit: currentFilters.limit || 10,
          total: response.data ? response.data.length : 0,
          totalPages: 1,
        }
      );
    } catch (err: unknown) {
      if (requestId !== latestRequestIdRef.current) {
        return;
      }
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to load shipments. Please verify backend connectivity.';
      setError(msg);
      setShipments([]);
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Trigger fetch whenever filters change
  useEffect(() => {
    fetchShipments(filters);
  }, [filters, fetchShipments]);

  // Debounced search effect (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        return {
          ...prev,
          search: searchInput,
          page: 1, // Reset to page 1 on new search query
        };
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Search handlers
  const handleSearchChange = (val: string) => {
    setSearchInput(val);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setFilters((prev) => ({ ...prev, search: '', page: 1 }));
  };

  // Filter change handlers
  const handleFilterChange = (
    key: keyof ShipmentFilterParams,
    value: string | number | boolean | undefined
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1, // Reset page on filter changes
    }));
  };

  const handleApplyFilters = () => {
    fetchShipments(filters);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters(DEFAULT_FILTERS);
    setToast({
      type: 'info',
      message: 'Filters reset to default view (Ready shipments).',
    });
  };

  // Server-side column sorting
  const handleSortChange = (field: string) => {
    setFilters((prev) => {
      if (prev.sortBy === field) {
        const nextOrder = prev.sortOrder === 'asc' ? 'desc' : 'asc';
        return {
          ...prev,
          sortBy: field,
          sortOrder: nextOrder,
          page: 1,
        };
      }
      return {
        ...prev,
        sortBy: field,
        sortOrder: 'asc',
        page: 1,
      };
    });
  };

  // Server-side pagination
  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Export Excel matching current filters
  const handleExportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const blob = await exportShipments(filters);
      downloadBlob(blob, `shipments-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
      setToast({
        type: 'success',
        message: 'Excel spreadsheet downloaded successfully.',
      });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to export shipments. Please try again.';
      setToast({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Drawer handlers
  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipmentId(shipment.id);
    setIsDrawerOpen(true);
  };

  // Handle Mark as Shipped confirmation
  const handleRequestMarkShipped = (shipment: Shipment) => {
    setShipmentToShip(shipment);
  };

  const handleConfirmMarkShipped = async () => {
    if (!shipmentToShip || isShipping) return;
    setIsShipping(true);
    try {
      const updated = await markShipmentShipped(shipmentToShip.id);

      setToast({
        type: 'success',
        message: `Shipment ${updated.awbNumber || updated.id.slice(0, 8)} marked as SHIPPED.`,
      });

      setShipmentToShip(null);

      // Refresh table to reflect authoritative status change
      fetchShipments(filters);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to mark shipment as shipped. Please try again.';
      setToast({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsShipping(false);
    }
  };

  const isFiltered =
    Boolean(filters.search) ||
    (filters.status !== 'READY' && filters.status !== undefined) ||
    Boolean(filters.courier) ||
    Boolean(filters.city) ||
    Boolean(filters.state) ||
    Boolean(filters.fromDate) ||
    Boolean(filters.toDate);

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Shipments Management</h1>
          <p className={styles.subtitle}>
            Search, filter, track status, notify recipients via WhatsApp/SMS, and dispatch deliveries.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => fetchShipments(filters)}
            disabled={isLoading}
            leftIcon={
              <RefreshCw
                size={14}
                className={isLoading ? styles.spinning : ''}
              />
            }
          >
            Refresh Table
          </Button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Search Input with Debounce */}
      <ShipmentSearch
        value={searchInput}
        onChange={handleSearchChange}
        onClear={handleSearchClear}
      />

      {/* Filter Toolbar */}
      <ShipmentFilters
        filters={filters}
        onChange={handleFilterChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        onExportExcel={handleExportExcel}
        isExporting={isExporting}
        isLoading={isLoading}
      />

      {/* Error State */}
      {error ? (
        <ErrorState
          title="Unable to load shipments"
          message={error}
          onRetry={() => fetchShipments(filters)}
        />
      ) : (
        <>
          {/* Shipments Data Table */}
          <ShipmentTable
            shipments={shipments}
            onSelectShipment={handleSelectShipment}
            isLoading={isLoading}
            sortBy={filters.sortBy}
            sortOrder={filters.sortOrder}
            onSortChange={handleSortChange}
            onResetFilters={handleResetFilters}
            isFiltered={isFiltered}
          />

          {/* Server-Side Pagination */}
          {!isLoading && pagination.total > 0 && (
            <Pagination
              pagination={pagination}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      {/* Authoritative Shipment Details Drawer */}
      <ShipmentDetailsDrawer
        shipmentId={selectedShipmentId}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedShipmentId(null);
        }}
        onRequestMarkShipped={handleRequestMarkShipped}
      />

      {/* Mark as Shipped Confirmation Modal */}
      <Modal
        isOpen={Boolean(shipmentToShip)}
        onClose={() => !isShipping && setShipmentToShip(null)}
        title="Confirm Shipment Dispatch"
        size="md"
        footer={
          <div className={styles.modalActions}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShipmentToShip(null)}
              disabled={isShipping}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleConfirmMarkShipped}
              isLoading={isShipping}
              disabled={isShipping}
              leftIcon={<CheckCheck size={16} />}
            >
              Confirm Dispatch
            </Button>
          </div>
        }
      >
        <div className={styles.modalContent}>
          <p>
            Are you sure you want to mark this shipment as <strong>SHIPPED</strong>?
          </p>
          {shipmentToShip && (
            <div className={styles.confirmDetailsBox}>
              <div>
                <strong>AWB:</strong> {shipmentToShip.awbNumber || '—'}
              </div>
              <div>
                <strong>Recipient:</strong> {shipmentToShip.name || 'Unnamed Recipient'}
              </div>
              <div>
                <strong>Courier:</strong> {shipmentToShip.courierPartnerName || '—'}
              </div>
              <div>
                <strong>Destination:</strong>{' '}
                {[shipmentToShip.city, shipmentToShip.state].filter(Boolean).join(', ') || '—'}
              </div>
            </div>
          )}
          <p className={styles.confirmSubtext}>
            This updates the authoritative record in the database and confirms the parcel has been dispatched to the carrier.
          </p>
        </div>
      </Modal>
    </div>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem' }}>Loading shipments...</div>}>
      <ShipmentsContent />
    </Suspense>
  );
}
