import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessKeys, inquiries, notificationLogs, sites } from "@/db/schema";
import type { ArchiveInput, ArchiveResult, IngestStore, NotifyChannel, SiteContext, StoredInquiry } from "@/lib/inquiries/store";
import { decryptSecret } from "@/lib/secrets";
import { minuteWindow } from "@/lib/time";

function asRows(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: Array<Record<string, unknown>> }).rows;
  }
  return [];
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value);
}

function asBoolean(value: unknown) {
  return value === true || value === "t" || value === "true";
}

function toInquiry(row: typeof inquiries.$inferSelect): StoredInquiry {
  return {
    id: row.id,
    siteId: row.siteId,
    status: row.status as StoredInquiry["status"],
    disposition: row.disposition,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    country: row.country,
    product: row.product,
    quantity: row.quantity,
    message: row.message,
    pageUrl: row.pageUrl,
    customFields: row.customFields ?? {},
    rawPayload: row.rawPayload ?? {},
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  };
}

export function createDrizzleStore(): IngestStore {
  const db = getDb();

  return {
    async findByAccessKeyHash(hash) {
      const [row] = await db
        .select({ site: sites })
        .from(accessKeys)
        .innerJoin(sites, eq(sites.id, accessKeys.siteId))
        .where(and(eq(accessKeys.keyHash, hash), isNull(accessKeys.revokedAt)))
        .limit(1);
      if (!row) return null;
      const site = row.site;
      let turnstileSecret: string | null = null;
      if (site.turnstileSecretEnc) {
        try {
          turnstileSecret = decryptSecret(site.turnstileSecretEnc);
        } catch (error) {
          console.error("[xunpanxia] turnstile secret could not be read", error);
        }
      }
      const context: SiteContext = {
        siteId: site.id,
        accountId: site.accountId,
        name: site.name,
        domain: site.domain,
        notifyEmail: site.notifyEmail,
        monthlyQuota: site.monthlyQuota,
        redirectUrl: site.redirectUrl,
        successMessage: site.successMessage,
        turnstileSecret,
        hasFeishu: Boolean(site.feishuWebhookEnc),
        hasWecom: Boolean(site.wecomWebhookEnc),
      };
      return context;
    },

    async touchKey(hash, now) {
      await db.update(accessKeys).set({ lastUsedAt: now }).where(eq(accessKeys.keyHash, hash));
    },

    async hitRateLimit(siteId, ip, limit, now) {
      const windowStart = minuteWindow(now).toISOString();
      const result = await db.execute(sql`
        insert into rate_buckets (site_id, ip, window_start, count)
        values (${siteId}, ${ip}, ${windowStart}, 1)
        on conflict (site_id, ip, window_start)
        do update set count = rate_buckets.count + 1
        returning count
      `);
      const count = asNumber(asRows(result)[0]?.count ?? 1);
      return { limited: count > limit, count };
    },

    async archive(input: ArchiveInput): Promise<ArchiveResult> {
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(inquiries)
          .values({
            siteId: input.inquiry.siteId,
            status: input.inquiry.status,
            disposition: input.inquiry.disposition,
            name: input.inquiry.name,
            company: input.inquiry.company,
            email: input.inquiry.email,
            phone: input.inquiry.phone,
            country: input.inquiry.country,
            product: input.inquiry.product,
            quantity: input.inquiry.quantity,
            message: input.inquiry.message,
            pageUrl: input.inquiry.pageUrl,
            customFields: input.inquiry.customFields,
            rawPayload: input.inquiry.rawPayload,
            ip: input.inquiry.ip,
            userAgent: input.inquiry.userAgent,
            createdAt: input.now,
          })
          .returning();
        if (!created) throw new Error("inquiry insert failed");

        let overQuota = false;
        let quotaAlert = false;
        const notificationIds: string[] = [];

        if (input.countUsage) {
          const usageResult = await tx.execute(sql`
            insert into monthly_usage (site_id, year_month, accepted_count, quota_alert_sent)
            values (${input.siteId}, ${input.yearMonth}, 1, false)
            on conflict (site_id, year_month)
            do update set accepted_count = monthly_usage.accepted_count + 1
            returning accepted_count, quota_alert_sent
          `);
          const usage = asRows(usageResult)[0];
          const acceptedCount = asNumber(usage?.accepted_count ?? 1);
          const alreadyAlerted = asBoolean(usage?.quota_alert_sent);
          overQuota = acceptedCount > input.quota;
          if (overQuota && !alreadyAlerted) {
            const marked = await tx.execute(sql`
              update monthly_usage
              set quota_alert_sent = true
              where site_id = ${input.siteId}
                and year_month = ${input.yearMonth}
                and quota_alert_sent = false
              returning id
            `);
            quotaAlert = asRows(marked).length > 0;
          }

          const channelRows: Array<{
            inquiryId: string;
            siteId: string;
            channel: NotifyChannel;
            status: "pending";
          }> = input.channels.map((channel) => ({
            inquiryId: created.id,
            siteId: input.siteId,
            channel,
            status: "pending" as const,
          }));
          if (quotaAlert) {
            channelRows.push({
              inquiryId: created.id,
              siteId: input.siteId,
              channel: "quota_alert",
              status: "pending",
            });
          }
          if (channelRows.length) {
            const inserted = await tx
              .insert(notificationLogs)
              .values(channelRows)
              .returning({ id: notificationLogs.id });
            notificationIds.push(...inserted.map((row) => row.id));
          }
        }

        return { inquiry: toInquiry(created), overQuota, quotaAlert, notificationIds };
      });
    },

    async listDefault(siteId) {
      const rows = await db
        .select()
        .from(inquiries)
        .where(and(eq(inquiries.siteId, siteId), sql`${inquiries.status} <> 'discarded'`));
      return rows.map(toInquiry);
    },
  };
}
