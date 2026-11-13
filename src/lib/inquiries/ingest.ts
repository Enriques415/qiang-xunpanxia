import { decideDisposition, type Disposition } from "@/lib/inquiries/disposition";
import {
  hasReachableContact,
  honeypotValue,
  mapFields,
  parseOpenedAt,
  redirectFromFields,
  safeHttpUrl,
} from "@/lib/inquiries/fields";
import type { IngestStore } from "@/lib/inquiries/store";
import { sha256Hex } from "@/lib/secrets";
import { yearMonthShanghai } from "@/lib/time";

export const PUBLIC_ERRORS = {
  missingKey: "Missing access key.",
  invalidKey: "Invalid access key.",
  noContact: "Please include an email, phone, WhatsApp number, or a message.",
  rateLimit: "Too many submissions from this network. Please try again shortly.",
} as const;

export type TurnstileResult = "pass" | "fail" | "error";

export type IngestInput = {
  accessKey: string | null;
  fields: Record<string, string>;
  ip: string;
  userAgent: string;
  referer: string | null;
  now: Date;
  rateLimit: number;
  turnstileToken: string | null;
  checkTurnstile?: (secret: string, token: string | null, ip: string) => Promise<TurnstileResult>;
};

export type IngestResult =
  | {
      ok: true;
      status: 200;
      id: string;
      inquiryStatus: "received" | "review" | "discarded";
      redirectUrl: string | null;
      successMessage: string | null;
      notificationIds: string[];
      overQuota: boolean;
    }
  | { ok: false; status: 400 | 401 | 429; error: string };

export async function ingestInquiry(input: IngestInput, store: IngestStore): Promise<IngestResult> {
  const accessKey = input.accessKey?.trim() || "";
  if (!accessKey) {
    return { ok: false, status: 401, error: PUBLIC_ERRORS.missingKey };
  }
  if (accessKey.length > 200) {
    return { ok: false, status: 401, error: PUBLIC_ERRORS.invalidKey };
  }

  const keyHash = sha256Hex(accessKey);
  const site = await store.findByAccessKeyHash(keyHash);
  if (!site) {
    return { ok: false, status: 401, error: PUBLIC_ERRORS.invalidKey };
  }

  const rate = await store.hitRateLimit(site.siteId, input.ip || "unknown", input.rateLimit, input.now);
  if (rate.limited) {
    return { ok: false, status: 429, error: PUBLIC_ERRORS.rateLimit };
  }

  const mapped = mapFields(input.fields);
  if (!hasReachableContact(mapped)) {
    return { ok: false, status: 400, error: PUBLIC_ERRORS.noContact };
  }

  if (!mapped.pageUrl) {
    mapped.pageUrl = safeHttpUrl(input.referer);
  }

  let decision: Disposition = decideDisposition({
    honeypot: honeypotValue(input.fields),
    openedAt: parseOpenedAt(input.fields),
    now: input.now.getTime(),
    userAgent: input.userAgent.slice(0, 400),
    email: mapped.email,
    message: mapped.message,
  });

  if (decision.status !== "discarded" && site.turnstileSecret) {
    const checked = input.checkTurnstile
      ? await input.checkTurnstile(site.turnstileSecret, input.turnstileToken, input.ip)
      : "fail";
    if (checked !== "pass" && decision.status === "received") {
      decision = { status: "review", disposition: "turnstile" };
    }
  }

  const discarded = decision.status === "discarded";
  const archived = await store.archive({
    siteId: site.siteId,
    quota: site.monthlyQuota,
    yearMonth: yearMonthShanghai(input.now),
    countUsage: !discarded,
    channels: discarded
      ? []
      : ["email", ...(site.hasFeishu ? (["feishu"] as const) : []), ...(site.hasWecom ? (["wecom"] as const) : [])],
    now: input.now,
    inquiry: {
      ...mapped,
      siteId: site.siteId,
      status: decision.status,
      disposition: decision.disposition,
      ip: input.ip.slice(0, 64) || null,
      userAgent: input.userAgent.slice(0, 400) || null,
    },
  });

  await store.touchKey(keyHash, input.now).catch(() => undefined);

  return {
    ok: true,
    status: 200,
    id: archived.inquiry.id,
    inquiryStatus: archived.inquiry.status,
    redirectUrl: redirectFromFields(input.fields) || safeHttpUrl(site.redirectUrl),
    successMessage: site.successMessage,
    notificationIds: archived.notificationIds,
    overQuota: archived.overQuota,
  };
}
