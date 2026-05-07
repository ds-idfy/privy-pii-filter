import type { EntitySpan } from "../hooks/usePiiWorker";

export type TextPart =
  | { type: "plain"; text: string }
  | { type: "entity"; span: EntitySpan };

export const ENTITY_LABEL_MAP: Record<string, string> = {
  EMAIL: "private_email",
  PHONE: "private_phone",
  PERSON: "private_name",
  NAME: "private_name",
  LOC: "private_location",
  LOCATION: "private_location",
  ORG: "private_org",
  DATE: "private_date",
  CREDIT_CARD: "private_cc",
  SSN: "private_ssn",
  IP: "private_ip",
  URL: "private_url",
};

export function buildParts(text: string, spans: EntitySpan[]): TextPart[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const parts: TextPart[] = [];
  let cursor = 0;
  for (const span of sorted) {
    if (span.start > cursor) parts.push({ type: "plain", text: text.slice(cursor, span.start) });
    parts.push({ type: "entity", span });
    cursor = span.end;
  }
  if (cursor < text.length) parts.push({ type: "plain", text: text.slice(cursor) });
  return parts;
}