/** Per-site extra form fields: which apply to a service, and validation. */
import type { FieldDef, FieldValue, Service } from "./types.js";

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;
export const PHONE_RE = /^[+\d][\d\s.()-]{5,24}$/;

export function fieldsFor(fields: FieldDef[], service: Pick<Service, "id" | "categoryId">): FieldDef[] {
  return fields.filter((f) => {
    if (f.serviceIds?.length && !f.serviceIds.includes(service.id)) return false;
    if (f.categoryIds?.length && !(service.categoryId && f.categoryIds.includes(service.categoryId))) return false;
    return true;
  });
}

/**
 * Cleans the submitted values of the fields that apply. Returns the cleaned
 * values and the ids of invalid fields; unknown keys are dropped.
 */
export function validateFields(defs: FieldDef[], input: Record<string, unknown>) {
  const values: Record<string, FieldValue> = {};
  const invalid: string[] = [];

  for (const f of defs) {
    const raw = input[f.id];
    if (f.type === "checkbox") {
      const v = raw === true;
      if (f.required && !v) invalid.push(f.id);
      values[f.id] = v;
      continue;
    }
    if (f.type === "number") {
      const empty = raw === undefined || raw === null || raw === "";
      const n = empty ? NaN : Number(raw);
      if (empty) {
        if (f.required) invalid.push(f.id);
        continue;
      }
      if (!Number.isFinite(n) || (f.min !== undefined && n < f.min) || (f.max !== undefined && n > f.max)) invalid.push(f.id);
      else values[f.id] = n;
      continue;
    }

    const s = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw) : "";
    if (!s) {
      if (f.required) invalid.push(f.id);
      continue;
    }
    const maxLength = f.maxLength ?? (f.type === "textarea" ? 2000 : 200);
    let ok = s.length <= maxLength;
    if (f.type === "select") ok &&= !!f.options?.some((o) => o.value === s);
    if (f.type === "email") ok &&= EMAIL_RE.test(s);
    if (f.type === "tel") ok &&= PHONE_RE.test(s);
    if (f.type === "date") ok &&= /^\d{4}-\d{2}-\d{2}$/.test(s);
    if (ok) values[f.id] = s;
    else invalid.push(f.id);
  }
  return { values, invalid };
}
