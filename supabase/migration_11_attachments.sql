-- ============================================================
-- Migration 11 — 客戶檔案附件(Sprint C)
-- ============================================================
-- 1) 建立 Supabase Storage bucket(私有,RLS 控制)
-- 2) deal_attachments 表記錄每筆檔案的 metadata + 關聯到 deal/comment
-- 3) storage.objects RLS:只有「能存取此 deal 的人」才能讀寫此 deal 底下檔案
-- ============================================================

-- 1) Storage bucket(若已存在不會重建)
insert into storage.buckets (id, name, public, file_size_limit)
values ('deal-attachments', 'deal-attachments', false, 52428800)   -- 50 MB
on conflict (id) do nothing;

-- 2) Metadata 表
create table if not exists public.deal_attachments (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  storage_path  text not null,                       -- bucket 內路徑(如 deal_id/uuid.png)
  file_name     text not null,
  mime_type     text default '',
  size_bytes    bigint default 0,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  comment_id    uuid references public.comments(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_deal_attachments_deal on public.deal_attachments(deal_id, created_at desc);

alter table public.deal_attachments enable row level security;

drop policy if exists deal_attachments_select on public.deal_attachments;
create policy deal_attachments_select on public.deal_attachments for select to authenticated
  using (public.can_access_deal(deal_id));

drop policy if exists deal_attachments_insert on public.deal_attachments;
create policy deal_attachments_insert on public.deal_attachments for insert to authenticated
  with check (public.can_access_deal(deal_id));

drop policy if exists deal_attachments_delete on public.deal_attachments;
create policy deal_attachments_delete on public.deal_attachments for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or exists(select 1 from public.deals d where d.id = deal_id and d.rm_id = auth.uid())
  );

do $$ begin
  alter publication supabase_realtime add table public.deal_attachments;
exception when duplicate_object then null;
end $$;

-- 3) storage.objects RLS:控制 Storage 層級的存取
-- (Supabase 預設沒有給 bucket 任何 policy,所以一開始連登入者都讀不到)

drop policy if exists "deal-attachments select" on storage.objects;
create policy "deal-attachments select" on storage.objects for select to authenticated
  using (
    bucket_id = 'deal-attachments'
    and exists (
      select 1 from public.deal_attachments da
      where da.storage_path = name
        and public.can_access_deal(da.deal_id)
    )
  );

drop policy if exists "deal-attachments insert" on storage.objects;
create policy "deal-attachments insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'deal-attachments');
-- 注意:上傳當下 deal_attachments 那筆還沒建,所以這層只檢查 bucket 對就好,
-- 真正的「對位到哪個 deal 才有權限」由 deal_attachments insert policy 把關。

drop policy if exists "deal-attachments delete" on storage.objects;
create policy "deal-attachments delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'deal-attachments'
    and (
      owner = auth.uid()
      or public.is_admin()
      or exists (
        select 1 from public.deal_attachments da
        join public.deals d on d.id = da.deal_id
        where da.storage_path = name and d.rm_id = auth.uid()
      )
    )
  );
