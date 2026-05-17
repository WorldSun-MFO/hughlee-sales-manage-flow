資料安全架構（Security Architecture）
WORLDSUN MEDDIC Pipeline | Data Security Reference

文件目的：定義本系統的資料安全防護架構、設計選擇與還原程序。可用於環境重建、新成員 onboarding、合規佐證、災難復原。

適用範圍：hughlee-star/hughlee-sales-manage-flow 對應的 Supabase project（Production / Preview / Development）

最後更新：2026-05-17 文件維護者：Hugh Lee（Founder / Admin） 建議審閱頻率：每季一次，或重大架構變更時即時更新


目錄
業務與監管脈絡
三層防護總覽
Row Level Security (RLS)
Audit Log
備份策略
已知設計選擇與 Trade-offs
常用維護操作
緊急情況處置
變更歷史
附錄 A：完整還原 Migration SQL
附錄 B：診斷與驗證 SQL


1. 業務與監管脈絡
本系統儲存高資產客戶（HNW family）的案件資料，包括但不限於：

客戶身分（姓名、聯絡方式、家族成員）
財務狀況（AUM、tier 分級、產品偏好）
案件進展（MEDDIC/MEDDPICC 評分、CEG Discovery、九階段 pipeline）
內部評估（pain points、stage checklist、score notes）

這類資料屬於：

監管框架
條文
影響
台灣《個人資料保護法》
第 6 條
財務狀況等敏感個資，蒐集處理利用有特別限制
台灣《個人資料保護法》
第 12 條
個資被竊取、洩漏、竄改時須通知當事人
台灣《個人資料保護法》
第 27 條
非公務機關保有個資檔案者應採行適當之安全措施
MFO 行業實務
DOA v1.0 內部規範
KYC、產品審批、Lombard Lending 授權分層


因此本系統的安全設計目標：

權限分層（Access Control）：不同角色僅能存取被授權範圍
變動可追溯（Audit Trail）：所有資料變動留下完整紀錄，符合個資法第 12 條與內部治理需求
災難可復原（Disaster Recovery）：誤刪、誤改、系統故障時可還原
外部攻擊防禦（External Threat）：即使 API key 外流，外部攻擊者仍無法讀取資料


2. 三層防護總覽
┌─────────────────────────────────────────────────────────┐
│                   外部世界 (Public Internet)             │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Supabase Auth + RLS                           │
│  • 身分驗證（JWT-based）                                  │
│  • Role-Based Access Control (admin / team_lead / rm)   │
│  • 每張 table 都有 row-level policy                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 2: Audit Log (Database Triggers)                 │
│  • 10 張關鍵 table 的所有變動自動留底                       │
│  • 不可篡改（連 admin 都不能改 audit_log）                  │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Backup (Supabase Daily Backup)                │
│  • 7 天每日自動備份（Pro Plan）                            │
│  • 建議：每週手動 pg_dump 至 Google Drive                 │
└─────────────────────────────────────────────────────────┘

層級
目的
防禦對象
RLS
控制誰能存取什麼
外部攻擊、anon key 外流、內部越權
Audit Log
記錄誰改了什麼
內部誤操作、合規追溯、debug
Backup
災難復原
系統故障、整批誤刪、勒索病毒



3. Row Level Security (RLS)
3.1 角色定義
系統定義三種 role，儲存於 profiles.role 欄位：

Role
對應人員
權限範圍
admin
Hugh（Founder）
全部資料的 CRUD
team_lead
Abbie（COO）、Dennis（Channel Manager）
自己 team 內所有成員的 deal
rm
Davie、其他 RM
僅自己 owned 的 deal


註：Vesta、Jeremy、Johnson 目前未配置 role 是「supporting staff」，視業務需求再決定 role 分配。
3.2 Helper Functions
所有 RLS policy 透過五個 helper function 組合判斷，避免邏輯散落各處：

Function
簽名
用途
is_admin()
() → boolean
當前 user 是否為 admin
is_team_lead()
() → boolean
當前 user 是否為 team_lead
is_manager()
() → boolean
當前 user 是否為 admin 或 team_lead
user_team_id()
() → uuid
當前 user 所屬 team
can_access_deal(deal_id)
(uuid) → boolean
當前 user 是否可存取指定 deal


設計重點：

所有 function 使用 SECURITY DEFINER → 避開 RLS 遞迴（policy 呼叫 function、function 又觸發 policy）
所有 function 設定 SET search_path = public → 避免 schema 注入攻擊
所有 function 標記 STABLE → PostgreSQL 可在同一 query 內 cache 結果，效能加分
can_access_deal() 自包含查詢 deals 表 → 衍生表（comments、scores 等）的 policy 統一呼叫此 function，達成 single source of truth
3.3 Policy 設計原則
核心邏輯：

deals 表本身：
  - SELECT: RM 看自己 OR admin 看全部 OR team_lead 看 team 內成員
  - INSERT: RM 只能新增自己 owned 的 deal（rm_id = auth.uid()）
  - UPDATE: 同 SELECT 條件
  - DELETE: 僅自己 owned + admin

衍生表（comments, scores, score_notes, deal_questions, stage_checklist,
       stage_history, deal_attachments, intel_deal_links）：
  - 所有操作統一檢查 can_access_deal(deal_id)
  - 跟著 deal 的權限走，避免單獨設計

非 deal 相關表：
  - profiles: 全員可讀，自己可改
  - settings: 全員可讀，僅 admin 可改
  - teams: 全員可讀，僅 admin 可改
  - market_intel: 全員可讀，本人或 admin 可改
  - market_tags / intel_tags: 全員可讀，特定 role 可寫
  - tasks: 個人化權限（assignee 或 creator 或 admin 或 team_lead 看 team 內）
  - mindmap_nodes: 僅 owner 可存取（私人筆記）

完整 policy 定義見 附錄 A。


4. Audit Log
4.1 設計理念
audit_log 是不可篡改的變動紀錄表，自動記錄 10 張關鍵 table 的所有 INSERT / UPDATE / DELETE 操作。

設計目標：

合規佐證：個資法第 12 條要求個資變動可追溯
內部治理：對應 DOA v1.0 的「變動有紀錄」原則
Debug 工具：任何資料異常都可回溯誰、何時、改了什麼
冷備份：所有變動的完整 OLD/NEW 資料以 JSONB 儲存，等於免費的軟刪除替代品
4.2 表結構
CREATE TABLE public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,           -- 哪張表
  record_id TEXT NOT NULL,            -- 哪筆紀錄（PK 字串形式）
  operation TEXT NOT NULL             -- INSERT / UPDATE / DELETE
    CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,                     -- 改之前的完整資料
  new_data JSONB,                     -- 改之後的完整資料
  changed_by UUID,                    -- 操作者 user_id
  changed_by_role TEXT,               -- 操作者 role（admin / team_lead / rm）
  changed_by_name TEXT,               -- 操作者全名（避免 join profiles）
  changed_at TIMESTAMPTZ              -- 操作時間
    DEFAULT NOW() NOT NULL
);
4.3 Trigger 機制
10 張 table 各掛一個 trigger（{table}_audit），於 AFTER INSERT/UPDATE/DELETE 時觸發 audit_trigger_func()。

Trigger function 特點：

SECURITY DEFINER → 寫入 audit_log 不受 RLS 限制
自動抓取 auth.uid() → 不需要前端傳遞操作者資訊
UPDATE 時用 IS DISTINCT FROM 判斷 → 沒有實質改變不寫入（避免空 UPDATE 噪音）
使用 to_jsonb(NEW) / to_jsonb(OLD) → schema 改變時自動適應新欄位
4.4 監控範圍
分類
表
為什麼監控
客戶與案件核心
deals
客戶資料變動是合規最關鍵的部分
評估邏輯
scores, score_notes
MEDDIC 評分異常變動需追溯（避免人為操弄）
權限管控
profiles, settings
角色變動、系統設定變動有重大影響
工作流
tasks, stage_checklist, deal_questions
案件執行軌跡
討論紀錄
comments
內部討論的法律證據鏈
痛點分析
pain_points
CEG Discovery 結論的變動軌跡


未監控的表（刻意排除）：

表
為什麼不監控
stage_history
本身就是 audit log 性質（記錄階段變動），重複監控
intel_tags, market_tags
標籤類，變動頻繁但價值低
ingest_sources, intel_link_suggestions
系統自動產生的中繼資料
mindmap_nodes
個人筆記，無合規需求
market_intel
內部知識資產，目前判斷不需 audit；如未來需要可加
teams
變動極少，需要時可手動追溯
deal_attachments
附件元資料，內容不能改、要改就重傳
intel_deal_links
join table，要改就 delete+insert

4.5 權限
audit_log.SELECT  → 僅 admin（透過 RLS policy 限制）
audit_log.INSERT  → 無 policy（trigger 用 SECURITY DEFINER 繞過 RLS 寫入）
audit_log.UPDATE  → 無 policy = 全擋（連 admin 都不能改）
audit_log.DELETE  → 無 policy = 全擋（連 admin 都不能刪）

這是刻意設計的「不可篡改」特性：audit log 一旦寫入就無法竄改，這是合規佐證的基礎。
4.6 常用查詢
查某個 deal 的完整變更歷史
SELECT 
  changed_at,
  operation,
  changed_by_name,
  old_data,
  new_data
FROM audit_log
WHERE table_name = 'deals' 
  AND record_id = '貼上 deal 的 UUID'
ORDER BY changed_at DESC;
查某人今天改了什麼（含具體欄位）
SELECT 
  changed_at,
  table_name,
  operation,
  record_id,
  (SELECT jsonb_object_agg(key, value) 
   FROM jsonb_each(new_data) 
   WHERE new_data->key IS DISTINCT FROM old_data->key
  ) AS changed_fields
FROM audit_log
WHERE changed_by_name = '某人全名'
  AND changed_at::DATE = CURRENT_DATE
ORDER BY changed_at DESC;
找出 24 小時內 MEDDIC 分數異常變動
SELECT 
  changed_at,
  changed_by_name,
  record_id AS score_id,
  old_data,
  new_data
FROM audit_log
WHERE table_name = 'scores'
  AND changed_at > NOW() - INTERVAL '24 hours'
ORDER BY changed_at DESC;
找出近 7 天所有 DELETE 操作（最關鍵的監控）
SELECT 
  changed_at,
  table_name,
  changed_by_name,
  changed_by_role,
  old_data
FROM audit_log
WHERE operation = 'DELETE'
  AND changed_at > NOW() - INTERVAL '7 days'
ORDER BY changed_at DESC;
從 audit_log 還原誤刪資料
（緊急操作型快速手冊見 docs/RECOVERY.md；本節為架構參考。）

【建議】一鍵還原（migration_17,免手拆 JSONB,admin only）
-- Step 1: 看可還原清單(近 30 天被刪、目前不存在的案件)
SELECT * FROM public.list_deleted_deals();

-- Step 2: 一行還原指定案件 + 其級聯子資料(scores / score_notes /
--         stage_checklist / deal_questions / comments / tasks),回傳還原摘要
SELECT public.restore_deleted_deal('<從上面複製的 deal_id>');
-- 還原本身會記入 audit_log(可追溯);函數內為原子交易,失敗自動 rollback。
-- 範圍外(設計上接受):stage_history / deal_attachments / 市場情報連結 /
-- family_wallet_map 不在 10 張 audited 表內,無法由此還原。
-- 注意:在 migration_16 修好「之前」就被刪的案件,其 scores 等子資料當時
-- 未被 audit 抓到 → 摘要會顯示該子表 0 筆(殼可還原,子資料當次永久遺失)。

【Fallback】手動拆 JSONB(函數不可用、或需逐欄檢視時)
-- Step 1: 找到誤刪的紀錄
SELECT id, old_data
FROM audit_log
WHERE table_name = 'deals'
  AND operation = 'DELETE'
  AND changed_at > NOW() - INTERVAL '1 hour';

-- Step 2: 取得 old_data 後用 INSERT 還原（需手動拆 JSONB）
-- 範例（請依實際 schema 調整欄位）：
INSERT INTO deals (id, rm_id, /* 其他欄位 */)
SELECT 
  (old_data->>'id')::UUID,
  (old_data->>'rm_id')::UUID
  -- 其他欄位以此類推
FROM audit_log
WHERE id = <audit_log id>;


5. 備份策略
5.1 Supabase Daily Backup（自動）
方案：Pro Plan
頻率：每日一次
保留：7 天
位置：Dashboard → Database → Backups
還原方式：點選某天的 snapshot → Restore（注意：會覆蓋整個 database）
5.2 每週手動 pg_dump（建議）
每週日執行一次完整 dump，存到 Google Drive 或本機加密硬碟。

# 設定 Supabase 連線字串（從 Dashboard → Project Settings → Database 取得）
export SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# 執行 dump
pg_dump "$SUPABASE_DB_URL" \
  --schema=public \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "worldsun_backup_$(date +%Y%m%d).sql"

# 加密（如儲存到雲端）
gpg --symmetric --cipher-algo AES256 "worldsun_backup_$(date +%Y%m%d).sql"
5.3 PITR（Point-in-Time Recovery）— 暫不啟用
是什麼：可還原到過去 7 天任意秒的狀態（粒度比 Daily Backup 細）
為什麼暫不啟用：
需要額外付費（PITR add-on + Small compute add-on）
目前單人開發、低頻寫入，Daily Backup 已足夠
audit_log 提供細粒度的個別紀錄還原
何時啟用：
多人協作後寫入頻率提高
業務開始接受不能丟超過 X 小時資料的客戶承諾
規模成長到需要嚴格 RPO（Recovery Point Objective）


6. 已知設計選擇與 Trade-offs
6.1 為什麼不做軟刪除（Soft Delete）
選擇：不在 table 加 deleted_at 欄位，誤刪後從 audit_log 還原。

理由：

audit_log 已記錄 DELETE 操作的完整 old_data（JSONB），等於免費的軟刪除
加軟刪除需要改前端十幾處 code（所有 SELECT 加 .is('deleted_at', null)，所有 DELETE 改成 UPDATE）
本系統不是高頻 DELETE 場景（HNW 客戶不會頻繁被刪），ROI 不划算

何時需要重新評估：

開放給 RM 自助操作後，誤刪頻率提高
業務開始要求「資料保留 X 年」的合規條款
需要「資源回收桶」UX
6.2 為什麼沒有 deal_collaborators 多人協作表
選擇：deal 目前是 single-owner（透過 rm_id），未支援多人協作。

理由：

目前團隊規模小，協作透過 admin / team_lead 機制間接覆蓋
過早設計增加複雜度，目前 helper function can_access_deal() 簡潔可維護

何時需要重新評估：

出現案子由多 RM 共同經營（如 Davie 主談 + Dennis 介紹 channel）
Vesta / Jeremy 需要參與特定案件的 KYC / 分析
需要區分「主負責人」與「協作者」權限差異

擴充方式（未來參考）：

CREATE TABLE deal_collaborators (
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT,  -- 'kyc_officer', 'analyst', 'channel_referrer'
  PRIMARY KEY (deal_id, user_id)
);

-- can_access_deal() 多加一個 OR 條件
-- or exists (select 1 from deal_collaborators c 
--           where c.deal_id = p_deal_id and c.user_id = auth.uid())
6.3 為什麼 mindmap_nodes 用 {public} role 而非 {authenticated}
現狀：四個 mindmap_nodes policy 的 role 是 {public}。

評估：技術上安全（USING 條件是 auth.uid() = owner_id，anon user 的 auth.uid() 為 NULL，永遠匹配不到）。但語意上 {authenticated} 更明確。

處置：列入「可選改進項」，不急著動。如要修正：

DROP POLICY IF EXISTS "mindmap_nodes_select_own" ON mindmap_nodes;
DROP POLICY IF EXISTS "mindmap_nodes_insert_own" ON mindmap_nodes;
DROP POLICY IF EXISTS "mindmap_nodes_update_own" ON mindmap_nodes;
DROP POLICY IF EXISTS "mindmap_nodes_delete_own" ON mindmap_nodes;

CREATE POLICY "mindmap_nodes_select_own" ON mindmap_nodes
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "mindmap_nodes_insert_own" ON mindmap_nodes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "mindmap_nodes_update_own" ON mindmap_nodes
  FOR UPDATE TO authenticated 
  USING (auth.uid() = owner_id) 
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "mindmap_nodes_delete_own" ON mindmap_nodes
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);


7. 常用維護操作
7.1 新增一張需要 audit 的 table
當 schema 演進加入新 table 時，套用相同 audit trigger：

CREATE TRIGGER <table_name>_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.<table_name>
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();
7.2 新增一個 user 並指派 role
Supabase 不在這個 .md 處理 user 註冊（透過 Auth UI 或 API），但 role 指派如下：

-- 升級為 admin
UPDATE profiles SET role = 'admin' WHERE id = '<user_uuid>';

-- 指派 team lead 並分配 team
UPDATE profiles 
SET role = 'team_lead', team_id = '<team_uuid>' 
WHERE id = '<user_uuid>';

-- 一般 RM
UPDATE profiles 
SET role = 'rm', team_id = '<team_uuid>'
WHERE id = '<user_uuid>';
7.3 audit_log 表變大時的歸檔（未來）
當 audit_log 累積到 10 萬筆以上（預估 6-12 個月），考慮歸檔：

-- 匯出超過 1 年的 audit_log（手動跑 pg_dump 部分匯出，或用 COPY TO）
COPY (
  SELECT * FROM audit_log 
  WHERE changed_at < NOW() - INTERVAL '1 year'
) TO '/tmp/audit_log_archive_2026.csv' WITH CSV HEADER;

-- 確認備份後刪除（請務必先驗證備份完整性！）
DELETE FROM audit_log 
WHERE changed_at < NOW() - INTERVAL '1 year';
7.4 健檢：每月檢查 RLS 是否還在運作
-- 確認所有 public 表 RLS 都還是 enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
-- 應該回傳 0 行

-- 確認所有 audit trigger 都還在
SELECT count(*) AS trigger_count
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE '%_audit';
-- 應該回傳 30（10 表 × 3 種 operation）


8. 緊急情況處置
8.1 發現誤刪資料
立即停止後續變動操作
查 audit_log 找出 DELETE 紀錄：

SELECT * FROM audit_log
WHERE operation = 'DELETE'
  AND table_name = '<table>'
  AND changed_at > NOW() - INTERVAL '1 hour'
ORDER BY changed_at DESC;

從 old_data JSONB 取出原始資料
用 INSERT 還原（見 4.6 範例）
如資料太多無法手動還原 → 用 Supabase Daily Backup 還原（會丟失今天其他變動）
8.2 懷疑資料外洩
立即輪換所有 Supabase API key（Dashboard → Project Settings → API → Reset）
立即輪換 GitHub Personal Access Token / Vercel token
檢查 audit_log 最近 30 天的異常 SELECT 模式（注意：audit_log 不記 SELECT，需從 Supabase Logs 查）
依個資法第 12 條評估通報必要性，必要時通報主管機關與當事人
進行內部調查並補強防護
8.3 整個 Supabase project 出問題
確認本地最近一份 pg_dump 是否可用
必要時新建 Supabase project
從 附錄 A 跑完整 migration 重建 schema + RLS + audit log
從 pg_dump 還原資料
更新 Vercel 環境變數指向新 project
Redeploy


9. 變更歷史
日期
變更內容
執行者
2026-05-17
新增一鍵還原工具：public.list_deleted_deals() + public.restore_deleted_deal()（admin only，免手拆 JSONB，還原動作本身入 audit_log）；§4.6 同步更新；見 migration_17
Hugh（real-run 待執行）+ Claude Code（SQL/doc）
2026-05-17
修復 audit_trigger_func() record_id bug（舊版寫死 NEW.id/OLD.id → 改用通用推導）；補回今天為止血而 DROP 的 4 張表 trigger（scores / score_notes / stage_checklist / deal_questions）；見 migration_16
Hugh（real-run）+ Claude Code（SQL/doc）
2026-05-17
建立 audit_log 表 + 10 張表的 audit trigger + admin-only read RLS
Hugh
2026-05-17
建立此 SECURITY.md 文件
Hugh
早期（具體日期參考 git history）
由 Claude Code 建立 RLS 架構：5 個 helper functions + 47 個 policies
Claude Code



附錄 A：完整還原 Migration SQL
使用情境：新建 Supabase project 後，按以下順序執行可重建完整安全架構。

執行前提：所有業務 table（deals, comments, scores 等）的 schema 已建立。本附錄只處理 security layer，不含 table schema 本身。
A.1 Helper Functions
-- ============================================
-- HELPER FUNCTION 1: is_admin
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.profiles 
    where id = auth.uid() and role = 'admin'
  );
$function$;

-- ============================================
-- HELPER FUNCTION 2: is_team_lead
-- ============================================
CREATE OR REPLACE FUNCTION public.is_team_lead()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1 from public.profiles 
    where id = auth.uid() and role = 'team_lead'
  );
$function$;

-- ============================================
-- HELPER FUNCTION 3: is_manager
-- ============================================
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.is_admin() or public.is_team_lead();
$function$;

-- ============================================
-- HELPER FUNCTION 4: user_team_id
-- ============================================
CREATE OR REPLACE FUNCTION public.user_team_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select team_id from public.profiles where id = auth.uid();
$function$;

-- ============================================
-- HELPER FUNCTION 5: can_access_deal
-- ============================================
CREATE OR REPLACE FUNCTION public.can_access_deal(p_deal_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.deals d
    where d.id = p_deal_id
      and (
        d.rm_id = auth.uid()                                      -- 自己的 deal
        or public.is_admin()                                      -- admin 看全部
        or (
          public.is_team_lead()                                   -- team lead
          and public.user_team_id() is not null
          and exists (
            select 1 from public.profiles p
            where p.id = d.rm_id and p.team_id = public.user_team_id()
          )
        )
      )
  );
$function$;
A.2 啟用 RLS
-- ============================================
-- 啟用 RLS：所有 public schema 的業務 table
-- ============================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_deal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_link_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intel_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_intel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mindmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pain_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
A.3 RLS Policies
-- ============================================
-- POLICIES: deals 表
-- ============================================
CREATE POLICY deals_select ON public.deals
  FOR SELECT TO authenticated
  USING (
    rm_id = auth.uid() 
    OR is_admin() 
    OR (
      is_team_lead() 
      AND user_team_id() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = deals.rm_id AND p.team_id = user_team_id()
      )
    )
  );

CREATE POLICY deals_insert ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    rm_id = auth.uid() 
    OR is_admin() 
    OR (
      is_team_lead() 
      AND user_team_id() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = deals.rm_id AND p.team_id = user_team_id()
      )
    )
  );

CREATE POLICY deals_update ON public.deals
  FOR UPDATE TO authenticated
  USING (
    rm_id = auth.uid() 
    OR is_admin() 
    OR (
      is_team_lead() 
      AND user_team_id() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = deals.rm_id AND p.team_id = user_team_id()
      )
    )
  )
  WITH CHECK (
    rm_id = auth.uid() 
    OR is_admin() 
    OR (
      is_team_lead() 
      AND user_team_id() IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = deals.rm_id AND p.team_id = user_team_id()
      )
    )
  );

CREATE POLICY deals_delete ON public.deals
  FOR DELETE TO authenticated
  USING (rm_id = auth.uid() OR is_admin());

-- ============================================
-- POLICIES: 衍生表（comments, deal_attachments, deal_questions,
--          intel_deal_links, intel_link_suggestions, scores, score_notes,
--          stage_checklist, stage_history）
-- ============================================

-- comments
CREATE POLICY comments_select ON public.comments
  FOR SELECT TO authenticated USING (can_access_deal(deal_id));
CREATE POLICY comments_insert ON public.comments
  FOR INSERT TO authenticated WITH CHECK (can_access_deal(deal_id));

-- deal_attachments
CREATE POLICY deal_attachments_select ON public.deal_attachments
  FOR SELECT TO authenticated USING (can_access_deal(deal_id));
CREATE POLICY deal_attachments_insert ON public.deal_attachments
  FOR INSERT TO authenticated WITH CHECK (can_access_deal(deal_id));
CREATE POLICY deal_attachments_delete ON public.deal_attachments
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid() 
    OR is_admin() 
    OR EXISTS (
      SELECT 1 FROM deals d
      WHERE d.id = deal_attachments.deal_id AND d.rm_id = auth.uid()
    )
  );

-- deal_questions
CREATE POLICY deal_questions_all ON public.deal_questions
  FOR ALL TO authenticated 
  USING (can_access_deal(deal_id)) 
  WITH CHECK (can_access_deal(deal_id));

-- intel_deal_links
CREATE POLICY intel_deal_links_select ON public.intel_deal_links
  FOR SELECT TO authenticated USING (can_access_deal(deal_id));
CREATE POLICY intel_deal_links_insert ON public.intel_deal_links
  FOR INSERT TO authenticated WITH CHECK (can_access_deal(deal_id));
CREATE POLICY intel_deal_links_delete ON public.intel_deal_links
  FOR DELETE TO authenticated USING (can_access_deal(deal_id));

-- intel_link_suggestions
CREATE POLICY intel_link_sugg_select ON public.intel_link_suggestions
  FOR SELECT TO authenticated USING (can_access_deal(deal_id));
CREATE POLICY intel_link_sugg_update ON public.intel_link_suggestions
  FOR UPDATE TO authenticated 
  USING (can_access_deal(deal_id)) 
  WITH CHECK (can_access_deal(deal_id));
CREATE POLICY intel_link_sugg_delete ON public.intel_link_suggestions
  FOR DELETE TO authenticated USING (can_access_deal(deal_id));

-- scores
CREATE POLICY scores_all ON public.scores
  FOR ALL TO authenticated 
  USING (can_access_deal(deal_id)) 
  WITH CHECK (can_access_deal(deal_id));

-- score_notes
CREATE POLICY score_notes_all ON public.score_notes
  FOR ALL TO authenticated 
  USING (can_access_deal(deal_id)) 
  WITH CHECK (can_access_deal(deal_id));

-- stage_checklist
CREATE POLICY stage_checklist_all ON public.stage_checklist
  FOR ALL TO authenticated 
  USING (can_access_deal(deal_id)) 
  WITH CHECK (can_access_deal(deal_id));

-- stage_history
CREATE POLICY stage_history_select ON public.stage_history
  FOR SELECT TO authenticated USING (can_access_deal(deal_id));

-- ============================================
-- POLICIES: 市場情報相關表
-- ============================================

-- market_intel
CREATE POLICY market_intel_select ON public.market_intel
  FOR SELECT TO authenticated USING (true);
CREATE POLICY market_intel_insert ON public.market_intel
  FOR INSERT TO authenticated 
  WITH CHECK (created_by = auth.uid() OR is_admin());
CREATE POLICY market_intel_update ON public.market_intel
  FOR UPDATE TO authenticated 
  USING (created_by = auth.uid() OR is_admin())
  WITH CHECK (created_by = auth.uid() OR is_admin());
CREATE POLICY market_intel_delete ON public.market_intel
  FOR DELETE TO authenticated 
  USING (created_by = auth.uid() OR is_admin());

-- market_tags
CREATE POLICY market_tags_select ON public.market_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY market_tags_insert ON public.market_tags
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY market_tags_delete ON public.market_tags
  FOR DELETE TO authenticated USING (is_admin());

-- intel_tags
CREATE POLICY intel_tags_select ON public.intel_tags
  FOR SELECT TO authenticated USING (true);
CREATE POLICY intel_tags_write ON public.intel_tags
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ingest_sources
CREATE POLICY ingest_sources_select ON public.ingest_sources
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ingest_sources_write ON public.ingest_sources
  FOR ALL TO authenticated 
  USING (is_manager()) 
  WITH CHECK (is_manager());

-- ============================================
-- POLICIES: profiles, settings, teams
-- ============================================

-- profiles
CREATE POLICY profiles_read ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated 
  WITH CHECK (
    is_admin() 
    OR (
      is_team_lead() 
      AND (team_id = user_team_id() OR team_id IS NULL)
    )
  );
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated 
  USING (id = auth.uid() OR is_manager())
  WITH CHECK (id = auth.uid() OR is_manager());
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated 
  USING (
    id <> auth.uid() 
    AND (is_admin() OR (is_team_lead() AND team_id = user_team_id()))
  );

-- settings
CREATE POLICY settings_read ON public.settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY settings_update ON public.settings
  FOR UPDATE TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- teams
CREATE POLICY teams_select ON public.teams
  FOR SELECT TO authenticated USING (true);
CREATE POLICY teams_write ON public.teams
  FOR ALL TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- ============================================
-- POLICIES: tasks, pain_points, mindmap_nodes
-- ============================================

-- pain_points
CREATE POLICY pain_points_select ON public.pain_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY pain_points_write ON public.pain_points
  FOR ALL TO authenticated 
  USING (is_admin()) 
  WITH CHECK (is_admin());

-- tasks
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT TO authenticated 
  USING (
    assignee_id = auth.uid() 
    OR created_by = auth.uid() 
    OR is_admin() 
    OR (deal_id IS NOT NULL AND can_access_deal(deal_id))
    OR (
      is_team_lead() 
      AND assignee_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = tasks.assignee_id AND p.team_id = user_team_id()
      )
    )
  );
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE TO authenticated 
  USING (
    assignee_id = auth.uid() 
    OR created_by = auth.uid() 
    OR is_admin() 
    OR (deal_id IS NOT NULL AND can_access_deal(deal_id))
  )
  WITH CHECK (
    assignee_id = auth.uid() 
    OR created_by = auth.uid() 
    OR is_admin() 
    OR (deal_id IS NOT NULL AND can_access_deal(deal_id))
  );
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE TO authenticated 
  USING (
    created_by = auth.uid() 
    OR is_admin() 
    OR (
      deal_id IS NOT NULL 
      AND EXISTS (
        SELECT 1 FROM deals d
        WHERE d.id = tasks.deal_id AND d.rm_id = auth.uid()
      )
    )
  );

-- mindmap_nodes（注意：目前 role 是 public，建議改 authenticated，見 6.3）
CREATE POLICY mindmap_nodes_select_own ON public.mindmap_nodes
  FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY mindmap_nodes_insert_own ON public.mindmap_nodes
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY mindmap_nodes_update_own ON public.mindmap_nodes
  FOR UPDATE 
  USING (auth.uid() = owner_id) 
  WITH CHECK (auth.uid() = owner_id);
CREATE POLICY mindmap_nodes_delete_own ON public.mindmap_nodes
  FOR DELETE USING (auth.uid() = owner_id);
A.4 Audit Log
-- ============================================
-- AUDIT LOG: 表結構
-- ============================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_by_role TEXT,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record 
  ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at 
  ON public.audit_log(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by 
  ON public.audit_log(changed_by);

-- ============================================
-- AUDIT LOG: Trigger Function
-- ============================================
-- ⚠️ 2026-05-17 修復(見 supabase/migration_16_fix_audit_trigger_recordid.sql):
--    舊版 record_id 寫死 NEW.id / OLD.id。但 scores / score_notes /
--    stage_checklist / deal_questions 沒有 id 欄(主鍵是 deal_id 或複合鍵),
--    任何寫入都會讓此 AFTER trigger 報 `record "new" has no field "id"`
--    → 交易回滾 → 寫入癱瘓。改用「通用 record_id」推導,不假設有 id 欄。
--    對既有有 id 欄的表行為完全不變(COALESCE 先取 id)。
CREATE OR REPLACE FUNCTION public.audit_trigger_func()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID;
  v_user_role TEXT;
  v_user_name TEXT;
  v_rec       JSONB;   -- 受影響列(DELETE 取 OLD,其餘取 NEW)
  v_record_id TEXT;    -- 通用主鍵字串,不假設欄名叫 id
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NOT NULL THEN
    SELECT role, full_name INTO v_user_role, v_user_name
    FROM public.profiles
    WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_rec := to_jsonb(OLD);
  ELSE
    v_rec := to_jsonb(NEW);
  END IF;

  -- 有 id 欄 → 取 id(與舊版 NEW.id::TEXT 等價);
  -- 無 id 欄 → deal_id + 次要鍵以 ':' 串接(concat_ws 自動略過 NULL)。
  -- ->>'x' 對不存在的 key 回傳 NULL,永不丟例外 —— 這是本修復的關鍵。
  v_record_id := COALESCE(
    v_rec->>'id',
    NULLIF(concat_ws(':',
      v_rec->>'deal_id',
      v_rec->>'field',
      v_rec->>'item_key',
      v_rec->>'question_key'
    ), '')
  );

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (
      table_name, record_id, operation,
      new_data, changed_by, changed_by_role, changed_by_name
    )
    VALUES (
      TG_TABLE_NAME, v_record_id, TG_OP,
      v_rec, v_user_id, v_user_role, v_user_name
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF to_jsonb(OLD) IS DISTINCT FROM to_jsonb(NEW) THEN
      INSERT INTO public.audit_log (
        table_name, record_id, operation,
        old_data, new_data, changed_by, changed_by_role, changed_by_name
      )
      VALUES (
        TG_TABLE_NAME, v_record_id, TG_OP,
        to_jsonb(OLD), v_rec, v_user_id, v_user_role, v_user_name
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (
      table_name, record_id, operation,
      old_data, changed_by, changed_by_role, changed_by_name
    )
    VALUES (
      TG_TABLE_NAME, v_record_id, TG_OP,
      v_rec, v_user_id, v_user_role, v_user_name
    );
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================
-- AUDIT LOG: 套用 Trigger 到 10 張表
-- ============================================
CREATE TRIGGER deals_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER scores_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.scores
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER profiles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER tasks_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER settings_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER comments_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER pain_points_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.pain_points
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER score_notes_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.score_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER deal_questions_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.deal_questions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

CREATE TRIGGER stage_checklist_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.stage_checklist
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_func();

-- ============================================
-- AUDIT LOG: 自身的 RLS（admin-only read, no write）
-- ============================================
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_admin_read ON public.audit_log
  FOR SELECT TO authenticated USING (public.is_admin());

-- 不設 INSERT/UPDATE/DELETE policy = 全擋
-- trigger function 使用 SECURITY DEFINER 繞過 RLS 寫入


附錄 B：診斷與驗證 SQL
B.1 健檢清單（建議每月跑一次）
-- 1. 確認所有 public 表 RLS 都還是 enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND rowsecurity = false;
-- 期望：0 行（所有表都已開）

-- 2. 確認 helper functions 都存在且設定正確
SELECT 
  proname, 
  prosecdef AS is_security_definer,
  proconfig
FROM pg_proc 
WHERE proname IN ('is_admin', 'is_team_lead', 'is_manager', 'user_team_id', 'can_access_deal');
-- 期望：5 行，全部 is_security_definer = true，proconfig 含 search_path

-- 3. 確認所有 policy 都還在
SELECT count(*) AS policy_count
FROM pg_policies 
WHERE schemaname = 'public';
-- 期望：47 行（如有變動，更新此數字）

-- 4. 確認所有 audit trigger 都還在
SELECT count(*) AS trigger_count
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
  AND trigger_name LIKE '%_audit';
-- 期望：30（10 表 × 3 種 operation）

-- 5. 確認 audit_log 表 RLS 設定正確
SELECT 
  policyname, 
  cmd, 
  qual
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'audit_log';
-- 期望：1 行，只有 audit_log_admin_read (SELECT)
B.2 安全紅旗檢查（任何結果都需要立刻處理）
-- 紅旗 1: 有任何 policy 套用到 public role（除 mindmap_nodes 已知例外）
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND 'public' = ANY(roles)
  AND tablename != 'mindmap_nodes';
-- 期望：0 行

-- 紅旗 2: 有任何 public 表沒開 RLS
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;
-- 期望：0 行

-- 紅旗 3: helper function 沒有 SECURITY DEFINER
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN ('is_admin', 'is_team_lead', 'is_manager', 'user_team_id', 'can_access_deal')
  AND NOT prosecdef;
-- 期望：0 行

-- 紅旗 4: audit_log 有意外的寫入 policy
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'audit_log'
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE');
-- 期望：0 行



文件結束

如需更新此文件，請同時更新「變更歷史」並 commit 到 hughlee-star/hughlee-sales-manage-flow 的 docs/SECURITY.md。

