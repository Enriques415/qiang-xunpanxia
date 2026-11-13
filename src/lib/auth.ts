import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { accounts, magicLinks, sessions } from "@/db/schema";
import { hashToken, randomToken } from "@/lib/secrets";

export const SESSION_COOKIE = "xb_session";
const MAGIC_TTL_MS = 20 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const linkHits = new Map<string, number[]>();

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function allowMagicLink(email: string, now = Date.now()) {
  const recent = (linkHits.get(email) ?? []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= 5 || recent.some((time) => now - time < 30_000)) {
    linkHits.set(email, recent);
    return false;
  }
  recent.push(now);
  linkHits.set(email, recent);
  return true;
}

export async function createMagicLink(email: string) {
  const token = randomToken();
  await getDb().insert(magicLinks).values({
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + MAGIC_TTL_MS),
  });
  return token;
}

export async function consumeMagicLink(token: string) {
  const db = getDb();
  const tokenHash = hashToken(token);
  return db.transaction(async (tx) => {
    const [link] = await tx.select().from(magicLinks).where(eq(magicLinks.tokenHash, tokenHash)).limit(1);
    if (!link || link.usedAt || link.expiresAt.getTime() < Date.now()) return null;
    await tx.update(magicLinks).set({ usedAt: new Date() }).where(eq(magicLinks.id, link.id));

    const inserted = await tx
      .insert(accounts)
      .values({ email: link.email })
      .onConflictDoNothing()
      .returning();
    const account =
      inserted[0] ??
      (await tx.select().from(accounts).where(eq(accounts.email, link.email)).limit(1))[0];
    if (!account) return null;

    const sessionToken = randomToken();
    await tx.insert(sessions).values({
      accountId: account.id,
      tokenHash: hashToken(sessionToken),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return { sessionToken, account };
  });
}

export async function getAccount() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ account: accounts })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return row?.account ?? null;
}

export async function requireAccount() {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}
