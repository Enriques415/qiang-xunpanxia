import { and, eq, inArray, lt, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { inquiries, monthlyUsage, notificationLogs, sites } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { postJson } from "@/lib/http";
import { getMailProvider } from "@/lib/mail";
import type { OutboundMail } from "@/lib/mail/provider";
import {
  feishuCard,
  inquiryHtml,
  inquirySubject,
  inquiryText,
  quotaSubject,
  quotaText,
  wecomMarkdown,
  type NoticeInquiry,
} from "@/lib/notify/messages";
import { MAX_DELIVERY_ATTEMPTS, settleDelivery } from "@/lib/notify/settle";
import { decryptSecret } from "@/lib/secrets";
import { yearMonthShanghai } from "@/lib/time";

export type BuiltNotice =
  | { kind: "email"; mail: OutboundMail }
  | { kind: "webhook"; url: string; body: unknown };

function toNotice(row: typeof inquiries.$inferSelect): NoticeInquiry {
  return {
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
    status: row.status as NoticeInquiry["status"],
    disposition: row.disposition,
    ip: row.ip,
  };
}

async function buildNotice(
  row: typeof notificationLogs.$inferSelect,
): Promise<{ notice: BuiltNotice } | { terminal: string }> {
  const db = getDb();
  const [site] = await db.select().from(sites).where(eq(sites.id, row.siteId)).limit(1);
  if (!site) return { terminal: "site missing" };

  if (row.channel === "quota_alert") {
    const yearMonth = yearMonthShanghai(new Date());
    const [usage] = await db
      .select()
      .from(monthlyUsage)
      .where(and(eq(monthlyUsage.siteId, site.id), eq(monthlyUsage.yearMonth, yearMonth)))
      .limit(1);
    const text = quotaText({
      siteName: site.name,
      used: usage?.acceptedCount ?? site.monthlyQuota + 1,
      quota: site.monthlyQuota,
      dashboardUrl: `${appUrl()}/dashboard/sites/${site.id}`,
    });
    return {
      notice: {
        kind: "email",
        mail: {
          to: site.notifyEmail,
          subject: quotaSubject(site.name),
          text,
          html: `<div style="font-family:sans-serif;white-space:pre-wrap">${text.replaceAll("<", "&lt;")}</div>`,
        },
      },
    };
  }

  if (!row.inquiryId) return { terminal: "inquiry missing" };
  const [inquiry] = await db.select().from(inquiries).where(eq(inquiries.id, row.inquiryId)).limit(1);
  if (!inquiry) return { terminal: "inquiry missing" };
  const view = toNotice(inquiry);
  const detailUrl = `${appUrl()}/dashboard/inquiries/${inquiry.id}`;

  if (row.channel === "email") {
    return {
      notice: {
        kind: "email",
        mail: {
          to: site.notifyEmail,
          subject: inquirySubject(view),
          text: inquiryText(view, detailUrl, site.name),
          html: inquiryHtml(view, detailUrl, site.name),
          replyTo: view.email?.includes("@") ? view.email : undefined,
        },
      },
    };
  }

  const encrypted = row.channel === "feishu" ? site.feishuWebhookEnc : site.wecomWebhookEnc;
  if (!encrypted) return { terminal: "webhook removed" };
  let url = "";
  try {
    url = decryptSecret(encrypted);
  } catch {
    return { terminal: "webhook decrypt failed" };
  }
  const body =
    row.channel === "feishu" ? feishuCard(view, detailUrl, site.name) : wecomMarkdown(view, detailUrl, site.name);
  return { notice: { kind: "webhook", url, body } };
}

export async function defaultSender(notice: BuiltNotice) {
  if (notice.kind === "email") {
    await getMailProvider().send(notice.mail);
    return;
  }
  await postJson(notice.url, notice.body);
}

export async function processNotifications(options: {
  ids?: string[];
  limit?: number;
  sender?: (notice: BuiltNotice) => Promise<void>;
  now?: Date;
}) {
  const db = getDb();
  const now = options.now ?? new Date();
  const sender = options.sender ?? defaultSender;
  const filters = [eq(notificationLogs.status, "pending"), lt(notificationLogs.attempts, MAX_DELIVERY_ATTEMPTS)];
  if (options.ids?.length) filters.push(inArray(notificationLogs.id, options.ids));
  else filters.push(lte(notificationLogs.nextAttemptAt, now));

  const due = await db
    .select()
    .from(notificationLogs)
    .where(and(...filters))
    .limit(options.limit ?? 20);

  for (const row of due) {
    const built = await buildNotice(row);
    if ("terminal" in built) {
      await db
        .update(notificationLogs)
        .set({ status: "failed", lastError: built.terminal, attempts: row.attempts + 1, nextAttemptAt: now })
        .where(eq(notificationLogs.id, row.id));
      continue;
    }
    await settleDelivery(
      {
        id: row.id,
        attempts: row.attempts,
        run: () => sender(built.notice),
      },
      {
        now,
        record: async (id, patch) => {
          await db
            .update(notificationLogs)
            .set({
              status: patch.status,
              attempts: patch.attempts,
              lastError: patch.lastError?.slice(0, 500) ?? null,
              nextAttemptAt: patch.nextAttemptAt,
              sentAt: patch.sentAt,
            })
            .where(eq(notificationLogs.id, id));
        },
      },
    );
  }
  return due.length;
}
