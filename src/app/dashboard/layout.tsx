import { Suspense } from "react";
import { DashboardShell } from "@/components/shell";

export const instant = false;

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-muted-foreground">正在打开后台…</p>}>
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
