import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { retryNotifications, setInquiryStatus } from "@/app/dashboard/actions";
import { requireAccount } from "@/lib/auth";
import { getOwnedInquiry, logsForInquiry } from "@/lib/data";
import { CHANNEL_LABEL, DISPOSITION_LABEL, NOTIFY_STATUS_LABEL, STATUS_LABEL } from "@/lib/labels";
import { formatShanghai } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const instant = false;

type Search = Record<string, string | string[] | undefined>;

export default function InquiryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在打开询盘…</p>}>
      <InquiryContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function InquiryContent({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Search>;
}) {
  await connection();
  const account = await requireAccount();
  const { id } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const owned = await getOwnedInquiry(account.id, id);
  if (!owned) notFound();
  const logs = await logsForInquiry(owned.inquiry.id);
  const inquiry = owned.inquiry;
  const notice = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const fields: Array<[string, string | null]> = [
    ["姓名", inquiry.name],
    ["公司", inquiry.company],
    ["邮箱", inquiry.email],
    ["电话 / WhatsApp", inquiry.phone],
    ["国家 / 地区", inquiry.country],
    ["意向产品", inquiry.product],
    ["数量", inquiry.quantity],
    ["留言", inquiry.message],
    ["来源页", inquiry.pageUrl],
    ["来源 IP", inquiry.ip],
    ["User-Agent", inquiry.userAgent],
  ];

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm text-muted-foreground">{owned.site.name} · {formatShanghai(inquiry.createdAt)}</p>
        <h1 className="mt-1 font-serif text-4xl">{inquiry.company || inquiry.name || "未留名的询盘"}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>{STATUS_LABEL[inquiry.status as keyof typeof STATUS_LABEL] || inquiry.status}</Badge>
          <Badge variant="outline">{DISPOSITION_LABEL[inquiry.disposition] || inquiry.disposition}</Badge>
        </div>
      </div>

      {notice === "status" ? <p className="text-sm">状态已改好。</p> : null}
      {notice === "retried" ? <p className="text-sm">已重新投递。如果渠道仍失败，这条询盘不会被删掉。</p> : null}

      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">字段</h2>
        <dl className="mt-3 grid gap-3">
          {fields.map(([label, value]) => (
            <div key={label} className="grid gap-1 md:grid-cols-[9rem_1fr]">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="text-sm break-all whitespace-pre-wrap">{value || "—"}</dd>
            </div>
          ))}
          {Object.entries(inquiry.customFields ?? {}).map(([key, value]) => (
            <div key={key} className="grid gap-1 md:grid-cols-[9rem_1fr]">
              <dt className="text-sm text-muted-foreground">自定义 · {key}</dt>
              <dd className="text-sm break-all whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">改状态</h2>
        <p className="mt-1 text-sm text-muted-foreground">待审的询盘建议先看一眼再决定。改成已丢弃不会删除记录。</p>
        <form action={setInquiryStatus} className="mt-3 flex flex-wrap items-center gap-2">
          <input type="hidden" name="inquiryId" value={inquiry.id} />
          <select className="h-10 rounded-lg border border-input bg-background px-2 text-sm" name="status" defaultValue={inquiry.status}>
            <option value="received">已接收</option>
            <option value="review">待审</option>
            <option value="discarded">已丢弃</option>
          </select>
          <Button type="submit" className="h-10 px-4">
            保存状态
          </Button>
        </form>
      </section>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">通知</h2>
          <form action={retryNotifications}>
            <input type="hidden" name="inquiryId" value={inquiry.id} />
            <Button type="submit" variant="outline" className="h-9 bg-card">
              重新投递
            </Button>
          </form>
        </div>
        {logs.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">这条没有通知。蜜罐或扫描器流量会归档为已丢弃，并且不发通知。</p>
        ) : (
          <ul className="mt-3 grid gap-2 text-sm">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg bg-muted px-3 py-2">
                <span className="font-medium">{CHANNEL_LABEL[log.channel] || log.channel}</span>
                {" · "}
                {NOTIFY_STATUS_LABEL[log.status] || log.status}
                {" · 尝试 "}
                {log.attempts}
                {log.lastError ? <span className="mt-1 block text-destructive">{log.lastError}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <summary className="cursor-pointer text-lg font-semibold">原始 payload</summary>
        <pre className="mt-3 overflow-x-auto text-xs leading-5">{JSON.stringify(inquiry.rawPayload, null, 2)}</pre>
      </details>
    </div>
  );
}
