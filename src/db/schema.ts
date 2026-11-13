import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const plans = pgTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  monthlyQuota: integer("monthly_quota").notNull(),
  feishuEnabled: boolean("feishu_enabled").notNull().default(true),
  wecomEnabled: boolean("wecom_enabled").notNull().default(true),
  exportEnabled: boolean("export_enabled").notNull().default(true),
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const magicLinks = pgTable("magic_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sites = pgTable("sites", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  domain: text("domain").notNull(),
  notifyEmail: text("notify_email").notNull(),
  planId: text("plan_id")
    .notNull()
    .default("free")
    .references(() => plans.id),
  monthlyQuota: integer("monthly_quota").notNull().default(50),
  redirectUrl: text("redirect_url"),
  successMessage: text("success_message"),
  turnstileSiteKey: text("turnstile_site_key"),
  turnstileSecretEnc: text("turnstile_secret_enc"),
  feishuWebhookEnc: text("feishu_webhook_enc"),
  wecomWebhookEnc: text("wecom_webhook_enc"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accessKeys = pgTable(
  "access_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("access_keys_site_idx").on(table.siteId)],
);

export const inquiries = pgTable(
  "inquiries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    disposition: text("disposition").notNull(),
    name: text("name"),
    company: text("company"),
    email: text("email"),
    phone: text("phone"),
    country: text("country"),
    product: text("product"),
    quantity: text("quantity"),
    message: text("message"),
    pageUrl: text("page_url"),
    customFields: jsonb("custom_fields").$type<Record<string, string>>().notNull(),
    rawPayload: jsonb("raw_payload").$type<Record<string, string>>().notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("inquiries_site_created_idx").on(table.siteId, table.createdAt),
    index("inquiries_site_email_idx").on(table.siteId, table.email),
    index("inquiries_site_company_idx").on(table.siteId, table.company),
  ],
);

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (table) => [index("notification_logs_due_idx").on(table.status, table.nextAttemptAt)],
);

export const monthlyUsage = pgTable(
  "monthly_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    acceptedCount: integer("accepted_count").notNull().default(0),
    quotaAlertSent: boolean("quota_alert_sent").notNull().default(false),
  },
  (table) => [uniqueIndex("monthly_usage_site_month_idx").on(table.siteId, table.yearMonth)],
);

export const rateBuckets = pgTable(
  "rate_buckets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    ip: text("ip").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (table) => [
    uniqueIndex("rate_buckets_site_ip_window_idx").on(table.siteId, table.ip, table.windowStart),
  ],
);
