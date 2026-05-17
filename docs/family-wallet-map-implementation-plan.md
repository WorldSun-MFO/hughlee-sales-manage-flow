# Family Wallet Map — Implementation Plan

**Derived from**: `docs/family-wallet-map-spec.md`
**Branch**: `feature/family-wallet-map`(base `579fe03`,spec commit `d613c8f`)
**Status**: Draft — 待 Hugh 逐 Session 批准後執行
**Migration model**: 手動於 Supabase SQL Editor 貼上執行(CLAUDE.md:無自動化管道)

> 本檔是「把 spec 拆成可執行步驟」的工作計畫,**不是 spec**。spec 逐字保存不改;
> 凡 spec 與現況 repo 有落差,一律在此校正並標明理由。

---

## 0. Pre-flight — 開工前必須先解決的 spec ↔ repo 落差

以下用三層陳述(我看到 / 我認為 / 建議)。**A 是 blocker,B 也是,其餘為決策點。**

### A.（Blocker)Migration 編號衝突 — spec 寫 14,實際要用 15

- **我看到**:`ls supabase/migration_*.sql` 顯示 `migration_14_gnews_sources.sql` 已存在(Phase 5.2-b)。spec §3.1 與 §8 DoD 寫的是 `migration_14_family_wallet_map.sql`。
- **我認為這代表**:照 spec 字面建 `migration_14_*` 會與既有檔編號撞號;依 CLAUDE.md「新增前 ls 確認最大號 +1、既有衝突不回頭改名、新檔從未衝突的下一號繼續」,正確檔名是 **`migration_15_family_wallet_map.sql`**。
- **建議**:Session 2 一律用 `migration_15_family_wallet_map.sql`。spec 內文不動(逐字),此校正只存在於本計畫與實作。**需你拍板採用 15。**

### B.（Blocker)spec 的 SQL 非 idempotent,CLAUDE.md 要求 idempotent

- **我看到**:spec §3.1/§3.2 的 SQL 是裸 `ALTER TABLE … ADD COLUMN` / `CREATE TABLE` / `CREATE INDEX` / `CREATE TRIGGER` / `CREATE POLICY`。CLAUDE.md 規定 migration 須 idempotent(`if not exists` / `drop … if exists` 後重建)。
- **我認為這代表**:直接貼 spec SQL,重跑會報「already exists」而中斷,違反 repo 慣例。
- **建議**:Session 2 把 spec SQL 改寫為 idempotent 版本(語意完全等價,不增刪欄位/政策),於計畫內列出改寫後全文供你審。**屬「忠於 spec 語意、符合 repo 慣例」的必要轉寫,非更動需求。**

### C. RLS 權威來源 = migration_8 起,schema.sql 過時(spec §2.2 已正確,附驗證)

- **我看到**:`can_access_deal()` 定義於 `migration_8_teams.sql:77`;`deals_select` 在 `schema.sql:179` 與 `migration_8_teams.sql:105` 各有一份。
- **我認為這代表**:spec §2.2 正確。實作 RLS 一律參照 migration_8 之後;`deals` 表不需新政策(新欄位被既有 row 政策涵蓋),只需為 `wallet_map_audit_log` 建政策。
- **建議**:Session 2 RLS 僅針對 audit log;審查時用 `can_access_deal()` 三層權限(rm/team_lead/admin)手動驗證(CLAUDE.md 規定)。

### D. @uiw/react-md-editor 必須 `next/dynamic` + `ssr:false`

- **我看到**:本專案 Next.js App Router、`next build` 會做 SSR/SSG(先前 build log 有 Generating static pages)。`@uiw/react-md-editor` 依賴瀏覽器 API。
- **我認為這代表**:在 `DealDetail.tsx` 直接 `import` 該編輯器,`next build`(= Vercel 部署用的)極可能 SSR 階段報錯,變紅燈擋部署。
- **建議**:Session 3 一律以 `dynamic(() => import('@uiw/react-md-editor'), { ssr:false })` 載入。列為 Session 3 硬性步驟與驗收點。

### E. npm 2 moderate vulnerabilities（待你定,連動你 CVE 擋部署前例)

- **我看到**:`npm install @uiw/react-md-editor` 後 npm 報 `2 moderate severity vulnerabilities`,建議 `npm audit fix --force`(breaking)。
- **我認為這代表**:不一定擋現在的 build,但你 memory 有「CVE 擋部署」前例,且 `--force` 可能 breaking,屬決策非例行。
- **建議**:**先不動**(我不會自跑 audit fix)。上線前(spec §6 Week 4 前)由你/Johnson 決定:接受、升版、或換編輯器。我可在 Session 5 附 `npm audit` 明細給你判。

### F. Audit log 必須 server-side(IP/UA 不可信任 client)

- **我看到**:spec §3.1 audit 表有 `ip_address INET` / `user_agent`;§3.5 明寫「Use Supabase server action or RPC, not direct client write」。`DealDetail.tsx` 是 client component。
- **我認為這代表**:client 端直接 insert 無法取得可信 IP;需經 server 路徑(Next.js Route Handler 讀 header,或 Supabase RPC/Edge)。這是設計決策。
- **建議**:Session 4 二選一,需你批:**(F1)** 新增 `src/app/api/wallet-map/audit/route.ts`(server 讀 IP/UA、用 service 或 RLS 寫入);**(F2)** Supabase RPC function。預設建議 F1(與既有 `src/app/api/*` 慣例一致)。

### G. 無既有測試框架(Session 5 決策)

- **我看到**:`package.json` scripts 僅 dev/build/start/lint/typecheck,**無 test runner**。spec §8 DoD 多為操作性(政策簽署、建 5 份真實 wallet map、Hugh 週會用過),非自動化測試。
- **我認為這代表**:Session 5「tests」對 Phase 1(spec §2.1 刻意極簡)較合適的是「typecheck+build 綠燈 + RLS 手動驗證 + UAT 檢查表」,而非引入測試框架。
- **建議**:Session 5 採手動 UAT + RLS 驗證查詢對 DoD 打勾;是否引入 test runner 留待 Phase 2。**需你選:手動 UAT(建議) / 引入框架。**

---

## Session 2 — DB Migration + RLS

| 項目 | 內容 |
|---|---|
| 目標 | spec §3.1 欄位/索引/trigger/audit 表 + §3.2 audit log RLS |
| 動的檔案 | **新增** `supabase/migration_15_family_wallet_map.sql`(唯一檔;不動既有 migration、不動 schema.sql) |
| 具體步驟 | 1) 把 spec §3.1+§3.2 SQL 改寫為 idempotent(ADD COLUMN IF NOT EXISTS、CREATE TABLE IF NOT EXISTS、CREATE INDEX IF NOT EXISTS、DROP TRIGGER/POLICY IF EXISTS 後建);2) audit 表 `enable row level security` + 兩條政策(insert own / select via `can_access_deal(deal_id)`);3) 計畫內貼出改寫後 SQL 全文供你審 |
| 預估時間 | 0.5 天(含 idempotent 改寫 + 自審) |
| 執行前需你批准 | ✅ 採 `migration_15` 檔名(落差 A);✅ idempotent 改寫後 SQL 全文(落差 B);✅ 確認手動於 Supabase SQL Editor 由你/Johnson 貼上執行(我不碰正式 DB) |
| 執行後 commit | `supabase/migration_15_family_wallet_map.sql`;message 例:`feat(wallet-map): migration_15 — deals 欄位 + audit log + RLS`;typecheck+build 綠燈才 push |
| DoD 對應 | §8「migration executed」「Audit log RLS deployed and tested」 |

> 注意:spec §3.1 audit 表 `user_id REFERENCES auth.users(id)`。repo 慣例多以 `public.profiles(id)` 做 FK(deals.rm_id→profiles)。**沿用 spec 的 auth.users**(忠於 spec);若 Johnson 要改 profiles 一致性,列為你可選的 Session 2 微調點。

---

## Session 3 — 前端 Section + Editor

| 項目 | 內容 |
|---|---|
| 目標 | spec §3.3.1–3.3.3、§3.4 模板:DealDetail 內可折疊 section + Markdown 編輯器 |
| 動的檔案 | `src/components/DealDetail.tsx`(掛載 section,742 行,僅插入不重構);**新增** `src/components/wallet-map/WalletMapSection.tsx`(主元件,避免再撐肥 DealDetail);`src/lib/types.ts`(加 3 個 deal 欄位型別);deals 資料查詢處(Server Component select 補新欄位 — Session 3 開工首件事先定位該檔) |
| 具體步驟 | 1) 定位 deals 查詢來源、select 補 `family_wallet_map_md/_last_reviewed_at/_updated_at`;2) WalletMapSection:預設折疊、有內容自動展開;3) 編輯器 `dynamic(import('@uiw/react-md-editor'),{ssr:false})`(落差 D);4) `family_wallet_map_md` 為 NULL 時帶入 §3.4 模板;5) 存檔:blur + 明確 Save 鈕 |
| 預估時間 | 1–2 天 |
| 執行前需你批准 | ✅ UX 行為(折疊/展開、blur 自動存是否會誤觸);✅ 新增 `WalletMapSection.tsx` 拆檔方式;✅ 確認儲存走 server(寫 deals 經既有 RLS,client 直寫 or API — 與落差 F 機制一致) |
| 執行後 commit | DealDetail.tsx + WalletMapSection.tsx + types.ts + 資料查詢檔;message 例:`feat(wallet-map): DealDetail 內嵌情報 section + md 編輯器`;typecheck+build 綠燈才 push |
| DoD 對應 | §8「Frontend editor section live in DealDetail.tsx」 |

---

## Session 4 — Watermark + Audit Log + Staleness

| 項目 | 內容 |
|---|---|
| 目標 | spec §3.3.4 浮水印、§3.3.5 禁用、§3.3.2 stale 指示、§3.5 audit、mark_reviewed |
| 動的檔案 | `src/components/wallet-map/WalletMapSection.tsx`(浮水印 attrs、stale 指示、標記已審視鈕);`src/app/globals.css`(§3.3.4 CSS + `@media print`);**新增 audit 機制**(落差 F:預設 `src/app/api/wallet-map/audit/route.ts`);可能微調 Session 2 migration 若 RPC 路線(落差 F2) |
| 具體步驟 | 1) 浮水印:`data-user-email`(取自 Supabase auth/profile)、`data-timestamp`;2) stale:≤30 綠 / 31–60 黃 / 60+ 紅(依 `_last_reviewed_at`);3) 「標記為已審視」更新 `_last_reviewed_at`;4) audit 三事件(view 展開 / edit 存檔 / mark_reviewed)走 server 寫入 |
| 預估時間 | 1 天 |
| 執行前需你批准 | ✅ audit 機制 F1/F2 定案;✅ **誠實caveat**:浮水印是 CSS 嚇阻(opacity 0.05、`@media print` 隱藏),擋不了實體拍照/截圖工具;真正控制力來自 §5 政策 + audit log + 罰則。你需知這點再核准,不要把它當技術防外洩 |
| 執行後 commit | WalletMapSection.tsx + globals.css + audit route(或 RPC migration);message 例:`feat(wallet-map): 浮水印 + 審視時效 + audit log`;typecheck+build 綠燈才 push |
| DoD 對應 | §8「Watermark visible」「Staleness working」「Audit log capturing all three event types」 |

---

## Session 5 — Tests + DoD 驗收

| 項目 | 內容 |
|---|---|
| 目標 | 對 spec §8 DoD 逐項驗收(自動可驗的自動驗,操作性的列檢查表) |
| 動的檔案 | **新增** `docs/family-wallet-map-uat-checklist.md`(UAT + RLS 驗證查詢 + DoD 對照);無 app code 變更(除非 UAT 抓到 bug 另開修正) |
| 具體步驟 | 1) typecheck + build 綠燈;2) RLS 手動驗證:以 rm/team_lead/admin 三身分對 `wallet_map_audit_log` 與 deals 新欄位跑 `can_access_deal()` 涵蓋查詢(CLAUDE.md 規定);3) audit 三事件 smoke test;4) 附 `npm audit` 明細(落差 E)供你上線前定;5) DoD 操作項(政策簽署、5 份真實 wallet map、週會使用)標為 Hugh/Davie 人工項 |
| 預估時間 | 0.5 天 |
| 執行前需你批准 | ✅ Session 5 採「手動 UAT + RLS 驗證」而非引入 test runner(落差 G);✅ RLS 驗證要在哪個環境跑(建議 staging,不在 prod 亂試) |
| 執行後 commit | `docs/family-wallet-map-uat-checklist.md`(+ 任何 UAT 修正另獨立 commit);message 例:`docs(wallet-map): UAT 檢查表 + DoD 驗收`;typecheck+build 綠燈才 push |
| DoD 對應 | §8 全表收尾(技術項自動/半自動;操作項移交人工) |

---

## 附錄

### A1. Session 間依賴
- S2 → S3:前端需 S2 欄位存在(本機可先用 spec schema 假資料平行起手,但合併前 S2 須先落 DB)
- S3 → S4:浮水印/stale/audit 掛在 S3 的 WalletMapSection 上
- S4 → S5:DoD 驗收需 S2–S4 全到位

### A2. Commit / Branch 策略
- 全程在 `feature/family-wallet-map`,每 Session 至少 1 commit、各自 typecheck+build 綠燈才 push(CLAUDE.md + 你的守則)
- 每 commit 一律帶 `Co-Authored-By: Claude Opus 4.7 (1M context)` trailer(repo 慣例)
- Phase 1 完成後再決定何時對 `main` 開 PR(repo 未來要走 PR review,見 CLAUDE.md;solo 階段可由你定直接 merge or PR)

### A3. 回滾
- migration_15 idempotent,且只 ADD COLUMN / 新 audit 表 → 風險低;回滾腳本(DROP COLUMN/TABLE IF EXISTS)在 Session 2 一併附,但**不自動執行**,由你決定
- 前端為新增 section,未改既有 deal 邏輯 → 回滾 = revert feature commit

### A4. 不在 Phase 1(spec §1.3,僅備忘,本計畫不做)
跨 deal 彙總、依家族屬性搜尋、家族關係圖、email/LINE 自動提醒、行動裝置編輯最佳化。

---

**End of Plan**
