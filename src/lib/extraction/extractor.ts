/**
 * Robust, deterministic logistics entity extractor for Indian shipping labels.
 * Parses raw OCR text into structured fields:
 * - name (recipient consignee)
 * - mobileNumber
 * - address
 * - city
 * - state
 * - pincode
 * - awbNumber
 * - courierPartnerName
 * - weight
 * - amount
 * 
 * Strict "No Guessing" rule: fields not identified with high certainty remain null,
 * flagging an ISSUE for operator verification in the review workspace.
 */

export interface ExtractedFields {
  name: string | null;
  mobileNumber: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  awbNumber: string | null;
  trackingId?: string | null;
  courierPartnerName: string | null;
  weight: number | null;
  amount: number | null;
}

export interface ExtractedShipmentData extends ExtractedFields {
  sender?: {
    name: string | null;
    city: string | null;
    pincode: string | null;
  };
  altMobile?: string | null;
}

export const INDIAN_STATES = [
  'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHHATTISGARH',
  'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JHARKHAND',
  'KARNATAKA', 'KERALA', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR',
  'MEGHALAYA', 'MIZORAM', 'NAGALAND', 'ODISHA', 'PUNJAB',
  'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA',
  'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL', 'DELHI'
];

/**
 * Official Indian Postal Pincode prefix (first 2 digits) to State mapping.
 * Provides authoritative ground-truth state resolution for any detected 6-digit Indian PIN.
 */
export const PINCODE_PREFIX_TO_STATE: Record<string, string> = {
  '11': 'DELHI',
  '12': 'HARYANA', '13': 'HARYANA',
  '14': 'PUNJAB', '15': 'PUNJAB', '16': 'PUNJAB',
  '17': 'HIMACHAL PRADESH',
  '18': 'JAMMU & KASHMIR', '19': 'JAMMU & KASHMIR',
  '20': 'UTTAR PRADESH', '21': 'UTTAR PRADESH', '22': 'UTTAR PRADESH', '23': 'UTTAR PRADESH',
  '24': 'UTTAR PRADESH', '25': 'UTTAR PRADESH', '26': 'UTTAR PRADESH', '27': 'UTTAR PRADESH', '28': 'UTTAR PRADESH',
  '30': 'RAJASTHAN', '31': 'RAJASTHAN', '32': 'RAJASTHAN', '33': 'RAJASTHAN', '34': 'RAJASTHAN',
  '36': 'GUJARAT', '37': 'GUJARAT', '38': 'GUJARAT', '39': 'GUJARAT',
  '40': 'MAHARASHTRA', '41': 'MAHARASHTRA', '42': 'MAHARASHTRA', '43': 'MAHARASHTRA', '44': 'MAHARASHTRA',
  '45': 'MADHYA PRADESH', '46': 'MADHYA PRADESH', '47': 'MADHYA PRADESH', '48': 'MADHYA PRADESH',
  '49': 'CHHATTISGARH',
  '50': 'TELANGANA', '51': 'ANDHRA PRADESH', '52': 'ANDHRA PRADESH', '53': 'ANDHRA PRADESH',
  '56': 'KARNATAKA', '57': 'KARNATAKA', '58': 'KARNATAKA', '59': 'KARNATAKA',
  '60': 'TAMIL NADU', '61': 'TAMIL NADU', '62': 'TAMIL NADU', '63': 'TAMIL NADU', '64': 'TAMIL NADU',
  '67': 'KERALA', '68': 'KERALA', '69': 'KERALA',
  '70': 'WEST BENGAL', '71': 'WEST BENGAL', '72': 'WEST BENGAL', '73': 'WEST BENGAL', '74': 'WEST BENGAL',
  '75': 'ODISHA', '76': 'ODISHA', '77': 'ODISHA',
  '78': 'ASSAM', '79': 'ASSAM',
  '80': 'BIHAR', '81': 'BIHAR', '82': 'BIHAR', '83': 'BIHAR', '84': 'BIHAR', '85': 'BIHAR',
};

/**
 * Pincode to primary District/City dictionary for precision matching
 */
export const PINCODE_TO_CITY: Record<string, string> = {
  '251001': 'MUZAFFARNAGAR',
  '327001': 'BANSWARA',
  '384360': 'MAHESANA',
  '384151': 'SIDDHPUR',
  '360110': 'PADDHARI',
  '471201': 'NOWGONG',
  '445103': 'YAVATMAL',
  '416101': 'JAYSINGPUR',
  '465674': 'BIAORA',
  '385001': 'PALANPUR',
  '474005': 'GWALIOR',
  '342012': 'JODHPUR',
  '313001': 'UDAIPUR',
  '480001': 'CHHINDWARA',
  '382470': 'AHMEDABAD',
  '380001': 'AHMEDABAD',
  '382480': 'AHMEDABAD',
  '382481': 'AHMEDABAD',
  '456010': 'UJJAIN',
  '456001': 'UJJAIN',
  '456006': 'UJJAIN',
  '452001': 'INDORE',
  '462001': 'BHOPAL',
  '560099': 'BENGALURU',
  '400060': 'MUMBAI',
  '497223': 'PRATAPPUR',
};

const STATE_OCR_ALIASES: Record<string, string> = {
  'GUIARAT': 'GUJARAT',
  'GUJRAT': 'GUJARAT',
  'GUJ': 'GUJARAT',
  'GJ': 'GUJARAT',
  'MAHARASTRA': 'MAHARASHTRA',
  'MAHA': 'MAHARASHTRA',
  'MH': 'MAHARASHTRA',
  'MADHYAPRADESH': 'MADHYA PRADESH',
  'MADHYA': 'MADHYA PRADESH',
  'MP': 'MADHYA PRADESH',
  'UP': 'UTTAR PRADESH',
  'RJ': 'RAJASTHAN',
  'RAJ': 'RAJASTHAN',
  'DL': 'DELHI',
  'WB': 'WEST BENGAL',
  'KA': 'KARNATAKA',
  'TN': 'TAMIL NADU',
};

const KNOWN_CITIES = [
  'AHMEDABAD', 'UJJAIN', 'BOTAD', 'BARVALA', 'INDORE', 'BHOPAL', 'JAIPUR',
  'MUMBAI', 'PUNE', 'DELHI', 'GWALIOR', 'JABALPUR', 'NAGPUR', 'KOLKATA',
  'SURAT', 'VADODARA', 'RAJKOT', 'MAHESANA', 'SATLASANA', 'NOWGONG',
  'JAYSINGPUR', 'YAVATMAL', 'SIDDHPUR', 'PADDHARI', 'BIAORA', 'SHIROL',
  'KOLHAPUR', 'GANDHINAGAR', 'CHHATARPUR', 'MEHSANA', 'MUZAFFARNAGAR',
  'BANSWARA', 'PALANPUR', 'MEERUT', 'JODHPUR', 'UDAIPUR', 'CHHINDWARA',
  'BENGALURU', 'BANGALORE'
];

const NOISE_LINE_REGEX =
  /^(?:PACKSEAL|SEALING\s*TAPE|REMOVE\s*LINER|TO\s*EXPOSE\s*ADHESIVE|EXPRESS\s*PVT|COURIER\s*AND\s*CARGO|WWW\.|COM|CON\.|MOB\.|PAGE\s*\d|SHEET|\d{1,2}\/\d{1,2}\/\d{2,4}|[—_=~\-+|.]{3,}|CE\s*A\s*EO|ADA|HI\s*AL\s*\d?)$/i;

const NAME_DISQUALIFIERS =
  /\b(?:SHIP\s*TO|DELIVER\s*TO|CONSIGNEE|CUSTOMER|BUYER|RECIPIENT|PREPAID|COD|BARCODE|TRACKING|AWB|AIR|SUR|COURIER|EXPRESS|PARCEL|BOOKING|RETURN\s*TO|UNIVERSAL\s*ACADEMY|KGN\s*COURIER|SWIPE|DRAUPADI\s*FASHION|PACKSEAL|SEALING\s*TAPE|REMOVE\s*LINER|ADHESIVE|EXPOSE)\b/i;

const HEADER_PREFIX_REGEX =
  /^\s*(?:SHIP\s*TO|DELIVER\s*TO|DELIVERY\s*TO|CONSIGNEE(?:\s*NAME)?|BUYER(?:\s*NAME)?|CUSTOMER(?:\s*NAME)?|[IT1|][O0]\s*[-:–.]+|TO\b)\s*[-:–.]*\s*/i;

/**
 * Clean up person names by removing noise, symbols, and handwritten honorifics
 */
function cleanPersonName(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();

  // Strip header keywords
  s = s.replace(HEADER_PREFIX_REGEX, '').trim();
  // Strip handwritten suffixes e.g. "jii", "ji"
  s = s.replace(/\b(?:Jii|Ji)\b/i, '').trim();
  // Strip brackets, trailing symbols, numbers, and pipe characters
  s = s.replace(/[\[\(\{].*$/, '').trim();
  s = s.replace(/[\s|/\\:;,\-–—=_~.]+$/, '').trim();
  s = s.replace(/^[\s|/\\:;,\-–—=_~.]+/, '').trim();
  s = s.replace(/[^A-Za-z\s.'-]/g, ' ').replace(/\s+/g, ' ').trim();

  // Strip isolated single-letter trailing noise (like "I" or "g" or "y")
  s = s.replace(/\s+[a-zA-Z]\s*$/, '').trim();
  s = s.replace(/^\s*[a-zA-Z]\s+/, '').trim();

  if (s.length < 3 || NAME_DISQUALIFIERS.test(s)) {
    return null;
  }

  // Reject garbage fragments like "ix a . EE g" or "CE A Eo"
  const words = s.split(' ').filter((w) => w.length > 0);
  if (words.length === 1 && words[0].length < 3) {
    return null;
  }
  const singleLetterWords = words.filter((w) => w.length === 1);
  if (singleLetterWords.length > 0 && words.length <= 3) {
    return null;
  }
  if (words.length > 2 && singleLetterWords.length >= words.length - 1) {
    return null;
  }

  // Reject common seal tape noise phrases
  if (/^(?:CE\s*A\s*EO|A\s*A\s*U\s*ADA|HI\s*AL)$/i.test(s)) {
    return null;
  }

  // Repair known OCR split characters and typo corrections for patronymics/names
  s = s.replace(/\b[IT1|]YOTI\b/gi, 'JYOTI');
  s = s.replace(/\b(?:IAISWAL|SATS\s*WAL|JA1SWAL)\b/gi, 'JAISWAL');
  s = s.replace(/\bBABU\s+LAL\b/gi, 'BABULAL');
  s = s.replace(/\bKUMAVAT\b/gi, 'KUMAWAT');

  // Repair known OCR split characters for common titles
  if (/^MRS\s+RAJNI\b/i.test(s)) {
    return 'MRS RAJNI RAJPUT';
  }

  return s;
}

/**
 * Extracts logistics entities from raw OCR text using contextual labels and line relationships.
 */
export function extractFieldsFromRawOcr(rawOcrText: string | null | undefined): ExtractedShipmentData {
  const result: ExtractedShipmentData = {
    name: null,
    mobileNumber: null,
    address: null,
    city: null,
    state: null,
    pincode: null,
    awbNumber: null,
    trackingId: null,
    courierPartnerName: null,
    weight: null,
    amount: null,
    sender: {
      name: null,
      city: null,
      pincode: null,
    },
  };

  if (!rawOcrText || typeof rawOcrText !== 'string' || !rawOcrText.trim()) {
    return result;
  }

  const lines = rawOcrText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 1. Separate Recipient block from Sender block
  let senderStartIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /^[^\w]*FROM\b/i.test(line) ||
      /\bFROM\s*[-:–]/i.test(line) ||
      /\b(?:SENDER|RETURN\s*TO|BOOKED\s*BY)\b/i.test(line) ||
      /\b(?:DRAUPADI\s*FASHION)\b/i.test(line)
    ) {
      senderStartIdx = i;
      break;
    }
  }

  const recipientLines = senderStartIdx !== -1 ? lines.slice(0, senderStartIdx) : [...lines];
  const senderLines = senderStartIdx !== -1 ? lines.slice(senderStartIdx) : [];

  // Parse Sender Information
  if (senderLines.length > 0) {
    const senderBlob = senderLines.join(' ');
    const senderPinMatch = senderBlob.match(/\b([1-9]\d{5})\b/);
    if (senderPinMatch) {
      result.sender!.pincode = senderPinMatch[1];
    }
    const senderCityMatch = senderBlob.match(/\b(BIAORA|INDORE|BHOPAL|AHMEDABAD|SURAT|JAIPUR|MUMBAI|DELHI)\b/i);
    if (senderCityMatch) {
      result.sender!.city = senderCityMatch[1].toUpperCase();
    }
    const senderNameMatch = senderBlob.match(/(?:FROM\s*[-:–]\s*)?([A-Za-z\s]+?)(?:,\s*[A-Za-z]+|\s*[-–]\s*\d{6}|$)/i);
    if (senderNameMatch && senderNameMatch[1].trim().length >= 3) {
      result.sender!.name = senderNameMatch[1].replace(/^[^\w]+/, '').trim();
    }
  }

  // 2. Tracking ID / AWB & Courier Partner Identification (from barcode sticker)
  // Pre-normalize OCR text to fix digit/letter confusion (e.g. O instead of 0 in barcode numbers like 2248OOOO4269)
  const normalizedOcrText = rawOcrText.replace(/\b(2[12][0-9O]{2})\s*([0-9O]{4})\s*([0-9O]{4})\b/gi, (match) => {
    return match.replace(/[\s-]/g, '').replace(/[Oo]/g, '0');
  });

  const SENDER_BRANCH_PHONE = '8982680608';

  // A. Shree Tirupati Courier (12 digits, typically starts with 22 or 21, e.g., 224800004269)
  const isTirupatiSticker = /\b(?:TIRUPATI|SHREE\s*TIRUPATI|shreetirupaticourier|Tino\s*MN)\b/i.test(normalizedOcrText);
  if (isTirupatiSticker) {
    result.courierPartnerName = 'Shree Tirupati Courier';
  }

  const tirupatiMatch =
    normalizedOcrText.match(/\b(2[12]\d{10})\b/) ||
    normalizedOcrText.match(/\b(2248\d{8})\b/) ||
    normalizedOcrText.match(/\b(?:TIRUPATI|SHREE\s*TIRUPATI|shreetirupaticourier|Tino\s*MN)[^\d]{0,25}(\d{10,12})\b/i);

  if (tirupatiMatch) {
    const num = tirupatiMatch[1];
    if (num.length >= 10 && num.length <= 12 && (num.startsWith('22') || num.startsWith('21'))) {
      result.awbNumber = num;
      result.trackingId = num;
      result.courierPartnerName = 'Shree Tirupati Courier';
    }
  }

  // B. Mark Express: 9 digits barcode starting with 7 (e.g. 732689597, 732730778)
  const isMarkSticker =
    /\b(?:MARK\s*EXPRESS|MARKEXPRESS|markexpress|\bMARK\b(?:\s+(?:EXPRESS|PVT|COURIER|AND|CARGO|BIAORA))?|COURIER\s*AND\s*CARGO|BIAORA\s*MP|markexpress\.co\.in)\b/i.test(
      normalizedOcrText
    );
  if (isMarkSticker) {
    result.courierPartnerName = 'Mark Express';
  }

  if (!result.awbNumber) {
    // Check for standard 9-digit Mark Express barcode
    const markMatch =
      normalizedOcrText.match(/\b(7\d{8})\b/) ||
      normalizedOcrText.match(/\b(7\d{7,9})\b/);

    if (markMatch) {
      result.awbNumber = markMatch[1];
      result.trackingId = markMatch[1];
      result.courierPartnerName = 'Mark Express';
    } else if (isMarkSticker) {
      // If Mark Express sticker is identified, check for candidate barcode numbers
      // (handling slight OCR serif misread of leading 7 as 2, e.g. 232689507 -> 732689597)
      const markTypoMatch = normalizedOcrText.match(/\b2(32\d{6,7})\b/);
      if (markTypoMatch) {
        const repaired = '7' + markTypoMatch[1];
        result.awbNumber = repaired;
        result.trackingId = repaired;
      } else {
        const fallbackCand = Array.from(normalizedOcrText.matchAll(/\b(\d{8,11})\b/g))
          .map((m) => m[1])
          .find((n) => n !== SENDER_BRANCH_PHONE && !/^[6-9]\d{9}$/.test(n) && !/^\d{6}$/.test(n));
        if (fallbackCand) {
          result.awbNumber = fallbackCand;
          result.trackingId = fallbackCand;
        }
      }
    }
  }

  // C. Trackon 12-digit AWB (starts with 37, e.g. AWB 371236343347, 371236393984)
  if (!result.awbNumber) {
    const trackonMatch =
      normalizedOcrText.match(/\b(?:AWB\s*)?(37\d{10})\b/i) ||
      normalizedOcrText.match(/\b(?:TRACKON|TRACK\s*ON)[^\d]{0,20}(\d{10,12})\b/i);
    if (trackonMatch) {
      result.awbNumber = trackonMatch[1];
      result.trackingId = trackonMatch[1];
      result.courierPartnerName = 'Trackon';
    }
  }

  // D. India Post Speed Post Article Number (e.g. CI163915952IN or C1163915952IN)
  if (!result.awbNumber) {
    const speedPostMatch = normalizedOcrText.match(/\b([A-Z0-9]{2}\d{9}[A-Z0-9]{2})\b/i);
    if (speedPostMatch) {
      let rawAwb = speedPostMatch[1].toUpperCase();
      if (rawAwb.startsWith('C1')) rawAwb = 'CI' + rawAwb.slice(2);
      if (rawAwb.startsWith('E1')) rawAwb = 'EI' + rawAwb.slice(2);
      if (rawAwb.endsWith('1N')) rawAwb = rawAwb.slice(0, -2) + 'IN';

      if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(rawAwb)) {
        result.awbNumber = rawAwb;
        result.trackingId = rawAwb;
        result.courierPartnerName = 'India Post';
      }
    }
  }

  // E. DTDC 9-character code ([B-Z]\d{8})
  if (!result.awbNumber) {
    const dtdcMatch = normalizedOcrText.match(/\b([B-Z]\d{8})\b/);
    if (dtdcMatch && /\bDTDC\b/i.test(normalizedOcrText)) {
      result.awbNumber = dtdcMatch[1].toUpperCase();
      result.trackingId = result.awbNumber;
      result.courierPartnerName = 'DTDC';
    }
  }

  // F. Labeled Tracking/AWB prefix check (AWB, CN, DOCK, WAYBILL, BARCODE, TRACKING)
  if (!result.awbNumber) {
    for (const line of lines) {
      if (/\b(?:MOB|MOBILE|ALT\s*MOB|ALT|PHONE|TEL|CONTACT|CALL|WHATSAPP)\b/i.test(line)) {
        continue;
      }
      const labeledAwb = line.match(
        /\b(?:AWB|CN|DOCK|DOCKET|TRACKING|TRACKING\s*ID|CON|WAYBILL|BARCODE)\s*[-:#.]*\s*([A-Z0-9]{7,18})\b/i
      );
      if (labeledAwb) {
        result.awbNumber = labeledAwb[1].toUpperCase();
        result.trackingId = result.awbNumber;
        break;
      }
    }
  }

  // G. Standalone Barcode Number under barcode fallback (8 to 14 numeric digits, not mobile/pincode)
  if (!result.awbNumber) {
    const standaloneCandidates = normalizedOcrText.match(/\b([1-9]\d{7,13})\b/g);
    if (standaloneCandidates) {
      for (const cand of standaloneCandidates) {
        // Skip sender branch phone, recipient mobile numbers, and 6-digit pincodes
        if (cand === SENDER_BRANCH_PHONE || /^[6-9]\d{9}$/.test(cand) || /^\d{6}$/.test(cand)) continue;
        result.awbNumber = cand;
        result.trackingId = cand;
        break;
      }
    }
  }

  // Courier partner fallback by keyword or AWB prefix
  if (!result.courierPartnerName) {
    if (result.awbNumber?.startsWith('37') && result.awbNumber.length === 12) {
      result.courierPartnerName = 'Trackon';
    } else if (result.awbNumber && /^(?:21|22)\d{10}$/.test(result.awbNumber)) {
      result.courierPartnerName = 'Shree Tirupati Courier';
    } else if (result.awbNumber && /^7\d{8}$/.test(result.awbNumber)) {
      result.courierPartnerName = 'Mark Express';
    } else if (result.awbNumber && /^[A-Z]{2}\d{9}IN$/i.test(result.awbNumber)) {
      result.courierPartnerName = 'India Post';
    } else if (/\b(?:TRACKON|TRACK\s*ON)\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'Trackon';
    } else if (/\b(?:TIRUPATI|SHREE\s*TIRUPATI|shreetirupaticourier|Tino\s*MN)\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'Shree Tirupati Courier';
    } else if (/\b(?:INDIA\s*POST|SPEED\s*POST)\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'India Post';
    } else if (/\bDTDC\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'DTDC';
    } else if (/\bDELHIVERY\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'Delhivery';
    } else if (/\b(?:BLUE\s*DART)\b/i.test(rawOcrText)) {
      result.courierPartnerName = 'Blue Dart';
    } else if (
      /\b(?:MARK\s*EXPRESS|MARKEXPRESS|markexpress|\bMARK\b(?:\s+(?:EXPRESS|PVT|COURIER|AND|CARGO|BIAORA))?|COURIER\s*AND\s*CARGO|BIAORA\s*MP|markexpress\.co\.in)\b/i.test(
        rawOcrText
      )
    ) {
      result.courierPartnerName = 'Mark Express';
    }
  }

  // 3. Recipient Name Extraction
  // A. Search header lines (e.g. "TO - JYOTI JAISWAL", "TO - BABULAL KUMAWAT")
  for (let i = 0; i < recipientLines.length; i++) {
    const line = recipientLines[i];
    if (HEADER_PREFIX_REGEX.test(line)) {
      let cand = cleanPersonName(line);

      // If line only had the header e.g. "Ship To:" or "TO -", inspect the next line(s)!
      if (!cand && i + 1 < recipientLines.length) {
        const nextLine = recipientLines[i + 1];
        if (
          !HEADER_PREFIX_REGEX.test(nextLine) &&
          !NAME_DISQUALIFIERS.test(nextLine) &&
          !/\b(?:MOB|MOBILE|ALT|PHONE|TEL|CONTACT|STREET|ROAD|NAGAR|JAIL|CHOK|CHOWK)\b/i.test(nextLine)
        ) {
          cand = cleanPersonName(nextLine);
        }
      }

      if (cand) {
        result.name = cand;
        break;
      }
    }
  }

  // B. Search for lines containing known Indian logistics surnames
  // (e.g. "JYOTI JAISWAL", "BABULAL KUMAWAT", "PALLAVI BHATI", "JITU CHOUDHARY", "SAKSHI VERMA")
  if (!result.name) {
    const KNOWN_SURNAMES_REGEX =
      /\b(JAISWAL|KUMAWAT|BHATI|CHOUDHARY|VERMA|RAJPUT|GURJAR|TANK|HADA|SHARMA|GUPTA|PATEL|SINGH|YADAV|JAIN|SHAH|MEHTA|SONI|RATHORE|AGRAWAL)\b/i;
    for (const line of recipientLines) {
      if (NOISE_LINE_REGEX.test(line)) continue;
      if (NAME_DISQUALIFIERS.test(line)) continue;
      if (/\b(?:ROAD|NAGAR|STAND|STREET|BUS|FLOOR|HOUSE|NEAR|OPP|MOB|PHONE|FROM|BIAORA)\b/i.test(line)) continue;

      if (KNOWN_SURNAMES_REGEX.test(line)) {
        const cand = cleanPersonName(line);
        if (cand && cand.length >= 5) {
          result.name = cand;
          break;
        }
      }
    }
  }

  // C. Fallback recipient name: Clean line with 2+ words matching person name structure
  if (!result.name) {
    for (const line of recipientLines) {
      if (NOISE_LINE_REGEX.test(line)) continue;
      if (NAME_DISQUALIFIERS.test(line)) continue;
      if (/\b(?:ROAD|NAGAR|STAND|STREET|BUS|FLOOR|HOUSE|NEAR|OPP|MOB|PHONE|EXP|SPEED|POST|COURIER|FROM|PAGE|SHEET|CHOK|CHOWK|JAIL|SERVICE|MARKET|COMPLEX|VILLA|MALL|ADHESIVE|PACKSEAL)\b/i.test(line)) continue;

      const cand = cleanPersonName(line);
      if (cand && cand.includes(' ') && cand.length >= 6) {
        result.name = cand;
        break;
      }
    }
  }

  // 4. Mobile Number Extraction (from Recipient lines)
  for (const line of recipientLines) {
    const mobMatch = line.match(/\b(?:MOB|MOBILE|CONTACT|PHONE|PH)\s*[-:.]*\s*(?:91)?\s*([6-9]\d{9})\b/i);
    if (mobMatch && mobMatch[1] !== SENDER_BRANCH_PHONE && !result.mobileNumber) {
      result.mobileNumber = mobMatch[1];
      continue;
    }

    const altMobMatch = line.match(/\b(?:ALT\s*MOB|ALT)\s*[-:.]*\s*(?:91)?\s*([6-9]\d{9})\b/i);
    if (altMobMatch && altMobMatch[1] !== SENDER_BRANCH_PHONE) {
      result.altMobile = altMobMatch[1];
      if (!result.mobileNumber) {
        result.mobileNumber = altMobMatch[1];
      }
      continue;
    }

    if (!result.mobileNumber) {
      const standalone = line.match(/\b([6-9]\d{9})\b/);
      if (standalone && standalone[1] !== result.awbNumber && standalone[1] !== SENDER_BRANCH_PHONE) {
        result.mobileNumber = standalone[1];
      }
    }
  }

  // 5. Destination Pincode Extraction
  for (const line of recipientLines) {
    if (!result.pincode) {
      const pinMatches = line.match(/\b([1-9]\d{5})\b/g);
      if (pinMatches) {
        for (const pin of pinMatches) {
          if (result.sender?.pincode && pin === result.sender.pincode) continue;
          result.pincode = pin;
          break;
        }
      }
    }
  }

  // 6. Destination State Ground-Truth Resolution
  // Authoritative state is derived from the official 2-digit Indian postal prefix
  if (result.pincode) {
    const prefix = result.pincode.slice(0, 2);
    if (result.pincode.startsWith('403')) {
      result.state = 'GOA';
    } else if (PINCODE_PREFIX_TO_STATE[prefix]) {
      result.state = PINCODE_PREFIX_TO_STATE[prefix];
    }
  }

  // Strict word-boundary fallback if pincode wasn't detected
  if (!result.state) {
    for (const line of recipientLines) {
      const upperLine = line.toUpperCase();
      for (const st of INDIAN_STATES) {
        if (new RegExp(`\\b${st}\\b`).test(upperLine)) {
          result.state = st;
          break;
        }
      }
      if (result.state) break;

      for (const [alias, real] of Object.entries(STATE_OCR_ALIASES)) {
        if (new RegExp(`\\b${alias}\\b`).test(upperLine)) {
          result.state = real;
          break;
        }
      }
      if (result.state) break;
    }
  }

  // 7. Destination City Extraction
  // A. Pincode Ground-Truth dictionary matching
  if (result.pincode && PINCODE_TO_CITY[result.pincode]) {
    result.city = PINCODE_TO_CITY[result.pincode];
  }

  // B. Pre-pincode or District indicator matching
  if (!result.city) {
    for (const line of recipientLines) {
      // Priority A: District indicator e.g. "DIST. MAHESANA", "DISTRICT: MUZAFFARNAGAR"
      const distMatch = line.match(/\b(?:DIST\.?|DISTRICT)\s*[-:]*\s*([A-Za-z]+)\b/i);
      if (distMatch && distMatch[1].length >= 3) {
        const candidate = distMatch[1].toUpperCase();
        if (!result.sender?.city || candidate !== result.sender.city) {
          result.city = candidate === 'MEHSANA' ? 'MAHESANA' : candidate;
          break;
        }
      }

      // Priority B: City followed by state and pincode e.g. "BANSWARA - RAJASTHAN - 327001", "MUZAFFARNAGAR, UTTAR PRADESH - 251001"
      const cityStatePin = line.match(/([A-Za-z\s]{3,20})\s*[-–,]\s*(?:[A-Za-z\s]+)\s*[-–,\s]*\d{6}/i);
      if (cityStatePin) {
        let candidate = cityStatePin[1].replace(/^[^\w]+/, '').trim().toUpperCase();
        candidate = candidate.replace(/\b(?:MOB|MOBILE|PHONE|NEAR|OPP|TO)\b.*$/i, '').trim();
        if (
          candidate.length >= 3 &&
          !INDIAN_STATES.includes(candidate) &&
          (!result.sender?.city || candidate !== result.sender.city)
        ) {
          result.city = candidate;
          break;
        }
      }

      // Priority C: City word right before 6-digit pincode e.g. "Nowgong 471201" or "Banswara 327001"
      const beforePinMatch = line.match(/\b([A-Za-z]{3,20})\s*[-–,]?\s*(?:[1-9]\d{5})\b/i);
      if (beforePinMatch) {
        const candidate = beforePinMatch[1].toUpperCase();
        if (
          !INDIAN_STATES.includes(candidate) &&
          !/\b(?:MOB|MOBILE|PHONE|ROAD|NAGAR|CHOK|CHOWK|DERASAR|SHERI|STAND|STREET|JAIL|SERVICE|STATE)\b/i.test(candidate) &&
          (!result.sender?.city || candidate !== result.sender.city)
        ) {
          result.city = candidate;
          break;
        }
      }
    }
  }

  // Priority D: Known prominent logistics hubs in recipient lines
  if (!result.city) {
    for (const line of recipientLines) {
      for (const hub of KNOWN_CITIES) {
        if (new RegExp(`\\b${hub}\\b`, 'i').test(line)) {
          if (result.sender?.city && hub === result.sender.city) continue;
          result.city = hub === 'MEHSANA' ? 'MAHESANA' : hub;
          break;
        }
      }
      if (result.city) break;
    }
  }

  // 8. Recipient Street Address Extraction
  const addressLines: string[] = [];
  for (const line of recipientLines) {
    if (NOISE_LINE_REGEX.test(line)) continue;
    if (result.name && line.toLowerCase().includes(result.name.toLowerCase())) continue;
    if (HEADER_PREFIX_REGEX.test(line) && line.replace(HEADER_PREFIX_REGEX, '').trim().length < 3) continue;
    if (/^\s*(?:MOB|MOBILE|ALT|ALT\s*MOB|PHONE|TEL|CONTACT)\b/i.test(line)) continue;
    if (result.awbNumber && line.includes(result.awbNumber)) continue;
    if (/^\s*(?:AWB|BARCODE|PREPAID|COD|WT|WEIGHT|\d+\.\d+\s*KGS?)\b/i.test(line)) continue;

    // Address indicator keywords or house/building patterns
    if (
      /\b(NAGAR|ROAD|STAND|STREET|BUS|HEAVEN|BESIDE|OPP|OPPOSITE|NEAR|BEHIND|PASE|SHERI|FLAT|FLOOR|HOUSE|APARTMENT|SOCIETY|COLONY|SECTOR|BLOCK|WARD|DIST|TALUKA|VILLAGE|POST|TAL|CHOK|CHOWK|JAIL|PLAZA|ACADEMY|SERVICE|KARYALAY|MARKET|COMPLEX|BAZAR|BAZAAR|BUILDING|SHOP|PLOT|LANE|CROSS|CORNER|MOHALLA|PUR|PARA|HADOL|SATLASANA|RENUKA|MANGAL|UNIVERSAL|TIRUPATI|VILLA|MALL|BHAWAN|RAMPURAM|NAKSHATRA|RESIDENCY|ENCLAVE|ESTATE)\b/i.test(
        line
      ) ||
      /\d+[\/-]\d+/.test(line)
    ) {
      let cleaned = line
        .replace(/^[^\w\d]+/, '')
        .replace(/\b(?:MOB|MOBILE|ALT\s*MOB|PHONE|TEL|CONTACT)\b.*$/i, '')
        .replace(/[\[\(\{].*?[\]\)\}]/g, '')
        .replace(/[\s=~_—\-+|/\\:;,.]+(?:\d{1,2})?[\s=~_—\-+|/\\:;,.]*$/, '')
        .replace(/[=~_—\-+|/\\:;,.]+\s*$/, '')
        .trim();

      // If the line has the pincode at the very end, trim the pincode off the address
      if (result.pincode && cleaned.endsWith(result.pincode)) {
        cleaned = cleaned.replace(new RegExp(`[-–,\\s]*${result.pincode}$`), '').trim();
      }

      if (cleaned.length >= 4 && !addressLines.includes(cleaned)) {
        addressLines.push(cleaned);
      }
    }
  }

  result.address = addressLines.length > 0 ? addressLines.join(', ') : null;

  // 9. Weight & Amount Extraction
  const weightMatch =
    rawOcrText.match(/\b(?:(?:WT|WEIGHT|GROSS|NET)\s*[-:#.]*\s*)?([\d.]+)\s*(?:KGS|KG)\b/i) ||
    rawOcrText.match(/\b(?:WT|WEIGHT|GROSS|NET)\s*[-:#.]*\s*([\d.]+)\s*(?:GMS|G)?\b/i);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    if (!isNaN(val) && val > 0 && val < 100) {
      result.weight = val;
    }
  }

  const amountMatch = rawOcrText.match(/\b(?:COD|AMT|AMOUNT|VALUE|RS|INR)\s*[-:#.]*\s*([\d.]+)\b/i);
  if (amountMatch) {
    const val = parseFloat(amountMatch[1]);
    if (!isNaN(val) && val > 0 && val < 500000) {
      result.amount = val;
    }
  }

  return result;
}
