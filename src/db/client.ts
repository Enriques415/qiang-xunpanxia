import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { plans } from "@/db/schema";

const globalForDb = globalThis as unknown as {
  xunpanSql?: ReturnType<typeof postgres>;
  xunpanPlans?: Promise<void>;
};

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (!globalForDb.xunpanSql) {
    globalForDb.xunpanSql = postgres(url, { max: 10 });
  }
  return globalForDb.xunpanSql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export async function closeDb() {
  if (!globalForDb.xunpanSql) return;
  await globalForDb.xunpanSql.end({ timeout: 5 });
  globalForDb.xunpanSql = undefined;
  globalForDb.xunpanPlans = undefined;
}

export function ensurePlans() {
  if (!globalForDb.xunpanPlans) {
    globalForDb.xunpanPlans = getDb()
      .insert(plans)
      .values([
        {
          id: "free",
          name: "免费",
          monthlyQuota: 50,
          feishuEnabled: true,
          wecomEnabled: true,
          exportEnabled: true,
        },
        {
          id: "paid",
          name: "付费",
          monthlyQuota: 2000,
          feishuEnabled: true,
          wecomEnabled: true,
          exportEnabled: true,
        },
      ])
      .onConflictDoNothing()
      .then(() => undefined)
      .catch((error: unknown) => {
        globalForDb.xunpanPlans = undefined;
        throw error;
      });
  }
  return globalForDb.xunpanPlans;
}
