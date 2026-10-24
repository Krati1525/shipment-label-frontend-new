import { z } from 'zod';

export const ShipmentStatusSchema = z.enum([
  'PROCESSING',
  'ISSUE',
  'READY',
  'SHIPPED',
]);

export const ConfidenceLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);

export const FieldConfidenceSchema = z.object({
  level: ConfidenceLevelSchema,
  score: z.number().min(0).max(1).optional(),
  reason: z.string().optional(),
});

export const ShipmentIssueSchema = z.object({
  field: z.string(),
  message: z.string(),
  severity: z.enum(['warning', 'error']).optional(),
});

export const ShipmentSchema = z.object({
  id: z.string().min(1),
  shipmentId: z.string().optional(),
  date: z.string(),
  name: z.string().nullable(),
  mobileNumber: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  awbNumber: z.string().nullable(),
  trackingId: z.string().nullable().optional(),
  courierPartnerName: z.string().nullable(),
  weight: z.union([z.number(), z.string()]).nullable(),
  amount: z.union([z.number(), z.string()]).nullable(),
  imagePath: z.string().nullable().optional(),
  imageUrl: z.string(),
  originalFileName: z.string(),
  rawOcrText: z.string().nullable(),
  status: ShipmentStatusSchema,
  hasIssues: z.boolean(),
  issues: z.union([
    z.array(ShipmentIssueSchema),
    z.record(z.string(), z.string()),
  ]).nullable(),
  confidence: z.record(z.string(), FieldConfidenceSchema).nullable().optional(),
  duplicateWarning: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ShipmentCorrectionPayloadSchema = z.object({
  name: z.string().nullable().optional(),
  mobileNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  awbNumber: z.string().nullable().optional(),
  trackingId: z.string().nullable().optional(),
  courierPartnerName: z.string().nullable().optional(),
  weight: z.union([z.number(), z.string()]).nullable().optional(),
  amount: z.union([z.number(), z.string()]).nullable().optional(),
});

export const ShipmentEventTypeSchema = z.enum([
  'IMAGE_UPLOADED',
  'OCR_COMPLETED',
  'EXTRACTION_COMPLETED',
  'ISSUE_CREATED',
  'ISSUE_RESOLVED',
  'SHIPMENT_EDITED',
  'MARKED_READY',
  'WHATSAPP_OPENED',
  'SMS_OPENED',
  'MARKED_SHIPPED',
]);

export const ShipmentEventSchema = z.object({
  id: z.string().min(1),
  shipmentId: z.string().min(1),
  type: ShipmentEventTypeSchema,
  timestamp: z.string(),
  details: z.string().optional(),
});

export const BackupManifestSchema = z.object({
  format: z.literal('ShipmentFlowBackup'),
  version: z.number().int().min(1),
  createdAt: z.string(),
  appVersion: z.string(),
  shipmentCount: z.number().int().nonnegative(),
  imageCount: z.number().int().nonnegative(),
});
