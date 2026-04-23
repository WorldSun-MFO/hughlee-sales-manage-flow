-- ============================================================
-- Migration 6 — Email 網域限制:只允許 @wsgfo.com 登入
-- ============================================================
-- 行為:
--   * @wsgfo.com 使用者登入 → 自動建立 RM profile(或合併既有 placeholder)
--   * 其他網域 → 在 auth.users 插入前直接拒絕,OAuth 回到登入頁報錯
-- ============================================================

-- 1) 建立網域檢查函式(@wsgfo.com 以外一律擋)
create or replace function public.restrict_email_domain() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or new.email !~* '@wsgfo\.com$' then
    raise exception '此系統僅限沃勝 (@wsgfo.com) 員工使用。您的 email % 未獲授權。', new.email
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- 2) 綁到 auth.users 的 BEFORE INSERT
drop trigger if exists restrict_email_domain_trigger on auth.users;
create trigger restrict_email_domain_trigger
  before insert on auth.users
  for each row execute function public.restrict_email_domain();
