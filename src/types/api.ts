import { ShipmentStatus } from './shipment';

export interface ShipmentFilterParams {
  search?: string;
  status?: ShipmentStatus | 'ALL';
  courier?: string;
  city?: string;
  state?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ShipmentCorrectionPayload {
  name?: string | null;
  mobileNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  awbNumber?: string | null;
  courierPartnerName?: string | null;
  weight?: number | string | null;
  amount?: number | string | null;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
}
