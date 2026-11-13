export function appUrl() {
  return (process.env.APP_URL || "http://127.0.0.1:47281").replace(/\/$/, "");
}

export function rateLimitPerMinute() {
  const value = Number(process.env.RATE_LIMIT_PER_MINUTE || 20);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

export function mailMode(): "resend" | "console" {
  if (process.env.MAIL_PROVIDER === "console") return "console";
  if (process.env.MAIL_PROVIDER === "resend" || process.env.RESEND_API_KEY) return "resend";
  if (process.env.NODE_ENV === "production") return "resend";
  return "console";
}

export function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeDomain(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    if (url.hostname === "localhost" || url.hostname.includes(".")) return url.hostname;
  } catch {
    return null;
  }
  return null;
}
