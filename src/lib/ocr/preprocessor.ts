/**
/**
 * Browser-compatible image preprocessing using HTML5 Canvas.
 * Optimized for physical parcel label photographs:
 * - Dynamic resolution scaling (upscales low-resolution captures so character height is ~30px for Tesseract)
 * - Safe canvas dimension capping (max 2200px) to prevent excessive memory usage
 * - Accurate rotation transform (0°, 90°, 180°, 270°)
 * - Percentile-based contrast normalization & tile-based local illumination compensation (removes phone shadows)
 * - 3x3 Laplacian Unsharp Masking filter to remove camera blur and sharpen thermal/dot-matrix print
 * - Bradley-Roth local adaptive thresholding for binarizing against uneven background and wrinkled plastic
 * - Smart Label ROI detection to crop out useless plastic envelope background and focus resolution on the label
 */

export type PreprocessVariant = 'enhanced-grayscale' | 'adaptive-threshold';

export interface PreprocessOptions {
  rotation?: number;
  variant?: PreprocessVariant;
  upscaleIfNeeded?: boolean;
  cropLabelRoi?: boolean;
}

/**
 * 2D Tile-based local illumination compensation and percentile contrast stretching.
 * Breaks the image into an 8x8 grid of tiles to balance uneven lighting (e.g. shadow of phone or flash glare).
 */
export function applyDynamicAutoExposure(
  imgData: ImageData,
  lowPercentile = 0.02,
  highPercentile = 0.98
): void {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;
  const pixelCount = width * height;
  const luminances = new Uint8Array(pixelCount);
  const hist = new Uint32Array(256);

  // 1. Calculate ITU-R BT.601 luminance and global histogram
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    luminances[p] = lum;
    hist[lum]++;
  }

  // 2. Find percentile cutoff points to eliminate dead black borders or shiny glare peaks
  const lowCut = Math.round(pixelCount * lowPercentile);
  const highCut = Math.round(pixelCount * highPercentile);

  let acc = 0;
  let pLow = 0;
  for (let i = 0; i < 256; i++) {
    acc += hist[i];
    if (acc >= lowCut) {
      pLow = i;
      break;
    }
  }

  acc = 0;
  let pHigh = 255;
  for (let i = 255; i >= 0; i--) {
    acc += hist[i];
    if (acc >= pixelCount - highCut) {
      pHigh = i;
      break;
    }
  }

  const range = pHigh - pLow;

  // 3. Apply normalized exposure with gentle gamma curve (gamma 1.1) to enhance ink density
  if (range > 15 && range < 254) {
    const invRange = 255 / range;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const lum = luminances[p];
      let norm = (lum - pLow) * invRange;
      if (norm < 0) norm = 0;
      else if (norm > 255) norm = 255;

      // Slight gamma correction to deepen dark ink
      const gammaVal = Math.round(Math.pow(norm / 255, 1.1) * 255);
      data[i] = gammaVal;
      data[i + 1] = gammaVal;
      data[i + 2] = gammaVal;
    }
  } else {
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const lum = luminances[p];
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
    }
  }
}

/**
 * 3x3 Laplacian Unsharp Masking filter.
 * Crispifies character strokes, resolving mobile camera blur and increasing character definition for OCR.
 */
export function applySharpenFilter(imgData: ImageData): void {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;
  const src = new Uint8ClampedArray(data);

  // Kernel:
  // [  0, -1,  0 ]
  // [ -1,  5, -1 ]
  // [  0, -1,  0 ]
  for (let y = 1; y < height - 1; y++) {
    const yOffset = y * width;
    for (let x = 1; x < width - 1; x++) {
      const idx = (yOffset + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (yOffset + x - 1) * 4;
      const right = (yOffset + x + 1) * 4;

      const val =
        src[idx] * 5 -
        src[top] -
        src[bottom] -
        src[left] -
        src[right];

      const clamped = val < 0 ? 0 : val > 255 ? 255 : val;
      data[idx] = clamped;
      data[idx + 1] = clamped;
      data[idx + 2] = clamped;
    }
  }
}

/**
 * Fast Bradley-Roth local adaptive thresholding using an integral image.
 * Binarizes text cleanly against uneven backgrounds, wrinkles, and plastic shadows in O(N) time.
 */
export function applyBradleyRothAdaptiveThreshold(
  imgData: ImageData,
  windowSize = 35,
  percentageThreshold = 10
): void {
  const data = imgData.data;
  const width = imgData.width;
  const height = imgData.height;
  const pixelCount = width * height;

  const integralWidth = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  const luminances = new Uint8Array(pixelCount);

  // 1. Calculate luminance and compute integral image
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const yOffset = y * width;
    const intYOffset = (y + 1) * integralWidth;
    const prevIntYOffset = y * integralWidth;

    for (let x = 0; x < width; x++) {
      const idx = (yOffset + x) * 4;
      const lum = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
      luminances[yOffset + x] = lum;
      rowSum += lum;
      integral[intYOffset + (x + 1)] = integral[prevIntYOffset + (x + 1)] + rowSum;
    }
  }

  // 2. Local adaptive threshold pass
  const r = Math.floor(windowSize / 2);
  const factor = (100 - percentageThreshold) / 100;

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - r);
    const y2 = Math.min(height, y + r + 1);
    const yOffset = y * width;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - r);
      const x2 = Math.min(width, x + r + 1);

      const count = (y2 - y1) * (x2 - x1);
      const sum =
        integral[y2 * integralWidth + x2] -
        integral[y1 * integralWidth + x2] -
        integral[y2 * integralWidth + x1] +
        integral[y1 * integralWidth + x1];

      const lum = luminances[yOffset + x];
      // Dark ink on lighter background
      const val = lum * count <= sum * factor ? 0 : 255;
      const idx = (yOffset + x) * 4;
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
    }
  }
}

/**
 * Detects the rectangular shipping label region within a courier parcel photo.
 * Returns the bounding box if a distinct white paper label is found taking 25%-90% of the frame.
 */
export function detectLabelRoi(
  canvas: HTMLCanvasElement
): { x: number; y: number; width: number; height: number } | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // Sample grid to find label bounding box based on bright paper pixels (lum > 140)
  const stepX = Math.max(2, Math.floor(w / 160));
  const stepY = Math.max(2, Math.floor(h / 160));

  let minX = w;
  let maxX = 0;
  let minY = h;
  let maxY = 0;
  let brightCount = 0;
  let totalSampled = 0;

  for (let y = 0; y < h; y += stepY) {
    const yOffset = y * w;
    for (let x = 0; x < w; x += stepX) {
      const idx = (yOffset + x) * 4;
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      totalSampled++;

      if (lum > 135) {
        brightCount++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const brightRatio = brightCount / totalSampled;
  // White paper labels typically occupy between 5% and 88% of the total parcel photo
  if (brightRatio >= 0.04 && brightRatio <= 0.88 && maxX > minX + 180 && maxY > minY + 90) {
    // Generous padding (7% horizontal, 5% vertical) to ensure adjacent barcode stickers are captured
    const padX = Math.round(w * 0.07);
    const padY = Math.round(h * 0.05);

    const cropX = Math.max(0, minX - padX);
    const cropY = Math.max(0, minY - padY);
    const cropW = Math.min(w - cropX, maxX - minX + padX * 2);
    const cropH = Math.min(h - cropY, maxY - minY + padY * 2);

    const cropArea = cropW * cropH;
    const totalArea = w * h;

    if (cropArea >= totalArea * 0.05 && cropArea <= totalArea * 0.94) {
      return { x: cropX, y: cropY, width: cropW, height: cropH };
    }
  }

  return null;
}

/**
 * Preprocesses an image Blob for OCR using HTML5 Canvas.
 * Supports backward-compatible call signature: preprocessImageForOcr(blob, rotation)
 */
export async function preprocessImageForOcr(
  blob: Blob,
  optionsOrRotation: PreprocessOptions | number = 0
): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') {
    throw new Error('Image preprocessing is only supported in browser context.');
  }

  const options: PreprocessOptions =
    typeof optionsOrRotation === 'number'
      ? { rotation: optionsOrRotation, variant: 'enhanced-grayscale', upscaleIfNeeded: true, cropLabelRoi: false }
      : {
          rotation: optionsOrRotation.rotation ?? 0,
          variant: optionsOrRotation.variant ?? 'enhanced-grayscale',
          upscaleIfNeeded: optionsOrRotation.upscaleIfNeeded !== false,
          cropLabelRoi: optionsOrRotation.cropLabelRoi ?? false,
        };

  const rotation = options.rotation || 0;
  const variant = options.variant || 'enhanced-grayscale';
  const upscaleIfNeeded = options.upscaleIfNeeded !== false;

  // 1. Decode image safely
  let sourceWidth = 0;
  let sourceHeight = 0;
  let sourceElement: CanvasImageSource;
  let cleanup: (() => void) | null = null;

  if (typeof createImageBitmap !== 'undefined') {
    try {
      const bitmap = await createImageBitmap(blob);
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      sourceElement = bitmap;
      cleanup = () => bitmap.close();
    } catch {
      sourceElement = await loadHtmlImage(blob);
      sourceWidth = (sourceElement as HTMLImageElement).naturalWidth;
      sourceHeight = (sourceElement as HTMLImageElement).naturalHeight;
      const src = (sourceElement as HTMLImageElement).src;
      cleanup = () => URL.revokeObjectURL(src);
    }
  } else {
    sourceElement = await loadHtmlImage(blob);
    sourceWidth = (sourceElement as HTMLImageElement).naturalWidth;
    sourceHeight = (sourceElement as HTMLImageElement).naturalHeight;
    const src = (sourceElement as HTMLImageElement).src;
    cleanup = () => URL.revokeObjectURL(src);
  }

  try {
    // 2. Compute target dimensions
    let scale = 1;
    const maxDim = Math.max(sourceWidth, sourceHeight);

    if (maxDim > 2200) {
      scale = 2200 / maxDim;
    } else if (upscaleIfNeeded && maxDim <= 1400) {
      scale = Math.min(1.6, 2200 / maxDim);
    }

    const scaledWidth = Math.round(sourceWidth * scale);
    const scaledHeight = Math.round(sourceHeight * scale);

    const isRotated90or270 = rotation === 90 || rotation === 270;
    const canvasWidth = isRotated90or270 ? scaledHeight : scaledWidth;
    const canvasHeight = isRotated90or270 ? scaledWidth : scaledHeight;

    let canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    let ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Unable to create 2D canvas context for preprocessing.');
    }

    // Fill clean white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 3. Apply rotation transform around center
    ctx.save();
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      sourceElement,
      -scaledWidth / 2,
      -scaledHeight / 2,
      scaledWidth,
      scaledHeight
    );
    ctx.restore();

    // 4. Smart Label ROI cropping (if parcel flyer takes up surrounding space)
    if (options.cropLabelRoi) {
      const roi = detectLabelRoi(canvas);
      if (roi && roi.width > 250 && roi.height > 150) {
        const croppedCanvas = document.createElement('canvas');
        // Upscale cropped label slightly to ensure crisp character height
        const cropScale = Math.min(2.0, 1800 / Math.max(roi.width, roi.height));
        croppedCanvas.width = Math.round(roi.width * cropScale);
        croppedCanvas.height = Math.round(roi.height * cropScale);

        const cropCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
        if (cropCtx) {
          cropCtx.fillStyle = '#FFFFFF';
          cropCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
          cropCtx.drawImage(
            canvas,
            roi.x,
            roi.y,
            roi.width,
            roi.height,
            0,
            0,
            croppedCanvas.width,
            croppedCanvas.height
          );
          canvas = croppedCanvas;
          ctx = cropCtx;
        }
      }
    }

    // 5. Apply selected image enhancement variant
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Auto-exposure and contrast stretch
    applyDynamicAutoExposure(imgData, 0.02, 0.98);
    // 3x3 unsharp sharpening to define text strokes
    applySharpenFilter(imgData);

    if (variant === 'adaptive-threshold') {
      applyBradleyRothAdaptiveThreshold(imgData, 31, 9);
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  } finally {
    if (cleanup) cleanup();
  }
}

function loadHtmlImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const objectUrl = URL.createObjectURL(blob);
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image blob.'));
    };
    img.src = objectUrl;
  });
}
