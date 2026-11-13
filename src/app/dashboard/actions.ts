"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensurePlans, getDb } from "@/db/client";
import { accessKeys, inquiries, notificationLogs, sites } from "@/db/schema";
import { requireAccount } from "@/lib/auth";
import { getOwnedInquiry, getOwnedSite } from "@/lib/data";
import { appUrl, isEmail, normalizeDomain } from "@/lib/env";
import { classifyWebhook } from "@/lib/http";
import { defaultSender, processNotifications } from "@/lib/notify/process";
import { encryptSecret, generateAccessKey } from "@/lib/secrets";
import { safeHttpUrl } from "@/lib/inquiries/fields";

export type KeyState = { error?: string; accessKey?: string; siteId?: string; endpoint?: string } | null;

function clean(value: FormDataEntryValue | null, max: number) {
  return String(value || "").trim().slice(0, max);
}

export async function createSite(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const account = await requireAccount();
  const name = clean(formData.get("name"), 80);
  const domain = normalizeDomain(clean(formData.get("domain"), 200));
  const notifyEmail = clean(formData.get("notifyEmail"), 320).toLowerCase() || account.email;
  if (!name) return { error: "请填写站点名称。" };
  if (!domain) return { error: "请填写站点域名，例如 harbor.example。" };
  if (!isEmail(notifyEmail)) return { error: "通知邮箱看起来不对。" };

  await ensurePlans();
  const key = generateAccessKey();
  const created = await getDb().transaction(async (tx) => {
    const [site] = await tx
      .insert(sites)
      .values({
        accountId: account.id,
        name,
        domain,
        notifyEmail,
        planId: "free",
        monthlyQuota: 50,
      })
      .returning();
    if (!site) throw new Error("site insert failed");
    await tx.insert(accessKeys).values({
      siteId: site.id,
      keyHash: key.hash,
      keyPrefix: key.prefix,
    });
    return site;
  });

  revalidatePath("/dashboard");
  return {
    accessKey: key.raw,
    siteId: created.id,
    endpoint: `${appUrl()}/api/v1/inquiries`,
  };
}

export async function rotateKey(_prev: KeyState, formData: FormData): Promise<KeyState> {
  const account = await requireAccount();
  const siteId = clean(formData.get("siteId"), 80);
  const site = await getOwnedSite(account.id, siteId);
  if (!site) return { error: "找不到这个站点。" };
  const key = generateAccessKey();
  const now = new Date();
  await getDb().transaction(async (tx) => {
    await tx
      .update(accessKeys)
      .set({ revokedAt: now })
      .where(and(eq(accessKeys.siteId, site.id), isNull(accessKeys.revokedAt)));
    await tx.insert(accessKeys).values({
      siteId: site.id,
      keyHash: key.hash,
      keyPrefix: key.prefix,
    });
  });
  revalidatePath(`/dashboard/sites/${site.id}`);
  return { accessKey: key.raw, siteId: site.id, endpoint: `${appUrl()}/api/v1/inquiries` };
}

export async function updateSite(formData: FormData) {
  const account = await requireAccount();
  const siteId = clean(formData.get("siteId"), 80);
  const site = await getOwnedSite(account.id, siteId);
  if (!site) redirect("/dashboard");
  const name = clean(formData.get("name"), 80);
  const domain = normalizeDomain(clean(formData.get("domain"), 200));
  const notifyEmail = clean(formData.get("notifyEmail"), 320).toLowerCase();
  const redirectUrl = safeHttpUrl(clean(formData.get("redirectUrl"), 2000));
  const redirectRaw = clean(formData.get("redirectUrl"), 2000);
  const successMessage = clean(formData.get("successMessage"), 300);
  if (!name || !domain || !isEmail(notifyEmail)) redirect(`/dashboard/sites/${site.id}?notice=invalid`);
  if (redirectRaw && !redirectUrl) redirect(`/dashboard/sites/${site.id}?notice=bad-redirect`);

  await getDb()
    .update(sites)
    .set({
      name,
      domain,
      notifyEmail,
      redirectUrl,
      successMessage: successMessage || null,
    })
    .where(eq(sites.id, site.id));
  revalidatePath(`/dashboard/sites/${site.id}`);
  redirect(`/dashboard/sites/${site.id}?notice=saved`);
}

export async function updateChannels(formData: FormData) {
  const account = await requireAccount();
  const siteId = clean(formData.get("siteId"), 80);
  const site = await getOwnedSite(account.id, siteId);
  if (!site) redirect("/dashboard");
  const intent = clean(formData.get("intent"), 40);
  const patch: Partial<typeof sites.$inferInsert> = {};

  if (intent === "clear-feishu") patch.feishuWebhookEnc = null;
  if (intent === "clear-wecom") patch.wecomWebhookEnc = null;
  if (intent === "clear-turnstile") patch.turnstileSecretEnc = null;

  const feishu = clean(formData.get("feishuWebhook"), 500);
  const wecom = clean(formData.get("wecomWebhook"), 500);
  const turnstileSiteKey = clean(formData.get("turnstileSiteKey"), 200);
  const turnstileSecret = clean(formData.get("turnstileSecret"), 200);

  if (feishu) {
    const url = classifyWebhook("feishu", feishu);
    if (!url) redirect(`/dashboard/sites/${site.id}?notice=bad-feishu`);
    patch.feishuWebhookEnc = encryptSecret(url);
  }
  if (wecom) {
    const url = classifyWebhook("wecom", wecom);
    if (!url) redirect(`/dashboard/sites/${site.id}?notice=bad-wecom`);
    patch.wecomWebhookEnc = encryptSecret(url);
  }
  patch.turnstileSiteKey = turnstileSiteKey || null;
  if (turnstileSecret) patch.turnstileSecretEnc = encryptSecret(turnstileSecret);

  await getDb().update(sites).set(patch).where(eq(sites.id, site.id));
  revalidatePath(`/dashboard/sites/${site.id}`);
  redirect(`/dashboard/sites/${site.id}?notice=saved`);
}

export async function setInquiryStatus(formData: FormData) {
  const account = await requireAccount();
  const inquiryId = clean(formData.get("inquiryId"), 80);
  const status = clean(formData.get("status"), 20);
  if (status !== "received" && status !== "review" && status !== "discarded") {
    redirect("/dashboard/inquiries");
  }
  const owned = await getOwnedInquiry(account.id, inquiryId);
  if (!owned) redirect("/dashboard/inquiries");
  await getDb()
    .update(inquiries)
    .set({ status, disposition: "manual" })
    .where(eq(inquiries.id, owned.inquiry.id));
  revalidatePath(`/dashboard/inquiries/${owned.inquiry.id}`);
  revalidatePath("/dashboard/inquiries");
  redirect(`/dashboard/inquiries/${owned.inquiry.id}?notice=status`);
}

export async function retryNotifications(formData: FormData) {
  const account = await requireAccount();
  const inquiryId = clean(formData.get("inquiryId"), 80);
  const owned = await getOwnedInquiry(account.id, inquiryId);
  if (!owned) redirect("/dashboard/inquiries");
  const failed = await getDb()
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(eq(notificationLogs.inquiryId, owned.inquiry.id), inArray(notificationLogs.status, ["failed", "pending"])),
    );
  if (failed.length) {
    await getDb()
      .update(notificationLogs)
      .set({ status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: null })
      .where(
        inArray(
          notificationLogs.id,
          failed.map((row) => row.id),
        ),
      );
    await processNotifications({
      ids: failed.map((row) => row.id),
      sender: defaultSender,
    }).catch((error) => console.error("[xunpanxia] retry", error));
  }
  revalidatePath(`/dashboard/inquiries/${owned.inquiry.id}`);
  redirect(`/dashboard/inquiries/${owned.inquiry.id}?notice=retried`);
}
