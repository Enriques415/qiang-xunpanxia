import { and, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { accessKeys, inquiries, monthlyUsage, notificationLogs, sites } from "@/db/schema";
import { yearMonthShanghai } from "@/lib/time";

export async function listSitesFor(accountId: string) {
  const yearMonth = yearMonthShanghai(new Date());
  return getDb()
    .select({
      id: sites.id,
      name: sites.name,
      domain: sites.domain,
      notifyEmail: sites.notifyEmail,
      monthlyQuota: sites.monthlyQuota,
      planId: sites.planId,
      createdAt: sites.createdAt,
      used: monthlyUsage.acceptedCount,
    })
    .from(sites)
    .leftJoin(monthlyUsage, and(eq(monthlyUsage.siteId, sites.id), eq(monthlyUsage.yearMonth, yearMonth)))
    .where(eq(sites.accountId, accountId))
    .orderBy(desc(sites.createdAt));
}

export async function getOwnedSite(accountId: string, siteId: string) {
  const [site] = await getDb()
    .select()
    .from(sites)
    .where(and(eq(sites.id, siteId), eq(sites.accountId, accountId)))
    .limit(1);
  return site ?? null;
}

export async function activeKeyFor(siteId: string) {
  const [key] = await getDb()
    .select()
    .from(accessKeys)
    .where(and(eq(accessKeys.siteId, siteId), isNull(accessKeys.revokedAt)))
    .orderBy(desc(accessKeys.createdAt))
    .limit(1);
  return key ?? null;
}

export type InquiryFilters = {
  siteId?: string;
  q?: string;
  status?: string;
  limit: number;
};

export async function listInquiriesFor(accountId: string, filters: InquiryFilters) {
  const owned = await getDb()
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.accountId, accountId));
  const ownedIds = owned.map((site) => site.id);
  if (!ownedIds.length) return [];
  if (filters.siteId && !ownedIds.includes(filters.siteId)) return [];

  const where = [inArray(inquiries.siteId, filters.siteId ? [filters.siteId] : ownedIds)];
  if (filters.status === "received" || filters.status === "review" || filters.status === "discarded") {
    where.push(eq(inquiries.status, filters.status));
  } else if (filters.status !== "all") {
    where.push(sql`${inquiries.status} <> 'discarded'`);
  }
  const q = filters.q?.trim();
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, "\\$&")}%`;
    where.push(or(ilike(inquiries.email, pattern), ilike(inquiries.company, pattern))!);
  }

  return getDb()
    .select({
      inquiry: inquiries,
      siteName: sites.name,
    })
    .from(inquiries)
    .innerJoin(sites, eq(sites.id, inquiries.siteId))
    .where(and(...where))
    .orderBy(desc(inquiries.createdAt))
    .limit(filters.limit);
}

export async function getOwnedInquiry(accountId: string, inquiryId: string) {
  const [row] = await getDb()
    .select({ inquiry: inquiries, site: sites })
    .from(inquiries)
    .innerJoin(sites, eq(sites.id, inquiries.siteId))
    .where(and(eq(inquiries.id, inquiryId), eq(sites.accountId, accountId)))
    .limit(1);
  return row ?? null;
}

export async function logsForInquiry(inquiryId: string) {
  return getDb()
    .select()
    .from(notificationLogs)
    .where(eq(notificationLogs.inquiryId, inquiryId))
    .orderBy(desc(notificationLogs.createdAt));
}

export async function monthUsage(siteId: string) {
  const yearMonth = yearMonthShanghai(new Date());
  const [row] = await getDb()
    .select()
    .from(monthlyUsage)
    .where(and(eq(monthlyUsage.siteId, siteId), eq(monthlyUsage.yearMonth, yearMonth)))
    .limit(1);
  return { yearMonth, used: row?.acceptedCount ?? 0 };
}
