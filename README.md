# 询盘匣

给外贸独立站用的询盘接收与通知。海外买家在独立站提交表单之后，询盘归档到卖家后台，并通知到邮箱，以及可选的飞书或企业微信群机器人。

这不是通用的「表单发邮件」工具，文档和产品也不打那个关键词市场。V1 不做团队权限、文件上传、出站 CRM、买家背调、表单搭建器和付款。

## 本地运行

需要 Node.js 22+。数据库用 PostgreSQL 16。

```bash
docker compose up -d
cp .env.example .env.local
# 编辑 .env.local：至少换成你自己的 AUTH_SECRET 和 WEBHOOK_SECRET
npm install
npm run db:migrate
npm run dev
```

打开 [http://127.0.0.1:47281](http://127.0.0.1:47281)。

Docker Compose 把 Postgres 映射到本机 `54329`。`.env.example` 里的 `DATABASE_URL` 与此对应。若你改用本机已安装的 Postgres，把端口改成实际端口即可。

没配 `RESEND_API_KEY` 且 `MAIL_PROVIDER=console` 时，登录链接和询盘通知不会真的外发，会出现在终端，以及 [http://127.0.0.1:47281/dev/mailbox](http://127.0.0.1:47281/dev/mailbox)。用邮箱提交登录表单后，点页面上的链接进入后台。

```bash
npm test
```

测试覆盖字段映射、蜜罐丢弃且不通知、缺少联系方式返回 400、超过月额度仍返回 200、通知发送失败时询盘仍保留。配置了 `DATABASE_URL` 时还会对真实 Postgres 跑一遍归档和投递失败。

## 卖家怎么用

1. 用邮箱登录。第一次使用会建账号，没有密码。
2. 新建站点，抄下只显示一次的访问密钥。库里只存哈希。忘了就在站点页作废并换新。
3. 按接入说明把 HTML 表单嵌进独立站，或把 Shopify 主题片段贴进 `sections/inquiry-box.liquid`。V1 不做应用市场。
4. 在站点设置里填写通知邮箱。需要群通知时，粘贴飞书或企业微信机器人的 https Webhook。地址加密后保存，页面只显示主机名。
5. 询盘列表可按站点筛选，搜索邮箱和公司名，改状态，导出 CSV。

公开接收地址是 `POST /api/v1/inquiries`。支持 `application/x-www-form-urlencoded`、multipart 和 JSON。密钥放在隐藏字段 `access_key`、查询参数，或请求头 `X-Access-Key`。至少要有邮箱、电话 / WhatsApp 或留言，否则 400。JSON 成功返回 `{ "ok": true, "id": "..." }`。HTML 表单若带 `_redirect`，会 303 到感谢页。`fetch` 请带 `Accept: application/json`，接口允许跨域。

免费档默认每站每月 50 条（按上海时区的自然月，已接收和待审计入，丢弃不计入）。超出后买家端仍然 200，卖家收到一封额度提醒，后台提示升级。付款没有做。试点加额度：

```sql
update sites set plan_id = 'paid', monthly_quota = 2000 where id = '<站点 uuid>';
```

## 邮件

发信走 `MailProvider`。业务代码只调用这个接口。

- `MAIL_PROVIDER=console`：本地开发，不外发。
- `MAIL_PROVIDER=resend`：需要 `RESEND_API_KEY` 和 `MAIL_FROM`。`MAIL_FROM` 必须是已在 Resend 验证的域名。

国内邮箱（QQ、163）投递差时，不要改询盘逻辑。另写一个 `MailProvider`（阿里云邮件推送或 SendCloud），在 `src/lib/mail/index.ts` 的 `getMailProvider()` 里按 `MAIL_PROVIDER` 选择。

用自己的域名发信时，在 DNS 配好这三样，记录的具体值以 Resend（或你换上的服务商）控制台为准：

- SPF：声明哪些服务器可以代这个域名发信。
- DKIM：给每封信签名，收件方能核对是你发的。
- DMARC：告诉对方 SPF / DKIM 失败时怎么处理，并接收汇总报告。可以先从 `p=none` 观察，再收到 `quarantine`。

登录链接 20 分钟内有效、只用一次。会话 cookie 是 httpOnly，30 天。

## 通知失败

询盘和通知日志分表。归档成功后才把邮件、飞书、企微写进 outbox。发送失败只会把日志标成待重试或失败，不会删询盘。

长驻 Node 进程每 20 秒扫一次到期的待发送记录，最多 5 次（约 15 秒、30 秒、2 分钟、8 分钟、30 分钟）。Serverless 上请每分钟调用：

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://你的域名/api/internal/notifications/drain
```

接收接口先落库再返回，常态应在 1 秒内。通知是异步的。

飞书只接受 `open.feishu.cn` 或 `open.larksuite.com` 的 https 地址。企业微信只接受 `qyapi.weixin.qq.com`。这是为了避免把服务器变成任意 URL 的跳板。

## 反垃圾

- 蜜罐字段 `_hp`（也认 `_honey`、`_gotcha`）有内容：状态记为已丢弃，不进默认列表，不发通知。接口仍返回成功，避免机器据此改脚本。
- 表单里带了 `_opened_at`，且提交距离打开不足 2 秒：标待审，仍归档并发通知。
- 同一 IP 加同一密钥默认每分钟 20 次，超出返回 429，不归档。
- 一次性邮箱、明显广告串：待审，仍通知。
- 扫描器 User-Agent（sqlmap、nikto 等）：丢弃且不通知。
- 站点填了 Turnstile 密钥时会向 Cloudflare 校验。没通过或校验服务异常：待审，仍通知。

## 部署

一套代码。源站和数据库放新加坡，兼顾国内打开后台和海外买家写入。

- 公开 `POST /api/v1/inquiries` 要全球可访问。生产可以用 OpenNext for Cloudflare 把同一个 Next 应用放到边缘，Postgres 经 Hyperdrive 连回新加坡；也可以把源站放在新加坡，前面用 Cloudflare 代理。
- 卖家后台、登录邮件、飞书和企业微信都是我们主动出站。新加坡一般能打到这些地址。
- 若实测国内打不开后台，再在前面加一个国内可访问的 CDN 或反向代理，指回新加坡源站。V1 不要为这个拆两套代码，也不要上双活多云。
- 传输使用 HTTPS。访问密钥和 Webhook 不要写进仓库或前端静态资源。Turnstile 的站点密钥是公开的，密钥本身加密存放。

## 表

账号、魔法链接、会话、站点、访问密钥、询盘、通知日志、月度用量、频控桶、套餐分开存放。套餐表预留免费 / 付费和额度，付款本身没接。

询盘至少保留 12 个月这个要求，V1 靠不自动删除加上 CSV 导出。还没有到期清理任务。
