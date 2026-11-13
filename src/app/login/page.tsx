import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "登录" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">正在打开登录页…</p>}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <Link href="/" className="mb-8 flex items-center gap-2 font-serif text-xl">
        <span className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground">匣</span>
        询盘匣
      </Link>
      <h1 className="font-serif text-4xl">用邮箱登录</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        不需要密码。我们发一个 20 分钟内有效的链接，点开就进后台。第一次使用这个邮箱，会直接建好账号。
      </p>
      <div className="mt-8">
        <LoginForm expired={params.error === "expired"} />
      </div>
      <p className="mt-6 text-sm text-muted-foreground">
        本地如果没配发信服务，链接会出现在上面，也可以到{" "}
        <Link className="underline" href="/dev/mailbox">
          开发收件匣
        </Link>{" "}
        查看。
      </p>
    </div>
  );
}
