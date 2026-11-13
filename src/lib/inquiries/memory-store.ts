import { randomUUID } from "node:crypto";
import { minuteWindow } from "@/lib/time";
import type { ArchiveInput, ArchiveResult, IngestStore, SiteContext, StoredInquiry } from "@/lib/inquiries/store";

type Usage = { acceptedCount: number; quotaAlertSent: boolean };

export class MemoryStore implements IngestStore {
  private sites = new Map<string, SiteContext>();
  inquiries: StoredInquiry[] = [];
  notifications: Array<{ id: string; inquiryId: string; siteId: string; channel: string }> = [];
  private usage = new Map<string, Usage>();
  private rates = new Map<string, number>();

  addSite(keyHash: string, site: SiteContext) {
    this.sites.set(keyHash, site);
  }

  async findByAccessKeyHash(hash: string) {
    return this.sites.get(hash) ?? null;
  }

  async touchKey() {}

  async hitRateLimit(siteId: string, ip: string, limit: number, now: Date) {
    const key = `${siteId}:${ip}:${minuteWindow(now).toISOString()}`;
    const count = (this.rates.get(key) ?? 0) + 1;
    this.rates.set(key, count);
    return { limited: count > limit, count };
  }

  async archive(input: ArchiveInput): Promise<ArchiveResult> {
    const inquiry: StoredInquiry = {
      ...input.inquiry,
      id: randomUUID(),
      createdAt: input.now,
    };
    this.inquiries.push(inquiry);

    let overQuota = false;
    let quotaAlert = false;
    const notificationIds: string[] = [];

    if (input.countUsage) {
      const key = `${input.siteId}:${input.yearMonth}`;
      const row = this.usage.get(key) ?? { acceptedCount: 0, quotaAlertSent: false };
      row.acceptedCount += 1;
      overQuota = row.acceptedCount > input.quota;
      if (overQuota && !row.quotaAlertSent) {
        row.quotaAlertSent = true;
        quotaAlert = true;
      }
      this.usage.set(key, row);

      for (const channel of input.channels) {
        const id = randomUUID();
        this.notifications.push({ id, inquiryId: inquiry.id, siteId: input.siteId, channel });
        notificationIds.push(id);
      }
      if (quotaAlert) {
        const id = randomUUID();
        this.notifications.push({
          id,
          inquiryId: inquiry.id,
          siteId: input.siteId,
          channel: "quota_alert",
        });
        notificationIds.push(id);
      }
    }

    return { inquiry, overQuota, quotaAlert, notificationIds };
  }

  async listDefault(siteId: string) {
    return this.inquiries.filter(
      (inquiry) => inquiry.siteId === siteId && inquiry.status !== "discarded",
    );
  }

  usageCount(siteId: string, yearMonth: string) {
    return this.usage.get(`${siteId}:${yearMonth}`)?.acceptedCount ?? 0;
  }
}
