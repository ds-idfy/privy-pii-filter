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

export function buildParts(text: string, spans: EntitySpan[]): TextPart[] {
  if (!spans.length) return [{ type: "plain", text }];

  type Located = { start: number; end: number; span: EntitySpan; displayLabel: string };
  const located: Located[] = [];
  const used = new Set<number>();

  for (const span of spans) {
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
            start: idx,
            end,
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
