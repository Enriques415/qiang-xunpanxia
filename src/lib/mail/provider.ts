export type OutboundMail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export interface MailProvider {
  readonly name: string;
  send(mail: OutboundMail): Promise<void>;
}
