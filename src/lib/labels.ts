export const STATUS_LABEL = {
  received: "已接收",
  review: "待审",
  discarded: "已丢弃",
} as const;

export const DISPOSITION_LABEL: Record<string, string> = {
  ok: "正常接收",
  too_fast: "页面打开后 2 秒内就提交了",
  honeypot: "蜜罐字段有内容，按机器提交丢弃",
  bot_ua: "来源像扫描器，已丢弃且不通知",
  spam_copy: "留言像广告，已归档并通知，标为待审",
  disposable_email: "邮箱像一次性地址，已归档并通知，标为待审",
  turnstile: "人机验证没通过，已归档并通知，标为待审",
  manual: "卖家在后台改过状态",
};

export const CHANNEL_LABEL: Record<string, string> = {
  email: "邮件",
  feishu: "飞书",
  wecom: "企业微信",
  quota_alert: "额度提醒",
};

export const NOTIFY_STATUS_LABEL: Record<string, string> = {
  pending: "待发送",
  sent: "已送达",
  failed: "失败",
};
