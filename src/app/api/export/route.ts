import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { listInquiriesFor } from "@/lib/data";
import { appUrl } from "@/lib/env";
import { DISPOSITION_LABEL, STATUS_LABEL } from "@/lib/labels";
import { formatShanghai } from "@/lib/time";

export async function GET(request: Request) {
  const account = await getAccount();
  if (!account) return NextResponse.redirect(new URL("/login", appUrl()));
  const url = new URL(request.url);
  const rows = await listInquiriesFor(account.id, {
    siteId: url.searchParams.get("site") || undefined,
    q: url.searchParams.get("q") || undefined,
    status: url.searchParams.get("status") || undefined,
    limit: 20000,
  });
  const csv = toCsv(
    ["时间", "站点", "状态", "姓名", "公司", "邮箱", "电话", "国家", "产品", "数量", "留言", "来源页", "IP", "分流", "自定义字段"],
    rows.map(({ inquiry, siteName }) => [
      formatShanghai(inquiry.createdAt),
      siteName,
      STATUS_LABEL[inquiry.status as keyof typeof STATUS_LABEL] || inquiry.status,
      inquiry.name || "",
      inquiry.company || "",
      inquiry.email || "",
      inquiry.phone || "",
      inquiry.country || "",
      inquiry.product || "",
      inquiry.quantity || "",
      inquiry.message || "",
      inquiry.pageUrl || "",
      inquiry.ip || "",
      DISPOSITION_LABEL[inquiry.disposition] || inquiry.disposition,
      JSON.stringify(inquiry.customFields ?? {}),
    ]),
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=inquiries.csv",
    },
  });
}
