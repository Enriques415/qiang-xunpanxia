import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { updateChannels, updateSite } from "@/app/dashboard/actions";
import { CodeBlock } from "@/components/code-block";
import { RotateKeyForm } from "@/components/rotate-key-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAccount } from "@/lib/auth";
import { activeKeyFor, getOwnedSite, monthUsage } from "@/lib/data";
import { htmlSnippet } from "@/lib/embed";
import { appUrl } from "@/lib/env";
import { decryptSecret } from "@/lib/secrets";

export const instant = false;

const notices: Record<string, string> = {
  saved: "已保存。",
  invalid: "名称、域名或通知邮箱没填对。",
  "bad-redirect": "感谢页地址需要是 http 或 https 链接。",
  "bad-feishu": "飞书地址需要是 open.feishu.cn 或 open.larksuite.com 的 https 机器人 Webhook。",
  "bad-wecom": "企业微信地址需要是 qyapi.weixin.qq.com 的 https 机器人 Webhook。",
};

function webhookHost(enc: string | null) {
  if (!enc) return "未配置";
  try {
    return `已配置 · ${new URL(decryptSecret(enc)).hostname}`;
  } catch {
    return "已保存，但读不出来，请重新粘贴";
  }
}

export default function SitePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在打开站点…</p>}>
      <SiteContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteContent({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const account = await requireAccount();
  const { siteId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(siteId)) notFound();
  const site = await getOwnedSite(account.id, siteId);
  if (!site) notFound();
  const [key, usage] = await Promise.all([activeKeyFor(site.id), monthUsage(site.id)]);
  const noticeKey = Array.isArray(query.notice) ? query.notice[0] : query.notice;
  const endpoint = `${appUrl()}/api/v1/inquiries`;
  const over = usage.used > site.monthlyQuota;

  return (
    <div className="grid gap-8">
      <div>
        <p className="text-sm text-muted-foreground">{site.domain}</p>
        <h1 className="font-serif text-4xl">{site.name}</h1>
        <p className={over ? "mt-2 text-sm text-destructive" : "mt-2 text-sm text-muted-foreground"}>
          {usage.yearMonth} 已接收 {usage.used} / {site.monthlyQuota}
          {over ? "。额度已用完，买家提交仍会成功，请准备升级或手动加额度。" : "。免费档默认每月 50 条。"}
        </p>
        {noticeKey && notices[noticeKey] ? <p className="mt-3 text-sm">{notices[noticeKey]}</p> : null}
      </div>

      <section className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">站点资料</h2>
        <form action={updateSite} className="grid gap-4">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid gap-2">
            <Label htmlFor="name">名称</Label>
            <Input id="name" className="h-10 bg-background" name="name" defaultValue={site.name} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="domain">域名</Label>
            <Input id="domain" className="h-10 bg-background" name="domain" defaultValue={site.domain} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notifyEmail">通知邮箱</Label>
            <Input id="notifyEmail" className="h-10 bg-background" name="notifyEmail" type="email" defaultValue={site.notifyEmail} required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="redirectUrl">提交成功后的感谢页</Label>
            <Input id="redirectUrl" className="h-10 bg-background" name="redirectUrl" defaultValue={site.redirectUrl ?? ""} placeholder="https://harbor.example/thanks" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="successMessage">没有感谢页时给买家看的英文提示</Label>
            <Textarea id="successMessage" name="successMessage" defaultValue={site.successMessage ?? ""} placeholder="Thank you. We have received your inquiry and will reply soon." />
          </div>
          <Button type="submit" className="h-10 w-fit px-4">
            保存资料
          </Button>
        </form>
      </section>

      <section className="grid gap-3 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">访问密钥</h2>
        <RotateKeyForm siteId={site.id} prefix={key?.keyPrefix ?? null} />
      </section>

      <section className="grid gap-4 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-lg font-semibold">飞书、企业微信和人机验证</h2>
        <p className="text-sm text-muted-foreground">
          飞书现在是 {webhookHost(site.feishuWebhookEnc)}。企业微信现在是 {webhookHost(site.wecomWebhookEnc)}。地址加密后入库，页面上不回显完整链接。
        </p>
        <form action={updateChannels} className="grid gap-4">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid gap-2">
            <Label htmlFor="feishuWebhook">飞书自定义机器人 Webhook</Label>
            <Input id="feishuWebhook" className="h-10 bg-background" name="feishuWebhook" placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="wecomWebhook">企业微信群机器人 Webhook</Label>
            <Input id="wecomWebhook" className="h-10 bg-background" name="wecomWebhook" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..." />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="turnstileSiteKey">Turnstile 站点密钥（公开）</Label>
            <Input id="turnstileSiteKey" className="h-10 bg-background" name="turnstileSiteKey" defaultValue={site.turnstileSiteKey ?? ""} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="turnstileSecret">Turnstile 密钥</Label>
            <Input id="turnstileSecret" className="h-10 bg-background" name="turnstileSecret" type="password" placeholder={site.turnstileSecretEnc ? "已配置，留空则保持不变" : "可选"} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="intent" value="save" className="h-10 px-4">
              保存通知设置
            </Button>
            <Button type="submit" name="intent" value="clear-feishu" variant="outline" className="h-10 bg-background">
              移除飞书
            </Button>
            <Button type="submit" name="intent" value="clear-wecom" variant="outline" className="h-10 bg-background">
              移除企业微信
            </Button>
            <Button type="submit" name="intent" value="clear-turnstile" variant="outline" className="h-10 bg-background">
              移除验证密钥
            </Button>
          </div>
        </form>
      </section>

      <section className="grid gap-3">
        <h2 className="font-serif text-2xl">表单示例</h2>
        <p className="text-sm text-muted-foreground">
          下面用占位符代替密钥。创建或轮换密钥时，页面会给出带真实密钥的片段。接入步骤见{" "}
          <Link className="underline" href="/guide">
            接入说明
          </Link>
          。
        </p>
        <CodeBlock code={htmlSnippet({ endpoint, accessKey: "YOUR_ACCESS_KEY", redirect: site.redirectUrl ?? undefined })} />
      </section>
    </div>
  );
}
