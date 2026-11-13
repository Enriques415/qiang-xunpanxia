import type { TurnstileResult } from "@/lib/inquiries/ingest";

export async function verifyTurnstile(
  secret: string,
  token: string | null,
  ip: string,
): Promise<TurnstileResult> {
  if (!token) return "fail";
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return "error";
    const json = (await response.json()) as { success?: boolean };
    return json.success ? "pass" : "fail";
  } catch {
    return "error";
  }
}
