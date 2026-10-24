'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import styles from './page.module.css';
import { ShipmentSearch } from '@/components/shipments/ShipmentSearch';
import { ShipmentFilters } from '@/components/shipments/ShipmentFilters';
import { ShipmentTable } from '@/components/shipments/ShipmentTable';
import { Pagination } from '@/components/shipments/Pagination';
import { ShipmentDetailsDrawer } from '@/components/shipments/ShipmentDetailsDrawer';
import { EditShipmentModal } from '@/components/shipments/EditShipmentModal';
import { SmsModal } from '@/components/shipments/SmsModal';
import { WhatsAppModal } from '@/components/shipments/WhatsAppModal';
import { DeleteConfirmationModal } from '@/components/shipments/DeleteConfirmationModal';
import { Toast } from '@/components/ui/Toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/ErrorState';
import { CheckCheck, RefreshCw, Trash2, MessageSquare, MessageCircle, Send, X } from 'lucide-react';
import { Shipment, Pagination as PaginationType, ShipmentStatus } from '@/types/shipment';
import { ShipmentFilterParams } from '@/types/api';
import {
  getShipments,
  exportShipments,
  downloadBlob,
  markShipmentShipped,
  deleteShipment,
  deleteBatchShipments,
  updateShipment,
} from '@/lib/shipments';

interface ToastState {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

const DEFAULT_FILTERS: ShipmentFilterParams = {
  search: '',
  status: 'ALL',
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

  // Bulk selection state
  const [selectedShipmentIds, setSelectedShipmentIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // Delete confirmation modal state
  const [shipmentToDelete, setShipmentToDelete] = useState<Shipment | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  // Edit shipment modal state
  const [editingShipment, setEditingShipment] = useState<Shipment | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // SMS Modal state (single and bulk)
  const [smsShipment, setSmsShipment] = useState<Shipment | null>(null);
  const [isBulkSmsOpen, setIsBulkSmsOpen] = useState(false);

  // WhatsApp Modal state (single and bulk)
  const [whatsAppShipment, setWhatsAppShipment] = useState<Shipment | null>(null);
  const [isBulkWhatsAppOpen, setIsBulkWhatsAppOpen] = useState(false);
  const [drawerRefreshTrigger, setDrawerRefreshTrigger] = useState(0);

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

  const latestRequestIdRef = useRef(0);

  // Fetch real shipments from backend
  const fetchShipments = useCallback(async (currentFilters: ShipmentFilterParams) => {
    const requestId = ++latestRequestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await getShipments(currentFilters);

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
          page: 1,
        };
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
  };

  const handleSearchClear = () => {
    setSearchInput('');
    setFilters((prev) => ({ ...prev, search: '', page: 1 }));
  };

  const handleFilterChange = (
    key: keyof ShipmentFilterParams,
    value: string | number | boolean | undefined
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: 1,
    }));
  };

  const handleApplyFilters = () => {
    fetchShipments(filters);
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setFilters(DEFAULT_FILTERS);
    setSelectedShipmentIds([]);
    setToast({
      type: 'info',
      message: 'Filters reset to default view (Ready shipments).',
    });
  };

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

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      const msg = err instanceof Error ? err.message : 'Unable to export shipments. Please try again.';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsExporting(false);
    }
  };

  // Checkbox toggle handlers
  const handleToggleSelect = (id: string) => {
    setSelectedShipmentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (shipments.length === 0) return;
    const allSelected = shipments.every((s) => selectedShipmentIds.includes(s.id));
    if (allSelected) {
      setSelectedShipmentIds([]);
    } else {
      const allIds = shipments.map((s) => s.id);
      setSelectedShipmentIds(allIds);
    }
  };

  // Bulk Delete Operations
  const handleRequestBulkDelete = () => {
    if (selectedShipmentIds.length === 0) return;
    setIsBulkDeleteOpen(true);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedShipmentIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const res = await deleteBatchShipments(selectedShipmentIds);
      setToast({
        type: 'success',
        message: `Successfully deleted ${res.count} shipment(s).`,
      });
      setSelectedShipmentIds([]);
      setIsBulkDeleteOpen(false);
      fetchShipments(filters);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk delete failed.';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkWhatsApp = () => {
    if (readySelectedCount === 0) {
      setToast({
        type: 'warning',
        message: 'None of the selected shipments have status READY for WhatsApp dispatch.',
      });
      return;
    }
    setIsBulkWhatsAppOpen(true);
  };

  const handleOpenWhatsApp = (shipment: Shipment) => {
    setWhatsAppShipment(shipment);
  };

  // Single Row Handlers
  const handleDeleteShipment = (shipment: Shipment) => {
    setShipmentToDelete(shipment);
  };

  const handleConfirmSingleDelete = async () => {
    if (!shipmentToDelete) return;
    const label = shipmentToDelete.name || shipmentToDelete.awbNumber || shipmentToDelete.id.slice(0, 8);
    setIsDeletingSingle(true);
    try {
      await deleteShipment(shipmentToDelete.id);
      setToast({ type: 'success', message: `Shipment "${label}" deleted successfully.` });
      setShipments((prev) => prev.filter((s) => s.id !== shipmentToDelete.id));
      setSelectedShipmentIds((prev) => prev.filter((id) => id !== shipmentToDelete.id));
      if (selectedShipmentId === shipmentToDelete.id) {
        setSelectedShipmentId(null);
        setIsDrawerOpen(false);
      }
      setShipmentToDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete shipment.';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleEditShipment = (shipment: Shipment) => {
    setEditingShipment(shipment);
  };

  const handleSaveEdit = async (id: string, updatedData: Partial<Shipment>) => {
    setIsSavingEdit(true);
    try {
      const updated = await updateShipment(id, updatedData);
      setToast({
        type: 'success',
        message: `Shipment ${updated.awbNumber || updated.id.slice(0, 8)} updated successfully.`,
      });
      setShipments((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...updated, imageUrl: updated.imageUrl || s.imageUrl } : s))
      );
      setDrawerRefreshTrigger((prev) => prev + 1);
      setEditingShipment(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update shipment.';
      setToast({ type: 'error', message: msg });
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleBulkSms = () => {
    if (readySelectedCount === 0) {
      setToast({
        type: 'warning',
        message: 'None of the selected shipments have status READY for SMS dispatch.',
      });
      return;
    }
    setIsBulkSmsOpen(true);
  };

  const handleOpenSms = (shipment: Shipment) => {
    setSmsShipment(shipment);
  };

  const handleSelectShipment = (shipment: Shipment) => {
    setSelectedShipmentId(shipment.id);
    setIsDrawerOpen(true);
  };

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
      fetchShipments(filters);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to mark shipment as shipped.';
      setToast({ type: 'error', message: msg });
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

  const selectedShipmentsList = useMemo(
    () => shipments.filter((s) => selectedShipmentIds.includes(s.id)),
    [shipments, selectedShipmentIds]
  );
  const readySelectedShipments = useMemo(
    () =>
      selectedShipmentsList.filter(
        (s) => String(s.status || '').trim().toUpperCase() === 'READY'
      ),
    [selectedShipmentsList]
  );
  const readySelectedCount = readySelectedShipments.length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>Shipments Management</h1>
          <p className={styles.subtitle}>
            Search, filter, track status, notify recipients via Direct SMS/WhatsApp, and edit or dispatch shipments.
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

      {/* Bulk Action Toolbar */}
      {selectedShipmentIds.length > 0 && (
        <div className={styles.bulkBar}>
          <div className={styles.bulkInfo}>
            <span className={styles.bulkBadge}>{selectedShipmentIds.length}</span>
            <span>shipment(s) selected</span>
            {readySelectedCount > 0 && (
              <span className={styles.bulkReadyBadge}>
                {readySelectedCount} Ready
              </span>
            )}
          </div>

          <div className={styles.bulkActions}>
            {/* Show Bulk WhatsApp only for READY status */}
            {readySelectedCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkWhatsApp}
                leftIcon={<MessageCircle size={14} color="#16a34a" />}
                title={`Send WhatsApp to ${readySelectedCount} Ready shipment(s)`}
              >
                Bulk WhatsApp ({readySelectedCount})
              </Button>
            )}

            {/* Show Bulk SMS only for READY status */}
            {readySelectedCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBulkSms}
                leftIcon={<MessageSquare size={14} color="#2563eb" />}
                title={`Send SMS to ${readySelectedCount} Ready shipment(s)`}
              >
                Bulk SMS ({readySelectedCount})
              </Button>
            )}

            <Button
              variant="danger"
              size="sm"
              onClick={handleRequestBulkDelete}
              isLoading={isBulkDeleting}
              disabled={isBulkDeleting}
              leftIcon={<Trash2 size={14} />}
            >
              Bulk Delete ({selectedShipmentIds.length})
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedShipmentIds([])}
              leftIcon={<X size={14} />}
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

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
            onDeleteShipment={handleDeleteShipment}
            onEditShipment={handleEditShipment}
            onOpenSms={handleOpenSms}
            onOpenWhatsApp={handleOpenWhatsApp}
            selectedIds={selectedShipmentIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
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
        onDeleteShipment={handleDeleteShipment}
        onEditShipment={handleEditShipment}
        refreshTrigger={drawerRefreshTrigger}
      />

      {/* Edit Shipment Modal */}
      <EditShipmentModal
        shipment={editingShipment}
        isOpen={Boolean(editingShipment)}
        onClose={() => setEditingShipment(null)}
        onSave={handleSaveEdit}
        isSaving={isSavingEdit}
      />

      {/* Single Direct SMS Modal */}
      <SmsModal
        isOpen={Boolean(smsShipment)}
        onClose={() => setSmsShipment(null)}
        shipment={smsShipment}
        onSuccess={(msg) => setToast({ type: 'success', message: msg })}
      />

      {/* Bulk SMS Modal */}
      <SmsModal
        isOpen={isBulkSmsOpen}
        onClose={() => setIsBulkSmsOpen(false)}
        shipments={isBulkSmsOpen ? readySelectedShipments : []}
        onSuccess={(msg) => {
          setToast({ type: 'success', message: msg });
          setSelectedShipmentIds([]);
        }}
      />

      {/* Single WhatsApp Modal */}
      <WhatsAppModal
        isOpen={Boolean(whatsAppShipment)}
        onClose={() => setWhatsAppShipment(null)}
        shipment={whatsAppShipment}
        onSuccess={(msg) => setToast({ type: 'success', message: msg })}
      />

      {/* Bulk WhatsApp Modal */}
      <WhatsAppModal
        isOpen={isBulkWhatsAppOpen}
        onClose={() => setIsBulkWhatsAppOpen(false)}
        shipments={isBulkWhatsAppOpen ? readySelectedShipments : []}
        onSuccess={(msg) => {
          setToast({ type: 'success', message: msg });
          setSelectedShipmentIds([]);
        }}
      />

      {/* Single Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={Boolean(shipmentToDelete)}
        onClose={() => !isDeletingSingle && setShipmentToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        isLoading={isDeletingSingle}
        shipment={shipmentToDelete}
      />

      {/* Bulk Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={isBulkDeleteOpen}
        onClose={() => !isBulkDeleting && setIsBulkDeleteOpen(false)}
        onConfirm={handleConfirmBulkDelete}
        isLoading={isBulkDeleting}
        shipments={selectedShipmentsList}
        totalCount={selectedShipmentIds.length}
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