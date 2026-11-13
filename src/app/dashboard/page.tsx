import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { requireAccount } from "@/lib/auth";
import { listSitesFor } from "@/lib/data";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const instant = false;
export const metadata = { title: "站点" };

export default function SitesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在读取站点…</p>}>
      <SitesContent />
    </Suspense>
  );
}

async function SitesContent() {
  await connection();
  const account = await requireAccount();
  const sites = await listSitesFor(account.id);
  const over = sites.filter((site) => (site.used ?? 0) > site.monthlyQuota);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">站点</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            每个独立站一把密钥。免费档默认每站每月 50 条。超过之后买家仍然能提交，后台会提示你升级。
          </p>
        </div>
        <Link className={cn(buttonVariants(), "h-10 px-4")} href="/dashboard/sites/new">
          新建站点
        </Link>
      </div>

      {over.length ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-700/20">
          {over.map((site) => site.name).join("、")} 本月已超过免费额度。询盘仍会收下。试点阶段可以在数据库里手动调高 monthly_quota。
        </p>
      ) : null}

      {sites.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
          <h2 className="font-serif text-2xl">还没有站点</h2>
          <p className="mt-2 text-sm text-muted-foreground">先建一个站，拿到访问密钥，再嵌到询盘表单里。</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {sites.map((site) => {
            const used = site.used ?? 0;
            const overQuota = used > site.monthlyQuota;
            return (
              <li key={site.id} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">
                      <Link className="hover:underline" href={`/dashboard/sites/${site.id}`}>
                        {site.name}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted-foreground">{site.domain}</p>
                  </div>
                  <p className={overQuota ? "text-sm text-destructive" : "text-sm"}>
                    本月 {used} / {site.monthlyQuota}
                    {overQuota ? " · 已超额" : ""}
                  </p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">通知到 {site.notifyEmail}</p>
                <Link className="mt-3 inline-block text-sm underline" href={`/dashboard/inquiries?site=${site.id}`}>
                  查看这个站的询盘
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
