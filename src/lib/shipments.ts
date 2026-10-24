/**
 * Local-First Shipment Service Module.
 * Replaces legacy backend HTTP endpoints with in-browser IndexedDB repository calls.
 */

import ExcelJS from 'exceljs';
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
  DashboardData,
} from '@/types/shipment';
import { ShipmentFilterParams, ShipmentCorrectionPayload } from '@/types/api';
import { shipmentService } from './services/shipment.service';
export { shipmentService };
import { runLocalOcr, runLocalBatchOcr, OcrProgressInfo } from './ocr/ocr-service';

/**
 * Upload one or multiple label image files into local IndexedDB storage
 */
export async function uploadShipments(files: File[]): Promise<UploadResponse> {
  return shipmentService.createShipmentsFromFiles(files);
}

/**
 * Trigger OCR text recognition for a single shipment locally in browser
 */
export async function runOcr(shipmentId: string): Promise<OCRResponse> {
  return runLocalOcr(shipmentId);
}

/**
 * Trigger batch OCR processing on specified shipment IDs locally in browser
 */
export async function runBatchOcr(
  shipmentIds: string[],
  options?: {
    onItemProgress?: (info: OcrProgressInfo) => void;
    shouldPause?: () => boolean;
  }
): Promise<BatchOcrResponse> {
  return runLocalBatchOcr(shipmentIds, options);
}

/**
 * Trigger structured field extraction for a single shipment locally (Phase 4)
 */
export async function extractShipment(shipmentId: string): Promise<ExtractionResponse> {
  return shipmentService.extractShipment(shipmentId);
}

/**
 * Trigger batch extraction for specified shipment IDs locally (Phase 4)
 */
export async function extractBatch(shipmentIds: string[]): Promise<BatchExtractionResponse> {
  return shipmentService.extractBatchShipments(shipmentIds);
}

/**
 * Retrieve paginated and filtered list of shipments from local IndexedDB
 */
export async function getShipments(
  params?: ShipmentFilterParams,
  _signal?: AbortSignal
): Promise<ShipmentListResponse> {
  return shipmentService.getShipments(params);
}

/**
 * Retrieve all shipments marked with ISSUE status requiring manual review
 */
export async function getIssues(params?: { page?: number; limit?: number }): Promise<Shipment[]> {
  return shipmentService.getIssues(params);
}

/**
 * Retrieve single shipment by ID from local IndexedDB storage
 */
export async function getShipment(id: string): Promise<Shipment> {
  return shipmentService.getShipment(id);
}

/**
 * Save manual corrections and resolve a shipment issue locally
 */
export async function resolveShipment(
  id: string,
  data: ShipmentCorrectionPayload
): Promise<ResolveResponse> {
  const updated = await shipmentService.resolveShipment(id, data);
  return {
    ...updated,
    success: true,
    message: 'Shipment resolved successfully',
    shipment: updated,
  };
}

/**
 * Formats Indian and international mobile numbers for WhatsApp Web / App URLs.
 * Ensures Indian 10-digit mobile numbers are prefixed with international code '91'.
 */
export function formatWhatsAppPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits.length >= 10 ? digits : null;
}

export interface CourierTrackingInfo {
  name: string;
  trackingUrl: string;
  instructions: string;
}

export function getCourierTrackingInfo(courier?: string | null, awb?: string | null): CourierTrackingInfo {
  const norm = (courier || '').toLowerCase();
  const trackingNumber = (awb || '').trim();

  if (norm.includes('tirupati')) {
    return {
      name: 'Shree Tirupati Courier',
      trackingUrl: 'https://www.shreetirupaticourier.net/',
      instructions: trackingNumber ? `Enter Tracking/Docket ID "${trackingNumber}" on the website to view live status.` : 'Visit website to track.',
    };
  }
  if (norm.includes('trackon')) {
    return {
      name: 'Trackon Couriers',
      trackingUrl: 'https://trackon.co.in/',
      instructions: trackingNumber ? `Enter AWB "${trackingNumber}" to view delivery progress.` : 'Visit website to track.',
    };
  }
  if (norm.includes('mark express') || norm.includes('markexpress')) {
    return {
      name: 'Mark Express',
      trackingUrl: 'http://www.markexpress.co.in/',
      instructions: trackingNumber ? `Enter Tracking ID "${trackingNumber}" to trace your package.` : 'Visit website to track.',
    };
  }
  if (norm.includes('india post') || norm.includes('speed post')) {
    return {
      name: 'India Post (Speed Post)',
      trackingUrl: 'https://www.indiapost.gov.in/_layouts/15/dptc/trackconsignment.aspx',
      instructions: trackingNumber ? `Enter Consignment No. "${trackingNumber}" to trace.` : 'Visit website to track.',
    };
  }
  if (norm.includes('dtdc')) {
    return {
      name: 'DTDC',
      trackingUrl: 'https://www.dtdc.in/tracking/shipment-tracking.asp',
      instructions: trackingNumber ? `Enter AWB "${trackingNumber}" on the portal.` : 'Visit website to track.',
    };
  }
  if (norm.includes('delhivery')) {
    return {
      name: 'Delhivery',
      trackingUrl: trackingNumber ? `https://www.delhivery.com/track/package/${trackingNumber}` : 'https://www.delhivery.com/',
      instructions: 'Track live package status online.',
    };
  }
  if (norm.includes('blue dart') || norm.includes('bluedart')) {
    return {
      name: 'Blue Dart',
      trackingUrl: 'https://www.bluedart.com/tracking',
      instructions: trackingNumber ? `Enter Waybill "${trackingNumber}".` : 'Visit website to track.',
    };
  }

  return {
    name: courier || 'Courier Service',
    trackingUrl: '',
    instructions: trackingNumber ? `Use Tracking ID "${trackingNumber}" with our delivery partner.` : '',
  };
}

/**
 * Generate notification link (WhatsApp & SMS) with prominent Tracking ID / AWB
 */
export async function getNotification(id: string): Promise<NotificationResponse> {
  const shipment = await shipmentService.getShipment(id);
  const waPhone = formatWhatsAppPhone(shipment.mobileNumber);
  const rawMobile = (shipment.mobileNumber || '').replace(/\D/g, '');
  const recipientName = shipment.name || 'Valued Customer';
  const trackingNumber = shipment.trackingId || shipment.awbNumber || 'Pending / N/A';
  const courierInfo = getCourierTrackingInfo(shipment.courierPartnerName, trackingNumber);
  const destination = [shipment.city, shipment.state].filter(Boolean).join(', ') || 'Your address';

  const trackLinkText = courierInfo.trackingUrl ? `\n🌐 Track Online: ${courierInfo.trackingUrl}` : '';
  const howToTrack = courierInfo.trackingUrl
    ? `\n\n💡 How to track:\nVisit the tracking link above and enter your Tracking ID: ${trackingNumber}`
    : '';

  let message =
    `Namaste ${recipientName}! 🙏\n\n` +
    `Thank you for ordering with Draupadi Fashion! 📦✨\n` +
    `Your parcel is packaged and prepared for dispatch.\n\n` +
    `📋 Order & Tracking Information:\n` +
    `━━━━━━━━━━━━━━━━━━━\n` +
    `🔖 Tracking ID: ${trackingNumber}\n` +
    `🚚 Courier Partner: ${courierInfo.name}\n` +
    `📍 Delivery To: ${destination}` +
    `${trackLinkText}\n` +
    `━━━━━━━━━━━━━━━━━━━` +
    `${howToTrack}\n\n` +
    `For any assistance, please reply directly to this message.\n` +
    `Warm regards,\nDraupadi Fashion, Biaora`;

  if (shipment.status === 'SHIPPED') {
    message =
      `Namaste ${recipientName}! 🙏\n\n` +
      `Great news! Your parcel from Draupadi Fashion has been dispatched and is on its way to you! 🚚💨\n\n` +
      `📋 Live Tracking Information:\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `🔖 Tracking ID: ${trackingNumber}\n` +
      `🚚 Courier Partner: ${courierInfo.name}\n` +
      `📍 Delivery To: ${destination}` +
      `${trackLinkText}\n` +
      `━━━━━━━━━━━━━━━━━━━` +
      `${howToTrack}\n\n` +
      `Thank you for shopping with Draupadi Fashion, Biaora!`;
  }

  const encodedMsg = encodeURIComponent(message);
  // Universal WhatsApp Web/App URL with proper country code
  const whatsappUrl = waPhone
    ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodedMsg}`
    : '';
  // Native device SMS link
  const smsUrl = rawMobile
    ? `sms:${rawMobile}?body=${encodedMsg}`
    : '';

  return {
    shipmentId: shipment.id,
    status: shipment.status,
    mobileNumber: shipment.mobileNumber || '',
    message,
    whatsappUrl,
    smsUrl,
  };
}

/**
 * Explicitly mark a READY shipment as SHIPPED locally in IndexedDB
 */
export async function markShipmentShipped(id: string): Promise<ShipResponse> {
  const updated = await shipmentService.markShipmentShipped(id);
  return {
    ...updated,
    success: true,
    message: 'Shipment marked as shipped',
    shipment: updated,
  };
}

/**
 * Export URL placeholder (not needed in local-first mode)
 */
export function getExportUrl(_params?: ShipmentFilterParams): string {
  return '#';
}

/**
 * Generate Excel XLSX export matching filters using in-browser ExcelJS
 */
export async function exportShipments(params?: ShipmentFilterParams): Promise<Blob> {
  const result = await shipmentService.getShipments({
    ...params,
    page: 1,
    limit: 100000,
  });
  const shipments = result.data;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Shipments');

  worksheet.columns = [
    { header: 'ID', key: 'id', width: 36 },
    { header: 'Date', key: 'date', width: 15 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Recipient Name', key: 'name', width: 20 },
    { header: 'Mobile Number', key: 'mobileNumber', width: 15 },
    { header: 'Address', key: 'address', width: 30 },
    { header: 'City', key: 'city', width: 15 },
    { header: 'State', key: 'state', width: 15 },
    { header: 'Pincode', key: 'pincode', width: 10 },
    { header: 'AWB Number', key: 'awbNumber', width: 20 },
    { header: 'Courier', key: 'courierPartnerName', width: 15 },
    { header: 'Weight (kg)', key: 'weight', width: 12 },
    { header: 'Amount (₹)', key: 'amount', width: 12 },
    { header: 'Original File', key: 'originalFileName', width: 25 },
  ];

  shipments.forEach((s) => {
    worksheet.addRow({
      id: s.id,
      date: s.date || s.createdAt,
      status: s.status,
      name: s.name || '',
      mobileNumber: s.mobileNumber || '',
      address: s.address || '',
      city: s.city || '',
      state: s.state || '',
      pincode: s.pincode || '',
      awbNumber: s.awbNumber || '',
      courierPartnerName: s.courierPartnerName || '',
      weight: s.weight ?? '',
      amount: s.amount ?? '',
      originalFileName: s.originalFileName || '',
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
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
 * Retrieve real dashboard statistics and recent shipments directly from IndexedDB
 */
export async function getDashboardData(_signal?: AbortSignal): Promise<DashboardData> {
  return shipmentService.getDashboardData();
}

/**
 * Delete a specific shipment by ID locally from IndexedDB
 */
export async function deleteShipment(id: string): Promise<{ success: boolean; message: string; id: string }> {
  await shipmentService.deleteShipment(id);
  return { success: true, message: 'Shipment deleted locally', id };
}

/**
 * Batch delete shipments by IDs locally from IndexedDB
 */
export async function deleteBatchShipments(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; deletedIds: string[] }> {
  const count = await shipmentService.deleteBatchShipments(shipmentIds);
  return { success: true, message: 'Shipments deleted locally', count, deletedIds: shipmentIds };
}

/**
 * Pause a processing shipment locally
 */
export async function pauseShipment(id: string): Promise<{ success: boolean; message: string; shipment: Shipment }> {
  const shipment = await shipmentService.getShipment(id);
  return { success: true, message: 'Processing paused', shipment };
}

/**
 * Resume a paused shipment locally
 */
export async function resumeShipment(id: string): Promise<{ success: boolean; message: string; shipment: Shipment }> {
  const shipment = await shipmentService.getShipment(id);
  return { success: true, message: 'Processing resumed', shipment };
}

/**
 * Batch pause shipments locally
 */
export async function pauseBatch(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; pausedIds: string[] }> {
  return { success: true, message: 'Batch paused', count: shipmentIds.length, pausedIds: shipmentIds };
}

/**
 * Batch resume shipments locally
 */
export async function resumeBatch(shipmentIds: string[]): Promise<{ success: boolean; message: string; count: number; resumedIds: string[] }> {
  return { success: true, message: 'Batch resumed', count: shipmentIds.length, resumedIds: shipmentIds };
}

/**
 * Update any shipment field directly (Edit functionality) locally in IndexedDB
 */
export async function updateShipment(
  id: string,
  data: Partial<Shipment>
): Promise<Shipment> {
  return shipmentService.updateShipment(id, data);
}

/**
 * Manual OCR re-scan for a specific shipment using local Tesseract engine
 */
export async function reScanShipment(
  id: string,
  rotation?: number
): Promise<Shipment> {
  await runLocalOcr(id, rotation || 0);
  await shipmentService.extractShipment(id);
  return shipmentService.getShipment(id);
}

/**
 * Direct SMS dispatch simulation with local audit event
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
  if (payload.shipmentId) {
    await shipmentService.addEvent(
      payload.shipmentId,
      'SMS_SENT' as any,
      `SMS notification sent to ${payload.toNumber}`
    );
  }
  return {
    success: true,
    message: 'SMS dispatched successfully via local gateway',
    dispatchTime: new Date().toISOString(),
    fromNumber: payload.fromNumber,
    toNumber: payload.toNumber,
    messageContent: payload.message,
  };
}

/**
 * Bulk SMS dispatch simulation
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
  return {
    success: true,
    totalCount: payload.shipmentIds.length,
    sentCount: payload.shipmentIds.length,
    results: payload.shipmentIds.map((id) => ({
      shipmentId: id,
      success: true,
      message: 'Dispatched',
    })),
  };
}

/**
 * Bulk WhatsApp dispatch preparation locally
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
  const items = await Promise.all(
    payload.shipmentIds.map(async (id) => {
      const s = await shipmentService.getShipment(id);
      const waPhone = formatWhatsAppPhone(s.mobileNumber);
      const trackingNumber = s.trackingId || s.awbNumber || 'N/A';
      const courierInfo = getCourierTrackingInfo(s.courierPartnerName, trackingNumber);
      const city = s.city || '';
      const name = s.name || 'Customer';

      const msg = payload.customMessage
        ? payload.customMessage
            .replace(/\{name\}/gi, name)
            .replace(/\{awb\}/gi, trackingNumber)
            .replace(/\{tracking_id\}/gi, trackingNumber)
            .replace(/\{courier\}/gi, courierInfo.name)
            .replace(/\{city\}/gi, city)
            .replace(/\{tracking_url\}/gi, courierInfo.trackingUrl)
        : `Namaste ${name}! 🙏\n\nYour order from Draupadi Fashion is on its way! 📦✨\n\n🔖 Tracking ID: ${trackingNumber}\n🚚 Courier: ${courierInfo.name}\n📍 Delivery To: ${city}${courierInfo.trackingUrl ? `\n🌐 Track: ${courierInfo.trackingUrl}` : ''}\n\nThank you for shopping with Draupadi Fashion, Biaora!`;

      return {
        shipmentId: id,
        recipientName: name,
        mobileNumber: s.mobileNumber || '',
        cleanMobile: waPhone || null,
        message: msg,
        whatsappUrl: waPhone
          ? `https://api.whatsapp.com/send?phone=${waPhone}&text=${encodeURIComponent(msg)}`
          : null,
        hasValidPhone: !!waPhone,
      };
    })
  );

  return {
    success: true,
    totalCount: items.length,
    validPhoneCount: items.filter((i) => i.hasValidPhone).length,
    items,
  };
}
