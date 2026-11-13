import assert from "node:assert/strict";
import test from "node:test";
import { hasReachableContact, mapFields } from "../src/lib/inquiries/fields";
import { decideDisposition } from "../src/lib/inquiries/disposition";
import { htmlSnippet } from "../src/lib/embed";

test("maps trade-inquiry aliases and keeps unknown fields", () => {
  const mapped = mapFields({
    full_name: "Ada Lee",
    company_name: "Northwind",
    mail: "ada@northwind.example",
    tel: "+1 202 555 0148",
    region: "United States",
    sku: "BV-20",
    qty: "500 pcs",
    comment: "Need a quote",
    _page: "https://shop.example/valves",
    port: "Shanghai",
    access_key: "xk_secret",
    _hp: "",
  });

  assert.equal(mapped.name, "Ada Lee");
  assert.equal(mapped.company, "Northwind");
  assert.equal(mapped.email, "ada@northwind.example");
  assert.equal(mapped.phone, "+1 202 555 0148");
  assert.equal(mapped.country, "United States");
  assert.equal(mapped.product, "BV-20");
  assert.equal(mapped.quantity, "500 pcs");
  assert.equal(mapped.message, "Need a quote");
  assert.equal(mapped.pageUrl, "https://shop.example/valves");
  assert.equal(mapped.customFields.port, "Shanghai");
  assert.equal(mapped.customFields.access_key, undefined);
  assert.equal(mapped.rawPayload.access_key, undefined);
  assert.equal(mapped.rawPayload.port, "Shanghai");
  assert.equal(hasReachableContact(mapped), true);
});

test("keeps a distinct WhatsApp number beside phone", () => {
  const mapped = mapFields({
    phone: "+86 21 5555 0101",
    whatsapp: "+1 415 555 0199",
    message: "Call either number",
  });
  assert.equal(mapped.phone, "+86 21 5555 0101");
  assert.equal(mapped.customFields.whatsapp, "+1 415 555 0199");
});

test("accepts company firm, enquiry, and amount aliases", () => {
  const mapped = mapFields({
    firm: "Harbor Co",
    amount: "12",
    enquiry: "Please send a catalog",
  });
  assert.equal(mapped.company, "Harbor Co");
  assert.equal(mapped.quantity, "12");
  assert.equal(mapped.message, "Please send a catalog");
});

test("message alone is enough contact", () => {
  const mapped = mapFields({ message: "Looking for a supplier" });
  assert.equal(hasReachableContact(mapped), true);
  assert.equal(hasReachableContact(mapFields({})), false);
  assert.equal(hasReachableContact(mapFields({ name: "Ada" })), false);
});

test("honeypot and attack tools are discarded; fast or spam submissions stay in review", () => {
  const now = Date.parse("2026-11-13T00:00:02.000Z");
  assert.equal(
    decideDisposition({
      honeypot: "http://spam",
      openedAt: null,
      now,
      userAgent: "Mozilla/5.0",
      email: null,
      message: null,
    }).status,
    "discarded",
  );
  assert.equal(
    decideDisposition({
      honeypot: "",
      openedAt: null,
      now,
      userAgent: "sqlmap/1.7",
      email: "a@b.co",
      message: "hi",
    }).disposition,
    "bot_ua",
  );
  const fast = decideDisposition({
    honeypot: "",
    openedAt: now - 500,
    now,
    userAgent: "Mozilla/5.0",
    email: "a@b.co",
    message: "hi",
  });
  assert.equal(fast.status, "review");
  assert.equal(fast.disposition, "too_fast");
  assert.equal(
    decideDisposition({
      honeypot: "",
      openedAt: null,
      now,
      userAgent: "Mozilla/5.0",
      email: "a@mailinator.com",
      message: "hi",
    }).disposition,
    "disposable_email",
  );
});

test("embed snippet carries the endpoint, key, honeypot, and trade fields", () => {
  const html = htmlSnippet({
    endpoint: "https://box.example/api/v1/inquiries",
    accessKey: "xk_demo",
  });
  assert.match(html, /action="https:\/\/box\.example\/api\/v1\/inquiries"/);
  assert.match(html, /name="access_key" value="xk_demo"/);
  assert.match(html, /name="_hp"/);
  assert.match(html, /name="company"/);
  assert.match(html, /name="product"/);
  assert.match(html, /name="message"/);
});
