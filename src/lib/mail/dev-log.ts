import { randomUUID } from "node:crypto";
import type { OutboundMail } from "@/lib/mail/provider";

export type DevMail = OutboundMail & { id: string; at: string };

const globalForMail = globalThis as unknown as { __xunpanMails?: DevMail[] };

export function recordDevMail(mail: OutboundMail) {
  const list = globalForMail.__xunpanMails ?? [];
  list.unshift({ ...mail, id: randomUUID(), at: new Date().toISOString() });
  globalForMail.__xunpanMails = list.slice(0, 40);
}

export function listDevMails(): DevMail[] {
  return globalForMail.__xunpanMails ?? [];
}
