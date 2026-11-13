import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CodeBlock } from "@/components/code-block";
import { fetchSnippet, htmlSnippet, shopifySection } from "@/lib/embed";
import { appUrl } from "@/lib/env";

export const metadata = { title: "接入说明" };

export default function GuidePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">正在准备说明…</p>}>
      <GuideContent />
    </Suspense>
  );
}

async function GuideContent() {
  await connection();
  const endpoint = `${appUrl()}/api/v1/inquiries`;
  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 py-10 md:px-6">
      <header>
        <Link href="/" className="text-sm underline">
          返回询盘匣
        </Link>
        <h1 className="mt-4 font-serif text-5xl">把询盘表单接到匣里</h1>
        <p className="mt-3 text-lg leading-8 text-muted-foreground">
          这份说明只给外贸独立站和帮卖家建站的人。接收接口收的是买家询盘，不是通用的「表单发邮件」入口，文档也不往那个关键词市场上靠。
        </p>
      </header>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">接口</h2>
        <p className="text-sm leading-6">
          公开地址是 <code className="rounded bg-muted px-1">{endpoint}</code>。接受
          <code className="mx-1 rounded bg-muted px-1">application/x-www-form-urlencoded</code>、
          multipart 表单和 JSON。密钥可以放在隐藏字段 <code>access_key</code>、查询参数，或者请求头
          <code className="mx-1 rounded bg-muted px-1">X-Access-Key</code>。
        </p>
        <p className="text-sm leading-6">
          至少要有邮箱、电话 / WhatsApp，或者一段留言，否则返回 400，并说明缺什么。其他字段缺了不拦。JSON 成功时返回 200 和询盘 ID。HTML 表单如果带了
          <code className="mx-1">_redirect</code>，会跳到你的感谢页。用 fetch 提交时带上
          <code className="mx-1">Accept: application/json</code>，接口已开放 CORS。
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">HTML 表单</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          标签和按钮默认是英文，因为买家在英文站上填写。把 <code>YOUR_ACCESS_KEY</code> 换成创建站点时看到的那一把。
          <code className="mx-1">_hp</code> 是蜜罐，用样式挪出屏幕，不要删。页面打开后再写入 <code>_opened_at</code>，两秒内提交会被标成待审，但仍然归档并通知你。
        </p>
        <CodeBlock code={htmlSnippet({ endpoint, accessKey: "YOUR_ACCESS_KEY", redirect: "https://your-store.example/thanks" })} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">字段名</h2>
        <p className="text-sm leading-6">
          姓名 <code>name</code> / <code>full_name</code>，公司 <code>company</code> / <code>company_name</code> / <code>firm</code>，邮箱 <code>email</code> / <code>mail</code>，电话 <code>phone</code> / <code>tel</code> / <code>whatsapp</code> / <code>mobile</code>，国家 <code>country</code> / <code>region</code>，产品 <code>product</code> / <code>sku</code> / <code>item</code> / <code>model</code>，数量 <code>quantity</code> / <code>qty</code> / <code>amount</code>，留言 <code>message</code> / <code>comment</code> / <code>content</code> / <code>enquiry</code>。没列在这里的键会原样留在详情里。
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">JavaScript</h2>
        <CodeBlock code={fetchSnippet(endpoint)} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">Shopify 主题</h2>
        <p className="text-sm leading-6">
          V1 不上架应用市场。在主题里新建 <code>sections/inquiry-box.liquid</code>，把下面的片段贴进去，再在产品页或联系页添加这个 section。先在 Shopify 后台做一个 Thank you 页面，表单会把买家带到那里。
        </p>
        <CodeBlock code={shopifySection(endpoint)} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-3xl">人机验证和额度</h2>
        <p className="text-sm leading-6">
          站点设置里可以打开 Cloudflare Turnstile。验证没通过时，询盘标为待审，仍然通知你，不会悄悄丢掉。同一 IP 对同一密钥提交过快会收到 429。免费档每站每月 50 条，超过后买家端仍然是成功，卖家会收到额度提醒。
        </p>
        <p className="text-sm">
          <Link className="underline" href="/login">
            登录后台
          </Link>
          创建站点之后，就能拿到密钥。
        </p>
      </section>
    </div>
  );
}
