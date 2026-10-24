import Dexie, { type Table } from 'dexie';
import { Shipment, ShipmentEvent } from '@/types/shipment';

export interface StoredImage {
  shipmentId: string;
  fileName: string;
  mimeType: string;
  blob: Blob;
  sizeBytes: number;
  createdAt: string;
}

export interface AppMetadata {
  key: string;
  value: unknown;
  updatedAt: string;
}

export type StoredShipment = Shipment;

export class ShipmentFlowDB extends Dexie {
  shipments!: Table<StoredShipment, string>;
  images!: Table<StoredImage, string>;
  events!: Table<ShipmentEvent, string>;
  metadata!: Table<AppMetadata, string>;

  constructor() {
    super('ShipmentFlowDB');
    this.version(1).stores({
      shipments:
        'id, date, status, hasIssues, awbNumber, courierPartnerName, [courierPartnerName+awbNumber], createdAt, updatedAt',
      images: 'shipmentId, sizeBytes, createdAt',
      events: 'id, shipmentId, type, timestamp',
      metadata: 'key',
    });
  }
}

let dbInstance: ShipmentFlowDB | null = null;

/**
 * Returns the singleton database instance in browser environment.
 */
export function getDb(): ShipmentFlowDB {
  if (typeof window === 'undefined') {
    throw new Error('ShipmentFlowDB IndexedDB is only accessible in browser context.');
  }
  if (!dbInstance) {
    dbInstance = new ShipmentFlowDB();
  }
  return dbInstance;
}
