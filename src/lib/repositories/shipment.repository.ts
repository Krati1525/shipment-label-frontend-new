import { getDb, StoredImage } from '../db';
import {
  Shipment,
  ShipmentListResponse,
  DashboardStats,
  ShipmentEvent,
} from '@/types/shipment';
import { ShipmentFilterParams } from '@/types/api';
import { generateUUID } from '../utils';

export interface IShipmentRepository {
  findById(id: string): Promise<Shipment | null>;
  findShipments(params?: ShipmentFilterParams): Promise<ShipmentListResponse>;
  findIssues(params?: { page?: number; limit?: number }): Promise<Shipment[]>;
  create(shipment: Shipment, imageBlob?: Blob): Promise<Shipment>;
  createBatch(items: Array<{ shipment: Shipment; imageBlob: Blob }>): Promise<Shipment[]>;
  update(id: string, data: Partial<Shipment>): Promise<Shipment>;
  delete(id: string): Promise<void>;
  deleteBatch(ids: string[]): Promise<number>;
  getImageBlob(shipmentId: string): Promise<Blob | null>;
  getImageObjectUrl(shipmentId: string): Promise<string | null>;
  getDashboardStats(): Promise<DashboardStats>;
  checkDuplicateAwb(courier: string, awb: string, excludeId?: string): Promise<Shipment | null>;
  addEvent(event: Omit<ShipmentEvent, 'id'>): Promise<ShipmentEvent>;
  getEvents(shipmentId: string): Promise<ShipmentEvent[]>;
  getAllForExport(params?: ShipmentFilterParams): Promise<Shipment[]>;
  getAllForBackup(): Promise<{
    shipments: Shipment[];
    images: Array<{
      shipmentId: string;
      blob: Blob;
      fileName: string;
      mimeType: string;
    }>;
    events: ShipmentEvent[];
  }>;
  restoreFromBackup(
    shipments: Shipment[],
    images: Array<{
      shipmentId: string;
      blob: Blob;
      fileName: string;
      mimeType: string;
    }>,
    events: ShipmentEvent[],
    mode: 'replace' | 'merge'
  ): Promise<{ restoredShipments: number; restoredImages: number }>;
  clearAllData(): Promise<void>;
  getStorageEstimate(): Promise<{
    usageBytes: number;
    quotaBytes: number;
    shipmentCount: number;
    imageCount: number;
    lastBackupAt: string | null;
  }>;
}

export class DexieShipmentRepository implements IShipmentRepository {
  private objectUrlCache = new Map<string, string>();

  /**
   * Helper to retrieve or generate an Object URL for a given shipment image Blob
   */
  async getImageObjectUrl(shipmentId: string): Promise<string | null> {
    if (typeof window === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      return null;
    }

    const cached = this.objectUrlCache.get(shipmentId);
    if (cached) return cached;

    const blob = await this.getImageBlob(shipmentId);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    this.objectUrlCache.set(shipmentId, url);
    return url;
  }

  async findById(id: string): Promise<Shipment | null> {
    const db = getDb();
    const shipment = await db.shipments.get(id);
    if (!shipment) return null;

    // Attach active object URL if available
    const url = await this.getImageObjectUrl(id);
    if (url) shipment.imageUrl = url;
    return shipment;
  }

  async findShipments(params?: ShipmentFilterParams): Promise<ShipmentListResponse> {
    const db = getDb();
    let collection = db.shipments.toCollection();

    let allShipments = await collection.toArray();

    // 1. Text Search across relevant fields
    if (params?.search && params.search.trim()) {
      const query = params.search.trim().toLowerCase();
      allShipments = allShipments.filter((s) => {
        return (
          (s.name && s.name.toLowerCase().includes(query)) ||
          (s.awbNumber && s.awbNumber.toLowerCase().includes(query)) ||
          (s.mobileNumber && s.mobileNumber.toLowerCase().includes(query)) ||
          (s.courierPartnerName && s.courierPartnerName.toLowerCase().includes(query)) ||
          (s.city && s.city.toLowerCase().includes(query)) ||
          (s.state && s.state.toLowerCase().includes(query)) ||
          (s.address && s.address.toLowerCase().includes(query)) ||
          (s.pincode && s.pincode.toLowerCase().includes(query)) ||
          (s.originalFileName && s.originalFileName.toLowerCase().includes(query)) ||
          (s.rawOcrText && s.rawOcrText.toLowerCase().includes(query))
        );
      });
    }

    // 2. Status Filter
    if (params?.status && params.status !== 'ALL') {
      allShipments = allShipments.filter((s) => s.status === params.status);
    }

    // 3. Courier Filter
    if (params?.courier && params.courier.trim()) {
      const courierQuery = params.courier.trim().toLowerCase();
      allShipments = allShipments.filter(
        (s) => s.courierPartnerName && s.courierPartnerName.toLowerCase().includes(courierQuery)
      );
    }

    // 4. City Filter
    if (params?.city && params.city.trim()) {
      const cityQuery = params.city.trim().toLowerCase();
      allShipments = allShipments.filter(
        (s) => s.city && s.city.toLowerCase().includes(cityQuery)
      );
    }

    // 5. State Filter
    if (params?.state && params.state.trim()) {
      const stateQuery = params.state.trim().toLowerCase();
      allShipments = allShipments.filter(
        (s) => s.state && s.state.toLowerCase().includes(stateQuery)
      );
    }

    // 6. Date Range Filter
    if (params?.fromDate) {
      const from = new Date(params.fromDate).getTime();
      allShipments = allShipments.filter((s) => {
        const sDate = new Date(s.date || s.createdAt).getTime();
        return !isNaN(sDate) && sDate >= from;
      });
    }

    if (params?.toDate) {
      const to = new Date(params.toDate).getTime();
      allShipments = allShipments.filter((s) => {
        const sDate = new Date(s.date || s.createdAt).getTime();
        return !isNaN(sDate) && sDate <= to;
      });
    }

    // 7. Sorting
    const sortBy = params?.sortBy || 'date';
    const sortOrder = params?.sortOrder || 'desc';
    const direction = sortOrder === 'asc' ? 1 : -1;

    allShipments.sort((a, b) => {
      let valA = (a as unknown as Record<string, unknown>)[sortBy];
      let valB = (b as unknown as Record<string, unknown>)[sortBy];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'string' && typeof valB === 'string') {
        const timeA = Date.parse(valA);
        const timeB = Date.parse(valB);
        if (!isNaN(timeA) && !isNaN(timeB)) {
          return (timeA - timeB) * direction;
        }
        return valA.localeCompare(valB) * direction;
      }

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * direction;
      }

      return String(valA).localeCompare(String(valB)) * direction;
    });

    const total = allShipments.length;
    const page = params?.page && params.page > 0 ? params.page : 1;
    const limit = params?.limit && params.limit > 0 ? params.limit : 10;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;

    const paged = allShipments.slice(offset, offset + limit);

    // Hydrate image URLs if missing
    for (const s of paged) {
      const liveUrl = await this.getImageObjectUrl(s.id);
      if (liveUrl) s.imageUrl = liveUrl;
    }

    return {
      data: paged,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findIssues(params?: { page?: number; limit?: number }): Promise<Shipment[]> {
    const db = getDb();
    let issues = await db.shipments
      .filter((s) => s.status === 'ISSUE' || s.hasIssues === true)
      .reverse()
      .sortBy('createdAt');

    if (params?.limit && params.limit > 0) {
      const page = params.page && params.page > 0 ? params.page : 1;
      const offset = (page - 1) * params.limit;
      issues = issues.slice(offset, offset + params.limit);
    }

    for (const s of issues) {
      const liveUrl = await this.getImageObjectUrl(s.id);
      if (liveUrl) s.imageUrl = liveUrl;
    }

    return issues;
  }

  async create(shipment: Shipment, imageBlob?: Blob): Promise<Shipment> {
    const db = getDb();
    await db.transaction('rw', db.shipments, db.images, db.events, async () => {
      if (imageBlob) {
        const storedImage: StoredImage = {
          shipmentId: shipment.id,
          fileName: shipment.originalFileName,
          mimeType: imageBlob.type || 'image/png',
          blob: imageBlob,
          sizeBytes: imageBlob.size,
          createdAt: shipment.createdAt,
        };
        await db.images.put(storedImage);

        const objectUrl = URL.createObjectURL(imageBlob);
        this.objectUrlCache.set(shipment.id, objectUrl);
        shipment.imageUrl = objectUrl;
      }

      await db.shipments.put(shipment);

      await db.events.put({
        id: generateUUID(),
        shipmentId: shipment.id,
        type: 'IMAGE_UPLOADED',
        timestamp: new Date().toISOString(),
        details: `Uploaded ${shipment.originalFileName}`,
      });
    });

    return shipment;
  }

  async createBatch(items: Array<{ shipment: Shipment; imageBlob: Blob }>): Promise<Shipment[]> {
    const db = getDb();
    const created: Shipment[] = [];

    await db.transaction('rw', db.shipments, db.images, db.events, async () => {
      for (const item of items) {
        const storedImage: StoredImage = {
          shipmentId: item.shipment.id,
          fileName: item.shipment.originalFileName,
          mimeType: item.imageBlob.type || 'image/png',
          blob: item.imageBlob,
          sizeBytes: item.imageBlob.size,
          createdAt: item.shipment.createdAt,
        };
        await db.images.put(storedImage);

        const objectUrl = URL.createObjectURL(item.imageBlob);
        this.objectUrlCache.set(item.shipment.id, objectUrl);
        item.shipment.imageUrl = objectUrl;

        await db.shipments.put(item.shipment);

        await db.events.put({
          id: generateUUID(),
          shipmentId: item.shipment.id,
          type: 'IMAGE_UPLOADED',
          timestamp: new Date().toISOString(),
          details: `Uploaded ${item.shipment.originalFileName}`,
        });

        created.push(item.shipment);
      }
    });

    return created;
  }

  async update(id: string, data: Partial<Shipment>): Promise<Shipment> {
    const db = getDb();
    const existing = await db.shipments.get(id);
    if (!existing) {
      throw new Error(`Shipment #${id} not found.`);
    }

    const liveUrl = await this.getImageObjectUrl(id);

    const updated: Shipment = {
      ...existing,
      ...data,
      imageUrl: data.imageUrl || liveUrl || existing.imageUrl || '',
      updatedAt: new Date().toISOString(),
    };

    await db.shipments.put(updated);

    if (liveUrl) {
      updated.imageUrl = liveUrl;
    }
    return updated;
  }

  async delete(id: string): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.shipments, db.images, db.events, async () => {
      await db.shipments.delete(id);
      await db.images.delete(id);
      await db.events.where('shipmentId').equals(id).delete();
    });

    const cachedUrl = this.objectUrlCache.get(id);
    if (cachedUrl) {
      URL.revokeObjectURL(cachedUrl);
      this.objectUrlCache.delete(id);
    }
  }

  async deleteBatch(ids: string[]): Promise<number> {
    const db = getDb();
    await db.transaction('rw', db.shipments, db.images, db.events, async () => {
      await db.shipments.bulkDelete(ids);
      await db.images.bulkDelete(ids);
      for (const id of ids) {
        await db.events.where('shipmentId').equals(id).delete();
      }
    });

    for (const id of ids) {
      const cachedUrl = this.objectUrlCache.get(id);
      if (cachedUrl) {
        URL.revokeObjectURL(cachedUrl);
        this.objectUrlCache.delete(id);
      }
    }

    return ids.length;
  }

  async getImageBlob(shipmentId: string): Promise<Blob | null> {
    const db = getDb();
    const stored = await db.images.get(shipmentId);
    return stored ? stored.blob : null;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const db = getDb();
    const all = await db.shipments.toArray();

    let processing = 0;
    let issue = 0;
    let ready = 0;
    let shipped = 0;

    for (const s of all) {
      if (s.status === 'PROCESSING') {
        processing++;
      } else if (s.status === 'ISSUE') {
        issue++;
      } else if (s.status === 'READY') {
        ready++;
      } else if (s.status === 'SHIPPED') {
        shipped++;
      }
    }

    return {
      total: all.length,
      processing,
      issue,
      ready,
      shipped,
    };
  }

  async checkDuplicateAwb(
    courier: string,
    awb: string,
    excludeId?: string
  ): Promise<Shipment | null> {
    const cleanCourier = courier.trim().toLowerCase();
    const cleanAwb = awb.trim().toLowerCase();
    if (!cleanCourier || !cleanAwb) return null;

    const db = getDb();
    const matches = await db.shipments
      .filter((s) => {
        if (excludeId && s.id === excludeId) return false;
        return (
          Boolean(s.courierPartnerName) &&
          Boolean(s.awbNumber) &&
          s.courierPartnerName!.trim().toLowerCase() === cleanCourier &&
          s.awbNumber!.trim().toLowerCase() === cleanAwb
        );
      })
      .toArray();

    return matches.length > 0 ? matches[0] : null;
  }

  async addEvent(event: Omit<ShipmentEvent, 'id'>): Promise<ShipmentEvent> {
    const db = getDb();
    const fullEvent: ShipmentEvent = {
      ...event,
      id: generateUUID(),
    };
    await db.events.put(fullEvent);
    return fullEvent;
  }

  async getEvents(shipmentId: string): Promise<ShipmentEvent[]> {
    const db = getDb();
    return db.events
      .where('shipmentId')
      .equals(shipmentId)
      .sortBy('timestamp');
  }

  async getAllForExport(params?: ShipmentFilterParams): Promise<Shipment[]> {
    const res = await this.findShipments({
      ...params,
      page: 1,
      limit: 100000,
    });
    return res.data;
  }

  async getAllForBackup(): Promise<{
    shipments: Shipment[];
    images: Array<{
      shipmentId: string;
      blob: Blob;
      fileName: string;
      mimeType: string;
    }>;
    events: ShipmentEvent[];
  }> {
    const db = getDb();
    const shipments = await db.shipments.toArray();
    const images = await db.images.toArray();
    const events = await db.events.toArray();

    return {
      shipments,
      images: images.map((img) => ({
        shipmentId: img.shipmentId,
        blob: img.blob,
        fileName: img.fileName,
        mimeType: img.mimeType,
      })),
      events,
    };
  }

  async restoreFromBackup(
    shipments: Shipment[],
    images: Array<{
      shipmentId: string;
      blob: Blob;
      fileName: string;
      mimeType: string;
    }>,
    events: ShipmentEvent[],
    mode: 'replace' | 'merge'
  ): Promise<{ restoredShipments: number; restoredImages: number }> {
    const db = getDb();

    await db.transaction('rw', db.shipments, db.images, db.events, db.metadata, async () => {
      if (mode === 'replace') {
        await db.shipments.clear();
        await db.images.clear();
        await db.events.clear();
      }

      await db.shipments.bulkPut(shipments);

      const storedImages: StoredImage[] = images.map((img) => ({
        shipmentId: img.shipmentId,
        fileName: img.fileName,
        mimeType: img.mimeType,
        blob: img.blob,
        sizeBytes: img.blob.size,
        createdAt: new Date().toISOString(),
      }));
      await db.images.bulkPut(storedImages);

      if (events && events.length > 0) {
        await db.events.bulkPut(events);
      }

      await db.metadata.put({
        key: 'lastBackupAt',
        value: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    return {
      restoredShipments: shipments.length,
      restoredImages: images.length,
    };
  }

  async clearAllData(): Promise<void> {
    const db = getDb();
    await db.transaction('rw', db.shipments, db.images, db.events, db.metadata, async () => {
      await db.shipments.clear();
      await db.images.clear();
      await db.events.clear();
      await db.metadata.clear();
    });

    for (const url of this.objectUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrlCache.clear();
  }

  async getStorageEstimate(): Promise<{
    usageBytes: number;
    quotaBytes: number;
    shipmentCount: number;
    imageCount: number;
    lastBackupAt: string | null;
  }> {
    const db = getDb();
    const [shipmentCount, imageCount, meta] = await Promise.all([
      db.shipments.count(),
      db.images.count(),
      db.metadata.get('lastBackupAt'),
    ]);

    let usageBytes = 0;
    let quotaBytes = 0;

    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        usageBytes = est.usage || 0;
        quotaBytes = est.quota || 0;
      } catch {
        // Fallback if permission or API fails
      }
    }

    return {
      usageBytes,
      quotaBytes,
      shipmentCount,
      imageCount,
      lastBackupAt: meta ? (meta.value as string) : null,
    };
  }
}

export const shipmentRepository: IShipmentRepository = new DexieShipmentRepository();
