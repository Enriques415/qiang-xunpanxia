"use client";

import { useActionState } from "react";
import { createSite, type KeyState } from "@/app/dashboard/actions";
import { KeyPanel } from "@/components/key-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateSiteForm({ defaultEmail }: { defaultEmail: string }) {
  const [state, action, pending] = useActionState(createSite, null as KeyState);
  if (state?.accessKey && state.siteId && state.endpoint) {
    return <KeyPanel accessKey={state.accessKey} siteId={state.siteId} endpoint={state.endpoint} />;
  }

  return (
    <form action={action} className="grid max-w-xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="name">站点名称</Label>
        <Input id="name" className="h-10 bg-card" name="name" required placeholder="例如：港湾灯具英文站" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="domain">站点域名</Label>
        <Input id="domain" className="h-10 bg-card" name="domain" required placeholder="harbor.example" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notifyEmail">通知邮箱</Label>
        <Input id="notifyEmail" className="h-10 bg-card" name="notifyEmail" type="email" defaultValue={defaultEmail} required />
        <p className="text-xs text-muted-foreground">每条询盘都会发到这个邮箱，可以和登录邮箱不同。</p>
      </div>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" className="h-10 w-fit px-4" disabled={pending}>
        {pending ? "正在创建…" : "创建站点并生成密钥"}
      </Button>
    </form>
  );
}
