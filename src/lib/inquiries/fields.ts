export type MappedInquiry = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  product: string | null;
  quantity: string | null;
  message: string | null;
  pageUrl: string | null;
  customFields: Record<string, string>;
  rawPayload: Record<string, string>;
};

const ALIASES = {
  name: ["name", "full_name"],
  company: ["company", "company_name", "firm"],
  email: ["email", "mail"],
  phone: ["phone", "tel", "mobile", "whatsapp"],
  country: ["country", "region"],
  product: ["product", "sku", "item", "model"],
  quantity: ["quantity", "qty", "amount"],
  message: ["message", "comment", "content", "enquiry"],
  pageUrl: ["page_url", "referrer", "_page"],
} as const;

const SECRET_KEYS = new Set(["access_key", "_access_key", "cf-turnstile-response"]);

const RESERVED = new Set<string>([
  ...SECRET_KEYS,
  "_hp",
  "_honey",
  "_gotcha",
  "_redirect",
  "_next",
  "_opened_at",
  "redirect",
  ...Object.values(ALIASES).flat(),
]);

const LIMITS: Record<keyof Omit<MappedInquiry, "customFields" | "rawPayload">, number> = {
  name: 200,
  company: 200,
  email: 320,
  phone: 80,
  country: 80,
  product: 200,
  quantity: 40,
  message: 8000,
  pageUrl: 2000,
};

export function lowerKeys(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value !== "string") continue;
    out[key.trim().toLowerCase()] = value;
  }
  return out;
}

export function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function first(fields: Record<string, string>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = clip(fields[key], 8000);
    if (value) return value;
  }
  return null;
}

export function honeypotValue(fields: Record<string, string>): string {
  const lower = lowerKeys(fields);
  for (const key of ["_hp", "_honey", "_gotcha"]) {
    const value = (lower[key] ?? "").trim();
    if (value) return value.slice(0, 500);
  }
  return "";
}

export function parseOpenedAt(fields: Record<string, string>): number | null {
  const raw = lowerKeys(fields)._opened_at?.trim();
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  const clipped = clip(value, 2000);
  if (!clipped) return null;
  try {
    const url = new URL(clipped);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function redirectFromFields(fields: Record<string, string>): string | null {
  const lower = lowerKeys(fields);
  return safeHttpUrl(lower._redirect || lower._next || null);
}

export function mapFields(fields: Record<string, string>): MappedInquiry {
  const lower = lowerKeys(fields);
  const mapped: MappedInquiry = {
    name: clip(first(lower, ALIASES.name), LIMITS.name),
    company: clip(first(lower, ALIASES.company), LIMITS.company),
    email: clip(first(lower, ALIASES.email), LIMITS.email),
    phone: clip(first(lower, ALIASES.phone), LIMITS.phone),
    country: clip(first(lower, ALIASES.country), LIMITS.country),
    product: clip(first(lower, ALIASES.product), LIMITS.product),
    quantity: clip(first(lower, ALIASES.quantity), LIMITS.quantity),
    message: clip(first(lower, ALIASES.message), LIMITS.message),
    pageUrl: safeHttpUrl(first(lower, ALIASES.pageUrl)),
    customFields: {},
    rawPayload: {},
  };

  const whatsapp = clip(lower.whatsapp, LIMITS.phone);
  if (whatsapp && whatsapp !== mapped.phone) {
    mapped.customFields.whatsapp = whatsapp;
  }

  let customCount = Object.keys(mapped.customFields).length;
  for (const [key, value] of Object.entries(lower)) {
    if (RESERVED.has(key) || key.startsWith("_")) continue;
    const clipped = clip(value, 2000);
    if (!clipped || customCount >= 40) continue;
    mapped.customFields[key.slice(0, 80)] = clipped;
    customCount += 1;
  }

  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEYS.has(key.trim().toLowerCase())) continue;
    const clipped = clip(value, 4000);
    if (clipped) mapped.rawPayload[key.slice(0, 80)] = clipped;
  }

  return mapped;
}

export function hasReachableContact(mapped: MappedInquiry): boolean {
  return Boolean(mapped.email || mapped.phone || mapped.message);
}
