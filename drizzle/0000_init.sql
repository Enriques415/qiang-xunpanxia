create table if not exists plans (
  id text primary key,
  name text not null,
  monthly_quota integer not null,
  feishu_enabled boolean not null default true,
  wecom_enabled boolean not null default true,
  export_enabled boolean not null default true
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists magic_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null,
  domain text not null,
  notify_email text not null,
  plan_id text not null default 'free' references plans (id),
  monthly_quota integer not null default 50,
  redirect_url text,
  success_message text,
  turnstile_site_key text,
  turnstile_secret_enc text,
  feishu_webhook_enc text,
  wecom_webhook_enc text,
  created_at timestamptz not null default now()
);

create table if not exists access_keys (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  key_hash text not null unique,
  key_prefix text not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists access_keys_site_idx on access_keys (site_id);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  status text not null,
  disposition text not null,
  name text,
  company text,
  email text,
  phone text,
  country text,
  product text,
  quantity text,
  message text,
  page_url text,
  custom_fields jsonb not null,
  raw_payload jsonb not null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint inquiries_status_chk check (status in ('received', 'review', 'discarded'))
);

create index if not exists inquiries_site_created_idx on inquiries (site_id, created_at);
create index if not exists inquiries_site_email_idx on inquiries (site_id, email);
create index if not exists inquiries_site_company_idx on inquiries (site_id, company);

create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid references inquiries (id) on delete cascade,
  site_id uuid not null references sites (id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint notification_logs_channel_chk check (channel in ('email', 'feishu', 'wecom', 'quota_alert')),
  constraint notification_logs_status_chk check (status in ('pending', 'sent', 'failed'))
);

create index if not exists notification_logs_due_idx on notification_logs (status, next_attempt_at);

create table if not exists monthly_usage (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  year_month text not null,
  accepted_count integer not null default 0,
  quota_alert_sent boolean not null default false
);

create unique index if not exists monthly_usage_site_month_idx on monthly_usage (site_id, year_month);

create table if not exists rate_buckets (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites (id) on delete cascade,
  ip text not null,
  window_start timestamptz not null,
  count integer not null default 0
);

create unique index if not exists rate_buckets_site_ip_window_idx on rate_buckets (site_id, ip, window_start);

insert into plans (id, name, monthly_quota, feishu_enabled, wecom_enabled, export_enabled)
values
  ('free', '免费', 50, true, true, true),
  ('paid', '付费', 2000, true, true, true)
on conflict (id) do nothing;
