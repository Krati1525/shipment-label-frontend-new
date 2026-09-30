export type ShipmentStatus = 'PROCESSING' | 'ISSUE' | 'READY' | 'SHIPPED';

export interface ShipmentIssue {
  field: string;
  message: string;
  severity?: 'warning' | 'error';
}

export interface Shipment {
  id: string;
  shipmentId?: string;
  date: string;
  name: string | null;
  mobileNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  awbNumber: string | null;
  courierPartnerName: string | null;
  weight: number | string | null;
  amount: number | string | null;
  imagePath?: string | null;
  imageUrl: string;
  originalFileName: string;
  rawOcrText: string | null;
  status: ShipmentStatus;
  hasIssues: boolean;
  issues: ShipmentIssue[] | Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ShipmentListResponse {
  data: Shipment[];
  pagination: Pagination;
}

export interface NotificationResponse {
  shipmentId: string;
  status: ShipmentStatus;
  mobileNumber: string;
  message: string;
  whatsappUrl: string;
  smsUrl: string;
}

export interface UploadResponse {
  success: boolean;
  message: string;
  count: number;
  data: Shipment[];
  shipments?: Shipment[];
}

export interface OCRResponse {
  shipmentId: string;
  status: ShipmentStatus;
  rawOcrText: string;
  hasIssues?: boolean;
}

export interface BatchOcrResultItem {
  shipmentId: string;
  success: boolean;
  rawOcrText?: string;
  error?: string;
}

export interface BatchOcrResponse {
  results: BatchOcrResultItem[];
}

export interface ExtractionResponse {
  shipmentId: string;
  shipment?: Shipment;
  data?: Record<string, string | number | null>;
  extractedFields?: Record<string, string | number | null>;
  status: ShipmentStatus;
  hasIssues: boolean;
  issues?: Record<string, string> | ShipmentIssue[];
}

export interface BatchExtractionResultItem {
  shipmentId: string;
  success: boolean;
  status?: ShipmentStatus;
  hasIssues?: boolean;
  data?: Record<string, string | number | null>;
  issues?: Record<string, string>;
  error?: string;
}

export interface BatchExtractionResponse {
  results: BatchExtractionResultItem[];
}

export type ProcessingStage =
  | 'WAITING'
  | 'OCR'
  | 'EXTRACTION'
  | 'COMPLETE'
  | 'ERROR';

export interface ProcessingShipmentItem {
  shipmentId: string;
  originalFileName: string;
  imageUrl?: string | null;
  stage: ProcessingStage;
  status: ShipmentStatus;
  hasIssues?: boolean;
  issues?: Record<string, string> | null;
  extractedFields?: Record<string, string | number | null> | null;
  rawOcrText?: string | null;
  error?: string | null;
}

export type ResolveResponse = Shipment & {
  success?: boolean;
  shipment?: Shipment;
  message?: string;
};

export type ShipResponse = Shipment & {
  success?: boolean;
  shipment?: Shipment;
  message?: string;
};

export interface DashboardStats {
  total: number;
  processing: number;
  issue: number;
  ready: number;
  shipped: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recentShipments: Shipment[];
}
