"use client";

export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
      <h1 className="font-serif text-3xl">后台这一页没有打开</h1>
      <p className="mt-2 text-sm text-muted-foreground">请重试。如果一直失败，先确认数据库正在运行，并且环境变量里的连接串是对的。</p>
      <button className="mt-4 underline" type="button" onClick={() => reset()}>
        再试一次
      </button>
    </div>
  );
}
