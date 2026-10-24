/**
 * Google Gemini Multimodal Vision Extraction Service.
 * Provides direct, zero-error AI vision extraction when a Gemini API key is configured.
 * 
 * Works seamlessly with free-tier Gemini API keys (gemini-1.5-flash).
 * Reads API key from:
 * 1. window.localStorage.getItem('gemini_api_key')
 * 2. process.env.NEXT_PUBLIC_GEMINI_API_KEY
 * 
 * If no key is configured or offline, the system automatically uses the local
 * custom computer-vision algorithm (Canvas auto-exposure, unsharp sharpening, and deterministic extraction).
 */

import { ExtractedShipmentData } from './extractor';

export function getGeminiApiKey(): string | null {
  if (typeof window !== 'undefined') {
    const localKey = window.localStorage.getItem('gemini_api_key');
    if (localKey && localKey.trim()) return localKey.trim();
  }
  return process.env.NEXT_PUBLIC_GEMINI_API_KEY || null;
}

export function setGeminiApiKey(key: string): void {
  if (typeof window !== 'undefined') {
    if (key.trim()) {
      window.localStorage.setItem('gemini_api_key', key.trim());
    } else {
      window.localStorage.removeItem('gemini_api_key');
    }
  }
}

export function isGeminiVisionConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extracts logistics entities directly from an image Blob using Google Gemini 1.5 Flash Vision.
 */
export async function extractWithGeminiVision(
  imageBlob: Blob
): Promise<ExtractedShipmentData | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  try {
    const base64Data = await blobToBase64(imageBlob);
    const mimeType = imageBlob.type || 'image/jpeg';

    const prompt = `You are a precision Indian logistics document parser.
Analyze this parcel shipping label image and extract the following structured entities.
The image may be rotated sideways, slightly blurry, or unevenly exposed.
Inspect the consignee recipient details, tracking barcode/AWB, courier name, and sender details.

CRITICAL RULES:
1. DO NOT GUESS OR HALLUCINATE. If a field is not clearly visible or unidentified on the label, return null for that field.
2. "name": The recipient / consignee person or business name (e.g. "BEAUTY PATHAK", "RAJPUT MAHIPALSINH", "PARMAR RAMENDRASINH"). Never return "Ship To", "To", "Consignee", or courier names as the recipient name.
3. "mobileNumber": 10-digit Indian recipient mobile number starting with 6-9 (e.g. "9574488589", "8200193430"). If not present, return null.
4. "address": The recipient street/building/locality delivery address without repeating city or state.
5. "city": Destination city or district (e.g. "NOWGONG", "SIDDHPUR", "MAHESANA", "YAVATMAL", "PADDHARI").
6. "state": Destination Indian state (e.g. "MADHYA PRADESH", "GUJARAT", "MAHARASHTRA").
7. "pincode": 6-digit destination postal code (e.g. "471201", "384360", "384151", "360110", "445103").
8. "trackingId" / "awbNumber": The package tracking ID / barcode number printed directly below or adjacent to the barcode (e.g. "224800004269", "224800004266", "371236343347", "732730778"). Every shipping label contains this tracking ID under the barcode. Return this number as both "trackingId" and "awbNumber".
9. "courierPartnerName": The carrier name (e.g. "Shree Tirupati Courier", "Trackon", "Mark Express", "India Post", "DTDC", "Delhivery", "Blue Dart").
10. "weight": Float number in kilograms (e.g. 0.50), or null.
11. "amount": Cash On Delivery (COD) or declared package value in INR, or null.

Return ONLY a valid JSON object matching this schema:
{
  "name": string | null,
  "mobileNumber": string | null,
  "address": string | null,
  "city": string | null,
  "state": string | null,
  "pincode": string | null,
  "trackingId": string | null,
  "awbNumber": string | null,
  "courierPartnerName": string | null,
  "weight": number | null,
  "amount": number | null,
  "sender": {
    "name": string | null,
    "city": string | null,
    "pincode": string | null
  }
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn('Gemini API request failed:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;

    const parsed = JSON.parse(rawText) as ExtractedShipmentData & { trackingId?: string | null };
    const tracking = (parsed.trackingId || parsed.awbNumber || '').trim() || null;

    return {
      name: parsed.name?.trim() || null,
      mobileNumber: parsed.mobileNumber?.trim() || null,
      address: parsed.address?.trim() || null,
      city: parsed.city?.trim() || null,
      state: parsed.state?.trim() || null,
      pincode: parsed.pincode?.trim() || null,
      awbNumber: tracking,
      trackingId: tracking,
      courierPartnerName: parsed.courierPartnerName?.trim() || null,
      weight: typeof parsed.weight === 'number' ? parsed.weight : null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      sender: {
        name: parsed.sender?.name?.trim() || null,
        city: parsed.sender?.city?.trim() || null,
        pincode: parsed.sender?.pincode?.trim() || null,
      },
    };
  } catch (err) {
    console.warn('Error during Gemini vision extraction, falling back to local OCR:', err);
    return null;
  }
}
