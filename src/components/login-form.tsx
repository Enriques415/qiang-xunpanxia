"use client";

import { useActionState } from "react";
import { requestMagicLink, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ expired }: { expired?: boolean }) {
  const [state, action, pending] = useActionState(requestMagicLink, null as LoginState);

  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">邮箱</Label>
        <Input id="email" className="h-10 bg-card" name="email" type="email" autoComplete="email" required placeholder="you@company.com" />
      </div>
      {expired ? <p className="text-sm text-destructive">链接失效了，或者已经被用过。再发一封吧。</p> : null}
      {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state?.sent ? (
        <p className="text-sm">
          登录链接已发出，20 分钟内有效。
          {state.devLink ? (
            <>
              {" "}
              当前是本地发信，没有走真实邮件服务：
              <a className="mt-2 block break-all underline" href={state.devLink}>
                点这里进入后台
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="h-10" disabled={pending}>
        {pending ? "正在发送…" : "发送登录链接"}
      </Button>
    </form>
  );
}
