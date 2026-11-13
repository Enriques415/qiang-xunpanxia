import { CopyButton } from "@/components/copy-button";

export function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-[#1c1915] p-4 pr-20 text-[13px] leading-6 text-[#f6f1e6]">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton value={code} />
      </div>
    </div>
  );
}
