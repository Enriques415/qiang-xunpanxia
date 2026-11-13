import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { getAccount } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function HomePage() {
  return (
    <div className="min-h-full">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link href="/" className="flex items-center gap-2 font-serif text-xl">
          <span className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground">匣</span>
          询盘匣
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/guide" className="hover:underline">
            接入说明
          </Link>
          <Suspense fallback={<Link href="/login">登录</Link>}>
            <AccountEntry />
          </Suspense>
        </nav>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-4 py-8 md:grid-cols-[1.15fr_.85fr] md:px-8 md:py-16">
        <div>
          <p className="text-sm tracking-[0.18em] text-primary uppercase">外贸独立站询盘</p>
          <h1 className="mt-3 max-w-xl font-serif text-4xl leading-tight md:text-6xl">
            买家留言进匣，邮箱和飞书一起响。
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">
            询盘匣是给外贸独立站用的接收层。海外买家在英文站留下公司、邮箱和意向产品之后，询盘归档到后台，并通知到你的邮箱、飞书或企业微信。不建站，不跟单，也不做买家背调。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className={cn(buttonVariants(), "h-10 px-4")} href="/login">
              用邮箱进入后台
            </Link>
            <Link className={cn(buttonVariants({ variant: "outline" }), "h-10 bg-card px-4")} href="/guide">
              看怎么嵌表单
            </Link>
          </div>
        </div>

        <aside className="rounded-3xl bg-card p-6 ring-1 ring-foreground/10">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">示意 · 一条刚进匣的询盘</p>
          <h2 className="mt-4 font-serif text-3xl">Northwind Trading</h2>
          <p className="mt-1 text-muted-foreground">Ada Lee · ada@northwind.example</p>
          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">意向产品</dt>
              <dd className="mt-1">Brass valve</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">数量</dt>
              <dd className="mt-1">500 pcs</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">留言</dt>
              <dd className="mt-1">Please quote FOB Shanghai.</dd>
            </div>
          </dl>
          <ul className="mt-6 space-y-2 text-sm">
            <li>已归档，状态：已接收</li>
            <li>邮件正在送往卖家邮箱</li>
            <li>飞书群机器人收到同一张短卡片</li>
          </ul>
        </aside>
      </main>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-16 md:grid-cols-3 md:px-8">
        {[
          ["1", "建站点，拿密钥", "一个账号可以管多个独立站。每站一把访问密钥，只完整显示一次，库里只存哈希。"],
          ["2", "嵌进现有网站", "纯 HTML 表单就能提交，也接受 JSON。Shopify 主题里贴一段片段即可，不做应用市场。"],
          ["3", "少漏，也不乱丢", "真买家宁可标成待审，也要归档并通知。只有蜜罐或明显扫描器流量才会丢弃。通知失败了，询盘还在。"],
        ].map(([index, title, body]) => (
          <article key={index} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
            <p className="font-serif text-3xl text-primary">{index}</p>
            <h2 className="mt-2 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

async function AccountEntry() {
  await connection();
  const account = await getAccount();
  return (
    <Link className="underline" href={account ? "/dashboard" : "/login"}>
      {account ? "进入后台" : "登录"}
    </Link>
  );
}
