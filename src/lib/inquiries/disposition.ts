export type InquiryStatus = "received" | "review" | "discarded";

export type Disposition = {
  status: InquiryStatus;
  disposition: string;
};

const ATTACK_UA =
  /sqlmap|nikto|masscan|zgrab|nuclei|dirbuster|gobuster|acunetix|nessus/i;

const SPAM_COPY =
  /\b(viagra|cialis|casino|crypto airdrop|seo services?|buy backlinks?)\b/i;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
]);

export function decideDisposition(input: {
  honeypot: string;
  openedAt: number | null;
  now: number;
  userAgent: string;
  email: string | null;
  message: string | null;
}): Disposition {
  if (input.honeypot.trim()) {
    return { status: "discarded", disposition: "honeypot" };
  }
  if (ATTACK_UA.test(input.userAgent)) {
    return { status: "discarded", disposition: "bot_ua" };
  }
  if (isTooFast(input.openedAt, input.now)) {
    return { status: "review", disposition: "too_fast" };
  }
  if (isDisposable(input.email)) {
    return { status: "review", disposition: "disposable_email" };
  }
  if (input.message && SPAM_COPY.test(input.message)) {
    return { status: "review", disposition: "spam_copy" };
  }
  return { status: "received", disposition: "ok" };
}

function isTooFast(openedAt: number | null, now: number): boolean {
  if (openedAt == null) return false;
  const elapsed = now - openedAt;
  if (elapsed < -30_000 || elapsed > 24 * 60 * 60 * 1000) return false;
  return elapsed < 2_000;
}

function isDisposable(email: string | null): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return Boolean(domain && DISPOSABLE_DOMAINS.has(domain));
}
