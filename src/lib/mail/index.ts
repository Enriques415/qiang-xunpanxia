import { mailMode } from "@/lib/env";
import { recordDevMail } from "@/lib/mail/dev-log";
import type { MailProvider, OutboundMail } from "@/lib/mail/provider";

class ConsoleMailProvider implements MailProvider {
  readonly name = "console";

  async send(mail: OutboundMail) {
    recordDevMail(mail);
    console.info(`[xunpanxia mail] to=${mail.to} subject=${mail.subject}`);
  }
}

class ResendMailProvider implements MailProvider {
  readonly name = "resend";

  constructor(
    private readonly apiKey: string,
    private readonly from: string,
  ) {}

  async send(mail: OutboundMail) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        reply_to: mail.replyTo,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`resend ${response.status}: ${detail.slice(0, 180)}`);
    }
  }
}

export function getMailProvider(): MailProvider {
  if (mailMode() === "console") return new ConsoleMailProvider();
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and MAIL_FROM are required when MAIL_PROVIDER=resend");
  }
  return new ResendMailProvider(apiKey, from);
}
