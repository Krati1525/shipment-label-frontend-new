/**
 * Shipment API service functions.
 * Establishes typed signatures matching backend endpoints.
 */

import { apiClient } from './api';
import {
  Shipment,
  ShipmentListResponse,
  UploadResponse,
  OCRResponse,
  BatchOcrResponse,
  ExtractionResponse,
  BatchExtractionResponse,
  ResolveResponse,
  ShipResponse,
  NotificationResponse,
  DashboardStats,
  DashboardData,
} from '@/types/shipment';
import { ShipmentFilterParams, ShipmentCorrectionPayload } from '@/types/api';

/**
 * Upload one or multiple label image files
 */
export async function uploadShipments(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('images', file, file.name);
  });
  return apiClient.post<UploadResponse>('/shipments/upload', formData);
}

/**
 * Trigger OCR text recognition for a single shipment
 */
export async function runOcr(shipmentId: string): Promise<OCRResponse> {
  return apiClient.post<OCRResponse>(`/shipments/${shipmentId}/ocr`);
}

/**
 * Trigger batch OCR processing on specified shipment IDs
 */
export async function runBatchOcr(shipmentIds: string[]): Promise<BatchOcrResponse> {
  return apiClient.post<BatchOcrResponse>('/shipments/ocr', { shipmentIds });
}

/**
 * Trigger structured field extraction for a single shipment
 */
export async function extractShipment(shipmentId: string): Promise<ExtractionResponse> {
  return apiClient.post<ExtractionResponse>(`/shipments/${shipmentId}/extract`);
}

/**
 * Trigger batch extraction for specified shipment IDs
 */
export async function extractBatch(shipmentIds: string[]): Promise<BatchExtractionResponse> {
  return apiClient.post<BatchExtractionResponse>('/shipments/extract', { shipmentIds });
}

/**
 * Retrieve paginated and filtered list of shipments
 */
export async function getShipments(
  params?: ShipmentFilterParams,
  signal?: AbortSignal
): Promise<ShipmentListResponse> {
  const cleanParams: Record<string, string | number | boolean> = {};

  if (params) {
    if (params.search && params.search.trim()) {
      cleanParams.search = params.search.trim();
    }
    if (params.status) {
      cleanParams.status = params.status;
    }
    if (params.courier && params.courier.trim()) {
      cleanParams.courier = params.courier.trim();
    }
    if (params.city && params.city.trim()) {
      cleanParams.city = params.city.trim();
    }
    if (params.state && params.state.trim()) {
      cleanParams.state = params.state.trim();
    }
    if (params.fromDate) {
      cleanParams.fromDate = params.fromDate;
    }
    if (params.toDate) {
      cleanParams.toDate = params.toDate;
    }
    if (params.page && params.page > 0) {
      cleanParams.page = params.page;
    }
    if (params.limit && params.limit > 0) {
      cleanParams.limit = params.limit;
    }
    if (params.sortBy) {
      cleanParams.sortBy = params.sortBy;
    }
    if (params.sortOrder) {
      cleanParams.sortOrder = params.sortOrder;
    }
  }

  return apiClient.get<ShipmentListResponse>('/shipments', cleanParams, undefined, signal);
}

/**
 * Retrieve all shipments marked with ISSUE status requiring manual review
 */
export async function getIssues(params?: { page?: number; limit?: number }): Promise<Shipment[]> {
  const res = await apiClient.get<Shipment[] | ShipmentListResponse>('/shipments/issues', params as Record<string, number>);
  if (Array.isArray(res)) {
    return res;
  }
  if (res && Array.isArray((res as ShipmentListResponse).data)) {
    return (res as ShipmentListResponse).data;
  }
  return [];
}

/**
 * Retrieve single shipment by ID
 */
export async function getShipment(id: string): Promise<Shipment> {
  return apiClient.get<Shipment>(`/shipments/${id}`);
}

/**
 * Save manual corrections and resolve a shipment issue
 */
export async function resolveShipment(
  id: string,
  data: ShipmentCorrectionPayload
): Promise<Shipment> {
  const payload: Record<string, string | number | null> = {};

  if (data.name !== undefined && data.name !== null) {
    const trimmed = data.name.trim();
    if (trimmed) payload.name = trimmed;
  }
  if (data.mobileNumber !== undefined && data.mobileNumber !== null) {
    const trimmed = data.mobileNumber.trim();
    if (trimmed) payload.mobileNumber = trimmed;
  }
  if (data.address !== undefined && data.address !== null) {
    const trimmed = data.address.trim();
    if (trimmed) payload.address = trimmed;
  }
  if (data.city !== undefined && data.city !== null) {
    const trimmed = data.city.trim();
    if (trimmed) payload.city = trimmed;
  }
  if (data.state !== undefined && data.state !== null) {
    const trimmed = data.state.trim();
    if (trimmed) payload.state = trimmed;
  }
  if (data.pincode !== undefined && data.pincode !== null) {
    const trimmed = data.pincode.trim();
    if (trimmed) payload.pincode = trimmed;
  }
  if (data.awbNumber !== undefined && data.awbNumber !== null) {
    const trimmed = data.awbNumber.trim();
    if (trimmed) payload.awbNumber = trimmed;
  }
  if (data.courierPartnerName !== undefined && data.courierPartnerName !== null) {
    const trimmed = data.courierPartnerName.trim();
    if (trimmed) payload.courierPartnerName = trimmed;
  }
  if (data.weight !== undefined) {
    if (typeof data.weight === 'string') {
      const trimmed = data.weight.trim();
      if (trimmed === '') {
        payload.weight = null;
      } else {
        const parsed = parseFloat(trimmed);
        payload.weight = isNaN(parsed) ? null : parsed;
      }
    } else {
      payload.weight = data.weight;
    }
  }
  if (data.amount !== undefined) {
    if (typeof data.amount === 'string') {
      const trimmed = data.amount.trim();
      if (trimmed === '') {
        payload.amount = null;
      } else {
        const parsed = parseFloat(trimmed);
        payload.amount = isNaN(parsed) ? null : parsed;
      }
    } else {
      payload.amount = data.amount;
    }
  }

  return apiClient.patch<Shipment>(`/shipments/${id}/resolve`, payload);
}

/**
 * Get notification link (WhatsApp & SMS) for a shipment
 */
export async function getNotification(id: string): Promise<NotificationResponse> {
  return apiClient.get<NotificationResponse>(`/shipments/${id}/notification`);
}

/**
 * Explicitly mark a READY shipment as SHIPPED
 */
export async function markShipmentShipped(id: string): Promise<ShipResponse> {
  return apiClient.patch<ShipResponse>(`/shipments/${id}/ship`);
}

/**
 * Get backend Excel export download URL with filters applied
 */
export function getExportUrl(params?: ShipmentFilterParams): string {
  const baseUrl = apiClient.getBaseUrl();
  const searchParams = new URLSearchParams();

  if (params) {
    if (params.search && params.search.trim()) {
      searchParams.append('search', params.search.trim());
    }
    if (params.status) {
      searchParams.append('status', params.status);
    }
    if (params.courier && params.courier.trim()) {
      searchParams.append('courier', params.courier.trim());
    }
    if (params.city && params.city.trim()) {
      searchParams.append('city', params.city.trim());
    }
    if (params.state && params.state.trim()) {
      searchParams.append('state', params.state.trim());
    }
    if (params.fromDate) {
      searchParams.append('fromDate', params.fromDate);
    }
    if (params.toDate) {
      searchParams.append('toDate', params.toDate);
    }
  }

  const query = searchParams.toString();
  return `${baseUrl}/shipments/export${query ? `?${query}` : ''}`;
}

/**
 * Download backend Excel export file matching current filters as a Blob
 */
export async function exportShipments(params?: ShipmentFilterParams): Promise<Blob> {
  const url = getExportUrl(params);
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  });

  if (!res.ok) {
    throw new Error('Unable to export shipments. Please try again.');
  }

  return res.blob();
}

/**
 * Trigger native browser file download of a Blob
 */
export function downloadBlob(blob: Blob, filename = 'shipment-export.xlsx'): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Retrieve real dashboard statistics and recent shipments from backend.
 * Queries status-specific endpoints in parallel relying on backend pagination metadata (pagination.total).
 * Combines counts and returns recent records sorted descending by creation time.
 */
export async function getDashboardData(signal?: AbortSignal): Promise<DashboardData> {
  const [procRes, issueRes, readyRes, shippedRes] = await Promise.all([
    getShipments(
      { status: 'PROCESSING', page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
      signal
    ),
    getShipments(
      { status: 'ISSUE', page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
      signal
    ),
    getShipments(
      { status: 'READY', page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
      signal
    ),
    getShipments(
      { status: 'SHIPPED', page: 1, limit: 5, sortBy: 'createdAt', sortOrder: 'desc' },
      signal
    ),
  ]);

  const processing = procRes.pagination?.total ?? 0;
  const issue = issueRes.pagination?.total ?? 0;
  const ready = readyRes.pagination?.total ?? 0;
  const shipped = shippedRes.pagination?.total ?? 0;
  const total = processing + issue + ready + shipped;

  const allRecent = [
    ...(procRes.data || []),
    ...(issueRes.data || []),
    ...(readyRes.data || []),
    ...(shippedRes.data || []),
  ];

  // Sort descending by date/createdAt to display true recent records across all statuses
  allRecent.sort((a, b) => {
    const timeA = new Date(a.createdAt || a.date).getTime();
    const timeB = new Date(b.createdAt || b.date).getTime();
    return timeB - timeA;
  });

  return {
    stats: {
      total,
      processing,
      issue,
      ready,
      shipped,
    },
    recentShipments: allRecent.slice(0, 5),
  };
}


/**
 * Delete a specific shipment by ID
 */
export async function deleteShipment(id: string): Promise<{ success: boolean; message: string; id: string }> {
  return apiClient.delete<{ success: boolean; message: string; id: string }>(`/shipments/${id}`);
}

/**
 * Batch delete shipments by IDs
 */
export async function deleteBatchShipments(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; deletedIds: string[] }> {
  return apiClient.delete<{ success: boolean; message: string; count: number; deletedIds: string[] }>(
    '/shipments/batch',
    { shipmentIds }
  );
}

/**
 * Pause a processing shipment
 */
export async function pauseShipment(id: string): Promise<{ success: boolean; message: string; shipment: Shipment }> {
  return apiClient.post<{ success: boolean; message: string; shipment: Shipment }>(`/shipments/${id}/pause`);
}

/**
 * Resume a paused shipment
 */
export async function resumeShipment(id: string): Promise<{ success: boolean; message: string; shipment: Shipment }> {
  return apiClient.post<{ success: boolean; message: string; shipment: Shipment }>(`/shipments/${id}/resume`);
}

/**
 * Batch pause shipments
 */
export async function pauseBatch(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; pausedIds: string[] }> {
  return apiClient.post<{ success: boolean; message: string; count: number; pausedIds: string[] }>('/shipments/pause', { shipmentIds });
}

/**
 * Batch resume shipments
 */
export async function resumeBatch(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; resumedIds: string[] }> {
  return apiClient.post<{ success: boolean; message: string; count: number; resumedIds: string[] }>('/shipments/resume', { shipmentIds });
}

/**
 * Update any shipment field directly (Edit functionality)
 */
export async function updateShipment(
  id: string,
  data: Partial<Shipment>
): Promise<Shipment> {
  return apiClient.patch<Shipment>(`/shipments/${id}`, data);
}

/**
 * Manual OCR re-scan and entity extraction for a specific shipment
 */
export async function reScanShipment(
  id: string,
  rotation?: number
): Promise<Shipment> {
  return apiClient.post<Shipment>(`/shipments/${id}/re-ocr`, { rotation });
}

/**
 * Direct SMS dispatch with configurable Sender Number
 */
export async function sendSms(payload: {
  shipmentId?: string;
  fromNumber: string;
  toNumber: string;
  message: string;
}): Promise<{
  success: boolean;
  message: string;
  dispatchTime: string;
  fromNumber: string;
  toNumber: string;
  messageContent: string;
}> {
  return apiClient.post('/shipments/sms', payload);
}

/**
 * Bulk SMS dispatch to multiple selected shipments
 */
export async function sendBulkSms(payload: {
  shipmentIds: string[];
  fromNumber: string;
  customMessage?: string;
}): Promise<{
  success: boolean;
  totalCount: number;
  sentCount: number;
  results: any[];
}> {
  return apiClient.post('/shipments/bulk-sms', payload);
}

/**
 * Bulk WhatsApp dispatch preparation
 */
export async function prepareBulkWhatsApp(payload: {
  shipmentIds: string[];
  customMessage?: string;
}): Promise<{
  success: boolean;
  totalCount: number;
  validPhoneCount: number;
  items: Array<{
    shipmentId: string;
    recipientName: string;
    mobileNumber: string;
    cleanMobile: string | null;
    message: string;
    whatsappUrl: string | null;
    hasValidPhone: boolean;
  }>;
}> {
  return apiClient.post('/shipments/bulk-whatsapp', payload);
}
