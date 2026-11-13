import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAccount } from "@/lib/auth";
import { listInquiriesFor, listSitesFor } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/labels";
import { formatShanghai } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const instant = false;
export const metadata = { title: "询盘" };

type Search = Record<string, string | string[] | undefined>;

export default function InquiriesPage({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在读取询盘…</p>}>
      <InquiriesContent searchParams={searchParams} />
    </Suspense>
  );
}

function one(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) || "";
}

async function InquiriesContent({ searchParams }: { searchParams: Promise<Search> }) {
  await connection();
  const account = await requireAccount();
  const params = await searchParams;
  const site = one(params.site);
  const q = one(params.q);
  const status = one(params.status);
  const [sites, rows] = await Promise.all([
    listSitesFor(account.id),
    listInquiriesFor(account.id, { siteId: site || undefined, q, status, limit: 200 }),
  ]);
  const exportQuery = new URLSearchParams();
  if (site) exportQuery.set("site", site);
  if (q) exportQuery.set("q", q);
  if (status) exportQuery.set("status", status);

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">询盘</h1>
          <p className="mt-2 text-sm text-muted-foreground">默认不显示已丢弃的机器提交。可以按站点和邮箱、公司名搜索。</p>
        </div>
        <a className="text-sm underline" href={`/api/export?${exportQuery.toString()}`}>
          导出 CSV
        </a>
      </div>

      <form className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10 md:grid-cols-[1fr_1fr_10rem_auto]" action="/dashboard/inquiries">
        <label className="grid gap-1 text-sm">
          站点
          <select className="h-10 rounded-lg border border-input bg-background px-2" name="site" defaultValue={site}>
            <option value="">全部站点</option>
            {sites.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          邮箱或公司
          <Input className="h-10 bg-background" name="q" defaultValue={q} placeholder="northwind 或 ada@" />
        </label>
        <label className="grid gap-1 text-sm">
          状态
          <select className="h-10 rounded-lg border border-input bg-background px-2" name="status" defaultValue={status}>
            <option value="">不含已丢弃</option>
            <option value="received">已接收</option>
            <option value="review">待审</option>
            <option value="discarded">已丢弃</option>
            <option value="all">全部</option>
          </select>
        </label>
        <Button type="submit" className="h-10 self-end px-4">
          筛选
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">{q || status || site ? "没有符合条件的询盘" : "还没有询盘"}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {q || status || site ? "换个关键词，或者把状态下拉改回「不含已丢弃」。" : "把表单嵌到独立站之后，买家提交会出现在这里。"}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-card ring-1 ring-foreground/10">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                {["时间", "姓名", "公司", "邮箱", "意向产品", "来源页", "状态"].map((heading) => (
                  <th key={heading} className="px-3 py-3 font-medium">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ inquiry, siteName }) => (
                <tr key={inquiry.id} className="border-t border-border">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <Link className="underline" href={`/dashboard/inquiries/${inquiry.id}`}>
                      {formatShanghai(inquiry.createdAt)}
                    </Link>
                    <div className="text-xs text-muted-foreground">{siteName}</div>
                  </td>
                  <td className="px-3 py-3">{inquiry.name || "—"}</td>
                  <td className="px-3 py-3">{inquiry.company || "—"}</td>
                  <td className="px-3 py-3">{inquiry.email || "—"}</td>
                  <td className="px-3 py-3">{inquiry.product || "—"}</td>
                  <td className="max-w-40 truncate px-3 py-3">{inquiry.pageUrl || "—"}</td>
                  <td className="px-3 py-3">
                    <Badge variant={inquiry.status === "review" ? "secondary" : inquiry.status === "discarded" ? "outline" : "default"}>
                      {STATUS_LABEL[inquiry.status as keyof typeof STATUS_LABEL] || inquiry.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
