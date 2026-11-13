import { escapeHtml } from "@/lib/notify/messages";
import { lowerKeys } from "@/lib/inquiries/fields";

export function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, X-Access-Key, Authorization, Accept",
    "access-control-max-age": "86400",
  };
}

export function wantsJson(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return true;
  const accept = request.headers.get("accept") || "";
  if (accept.includes("application/json") && !accept.includes("text/html")) return true;
  if (request.headers.get("sec-fetch-mode") === "cors") return true;
  return new URL(request.url).searchParams.get("response") === "json";
}

export async function readFields(
  request: Request,
): Promise<{ fields: Record<string, string> } | { error: string; status: number }> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 100_000) return { error: "Submission is too large.", status: 413 };
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as unknown;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: "JSON body must be an object.", status: 400 };
      }
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (value == null) continue;
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          fields[key] = String(value);
        } else {
          fields[key] = JSON.stringify(value);
        }
      }
      return { fields };
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const fields: Record<string, string> = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") fields[key] = value;
      }
      return { fields };
    }
  } catch {
    return { error: "Could not read the submission.", status: 400 };
  }
  return { error: "Unsupported content type. Send JSON or a form.", status: 415 };
}

export function accessKeyFrom(request: Request, fields: Record<string, string>) {
  const header = request.headers.get("x-access-key")?.trim();
  if (header) return header;
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }
  const query = new URL(request.url).searchParams.get("access_key")?.trim();
  if (query) return query;
  const lower = lowerKeys(fields);
  return lower.access_key || lower._access_key || null;
}

export function htmlResponse(title: string, message: string, status: number) {
  const html = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<body style="margin:0;background:#f3efe4;color:#1c1915;font-family:Georgia,'Songti SC',serif">
<main style="max-width:36rem;margin:14vh auto;padding:2rem">
<p style="font-family:sans-serif;letter-spacing:.16em;text-transform:uppercase;font-size:12px">Inquiry box</p>
<h1 style="font-weight:500;font-size:2rem">${escapeHtml(title)}</h1>
<p style="font-size:1.1rem;line-height:1.6">${escapeHtml(message)}</p>
</main>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...corsHeaders() },
  });
}
