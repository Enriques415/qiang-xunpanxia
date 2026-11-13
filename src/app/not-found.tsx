import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24">
      <h1 className="font-serif text-4xl">这页不在匣里</h1>
      <p className="mt-3 text-sm text-muted-foreground">地址可能写错了，或者这条询盘不属于当前登录的账号。</p>
      <Link className="mt-6 inline-block underline" href="/dashboard">
        回到站点列表
      </Link>
    </main>
  );
}
