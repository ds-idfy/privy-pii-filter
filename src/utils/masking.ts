import type { EntitySpan } from "../hooks/usePiiWorker";

export type TextPart =
  | { type: "plain"; text: string }
  | { type: "entity"; span: EntitySpan; displayLabel: string };

// Model labels → display labels
export const ENTITY_LABEL_MAP: Record<string, string> = {
  // Model output labels
  private_person:  "private_name",
  private_email:   "private_email",
  private_phone:   "private_phone",
  account_number:  "private_account",
  private_url:     "private_url",
  private_date:    "private_date",
  private_org:     "private_org",
  private_loc:     "private_location",
  // Indian PII (regex layer)
  aadhaar:         "private_aadhaar",
  pan:             "private_pan",
  indian_phone:    "private_phone",
  voter_id:        "private_voter_id",
  passport:        "private_passport",
  upi:             "private_upi",
  driving_licence: "private_dl",
  gstin:           "private_gstin",
  bank_account:    "private_bank_account",
  ifsc:            "private_ifsc",
  vehicle_reg:     "private_vehicle",
  // Unknown model labels
  secret:          "private_secret",
};

// ── Indian PII regex patterns ─────────────────────────────────────────────────
const INDIAN_PATTERNS: Array<{ type: string; re: RegExp }> = [
  // Email — catch all emails the model misses
  { type: "private_email",   re: /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g },
  // Aadhaar: 12 digits with optional spaces/dashes (xxxx xxxx xxxx or xxxx-xxxx-xxxx)
  { type: "aadhaar",         re: /\b\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/g },
  // PAN: ABCDE1234F
  { type: "pan",             re: /\b[A-Z]{5}\d{4}[A-Z]\b/g },
  // Indian mobile: +91, (91), 091, 91- prefix OR standalone 10-digit starting 6-9
  { type: "indian_phone",    re: /(?:(?:\+91|91|0091)[\s\-]?|(?:\(91\))[\s\-]?)[6-9]\d{4}[\s\-]?\d{5}\b|\b[6-9]\d{4}[\s\-]?\d{5}\b/g },
  // Voter ID: 3 letters + 7 digits
  { type: "voter_id",        re: /\b[A-Z]{3}\d{7}\b/g },
  // Indian Passport: letter + 7 digits
  { type: "passport",        re: /\b[A-PR-WY][1-9]\d{6}\b/g },
  // UPI ID: identifier@provider
  { type: "upi",             re: /\b[\w.\-]+@(?:okaxis|oksbi|okicici|okhdfcbank|ybl|upi|paytm|apl|ibl|icici|kotak|axisbank|sbi|hdfcbank|indus|rbl|federal|gpay|phonepe)\b/gi },
  // Driving licence: state code (2 letters) + 2 digits + space/- + up to 11 digits
  { type: "driving_licence", re: /\b[A-Z]{2}\d{2}[\s\-]?\d{4,11}\b/g },
  // GSTIN: 15-char format
  { type: "gstin",           re: /\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/g },
  // Bank account: 11-18 digits preceded by keyword
  { type: "bank_account",    re: /(?:account|acc|a\/c|acct)\s*(?:no\.?|number|#)?\s*:?\s*(\d{11,18})\b/gi },
  // IFSC: 4 letters + 0 + 6 alphanumeric
  { type: "ifsc",            re: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g },
  // Vehicle registration: state(2) + district(2) + series(1-2) + number(4)
  { type: "vehicle_reg",     re: /\b[A-Z]{2}\d{2}[A-Z]{1,2}\d{4}\b/g },
];

// Run Indian regex patterns on text, return synthetic EntitySpan array
function detectIndianPII(text: string): EntitySpan[] {
  const spans: EntitySpan[] = [];
  const covered = new Set<number>();

  for (const { type, re } of INDIAN_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      // For bank_account, the capture group is group 1
      const word = type === "bank_account" ? (m[1] ?? m[0]) : m[0];
      const start = type === "bank_account" ? (m.index + m[0].indexOf(m[1] ?? m[0])) : m.index;
      const end = start + word.length;

      let overlap = false;
      for (let i = start; i < end; i++) {
        if (covered.has(i)) { overlap = true; break; }
      }
      if (overlap) continue;

      for (let i = start; i < end; i++) covered.add(i);
      spans.push({ word, entity_group: type, score: 1, start, end });
    }
  }

  return spans;
}

// ── buildParts — merge model spans + Indian regex spans ───────────────────────
export function buildParts(text: string, modelSpans: EntitySpan[]): TextPart[] {
  // Detect Indian PII via regex
  const indianSpans = detectIndianPII(text);

  // Merge all spans, locate model spans by word search (model has no offsets)
  type Located = { start: number; end: number; span: EntitySpan; displayLabel: string };
  const located: Located[] = [];
  const used = new Set<number>();

  // First: place Indian regex spans (they have exact positions)
  for (const span of indianSpans) {
    for (let i = span.start; i < span.end; i++) used.add(i);
    located.push({
      start: span.start,
      end: span.end,
      span,
      displayLabel: ENTITY_LABEL_MAP[span.entity_group] ?? span.entity_group,
    });
  }

  // Second: locate model spans by word search
  for (const span of modelSpans) {
    const candidates = [span.word, span.word.trimStart(), span.word.trim()];
    let found = false;

    for (const candidate of candidates) {
      if (!candidate) continue;
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const idx = text.indexOf(candidate, searchFrom);
        if (idx === -1) break;

        let overlap = false;
        for (let i = idx; i < idx + candidate.length; i++) {
          if (used.has(i)) { overlap = true; break; }
        }
        if (!overlap) {
          const end = idx + candidate.length;
          for (let i = idx; i < end; i++) used.add(i);
          located.push({
            start: idx, end,
            span,
            displayLabel: ENTITY_LABEL_MAP[span.entity_group] ?? span.entity_group,
          });
          found = true;
          break;
        }
        searchFrom = idx + 1;
      }
      if (found) break;
    }
  }

  if (!located.length) return [{ type: "plain", text }];

  located.sort((a, b) => a.start - b.start);

  const parts: TextPart[] = [];
  let cursor = 0;
  for (const loc of located) {
    if (loc.start > cursor) parts.push({ type: "plain", text: text.slice(cursor, loc.start) });
    parts.push({ type: "entity", span: loc.span, displayLabel: loc.displayLabel });
    cursor = loc.end;
  }
  if (cursor < text.length) parts.push({ type: "plain", text: text.slice(cursor) });

  return parts;
}