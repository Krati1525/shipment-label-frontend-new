import { shipmentRepository, IShipmentRepository } from '../repositories/shipment.repository';
import {
  Shipment,
  ShipmentListResponse,
  DashboardData,
  ShipmentEvent,
  ShipmentEventType,
  UploadResponse,
  ExtractionResponse,
  BatchExtractionResponse,
  BatchExtractionResultItem,
} from '@/types/shipment';
import { ShipmentFilterParams, ShipmentCorrectionPayload } from '@/types/api';
import { ShipmentCorrectionPayloadSchema } from '../validation/schemas';
import { generateUUID } from '../utils';
import {
  extractFieldsFromRawOcr,
  validateExtractedFields,
  ExtractedFields,
  ExtractedShipmentData,
  isGeminiVisionConfigured,
  extractWithGeminiVision,
} from '../extraction';

export class ShipmentService {
  constructor(private repo: IShipmentRepository = shipmentRepository) {}

  async createShipmentsFromFiles(files: File[]): Promise<UploadResponse> {
    if (!files || files.length === 0) {
      return {
        success: true,
        message: 'No files provided for upload.',
        count: 0,
        data: [],
        shipments: [],
      };
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const isoTimestamp = now.toISOString();

    const items = files.map((file) => {
      const id = generateUUID();
      const shipment: Shipment = {
        id,
        date: dateStr,
        name: null,
        mobileNumber: null,
        address: null,
        city: null,
        state: null,
        pincode: null,
        awbNumber: null,
        courierPartnerName: null,
        weight: null,
        amount: null,
        imageUrl: '',
        originalFileName: file.name,
        rawOcrText: null,
        status: 'PROCESSING',
        hasIssues: false,
        issues: null,
        confidence: null,
        duplicateWarning: null,
        createdAt: isoTimestamp,
        updatedAt: isoTimestamp,
      };

      return {
        shipment,
        imageBlob: file as Blob,
      };
    });

    const created = await this.repo.createBatch(items);

    return {
      success: true,
      message: `Successfully stored ${created.length} ${created.length === 1 ? 'label' : 'labels'} locally.`,
      count: created.length,
      data: created,
      shipments: created,
    };
  }

  async getShipments(params?: ShipmentFilterParams): Promise<ShipmentListResponse> {
    return this.repo.findShipments(params);
  }

  async getShipment(id: string): Promise<Shipment> {
    const shipment = await this.repo.findById(id);
    if (!shipment) {
      throw new Error(`Shipment #${id} not found.`);
    }
    return shipment;
  }

  async getIssues(params?: { page?: number; limit?: number }): Promise<Shipment[]> {
    return this.repo.findIssues(params);
  }

  async getDashboardData(): Promise<DashboardData> {
    const stats = await this.repo.getDashboardStats();
    const recent = await this.repo.findShipments({
      page: 1,
      limit: 5,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    return {
      stats,
      recentShipments: recent.data,
    };
  }

  async resolveShipment(
    id: string,
    payload: ShipmentCorrectionPayload
  ): Promise<Shipment> {
    // 1. Validate payload using Zod schema
    const validated = ShipmentCorrectionPayloadSchema.parse(payload);

    // 2. Fetch existing shipment
    const existing = await this.getShipment(id);

    // 3. Merge corrections with existing values
    const mergedFields: ExtractedFields = {
      name: (validated.name !== undefined ? (validated.name?.trim() || null) : existing.name),
      mobileNumber: (validated.mobileNumber !== undefined ? (validated.mobileNumber?.trim() || null) : existing.mobileNumber),
      address: (validated.address !== undefined ? (validated.address?.trim() || null) : existing.address),
      city: (validated.city !== undefined ? (validated.city?.trim() || null) : existing.city),
      state: (validated.state !== undefined ? (validated.state?.trim() || null) : existing.state),
      pincode: (validated.pincode !== undefined ? (validated.pincode?.trim() || null) : existing.pincode),
      awbNumber: (validated.awbNumber !== undefined ? (validated.awbNumber?.trim() || null) : existing.awbNumber),
      courierPartnerName: (validated.courierPartnerName !== undefined ? (validated.courierPartnerName?.trim() || null) : existing.courierPartnerName),
      weight: validated.weight !== undefined ? (typeof validated.weight === 'string' ? parseFloat(validated.weight) || null : validated.weight) : (typeof existing.weight === 'string' ? parseFloat(existing.weight) || null : existing.weight),
      amount: validated.amount !== undefined ? (typeof validated.amount === 'string' ? parseFloat(validated.amount) || null : validated.amount) : (typeof existing.amount === 'string' ? parseFloat(existing.amount) || null : existing.amount),
    };

    const tracking = (validated.trackingId !== undefined
      ? (validated.trackingId?.trim() || null)
      : validated.awbNumber !== undefined
      ? (validated.awbNumber?.trim() || null)
      : existing.awbNumber) || null;

    // 4. In manual resolution, fields are not strictly mandatory.
    // Information might not be present on the physical label, so manual resolve marks the shipment READY.
    const updatedFields: Partial<Shipment> = {
      name: mergedFields.name,
      mobileNumber: mergedFields.mobileNumber,
      address: mergedFields.address,
      city: mergedFields.city,
      state: mergedFields.state,
      pincode: mergedFields.pincode,
      awbNumber: tracking,
      trackingId: tracking,
      courierPartnerName: mergedFields.courierPartnerName,
      weight: mergedFields.weight,
      amount: mergedFields.amount,
      status: 'READY',
      hasIssues: false,
      issues: null,
    };

    // 5. Check for duplicate AWB
    const courier = updatedFields.courierPartnerName || existing.courierPartnerName;
    const awb = updatedFields.awbNumber || existing.awbNumber;
    if (courier && awb) {
      const duplicate = await this.repo.checkDuplicateAwb(courier, awb, id);
      if (duplicate) {
        updatedFields.duplicateWarning = `Warning: Courier "${courier}" already has an existing shipment with AWB "${awb}".`;
      } else {
        updatedFields.duplicateWarning = null;
      }
    }

    const saved = await this.repo.update(id, updatedFields);

    await this.repo.addEvent({
      shipmentId: id,
      type: 'ISSUE_RESOLVED',
      timestamp: new Date().toISOString(),
      details: 'Manual resolution applied and verified by user. Shipment marked READY.',
    });

    return saved;
  }

  async markShipmentShipped(id: string): Promise<Shipment> {
    const existing = await this.getShipment(id);
    if (existing.status !== 'READY') {
      throw new Error(`Only READY shipments can be marked as SHIPPED. Current status: ${existing.status}`);
    }

    const updated = await this.repo.update(id, {
      status: 'SHIPPED',
    });

    await this.repo.addEvent({
      shipmentId: id,
      type: 'MARKED_SHIPPED',
      timestamp: new Date().toISOString(),
      details: 'Shipment marked as SHIPPED and handed over to carrier.',
    });

    return updated;
  }

  async updateShipment(id: string, data: Partial<Shipment>): Promise<Shipment> {
    const existing = await this.getShipment(id);

    const mergedFields: ExtractedFields = {
      name: data.name !== undefined ? (data.name?.trim() || null) : existing.name,
      mobileNumber: data.mobileNumber !== undefined ? (data.mobileNumber?.trim() || null) : existing.mobileNumber,
      address: data.address !== undefined ? (data.address?.trim() || null) : existing.address,
      city: data.city !== undefined ? (data.city?.trim() || null) : existing.city,
      state: data.state !== undefined ? (data.state?.trim() || null) : existing.state,
      pincode: data.pincode !== undefined ? (data.pincode?.trim() || null) : existing.pincode,
      awbNumber: data.awbNumber !== undefined ? (data.awbNumber?.trim() || null) : existing.awbNumber,
      courierPartnerName: data.courierPartnerName !== undefined ? (data.courierPartnerName?.trim() || null) : existing.courierPartnerName,
      weight: data.weight !== undefined ? (typeof data.weight === 'string' ? parseFloat(data.weight) || null : data.weight) : (typeof existing.weight === 'string' ? parseFloat(existing.weight) || null : existing.weight),
      amount: data.amount !== undefined ? (typeof data.amount === 'string' ? parseFloat(data.amount) || null : data.amount) : (typeof existing.amount === 'string' ? parseFloat(existing.amount) || null : existing.amount),
    };

    let statusUpdate = {};
    if (data.status) {
      statusUpdate = {
        status: data.status,
        hasIssues: data.status === 'ISSUE',
        issues: data.status === 'READY' || data.status === 'SHIPPED' ? null : existing.issues,
      };
    } else if (existing.status !== 'SHIPPED') {
      statusUpdate = {
        status: existing.status,
        hasIssues: existing.hasIssues,
      };
    }

    const trackingVal = (data.trackingId !== undefined
      ? (data.trackingId?.trim() || null)
      : data.awbNumber !== undefined
      ? (data.awbNumber?.trim() || null)
      : existing.awbNumber) || null;

    const updated = await this.repo.update(id, {
      ...data,
      awbNumber: trackingVal,
      trackingId: trackingVal,
      ...statusUpdate,
    });

    await this.repo.addEvent({
      shipmentId: id,
      type: 'SHIPMENT_EDITED',
      timestamp: new Date().toISOString(),
      details: 'Shipment details edited directly.',
    });

    return updated;
  }

  async saveRawOcrText(
    id: string,
    rawOcrText: string,
    meta?: { confidence?: number; variant?: string; rotation?: number }
  ): Promise<Shipment> {
    const updated = await this.repo.update(id, {
      rawOcrText,
      status: 'PROCESSING',
    });

    const confMsg = meta?.confidence !== undefined ? ` (Confidence: ${Math.round(meta.confidence)}%)` : '';
    const variantMsg = meta?.variant ? ` [${meta.variant}]` : '';

    await this.repo.addEvent({
      shipmentId: id,
      type: 'OCR_COMPLETED',
      timestamp: new Date().toISOString(),
      details: `OCR recognition completed (${rawOcrText.length} characters)${confMsg}${variantMsg}.`,
    });

    return updated;
  }

  /**
   * Parses rawOcrText into structured logistics entities, validates them,
   * updates status (READY vs ISSUE), checks for duplicates, and persists to IndexedDB.
   */
  async extractShipment(id: string): Promise<ExtractionResponse> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new Error(`Shipment #${id} not found.`);
    }

    // 1. If Gemini Vision is configured, attempt multimodal vision extraction from the image blob
    let extracted: ExtractedShipmentData | null = null;
    if (isGeminiVisionConfigured()) {
      try {
        const blob = await this.repo.getImageBlob(id);
        if (blob) {
          extracted = await extractWithGeminiVision(blob);
        }
      } catch (geminiErr) {
        console.warn('Gemini vision extraction error, using local extractor:', geminiErr);
      }
    }

    // 2. Fall back to local deterministic extractor
    if (!extracted) {
      extracted = extractFieldsFromRawOcr(existing.rawOcrText);
    }

    // 2. Validate extracted fields against Indian logistics requirements
    const validation = validateExtractedFields(extracted, existing.status);

    // 3. Duplicate AWB detection
    let duplicateWarning: string | null = null;
    if (extracted.courierPartnerName && extracted.awbNumber) {
      const duplicate = await this.repo.checkDuplicateAwb(
        extracted.courierPartnerName,
        extracted.awbNumber,
        id
      );
      if (duplicate) {
        duplicateWarning = `Duplicate AWB ${extracted.awbNumber} already exists on shipment #${duplicate.id.slice(0, 8)}.`;
        validation.issues.push({
          field: 'awbNumber',
          message: duplicateWarning,
          severity: 'warning',
        });
      }
    }

    // 4. Update shipment in IndexedDB
    const trackingId = extracted.trackingId || extracted.awbNumber || null;
    const updated = await this.repo.update(id, {
      name: extracted.name,
      mobileNumber: extracted.mobileNumber,
      address: extracted.address,
      city: extracted.city,
      state: extracted.state,
      pincode: extracted.pincode,
      awbNumber: trackingId,
      trackingId: trackingId,
      courierPartnerName: extracted.courierPartnerName,
      weight: extracted.weight !== null ? extracted.weight : existing.weight,
      amount: extracted.amount !== null ? extracted.amount : existing.amount,
      status: validation.status,
      hasIssues: !validation.isValid,
      issues: validation.issues.length > 0 ? validation.issues : null,
      duplicateWarning,
    });

    // 5. Audit Event Logging
    await this.repo.addEvent({
      shipmentId: id,
      type: 'EXTRACTION_COMPLETED',
      timestamp: new Date().toISOString(),
      details: `Entities extracted. Status: ${validation.status}. Recipient: ${extracted.name || 'Not detected'}, AWB: ${extracted.awbNumber || 'Not detected'}.`,
    });

    if (!validation.isValid) {
      const issueSummary = validation.issues.map((i) => `${i.field}: ${i.message}`).join(' | ');
      await this.repo.addEvent({
        shipmentId: id,
        type: 'ISSUE_CREATED',
        timestamp: new Date().toISOString(),
        details: `Validation issues detected: ${issueSummary}`,
      });
    }

    return {
      shipmentId: id,
      shipment: updated,
      status: validation.status,
      hasIssues: !validation.isValid,
      issues: validation.issues,
      extractedFields: {
        name: extracted.name,
        mobileNumber: extracted.mobileNumber,
        address: extracted.address,
        city: extracted.city,
        state: extracted.state,
        pincode: extracted.pincode,
        awbNumber: extracted.awbNumber,
        courierPartnerName: extracted.courierPartnerName,
        weight: extracted.weight,
        amount: extracted.amount,
      },
    };
  }

  /**
   * Batch extracts logistics entities sequentially for specified shipment IDs.
   */
  async extractBatchShipments(ids: string[]): Promise<BatchExtractionResponse> {
    const results: BatchExtractionResultItem[] = [];

    for (const id of ids) {
      try {
        const res = await this.extractShipment(id);
        results.push({
          shipmentId: id,
          success: true,
          status: res.status,
          hasIssues: res.hasIssues,
          issues: res.issues,
          extractedFields: res.extractedFields,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Entity extraction failed.';
        results.push({
          shipmentId: id,
          success: false,
          error: errorMsg,
        });
      }
    }

    return { results };
  }

  async deleteShipment(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async deleteBatchShipments(ids: string[]): Promise<number> {
    return this.repo.deleteBatch(ids);
  }

  async checkDuplicateAwb(courier: string, awb: string, excludeId?: string): Promise<Shipment | null> {
    return this.repo.checkDuplicateAwb(courier, awb, excludeId);
  }

  async addEvent(
    shipmentId: string,
    type: ShipmentEventType,
    details?: string
  ): Promise<ShipmentEvent> {
    return this.repo.addEvent({
      shipmentId,
      type,
      timestamp: new Date().toISOString(),
      details,
    });
  }

  async getEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    return this.repo.getEvents(shipmentId);
  }

  async getStorageEstimate() {
    return this.repo.getStorageEstimate();
  }

  async clearAllData(): Promise<void> {
    await this.repo.clearAllData();
  }
}

export const shipmentService = new ShipmentService();
