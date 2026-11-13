import { defaultSender, processNotifications } from "@/lib/notify/process";

const globalForLoop = globalThis as unknown as { __xunpanLoop?: boolean };

export function startOutboxLoop() {
  if (globalForLoop.__xunpanLoop) return;
  globalForLoop.__xunpanLoop = true;
  const timer = setInterval(() => {
    processNotifications({ sender: defaultSender, limit: 20 }).catch((error) => {
      console.error("[xunpanxia] outbox", error);
    });
  }, 20_000);
  timer.unref?.();
}
