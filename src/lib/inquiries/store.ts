import type { InquiryStatus } from "@/lib/inquiries/disposition";
import type { MappedInquiry } from "@/lib/inquiries/fields";

export type NotifyChannel = "email" | "feishu" | "wecom" | "quota_alert";

export type SiteContext = {
  siteId: string;
  accountId: string;
  name: string;
  domain: string;
  notifyEmail: string;
  monthlyQuota: number;
  redirectUrl: string | null;
  successMessage: string | null;
  turnstileSecret: string | null;
  hasFeishu: boolean;
  hasWecom: boolean;
};

export type StoredInquiry = MappedInquiry & {
  id: string;
  siteId: string;
  status: InquiryStatus;
  disposition: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type ArchiveInput = {
  siteId: string;
  quota: number;
  yearMonth: string;
  countUsage: boolean;
  channels: Array<Exclude<NotifyChannel, "quota_alert">>;
  now: Date;
  inquiry: Omit<StoredInquiry, "id" | "createdAt">;
};

export type ArchiveResult = {
  inquiry: StoredInquiry;
  overQuota: boolean;
  quotaAlert: boolean;
  notificationIds: string[];
};

export interface IngestStore {
  findByAccessKeyHash(hash: string): Promise<SiteContext | null>;
  touchKey(hash: string, now: Date): Promise<void>;
  hitRateLimit(
    siteId: string,
    ip: string,
    limit: number,
    now: Date,
  ): Promise<{ limited: boolean; count: number }>;
  archive(input: ArchiveInput): Promise<ArchiveResult>;
  listDefault(siteId: string): Promise<StoredInquiry[]>;
}
