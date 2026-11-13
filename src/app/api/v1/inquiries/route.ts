import { after } from "next/server";
import { ensurePlans } from "@/db/client";
import { clientIp } from "@/lib/http";
import { createDrizzleStore } from "@/lib/inquiries/drizzle-store";
import { ingestInquiry } from "@/lib/inquiries/ingest";
import { accessKeyFrom, corsHeaders, htmlResponse, readFields, wantsJson } from "@/lib/inquiries/request";
import { defaultSender, processNotifications } from "@/lib/notify/process";
import { rateLimitPerMinute } from "@/lib/env";
import { verifyTurnstile } from "@/lib/turnstile";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  const json = wantsJson(request);
  const parsed = await readFields(request);
  if ("error" in parsed) {
    return json
      ? Response.json({ ok: false, error: parsed.error }, { status: parsed.status, headers: corsHeaders() })
      : htmlResponse("Could not submit", parsed.error, parsed.status);
  }

  try {
    await ensurePlans();
    const result = await ingestInquiry(
      {
        accessKey: accessKeyFrom(request, parsed.fields),
        fields: parsed.fields,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent") || "",
        referer: request.headers.get("referer"),
        now: new Date(),
        rateLimit: rateLimitPerMinute(),
        turnstileToken: parsed.fields["cf-turnstile-response"] || null,
        checkTurnstile: verifyTurnstile,
      },
      createDrizzleStore(),
    );

    if (!result.ok) {
      return json
        ? Response.json({ ok: false, error: result.error }, { status: result.status, headers: corsHeaders() })
        : htmlResponse("Could not submit", result.error, result.status);
    }

    if (result.notificationIds.length) {
      const ids = result.notificationIds;
      after(() =>
        processNotifications({ ids, sender: defaultSender }).catch((error) => {
          console.error("[xunpanxia] notify", error);
        }),
      );
    }

    if (!json && result.redirectUrl) {
      return new Response(null, {
        status: 303,
        headers: { location: result.redirectUrl, ...corsHeaders() },
      });
    }
    if (!json) {
      return htmlResponse(
        "Thank you",
        result.successMessage || "We have received your inquiry and will reply soon.",
        200,
      );
    }
    return Response.json({ ok: true, id: result.id }, { status: 200, headers: corsHeaders() });
  } catch (error) {
    console.error("[xunpanxia] ingest", error);
    const message = "Something went wrong. Please try again.";
    return json
      ? Response.json({ ok: false, error: message }, { status: 500, headers: corsHeaders() })
      : htmlResponse("Could not submit", message, 500);
  }
}
