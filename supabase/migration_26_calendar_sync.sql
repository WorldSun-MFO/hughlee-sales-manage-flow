-- ============================================================
-- Migration 26 — Google 行事曆同步
-- ============================================================
-- 任務指派時,把任務同步成行事曆上的事件(單向 CRM → Google)。
-- 事件建在「操作者本人」的 primary calendar,指派對象設為與會者(收到邀請)。
-- 只對 @wsgfo.com 內部帳號;完成 / 刪除 / 無到期日 → 對應移除事件。
-- ============================================================

-- 任務上記錄對應的 Google 事件 --------------------------------------------
alter table public.tasks
  add column if not exists google_event_id    text,        -- 對應的 Calendar 事件 id
  add column if not exists google_event_owner uuid,        -- 用「誰」的行事曆建的(改 / 刪要用同一帳號的 token)
  add column if not exists google_synced_at   timestamptz, -- 最後一次成功同步時間
  add column if not exists google_sync_error  text;        -- 最後一次同步錯誤(null = 正常)

-- 每位使用者的 Google refresh token(加密後存)----------------------------
-- 登入時從 OAuth 回呼攔下 provider_refresh_token,AES-256-GCM 加密後存這。
-- ⚠️ 只有 service role 讀寫;故意不建任何 RLS policy → 前端(anon /
--    authenticated)一律無權限,token 永遠不會外流到瀏覽器。
create table if not exists public.google_credentials (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  refresh_token  text not null,              -- 密文,格式 base64(iv).base64(tag).base64(cipher)
  scope          text,
  updated_at     timestamptz not null default now()
);

alter table public.google_credentials enable row level security;
-- (刻意不 create policy:RLS 啟用且無 policy → 只有 service role 能存取)
