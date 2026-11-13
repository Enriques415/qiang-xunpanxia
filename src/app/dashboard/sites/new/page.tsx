import { connection } from "next/server";
import { Suspense } from "react";
import { CreateSiteForm } from "@/components/create-site-form";
import { requireAccount } from "@/lib/auth";

export const instant = false;
export const metadata = { title: "新建站点" };

export default function NewSitePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">正在准备表单…</p>}>
      <NewSiteContent />
    </Suspense>
  );
}

async function NewSiteContent() {
  await connection();
  const account = await requireAccount();
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-serif text-4xl">新建站点</h1>
        <p className="mt-2 text-sm text-muted-foreground">创建之后会生成访问密钥。完整密钥只在下一屏出现一次。</p>
      </div>
      <CreateSiteForm defaultEmail={account.email} />
    </div>
  );
}
