export function clientIp(request: Request): string {
  if (process.env.TRUST_PROXY !== "false") {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded.slice(0, 64);
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) return realIp.slice(0, 64);
  }
  return "0.0.0.0";
}

export async function postJson(url: string, body: unknown) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("invalid webhook url");
  }
  if (parsed.protocol !== "https:") throw new Error("webhook url must be https");

  const response = await fetch(parsed, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`webhook ${response.status}: ${text.slice(0, 180)}`);
  }
  const trimmed = text.trim();
  if (!trimmed || trimmed === "ok" || trimmed === "success") return;
  let json: { code?: number; StatusCode?: number; errcode?: number; msg?: string; errmsg?: string };
  try {
    json = JSON.parse(trimmed) as typeof json;
  } catch {
    return;
  }
  if (typeof json.code === "number" && json.code !== 0) {
    throw new Error(`feishu ${json.code}: ${json.msg || ""}`.slice(0, 180));
  }
  if (typeof json.StatusCode === "number" && json.StatusCode !== 0) {
    throw new Error(`feishu status ${json.StatusCode}`.slice(0, 180));
  }
  if (typeof json.errcode === "number" && json.errcode !== 0) {
    throw new Error(`wecom ${json.errcode}: ${json.errmsg || ""}`.slice(0, 180));
  }
}

const FEISHU_HOSTS = new Set(["open.feishu.cn", "open.larksuite.com"]);

export function classifyWebhook(kind: "feishu" | "wecom", value: string): string | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (kind === "feishu" && FEISHU_HOSTS.has(url.hostname)) return url.toString();
  if (kind === "wecom" && url.hostname === "qyapi.weixin.qq.com") return url.toString();
  return null;
}
