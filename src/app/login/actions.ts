"use server";

import { allowMagicLink, createMagicLink } from "@/lib/auth";
import { ensurePlans } from "@/db/client";
import { appUrl, isEmail, mailMode } from "@/lib/env";
import { getMailProvider } from "@/lib/mail";
import { escapeHtml } from "@/lib/notify/messages";

export type LoginState = { error?: string; sent?: boolean; devLink?: string } | null;

export async function requestMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!isEmail(email)) return { error: "请输入有效的邮箱地址。" };
  if (!allowMagicLink(email)) return { error: "刚刚已经发过一封，请等半分钟再试。" };

  await ensurePlans();
  const token = await createMagicLink(email);
  const link = `${appUrl()}/auth/verify?token=${token}`;
  const text = `打开这个链接登录询盘匣，20 分钟内有效：\n${link}\n\n如果不是你在登录，忽略这封邮件即可。`;
  const html = `<div style="font-family:sans-serif;color:#1c1915;line-height:1.6">
    <p>打开下面的链接登录询盘匣，20 分钟内有效。</p>
    <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
    <p>如果不是你在登录，忽略这封邮件即可。</p>
  </div>`;

  try {
    await getMailProvider().send({ to: email, subject: "登录询盘匣", text, html });
  } catch (error) {
    console.error("[xunpanxia] magic link", error);
    return { error: "登录邮件没有发出去。请检查发信配置后再试。" };
  }

  if (mailMode() === "console") return { sent: true, devLink: link };
  return { sent: true };
}
