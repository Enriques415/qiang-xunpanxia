export const MAX_DELIVERY_ATTEMPTS = 5;

export function backoffMs(attemptsAfterFailure: number): number {
  const seconds = [15, 30, 120, 480, 1800];
  return (seconds[attemptsAfterFailure - 1] ?? 1800) * 1000;
}

export type DeliveryPatch = {
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  nextAttemptAt: Date;
  sentAt: Date | null;
};

export async function settleDelivery(
  job: { id: string; attempts: number; run: () => Promise<void> },
  deps: {
    now: Date;
    maxAttempts?: number;
    record: (id: string, patch: DeliveryPatch) => Promise<void> | void;
  },
): Promise<DeliveryPatch> {
  const maxAttempts = deps.maxAttempts ?? MAX_DELIVERY_ATTEMPTS;
  try {
    await job.run();
    const patch: DeliveryPatch = {
      status: "sent",
      attempts: job.attempts + 1,
      lastError: null,
      nextAttemptAt: deps.now,
      sentAt: deps.now,
    };
    await deps.record(job.id, patch);
    return patch;
  } catch (error) {
    const attempts = job.attempts + 1;
    const terminal = attempts >= maxAttempts;
    const patch: DeliveryPatch = {
      status: terminal ? "failed" : "pending",
      attempts,
      lastError: error instanceof Error ? error.message : "send failed",
      nextAttemptAt: new Date(deps.now.getTime() + backoffMs(attempts)),
      sentAt: null,
    };
    await deps.record(job.id, patch);
    return patch;
  }
}
