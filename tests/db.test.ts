import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { eq } from "drizzle-orm";
import "../scripts/load-env";
import { closeDb, ensurePlans, getDb } from "../src/db/client";
import { accessKeys, accounts, inquiries, notificationLogs, sites } from "../src/db/schema";
import { ingestInquiry } from "../src/lib/inquiries/ingest";
import { createDrizzleStore } from "../src/lib/inquiries/drizzle-store";
import { generateAccessKey } from "../src/lib/secrets";
import { processNotifications } from "../src/lib/notify/process";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("postgres keeps the inquiry when notification delivery fails", { skip: hasDatabase ? false : "DATABASE_URL not set" }, async () => {
  await ensurePlans();
  const db = getDb();
  const email = `db-${randomUUID()}@example.com`;
  const [account] = await db.insert(accounts).values({ email }).returning();
  assert.ok(account);
  try {
    const key = generateAccessKey();
    const [site] = await db
      .insert(sites)
      .values({
        accountId: account.id,
        name: "DB Harbor",
        domain: "db-harbor.example",
        notifyEmail: email,
        planId: "free",
        monthlyQuota: 1,
        feishuWebhookEnc: null,
      })
      .returning();
    assert.ok(site);
    await db.insert(accessKeys).values({ siteId: site.id, keyHash: key.hash, keyPrefix: key.prefix });

    const store = createDrizzleStore();
    const base = {
      accessKey: key.raw,
      ip: "203.0.113.40",
      userAgent: "Mozilla/5.0",
      referer: null,
      now: new Date("2026-11-13T09:00:00.000Z"),
      rateLimit: 20,
      turnstileToken: null,
    };
    const first = await ingestInquiry({ ...base, fields: { email: "buyer@northwind.example", company: "Northwind", product: "Valve" } }, store);
    const honeypot = await ingestInquiry(
      { ...base, fields: { email: "bot@example.com", message: "spam", _hp: "filled" }, ip: "203.0.113.41" },
      store,
    );
    const over = await ingestInquiry(
      { ...base, fields: { email: "second@buyer.example", message: "still send it" }, ip: "203.0.113.42" },
      store,
    );

    assert.equal(first.ok && first.status, 200);
    assert.equal(honeypot.ok && honeypot.inquiryStatus, "discarded");
    assert.equal(honeypot.ok && honeypot.notificationIds.length, 0);
    assert.equal(over.ok && over.status, 200);
    assert.equal(over.ok && over.overQuota, true);

    const visible = await store.listDefault(site.id);
    assert.equal(visible.length, 2);
    assert.equal(visible.some((row) => row.company === "Northwind"), true);

    const before = await db.select().from(inquiries).where(eq(inquiries.siteId, site.id));
    assert.equal(before.length, 3);
    const noteId = first.ok ? first.notificationIds[0] : undefined;
    assert.ok(noteId);
    await processNotifications({
      ids: first.ok ? first.notificationIds : [],
      sender: async () => {
        throw new Error("smtp down");
      },
    });
    const after = await db.select().from(inquiries).where(eq(inquiries.siteId, site.id));
    assert.equal(after.length, before.length);
    const [log] = await db.select().from(notificationLogs).where(eq(notificationLogs.id, noteId));
    assert.equal(log?.status, "pending");
    assert.equal(log?.attempts, 1);
    assert.match(log?.lastError || "", /smtp down/);
  } finally {
    await db.delete(accounts).where(eq(accounts.email, email));
    await closeDb();
  }
});
