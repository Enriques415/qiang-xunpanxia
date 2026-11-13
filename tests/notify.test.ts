import assert from "node:assert/strict";
import test from "node:test";
import { feishuCard, inquiryHtml, inquirySubject, quotaText, wecomMarkdown } from "../src/lib/notify/messages";
import { settleDelivery } from "../src/lib/notify/settle";
import type { NoticeInquiry } from "../src/lib/notify/messages";

const inquiry: NoticeInquiry = {
  name: "Ada Lee",
  company: "Northwind",
  email: "ada@northwind.example",
  phone: "+1 202 555 0148",
  country: "United States",
  product: "Brass valve",
  quantity: "500",
  message: "Please quote FOB Shanghai for the brass valve.",
  pageUrl: "https://harbor.example/valves",
  customFields: { port: "Shanghai" },
  status: "received",
  disposition: "ok",
  ip: "203.0.113.10",
};

test("mail subject carries company and product, body carries fields and the detail link", () => {
  assert.match(inquirySubject(inquiry), /Northwind/);
  assert.match(inquirySubject(inquiry), /Brass valve/);
  const html = inquiryHtml(inquiry, "https://box.example/dashboard/inquiries/1", "Harbor");
  assert.match(html, /ada@northwind\.example/);
  assert.match(html, /Shanghai/);
  assert.match(html, /https:\/\/box\.example\/dashboard\/inquiries\/1/);
});

test("feishu and wecom cards include the short inquiry fields and the dashboard link", () => {
  const url = "https://box.example/dashboard/inquiries/1";
  const feishu = JSON.stringify(feishuCard(inquiry, url, "Harbor"));
  const wecom = JSON.stringify(wecomMarkdown(inquiry, url, "Harbor"));
  for (const payload of [feishu, wecom]) {
    assert.match(payload, /Ada Lee/);
    assert.match(payload, /Northwind/);
    assert.match(payload, /ada@northwind\.example/);
    assert.match(payload, /Brass valve/);
    assert.match(payload, /500/);
    assert.match(payload, /FOB Shanghai/);
    assert.match(payload, /dashboard\/inquiries\/1/);
  }
});

test("a failed delivery retries and does not remove the archived inquiry", async () => {
  const inquiries = [{ id: "inq-1", company: "Northwind" }];
  const logs: Array<{ status: string; attempts: number; lastError: string | null }> = [];
  const patch = await settleDelivery(
    {
      id: "note-1",
      attempts: 0,
      run: async () => {
        throw new Error("smtp down");
      },
    },
    {
      now: new Date("2026-11-13T08:31:00.000Z"),
      record: (_id, next) => {
        logs.push({ status: next.status, attempts: next.attempts, lastError: next.lastError });
      },
    },
  );

  assert.equal(inquiries.length, 1);
  assert.equal(inquiries[0]?.company, "Northwind");
  assert.equal(patch.status, "pending");
  assert.equal(patch.attempts, 1);
  assert.match(patch.lastError ?? "", /smtp down/);
  assert.equal(logs.length, 1);
});

test("quota reminder tells the seller the buyer was still accepted", () => {
  const text = quotaText({
    siteName: "Harbor",
    used: 51,
    quota: 50,
    dashboardUrl: "https://box.example/dashboard",
  });
  assert.match(text, /51/);
  assert.match(text, /50/);
  assert.match(text, /仍然会成功/);
});
