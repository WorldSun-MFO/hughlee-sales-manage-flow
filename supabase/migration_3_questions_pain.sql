-- ============================================================
-- Migration 3 — 實戰題庫追蹤 + 痛點商品矩陣 CRUD
-- 1) deal_questions:記錄每筆 deal 已釐清/已問的題目
-- 2) pain_points:把寫死的痛點→商品矩陣搬到資料庫,由 Manager 管理
-- ============================================================

-- ---------- 1. Deal Questions(題庫釐清追蹤) ----------
create table if not exists public.deal_questions (
  deal_id      uuid references public.deals(id) on delete cascade,
  question_key text not null,                      -- 例:'m_aum', 'e_eb_test'
  answered     boolean not null default true,      -- 已釐清/已問過
  note         text default '',                    -- 客戶回答摘要(可選)
  asked_by     uuid references public.profiles(id),
  asked_at     timestamptz not null default now(),
  primary key (deal_id, question_key)
);
create index if not exists idx_deal_questions_deal on public.deal_questions(deal_id);

alter table public.deal_questions enable row level security;

drop policy if exists deal_questions_all on public.deal_questions;
create policy deal_questions_all on public.deal_questions for all to authenticated
  using (exists (select 1 from public.deals d where d.id = deal_questions.deal_id and (d.rm_id = auth.uid() or public.is_manager())))
  with check (exists (select 1 from public.deals d where d.id = deal_questions.deal_id and (d.rm_id = auth.uid() or public.is_manager())));

alter publication supabase_realtime add table public.deal_questions;

-- ---------- 2. Pain Points(痛點 → 商品矩陣) ----------
create table if not exists public.pain_points (
  id         uuid primary key default gen_random_uuid(),
  pain       text not null,
  product    text not null,
  pitch      text default '',
  tiers      text default '',                      -- 例:'L1-L4', 'L1(主力)、L2', 'L4 專屬'
  order_idx  int not null default 0,
  is_active  boolean not null default true,
  created_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pain_points_order on public.pain_points(order_idx);

alter table public.pain_points enable row level security;

-- 所有登入者可讀
drop policy if exists pain_points_select on public.pain_points;
create policy pain_points_select on public.pain_points for select to authenticated using (true);

-- 只有 Manager 能新增 / 改 / 刪
drop policy if exists pain_points_write on public.pain_points;
create policy pain_points_write on public.pain_points for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

alter publication supabase_realtime add table public.pain_points;

-- 預載 Playbook v2.1 的 14 筆痛點 → 商品(既有 10 條 + v2.1 新增 4 條)
insert into public.pain_points (pain, product, pitch, tiers, order_idx) values
  ('定存報酬太低',               '高盈基金 / 和頓土地',           '8% 年息是定存 4 倍,波動只有 ~3%',                           'L1–L4',            10),
  ('擔心銀行抽銀根',             '宏利財摯宏耀',                   '內部特別貸款機制沒有 Margin Call 條款',                       'L2–L4',            20),
  ('想要槓桿但風險不要太高',     'PLR + CIMB (1:1.5x)',            '60 萬撬動 150 萬,LL 後年化約 9.2%',                           'L1(主力)、L2',    30),
  ('企業資金和個人混雜',         '宏利(公司戶)',                  '目前唯一支持 100% 單一股東公司戶投保的方案',                   'L2–L4',            40),
  ('傳承分配很頭痛',             '香港分紅保險',                   '變更要被保人、拆單贈與、指定受益人——類信託架構',              'L1–L4',            50),
  ('看好某檔股票但不想追高',     'FCN',                            '等待的每一天都在收 12–15% 票息',                              'L1–L4',            60),
  ('想買入某檔股票慢慢建倉',     'BEN',                            '30%+ 票息 + 折價買入',                                        'L1–L4',            70),
  ('我是超高淨值,一般產品不夠看','HSBC 3,000 萬級',                 '自付 10.5%,5 年 IRR 24%',                                    'L3(主力)、L4',    80),
  ('我錢不夠買大型保單',         '保誠 + DBS(10 萬級距起)',       '10 萬級距就能進場,港幣 HIBOR 低利套利',                       'L1(主力)',        90),
  ('希望資產不離手又要現金流',   '所有保費融資架構',               '資產不離手,流動性倍增——撬動國際金融資源',                    'L1–L4(依規模)',  100),
  ('擔心台灣政治風險 / 想分散',  '百慕達信託 + 香港保單',          '雙管轄區、一個走法律、一個走合約',                            'L2–L4',           110),
  ('下一代在國外讀書 / 工作',    '香港保單 + 信託',                '受益人可跨境、稅務處理靈活',                                  'L1–L4',           120),
  ('想做最大級距的保單特別貸款', '宏利 80M+ 特別貸款',             '5 年 IRR 可達 10.8%,業界最大額級距',                          'L4 專屬',         130),
  ('想用既有大額保單槓桿',       'HSBC 500 萬級保費融資',          '5 年 IRR 24%,自付 10.5%',                                    'L2(主力)、L3',   140)
on conflict do nothing;
