import type { EntitySpan } from "../hooks/usePiiWorker";

export type TextPart =
  | { type: "plain"; text: string }
  | { type: "entity"; span: EntitySpan; displayLabel: string };

export const ENTITY_LABEL_MAP: Record<string, string> = {
  private_person:  "private_name",
  private_email:   "private_email",
  private_phone:   "private_phone",
  account_number:  "private_account",
  private_url:     "private_url",
  private_date:    "private_date",
  private_org:     "private_org",
  private_loc:     "private_location",
  PERSON:          "private_name",
  EMAIL:           "private_email",
  PHONE:           "private_phone",
  LOC:             "private_location",
  ORG:             "private_org",
  DATE:            "private_date",
  IP:              "private_ip",
  URL:             "private_url",
};

// Build parts by searching for each entity's word in the original text
export function buildParts(text: string, spans: EntitySpan[]): TextPart[] {
  if (!spans.length) return [{ type: "plain", text }];

  // For each span, find its position in the text by searching for the word
  type Located = { start: number; end: number; span: EntitySpan; displayLabel: string };
  const located: Located[] = [];
  const used = new Set<number>();

  for (const span of spans) {
    const word = span.word.trimStart(); // model sometimes prepends a space
    const wordWithSpace = span.word; // try with leading space too
    let idx = -1;

    // Try exact match first, then trimmed
    for (const candidate of [wordWithSpace, word]) {
      let searchFrom = 0;
      while (searchFrom < text.length) {
        const found = text.indexOf(candidate, searchFrom);
        if (found === -1) break;
        // Check this position isn't already used
        if (!used.has(found)) {
          idx = found;
          break;
        }
        searchFrom = found + 1;
      }
      if (idx !== -1) break;
    }

    if (idx === -1) continue; // couldn't locate, skip

    const actualWord = text.slice(idx, idx + (span.word.trimStart() === span.word ? span.word.length : span.word.trimStart().length));
    const end = idx + actualWord.length;

    // Mark all positions as used
    for (let i = idx; i < end; i++) used.add(i);

    located.push({
      start: idx,
      end,
      span,
      displayLabel: ENTITY_LABEL_MAP[span.entity_group] ?? span.entity_group,
    });
  }

  // Sort by position
  located.sort((a, b) => a.start - b.start);

  // Build final parts
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const loc of located) {
    if (loc.start > cursor) {
      parts.push({ type: "plain", text: text.slice(cursor, loc.start) });
    }
    parts.push({ type: "entity", span: loc.span, displayLabel: loc.displayLabel });
    cursor = loc.end;
  }
  if (cursor < text.length) {
    parts.push({ type: "plain", text: text.slice(cursor) });
  }

  return parts;
}