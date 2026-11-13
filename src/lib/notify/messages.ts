import { DISPOSITION_LABEL, STATUS_LABEL } from "@/lib/labels";
import type { InquiryStatus } from "@/lib/inquiries/disposition";

export type NoticeInquiry = {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  product: string | null;
  quantity: string | null;
  message: string | null;
  pageUrl: string | null;
  customFields: Record<string, string>;
  status: InquiryStatus;
  disposition: string;
  ip: string | null;
};

function who(inquiry: Pick<NoticeInquiry, "company" | "name">): string {
  return inquiry.company || inquiry.name || "未留名";
}

export function inquirySubject(inquiry: Pick<NoticeInquiry, "company" | "name" | "product">): string {
  const product = inquiry.product ? ` · ${inquiry.product}` : "";
  return `新询盘：${who(inquiry)}${product}`.slice(0, 180);
}

export function messageSummary(message: string | null): string {
  if (!message) return "（无）";
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > 120 ? `${flat.slice(0, 120)}…` : flat;
}

function rows(inquiry: NoticeInquiry, detailUrl: string): Array<[string, string]> {
  const base: Array<[string, string]> = [
    ["姓名", inquiry.name || "—"],
    ["公司", inquiry.company || "—"],
    ["邮箱", inquiry.email || "—"],
    ["电话 / WhatsApp", inquiry.phone || "—"],
    ["国家 / 地区", inquiry.country || "—"],
    ["意向产品", inquiry.product || "—"],
    ["数量", inquiry.quantity || "—"],
    ["留言", inquiry.message || "—"],
    ["来源页", inquiry.pageUrl || "—"],
    ["来源 IP", inquiry.ip || "—"],
    ["状态", STATUS_LABEL[inquiry.status]],
    ["分流", DISPOSITION_LABEL[inquiry.disposition] || inquiry.disposition],
  ];
  for (const [key, value] of Object.entries(inquiry.customFields)) {
    base.push([`自定义 · ${key}`, value]);
  }
  base.push(["后台", detailUrl]);
  return base;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function inquiryText(inquiry: NoticeInquiry, detailUrl: string, siteName: string): string {
  const lines = [`站点「${siteName}」收到一条询盘。`, ""];
  if (inquiry.status === "review") {
    lines.push("系统把这条标为待审，但没有丢弃，通知照常发出。", "");
  }
  for (const [label, value] of rows(inquiry, detailUrl)) {
    lines.push(`${label}：${value}`);
  }
  return lines.join("\n");
}

export function inquiryHtml(inquiry: NoticeInquiry, detailUrl: string, siteName: string): string {
  const body = rows(inquiry, detailUrl)
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 12px 6px 0;color:#6d6458;font-weight:600;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const review =
    inquiry.status === "review"
      ? `<p style="margin:0 0 12px">系统把这条标为待审，但没有丢弃，通知照常发出。</p>`
      : "";
  return `<div style="font-family:sans-serif;color:#1c1915;line-height:1.5">
    <p style="margin:0 0 12px">站点「${escapeHtml(siteName)}」收到一条询盘。</p>
    ${review}
    <table style="border-collapse:collapse">${body}</table>
    <p style="margin:16px 0 0"><a href="${escapeHtml(detailUrl)}">在后台打开这条询盘</a></p>
  </div>`;
}

export function feishuCard(inquiry: NoticeInquiry, detailUrl: string, siteName: string) {
  const content = [
    `**站点** ${siteName}`,
    `**姓名** ${inquiry.name || "—"}`,
    `**公司** ${inquiry.company || "—"}`,
    `**邮箱** ${inquiry.email || "—"}`,
    `**产品** ${inquiry.product || "—"}`,
    `**数量** ${inquiry.quantity || "—"}`,
    `**留言** ${messageSummary(inquiry.message)}`,
    inquiry.status === "review" ? "**分流** 待审，已归档" : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    msg_type: "interactive",
    card: {
      header: {
        title: { tag: "plain_text", content: inquirySubject(inquiry).slice(0, 80) },
        template: "turquoise",
      },
      elements: [
        { tag: "div", text: { tag: "lark_md", content } },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "在后台查看" },
              type: "primary",
              url: detailUrl,
            },
          ],
        },
      ],
    },
  };
}

export function wecomMarkdown(inquiry: NoticeInquiry, detailUrl: string, siteName: string) {
  const content = [
    `**新询盘 · ${siteName}**`,
    `> 姓名：${inquiry.name || "—"}`,
    `> 公司：${inquiry.company || "—"}`,
    `> 邮箱：${inquiry.email || "—"}`,
    `> 产品：${inquiry.product || "—"}`,
    `> 数量：${inquiry.quantity || "—"}`,
    `> 留言：${messageSummary(inquiry.message)}`,
    inquiry.status === "review" ? "> 分流：待审，已归档" : "",
    `[在后台查看](${detailUrl})`,
  ]
    .filter(Boolean)
    .join("\n");
  return { msgtype: "markdown", markdown: { content } };
}

export function quotaSubject(siteName: string): string {
  return `询盘匣额度提醒：${siteName}`.slice(0, 180);
}

export function quotaText(input: {
  siteName: string;
  used: number;
  quota: number;
  dashboardUrl: string;
}): string {
  return [
    `站点「${input.siteName}」本月已接收 ${input.used} 条询盘，免费额度是 ${input.quota} 条。`,
    "买家那边的提交仍然会成功收下，不会因为超额被拒绝。",
    "请在后台查看用量。试点阶段可以手动调高额度。",
    input.dashboardUrl,
  ].join("\n");
}
