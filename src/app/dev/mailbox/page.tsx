import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { mailMode } from "@/lib/env";
import { listDevMails } from "@/lib/mail/dev-log";

export const metadata = { title: "开发收件匣" };

export default function MailboxPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm">正在打开收件匣…</p>}>
      <Mailbox />
    </Suspense>
  );
}

async function Mailbox() {
  await connection();
  if (process.env.NODE_ENV === "production" && mailMode() !== "console") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="font-serif text-4xl">生产环境不在这里留邮件</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">正式发信走邮件服务商。登录链接和询盘通知都以对方邮箱为准。</p>
      </main>
    );
  }
  const mails = listDevMails();
  return (
    <main className="mx-auto grid max-w-3xl gap-4 px-4 py-10">
      <Link href="/login" className="text-sm underline">
        返回登录
      </Link>
      <h1 className="font-serif text-4xl">开发收件匣</h1>
      <p className="text-sm text-muted-foreground">没配 Resend 时，登录链接和询盘通知会落在这个进程的内存里，重启就没了。</p>
      {mails.length === 0 ? (
        <p className="rounded-2xl bg-card p-5 text-sm ring-1 ring-foreground/10">还没有邮件。先在登录页提交一次邮箱。</p>
      ) : (
        mails.map((mail) => (
          <article key={mail.id} className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
            <p className="text-xs text-muted-foreground">{mail.at}</p>
            <h2 className="mt-1 font-medium">{mail.subject}</h2>
            <p className="text-sm text-muted-foreground">发给 {mail.to}</p>
            <pre className="mt-3 overflow-x-auto text-sm whitespace-pre-wrap">{mail.text}</pre>
          </article>
        ))
      )}
    </main>
  );
}
