"use client";

import { useActionState } from "react";
import { rotateKey, type KeyState } from "@/app/dashboard/actions";
import { KeyPanel } from "@/components/key-panel";
import { Button } from "@/components/ui/button";

export function RotateKeyForm({ siteId, prefix }: { siteId: string; prefix: string | null }) {
  const [state, action, pending] = useActionState(rotateKey, null as KeyState);
  if (state?.accessKey && state.siteId && state.endpoint) {
    return <KeyPanel accessKey={state.accessKey} siteId={state.siteId} endpoint={state.endpoint} />;
  }

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="siteId" value={siteId} />
      <p className="text-sm text-muted-foreground">
        当前密钥前缀：<span className="font-mono text-foreground">{prefix ? `${prefix}…` : "还没有"}</span>
        。换新之后，旧密钥立刻失效，已经嵌在网站上的表单要一起改。
      </p>
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" variant="outline" className="h-10 w-fit bg-card px-4" disabled={pending}>
        {pending ? "正在更换…" : "作废并换一把新密钥"}
      </Button>
    </form>
  );
}
