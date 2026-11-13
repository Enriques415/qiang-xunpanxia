"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "复制" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className="h-8 bg-card"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "已复制" : label}
    </Button>
  );
}
