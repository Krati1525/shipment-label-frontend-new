import { ExtractedFields } from './extractor';
import { ShipmentIssue, ShipmentStatus } from '@/types/shipment';

export interface ValidationResult {
  isValid: boolean;
  status: ShipmentStatus;
  issues: ShipmentIssue[];
}

/**
 * Validates extracted shipment logistics fields according to Indian shipping requirements.
 * Enforces:
 * - Recipient Name (at least 2 characters)
 * - Mobile Number (10 digits starting with 6-9)
 * - Destination Pincode (6 digits starting with 1-9)
 * - AWB Number (present and non-empty)
 */
export function validateExtractedFields(
  fields: ExtractedFields,
  existingStatus?: ShipmentStatus
): ValidationResult {
  const issues: ShipmentIssue[] = [];

  // 1. Recipient Name Validation
  if (!fields.name || fields.name.trim().length < 2) {
    issues.push({
      field: 'name',
      message: 'Recipient name is missing or unidentified.',
      severity: 'error',
    });
  }

  // 2. Mobile Number Validation
  if (!fields.mobileNumber || !fields.mobileNumber.trim()) {
    issues.push({
      field: 'mobileNumber',
      message: 'Customer mobile number is missing or unidentified.',
      severity: 'error',
    });
  } else {
    const cleanPhone = fields.mobileNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      issues.push({
        field: 'mobileNumber',
        message: `Invalid mobile number "${fields.mobileNumber}". Must be 10 digits starting with 6-9.`,
        severity: 'error',
      });
    }
  }

  // 3. Delivery Street Address Validation
  if (!fields.address || fields.address.trim().length < 4) {
    issues.push({
      field: 'address',
      message: 'Delivery street/locality address is missing or unidentified.',
      severity: 'error',
    });
  }

  // 4. Destination City Validation
  if (!fields.city || fields.city.trim().length < 2) {
    issues.push({
      field: 'city',
      message: 'Destination city is missing or unidentified.',
      severity: 'error',
    });
  }

  // 5. Destination State Validation
  if (!fields.state || fields.state.trim().length < 2) {
    issues.push({
      field: 'state',
      message: 'Destination state is missing or unidentified.',
      severity: 'error',
    });
  }

  // 6. Destination Pincode Validation
  if (!fields.pincode || !fields.pincode.trim()) {
    issues.push({
      field: 'pincode',
      message: 'Destination pincode is missing or unidentified.',
      severity: 'error',
    });
  } else {
    const cleanPin = fields.pincode.trim();
    if (!/^[1-9]\d{5}$/.test(cleanPin)) {
      issues.push({
        field: 'pincode',
        message: `Invalid 6-digit destination pincode "${fields.pincode}". Must be 6 digits starting with 1-9.`,
        severity: 'error',
      });
    }
  }

  // 7. AWB / Tracking Number Validation
  const trackingNumber = fields.trackingId || fields.awbNumber;
  if (!trackingNumber || trackingNumber.trim().length < 4) {
    issues.push({
      field: 'awbNumber',
      message: 'Tracking ID is missing or unidentified (printed below barcode on label).',
      severity: 'error',
    });
  }

  // 8. Courier Partner Validation
  if (!fields.courierPartnerName || !fields.courierPartnerName.trim()) {
    issues.push({
      field: 'courierPartnerName',
      message: 'Courier partner name is missing or unidentified.',
      severity: 'error',
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  // Preserve SHIPPED status if shipment was already dispatched
  if (existingStatus === 'SHIPPED') {
    return {
      isValid: !hasErrors,
      status: 'SHIPPED',
      issues,
    };
  }

  return {
    isValid: !hasErrors,
    status: hasErrors ? 'ISSUE' : 'READY',
    issues,
  };
}
