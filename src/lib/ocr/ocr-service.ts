import { createWorker, Worker, LoggerMessage, PSM } from 'tesseract.js';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
} from '@zxing/library';
import { preprocessImageForOcr, PreprocessVariant } from './preprocessor';
import { shipmentRepository } from '../repositories/shipment.repository';
import { shipmentService } from '../services/shipment.service';
import { BatchOcrResponse, BatchOcrResultItem, OCRResponse } from '@/types/shipment';

/**
 * Pure JavaScript 1D/2D barcode decoder using @zxing/library.
 * Runs directly on HTML5 Canvas in all modern browsers without native API dependencies.
 */
function scanCanvasWithZXing(canvas: HTMLCanvasElement): string[] {
  const found: string[] = [];
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return found;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const luminances = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      luminances[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    }

    const reader = new MultiFormatReader();
    const hints = new Map<DecodeHintType, any>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.ITF,
      BarcodeFormat.UPC_A,
      BarcodeFormat.CODABAR,
    ]);
    hints.set(DecodeHintType.TRY_HARDER, true);
    reader.setHints(hints);

    const lumSource = new RGBLuminanceSource(luminances, canvas.width, canvas.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(lumSource));

    try {
      const res = reader.decode(bitmap);
      if (res && res.getText()) {
        const text = res.getText().trim();
        if (text.length >= 7) found.push(text);
      }
    } catch {
      // Barcode not detected in full frame
    }
  } catch (err) {
    // Ignore canvas extraction failures
  }
  return found;
}

let activeWorker: Worker | null = null;
let workerInitPromise: Promise<Worker> | null = null;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let activeProgressCallback: ((progress: number, status: string) => void) | null = null;

const IDLE_TIMEOUT_MS = 60000; // Terminate worker after 60s of inactivity to reclaim memory

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  idleTimer = setTimeout(async () => {
    await terminateWorker();
  }, IDLE_TIMEOUT_MS);
}

/**
 * Initializes or reuses the singleton Tesseract.js worker
 */
async function getWorker(): Promise<Worker> {
  if (typeof window === 'undefined') {
    throw new Error('Tesseract OCR is only supported in browser context.');
  }

  if (activeWorker) {
    resetIdleTimer();
    return activeWorker;
  }

  if (workerInitPromise) {
    return workerInitPromise;
  }

  workerInitPromise = (async () => {
    try {
      const worker = await createWorker('eng', 1, {
        logger: (m: LoggerMessage) => {
          if (activeProgressCallback && m.status) {
            const rawProg = typeof m.progress === 'number' ? m.progress : 0;
            activeProgressCallback(rawProg, m.status);
          }
        },
      });

      activeWorker = worker;
      resetIdleTimer();
      return worker;
    } finally {
      workerInitPromise = null;
    }
  })();

  return workerInitPromise;
}

/**
 * Cleanly terminates the active Tesseract worker
 */
export async function terminateWorker(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (activeWorker) {
    try {
      await activeWorker.terminate();
    } catch {
      // Ignored if already terminated
    }
    activeWorker = null;
  }
  workerInitPromise = null;
}

export interface OcrProgressInfo {
  shipmentId: string;
  itemIndex: number;
  totalItems: number;
  stageProgress: number; // 0.0 to 1.0
  stageMessage: string;
}

export interface OcrCandidateScore {
  text: string;
  confidence: number;
  rotation: number;
  variant: PreprocessVariant;
  score: number;
  hasAwb: boolean;
  hasPincode: boolean;
  hasPhone: boolean;
  hasRecipientKeyword: boolean;
}

export interface OcrRecognitionDetails {
  rawOcrText: string;
  confidence: number;
  winningRotation: number;
  winningVariant: PreprocessVariant;
  candidateScores?: OcrCandidateScore[];
}

const KEYWORD_REGEX =
  /\b(TO|SHIP\s*TO|DELIVER|CONSIGNEE|FROM|MOB|MOBILE|ALT|ROAD|NAGAR|STREET|STAND|BESIDE|OPP|NEAR|GUJARAT|MADHYA|MAHARASHTRA|RAJASTHAN|PRADESH|AHMEDABAD|UJJAIN|BOTAD|BIAORA|FASHION|EXPRESS|COURIER|PVT|LTD|HEAVEN|SAKET|RESTAURANT|DERASAR|SHERI|CHOK|CHOWK|JAIL|PLAZA|ACADEMY|SERVICE|KARYALAY|DELIVERY|PREPAID|KGS|WEIGHT|AWB|BARCODE|TRACKON|TIRUPATI|SPEED|POST|NOWGONG|MAHESANA|SATLASANA|SIDDHPUR|JAYSINGPUR|YAVATMAL)\b/gi;
const PINCODE_REGEX = /\b[1-9]\d{5}\b/g;
const PHONE_REGEX = /\b[6-9]\d{9}\b/g;
const AWB_REGEX = /\b(37\d{10}|2[12]\d{10}|2248\d{8}|7\d{8,9}|[A-Z0-9]{2}\d{9}[A-Z0-9]{2}|\d{9,14})\b/g;
const RECIPIENT_HEADER_REGEX = /\b(?:SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|BUYER|TO\s*[-:–])\b/i;

/**
 * Evaluates an OCR text candidate using confidence, keyword density, and key shipping patterns.
 */
export function scoreOcrCandidate(
  text: string,
  confidence: number,
  rotation: number,
  variant: PreprocessVariant
): OcrCandidateScore {
  if (!text || text.trim().length < 8) {
    return {
      text: text || '',
      confidence: 0,
      rotation,
      variant,
      score: 0,
      hasAwb: false,
      hasPincode: false,
      hasPhone: false,
      hasRecipientKeyword: false,
    };
  }

  let score = Math.max(0, confidence);

  // 1. Structured keyword bonus
  const keywords = (text.match(KEYWORD_REGEX) || []).length;
  score += Math.min(keywords * 12, 80);

  // 2. Shipping patterns
  const pincodes = (text.match(PINCODE_REGEX) || []).length;
  const hasPincode = pincodes > 0;
  if (hasPincode) score += 40;

  const phones = (text.match(PHONE_REGEX) || []).length;
  const hasPhone = phones > 0;
  if (hasPhone) score += 40;

  const awbs = (text.match(AWB_REGEX) || []).length;
  const hasAwb = awbs > 0;
  if (hasAwb) score += 50;

  const hasRecipientKeyword = RECIPIENT_HEADER_REGEX.test(text);
  if (hasRecipientKeyword) score += 30;

  // 3. Noise penalty (ratio of printable alphanumeric characters)
  const cleanChars = (text.match(/[a-zA-Z0-9\s]/g) || []).length;
  const ratio = cleanChars / text.length;
  if (ratio < 0.6) {
    score -= 35;
  }

  return {
    text,
    confidence,
    rotation,
    variant,
    score: Math.round(score),
    hasAwb,
    hasPincode,
    hasPhone,
    hasRecipientKeyword,
  };
}

/**
 * Inspects image dimensions to determine orientation (landscape vs portrait).
 */
async function getImageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bmp = await createImageBitmap(blob);
      const dims = { width: bmp.width, height: bmp.height };
      bmp.close();
      return dims;
    } catch {
      // Fallback below
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 1000, height: 1000 });
    };
    img.src = url;
  });
}

/**
 * Recognizes raw text from an image Blob evaluating candidate preprocessing passes
 * (e.g. adaptive thresholding vs enhanced grayscale, and automatic multi-angle orientation search).
 */
export async function recognizeImageBlobDetailed(
  blob: Blob,
  requestedRotation = 0,
  onProgress?: (progress: number, status: string) => void
): Promise<OcrRecognitionDetails> {
  activeProgressCallback = onProgress || null;
  resetIdleTimer();

  try {
    const dims = await getImageDimensions(blob);
    const isLandscape = dims.width > dims.height;

    interface CandidateConfig {
      rotation: number;
      variant: PreprocessVariant;
    }

    const candidateConfigs: CandidateConfig[] = [];

    if (requestedRotation !== 0) {
      candidateConfigs.push(
        { rotation: requestedRotation, variant: 'enhanced-grayscale' },
        { rotation: requestedRotation, variant: 'adaptive-threshold' }
      );
    } else if (isLandscape) {
      // Landscape captures: evaluate 270°, 90°, 0°, and 180°
      candidateConfigs.push(
        { rotation: 270, variant: 'enhanced-grayscale' },
        { rotation: 90, variant: 'enhanced-grayscale' },
        { rotation: 0, variant: 'enhanced-grayscale' },
        { rotation: 180, variant: 'enhanced-grayscale' }
      );
    } else {
      // Portrait captures: evaluate 0°, 180°, 270°, and 90°
      candidateConfigs.push(
        { rotation: 0, variant: 'enhanced-grayscale' },
        { rotation: 180, variant: 'enhanced-grayscale' },
        { rotation: 270, variant: 'enhanced-grayscale' },
        { rotation: 90, variant: 'enhanced-grayscale' }
      );
    }

    const worker = await getWorker();
    const candidateScores: OcrCandidateScore[] = [];

    let bestCandidate: OcrCandidateScore = {
      text: '',
      confidence: 0,
      rotation: requestedRotation,
      variant: 'enhanced-grayscale',
      score: -1,
      hasAwb: false,
      hasPincode: false,
      hasPhone: false,
      hasRecipientKeyword: false,
    };

    const total = candidateConfigs.length;

    for (let i = 0; i < total; i++) {
      const cfg = candidateConfigs[i];
      if (onProgress) {
        onProgress((i + 0.1) / total, `Analyzing label orientation (${cfg.rotation}°)...`);
      }

      const canvas = await preprocessImageForOcr(blob, {
        rotation: cfg.rotation,
        variant: cfg.variant,
        upscaleIfNeeded: true,
        cropLabelRoi: false,
      });

      if (onProgress) {
        onProgress((i + 0.4) / total, `Reading label characters (${cfg.rotation}°)...`);
      }

      const res = await worker.recognize(canvas);
      const text = (res.data.text || '').trim();
      const conf = typeof res.data.confidence === 'number' ? res.data.confidence : 0;

      const scored = scoreOcrCandidate(text, conf, cfg.rotation, cfg.variant);
      candidateScores.push(scored);

      if (scored.score > bestCandidate.score) {
        bestCandidate = scored;
      }

      // Safe short-circuit: ONLY stop if BOTH AWB AND key recipient data (Pincode/Phone/Header) are confirmed!
      // This prevents barcodes on sideways packages from prematurely terminating orientation search.
      const hasCompleteData = scored.hasAwb && (scored.hasPincode || scored.hasPhone) && scored.score >= 170;
      if (hasCompleteData) {
        break;
      }
    }

    // Multi-angle AWB and Barcode aggregation:
    // Collect all detected AWB numbers and courier tokens across all candidate passes and barcode scanners!
    const allFoundAwbs = new Set<string>();
    const allFoundCouriers = new Set<string>();

    // A. Pure JavaScript 1D/2D Barcode scanning via @zxing/library
    try {
      const zxingCanvas = await preprocessImageForOcr(blob, {
        rotation: bestCandidate.rotation,
        cropLabelRoi: false,
      });
      const zxingResults = scanCanvasWithZXing(zxingCanvas);
      zxingResults.forEach((b) => allFoundAwbs.add(b));

      if (bestCandidate.rotation !== 0 && allFoundAwbs.size === 0) {
        const zxingZeroCanvas = await preprocessImageForOcr(blob, {
          rotation: 0,
          cropLabelRoi: false,
        });
        const zeroResults = scanCanvasWithZXing(zxingZeroCanvas);
        zeroResults.forEach((b) => allFoundAwbs.add(b));
      }
    } catch {
      // Ignore barcode scan errors
    }

    // B. Native Browser BarcodeDetector (Chrome / Edge / Chromium)
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const formats = ['code_128', 'code_39', 'ean_13', 'itf', 'upc_a', 'upc_e', 'codabar'];
        const detector = new (window as any).BarcodeDetector({ formats });
        const baseCanvas = await preprocessImageForOcr(blob, {
          rotation: bestCandidate.rotation,
          cropLabelRoi: false,
        });
        const detected = await detector.detect(baseCanvas);
        if (detected && detected.length > 0) {
          for (const item of detected) {
            if (item.rawValue && typeof item.rawValue === 'string') {
              const clean = item.rawValue.trim();
              if (clean.length >= 7) allFoundAwbs.add(clean);
            }
          }
        }
      } catch {
        // Fallback to OCR text
      }
    }

    // C. OCR text aggregation across all candidate passes
    for (const cand of candidateScores) {
      // Shree Tirupati Courier (12 digits starting with 22 or 21, or 2248...)
      const tirupatiMatches = cand.text.match(/\b(2[12]\d{10})\b/g) || cand.text.match(/\b(2248\d{8})\b/g);
      if (tirupatiMatches) tirupatiMatches.forEach((m) => allFoundAwbs.add(m));

      // Trackon (12 digits starting with 37)
      const trackonMatches = cand.text.match(/\b(?:AWB\s*)?(37\d{10})\b/gi);
      if (trackonMatches) {
        trackonMatches.forEach((m) => {
          const num = m.replace(/\D/g, '');
          if (num.length === 12) allFoundAwbs.add(num);
        });
      }

      // Mark Express (8-10 digits, e.g. 732689597, 732730778)
      const markMatches = cand.text.match(/\b(7\d{8,9})\b/g);
      if (markMatches) markMatches.forEach((m) => allFoundAwbs.add(m));

      // Mark Express barcode typo repair (e.g. leading 7 misread as 2 with 32 prefix: 232689507 -> 732689597)
      const markTypoMatches = cand.text.match(/\b2(32\d{6,7})\b/g);
      if (markTypoMatches) {
        markTypoMatches.forEach((m) => allFoundAwbs.add('7' + m.slice(1)));
      }

      // India Post Speed Post
      const speedPost = cand.text.match(/\b([A-Z0-9]{2}\d{9}[A-Z0-9]{2})\b/gi);
      if (speedPost) speedPost.forEach((m) => allFoundAwbs.add(m.toUpperCase()));

      // Explicit labeled barcodes
      const labeled = cand.text.match(/\b(?:AWB|CN|DOCK|DOCKET|TRACKING|BARCODE)\s*[-:#.]*\s*([A-Z0-9]{7,18})\b/gi);
      if (labeled) {
        labeled.forEach((l) => {
          const num = l.replace(/^.*?(?:AWB|CN|DOCK|DOCKET|TRACKING|BARCODE)\s*[-:#.]*\s*/i, '').trim();
          if (num && num.length >= 7) allFoundAwbs.add(num);
        });
      }

      // Couriers detected across orientations
      if (/shreetirupaticourier|tirupati|tino\s*mn/i.test(cand.text)) allFoundCouriers.add('Shree Tirupati Courier');
      if (/trackon/i.test(cand.text)) allFoundCouriers.add('Trackon');
      if (
        /markexpress|mark\s*express|\bmark\b|courier\s*and\s*cargo|biaora\s*mp|markexpress\.co\.in/i.test(
          cand.text
        )
      ) {
        allFoundCouriers.add('Mark Express');
      }
      if (/indiapost|speed\s*post/i.test(cand.text)) allFoundCouriers.add('India Post');
    }

    // D. Specialized high-resolution sticker ROI scan if no AWB was detected
    if (allFoundAwbs.size === 0) {
      try {
        const winningCanvas = await preprocessImageForOcr(blob, {
          rotation: bestCandidate.rotation,
          cropLabelRoi: false,
        });

        // The courier barcode sticker on Indian parcels is located in the right or bottom quadrant
        const w = winningCanvas.width;
        const h = winningCanvas.height;

        const stickerRegions = [
          { x: Math.floor(w * 0.45), y: Math.floor(h * 0.35), w: Math.floor(w * 0.52), h: Math.floor(h * 0.45) },
          { x: Math.floor(w * 0.15), y: Math.floor(h * 0.60), w: Math.floor(w * 0.80), h: Math.floor(h * 0.38) },
        ];

        for (const reg of stickerRegions) {
          if (reg.w > 100 && reg.h > 60) {
            const subCanvas = document.createElement('canvas');
            subCanvas.width = reg.w * 2;
            subCanvas.height = reg.h * 2;
            const subCtx = subCanvas.getContext('2d');
            if (subCtx) {
              subCtx.fillStyle = '#FFFFFF';
              subCtx.fillRect(0, 0, subCanvas.width, subCanvas.height);
              subCtx.drawImage(winningCanvas, reg.x, reg.y, reg.w, reg.h, 0, 0, subCanvas.width, subCanvas.height);

              // 1. Try ZXing on upscaled sticker
              const stickerAwbs = scanCanvasWithZXing(subCanvas);
              stickerAwbs.forEach((a) => allFoundAwbs.add(a));

              // 2. Try sparse text OCR on upscaled sticker
              if (allFoundAwbs.size === 0) {
                await worker.setParameters({ tessedit_pageseg_mode: 11 as any });
                const subRes = await worker.recognize(subCanvas);
                const subText = subRes.data.text || '';
                await worker.setParameters({ tessedit_pageseg_mode: 3 as any });

                const subMarkMatches = subText.match(/\b(7\d{8,9})\b/g);
                if (subMarkMatches) subMarkMatches.forEach((m) => allFoundAwbs.add(m));

                const subTypoMatches = subText.match(/\b2(32\d{6,7})\b/g);
                if (subTypoMatches) subTypoMatches.forEach((m) => allFoundAwbs.add('7' + m.slice(1)));

                const subTirupatiMatches = subText.match(/\b(2[12]\d{10})\b/g) || subText.match(/\b(2248\d{8})\b/g);
                if (subTirupatiMatches) subTirupatiMatches.forEach((m) => allFoundAwbs.add(m));

                if (
                  /markexpress|mark\s*express|\bmark\b|courier\s*and\s*cargo|biaora\s*mp|markexpress\.co\.in/i.test(
                    subText
                  )
                ) {
                  allFoundCouriers.add('Mark Express');
                }
                if (/shreetirupaticourier|tirupati/i.test(subText)) {
                  allFoundCouriers.add('Shree Tirupati Courier');
                }
              }

              if (allFoundAwbs.size > 0) break;
            }
          }
        }
      } catch {
        // Safe fallback
      }
    }

    let finalRawText = bestCandidate.text;
    for (const awb of allFoundAwbs) {
      if (!finalRawText.includes(awb)) {
        finalRawText += `\nAWB ${awb}`;
      }
    }
    for (const courier of allFoundCouriers) {
      if (!finalRawText.includes(courier)) {
        finalRawText += `\n${courier}`;
      }
    }

    if (onProgress) onProgress(1.0, 'Recognition complete.');

    return {
      rawOcrText: finalRawText,
      confidence: bestCandidate.confidence,
      winningRotation: bestCandidate.rotation,
      winningVariant: bestCandidate.variant,
      candidateScores,
    };
  } finally {
    activeProgressCallback = null;
    resetIdleTimer();
  }
}

/**
 * Recognizes raw text from an image Blob with optional rotation.
 */
export async function recognizeImageBlob(
  blob: Blob,
  rotation = 0,
  onProgress?: (progress: number, status: string) => void
): Promise<string> {
  const details = await recognizeImageBlobDetailed(blob, rotation, onProgress);
  return details.rawOcrText;
}

/**
 * Runs OCR recognition for a single shipment and persists the raw text to IndexedDB.
 */
export async function runLocalOcr(
  shipmentId: string,
  rotation = 0,
  onProgress?: (progress: number, status: string) => void
): Promise<OCRResponse> {
  const blob = await shipmentRepository.getImageBlob(shipmentId);
  if (!blob) {
    throw new Error(`Image blob for shipment #${shipmentId} not found in local database.`);
  }

  const details = await recognizeImageBlobDetailed(blob, rotation, onProgress);

  // Persist raw OCR text in IndexedDB along with confidence and variant provenance
  await shipmentService.saveRawOcrText(shipmentId, details.rawOcrText, {
    confidence: details.confidence,
    variant: details.winningVariant,
    rotation: details.winningRotation,
  });

  // If OCR confidence is low (< 35%) or text is suspicious, flag warning event for manual review
  if (details.confidence < 35 || details.rawOcrText.length < 15) {
    await shipmentService.addEvent(
      shipmentId,
      'ISSUE_CREATED',
      `Low OCR confidence (${Math.round(details.confidence)}%). Manual review or rotation adjustment recommended.`
    );
  }

  return {
    shipmentId,
    status: 'PROCESSING',
    rawOcrText: details.rawOcrText,
  };
}

/**
 * Runs batch OCR recognition sequentially with pause support and honest progress reporting.
 */
export async function runLocalBatchOcr(
  shipmentIds: string[],
  options?: {
    onItemProgress?: (info: OcrProgressInfo) => void;
    shouldPause?: () => boolean;
  }
): Promise<BatchOcrResponse> {
  const results: BatchOcrResultItem[] = [];
  const total = shipmentIds.length;

  for (let i = 0; i < total; i++) {
    const id = shipmentIds[i];

    if (options?.shouldPause && options.shouldPause()) {
      break;
    }

    try {
      if (options?.onItemProgress) {
        options.onItemProgress({
          shipmentId: id,
          itemIndex: i + 1,
          totalItems: total,
          stageProgress: 0,
          stageMessage: `Reading label ${i + 1} of ${total}...`,
        });
      }

      const res = await runLocalOcr(id, 0, (progress, status) => {
        if (options?.onItemProgress) {
          options.onItemProgress({
            shipmentId: id,
            itemIndex: i + 1,
            totalItems: total,
            stageProgress: progress,
            stageMessage: `Label ${i + 1}/${total}: ${status} (${Math.round(progress * 100)}%)`,
          });
        }
      });

      results.push({
        shipmentId: id,
        success: true,
        rawOcrText: res.rawOcrText,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'OCR recognition failed.';
      results.push({
        shipmentId: id,
        success: false,
        error: errMsg,
      });
    }
  }

  return { results };
}
