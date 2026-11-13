import assert from "node:assert/strict";
import test from "node:test";
import { ingestInquiry, PUBLIC_ERRORS } from "../src/lib/inquiries/ingest";
import { MemoryStore } from "../src/lib/inquiries/memory-store";
import { sha256Hex } from "../src/lib/secrets";
import type { SiteContext } from "../src/lib/inquiries/store";

const NOW = new Date("2026-11-13T08:30:00.000Z");

function site(overrides: Partial<SiteContext> = {}): SiteContext {
  return {
    siteId: "site-1",
    accountId: "acct-1",
    name: "Harbor Lighting",
    domain: "harbor.example",
    notifyEmail: "seller@harbor.example",
    monthlyQuota: 50,
    redirectUrl: null,
    successMessage: null,
    turnstileSecret: null,
    hasFeishu: false,
    hasWecom: false,
    ...overrides,
  };
}

function bind(store: MemoryStore, key = "xk_test_key", current = site()) {
  store.addSite(sha256Hex(key), current);
  return key;
}

async function submit(
  store: MemoryStore,
  fields: Record<string, string>,
  extra: Partial<Parameters<typeof ingestInquiry>[0]> = {},
) {
  return ingestInquiry(
    {
      accessKey: "xk_test_key",
      fields,
      ip: "203.0.113.10",
      userAgent: "Mozilla/5.0",
      referer: "https://harbor.example/contact",
      now: NOW,
      rateLimit: 20,
      turnstileToken: null,
      ...extra,
    },
    store,
  );
}

test("rejects a submission with no email, phone, or message", async () => {
  const store = new MemoryStore();
  bind(store);
  const result = await submit(store, { name: "Ada", company: "Northwind" });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.error, PUBLIC_ERRORS.noContact);
    assert.doesNotMatch(result.error, /postgres|stack|sql/i);
  }
  assert.equal(store.inquiries.length, 0);
});

test("honeypot submissions are archived as discarded, hidden from the list, and not notified", async () => {
  const store = new MemoryStore();
  bind(store, "xk_test_key", site({ hasFeishu: true }));
  const result = await submit(store, {
    email: "bot@example.com",
    message: "buy now",
    _hp: "https://spam.example",
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, 200);
    assert.equal(result.inquiryStatus, "discarded");
    assert.deepEqual(result.notificationIds, []);
  }
  assert.equal(store.notifications.length, 0);
  assert.equal(store.usageCount("site-1", "2026-11"), 0);
  assert.equal((await store.listDefault("site-1")).length, 0);
  assert.equal(store.inquiries.length, 1);
});

test("a real inquiry is listed and queues email", async () => {
  const store = new MemoryStore();
  bind(store, "xk_test_key", site({ hasWecom: true }));
  const result = await submit(store, {
    name: "Ada Lee",
    company: "Northwind",
    email: "ada@northwind.example",
    product: "Brass valve",
    port: "Shanghai",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.overQuota, false);
  const visible = await store.listDefault("site-1");
  assert.equal(visible.length, 1);
  assert.equal(visible[0]?.company, "Northwind");
  assert.equal(visible[0]?.product, "Brass valve");
  assert.equal(visible[0]?.customFields.port, "Shanghai");
  assert.equal(visible[0]?.pageUrl, "https://harbor.example/contact");
  assert.deepEqual(
    store.notifications.map((note) => note.channel).sort(),
    ["email", "wecom"],
  );
});

test("over-quota submissions still return 200 and queue a seller alert", async () => {
  const store = new MemoryStore();
  bind(store, "xk_test_key", site({ monthlyQuota: 1 }));
  const first = await submit(store, { email: "one@buyer.example", message: "first" });
  const second = await submit(store, { email: "two@buyer.example", message: "second" });
  assert.equal(first.ok && first.status, 200);
  assert.equal(second.ok, true);
  if (second.ok) {
    assert.equal(second.status, 200);
    assert.equal(second.overQuota, true);
  }
  assert.equal(store.inquiries.length, 2);
  assert.equal(store.usageCount("site-1", "2026-11"), 2);
  const channels = store.notifications.map((note) => note.channel);
  assert.equal(channels.filter((channel) => channel === "quota_alert").length, 1);
  const third = await submit(store, { email: "three@buyer.example" });
  assert.equal(third.ok && third.status, 200);
  assert.equal(store.notifications.filter((note) => note.channel === "quota_alert").length, 1);
});

test("rate limit returns 429 and does not archive", async () => {
  const store = new MemoryStore();
  bind(store);
  await submit(store, { email: "a@buyer.example" }, { rateLimit: 1 });
  const blocked = await submit(store, { email: "b@buyer.example" }, { rateLimit: 1 });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 429);
  assert.equal(store.inquiries.length, 1);
});

test("invalid key does not reveal whether a site exists", async () => {
  const store = new MemoryStore();
  const result = await submit(store, { email: "a@buyer.example" }, { accessKey: "xk_wrong" });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error, PUBLIC_ERRORS.invalidKey);
});
