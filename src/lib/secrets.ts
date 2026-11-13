import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(sessionPepper()).update("|").update(token).digest("hex");
}

export function sessionPepper(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set to at least 16 characters");
  }
  return "dev-only-auth-secret";
}

function encryptionKey(): Buffer {
  const secret =
    process.env.WEBHOOK_SECRET ||
    process.env.AUTH_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : "dev-only-webhook-secret");
  if (!secret) {
    throw new Error("WEBHOOK_SECRET or AUTH_SECRET must be set");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function generateAccessKey(): { raw: string; hash: string; prefix: string } {
  const raw = `xk_${randomBytes(24).toString("base64url")}`;
  return { raw, hash: sha256Hex(raw), prefix: raw.slice(0, 12) };
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}
