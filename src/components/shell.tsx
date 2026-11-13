import Link from "next/link";
import { connection } from "next/server";
import { requireAccount } from "@/lib/auth";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard/inquiries", label: "询盘" },
  { href: "/dashboard", label: "站点" },
  { href: "/guide", label: "接入说明" },
];

export async function DashboardShell({ children }: { children: React.ReactNode }) {
  await connection();
  const account = await requireAccount();

  return (
    <div className="min-h-full">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-serif text-xl">
            <span className="grid size-8 place-items-center rounded-md bg-primary text-sm text-primary-foreground">匣</span>
            询盘匣
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{account.email}</span>
            <form action="/api/auth/logout" method="post">
              <button className={cn(buttonVariants({ variant: "ghost" }), "h-8")} type="submit">
                退出
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[9rem_minmax(0,1fr)] md:px-6">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm hover:bg-muted">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
