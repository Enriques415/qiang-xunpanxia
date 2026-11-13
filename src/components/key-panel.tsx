import { CodeBlock } from "@/components/code-block";
import { CopyButton } from "@/components/copy-button";
import { htmlSnippet } from "@/lib/embed";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function KeyPanel({
  accessKey,
  siteId,
  endpoint,
}: {
  accessKey: string;
  siteId: string;
  endpoint: string;
}) {
  const snippet = htmlSnippet({ endpoint, accessKey });
  return (
    <div className="grid gap-6">
      <section className="rounded-2xl border border-amber-700/30 bg-amber-50 p-5">
        <p className="text-sm font-medium text-amber-950">这把访问密钥只出现这一次</p>
        <p className="mt-1 text-sm text-amber-900/80">
          离开这个页面后，后台只保留前几位。密钥存在数据库里的是哈希，找不到原文。如果忘了，到站点里作废并换一把新的。
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="overflow-x-auto rounded-lg bg-white px-3 py-2 text-sm">{accessKey}</code>
          <CopyButton value={accessKey} label="复制密钥" />
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-serif text-2xl">嵌到独立站的表单</h2>
        </div>
        <CodeBlock code={snippet} />
      </section>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-serif text-2xl">用这把密钥试提交</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          这是一个不依赖脚本的 HTML 表单，会在新标签打开感谢页。然后回到询盘列表就能看到这条。
        </p>
        <form className="mt-4 grid gap-3" method="post" action={endpoint} target="_blank">
          <input type="hidden" name="access_key" value={accessKey} />
          <label className="grid gap-1 text-sm">
            Name
            <input className="h-10 rounded-lg border border-input bg-background px-3" name="name" defaultValue="Ada Lee" />
          </label>
          <label className="grid gap-1 text-sm">
            Company
            <input className="h-10 rounded-lg border border-input bg-background px-3" name="company" defaultValue="Northwind Trading" />
          </label>
          <label className="grid gap-1 text-sm">
            Email
            <input className="h-10 rounded-lg border border-input bg-background px-3" name="email" type="email" defaultValue="ada@northwind.example" />
          </label>
          <label className="grid gap-1 text-sm">
            Product
            <input className="h-10 rounded-lg border border-input bg-background px-3" name="product" defaultValue="Brass valve" />
          </label>
          <label className="grid gap-1 text-sm">
            Message
            <textarea className="min-h-24 rounded-lg border border-input bg-background px-3 py-2" name="message" defaultValue="Please quote 500 pcs, FOB Shanghai." />
          </label>
          <Button type="submit" className="h-10 w-fit px-4">
            发送这条测试询盘
          </Button>
        </form>
        <p className="mt-4 text-sm">
          <Link className="underline" href={`/dashboard/sites/${siteId}`}>
            去站点设置
          </Link>
          <span className="text-muted-foreground"> · 密钥不会再完整显示</span>
        </p>
      </section>
    </div>
  );
}
