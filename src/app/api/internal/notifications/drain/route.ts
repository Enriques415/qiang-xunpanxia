import { defaultSender, processNotifications } from "@/lib/notify/process";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const processed = await processNotifications({ sender: defaultSender, limit: 50 });
  return Response.json({ ok: true, processed });
}
