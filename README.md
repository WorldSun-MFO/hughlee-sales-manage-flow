# WORLDSUN MEDDIC Pipeline

> **沃勝聯合家族辦公室(Multi-Family Office)** 內部銷售管理系統。
> 網頁版 MEDDPICC 資格評分 + Pipeline Tracker(L1–L7)+ AI 助手 + AI 路徑規劃,給 10 人銷售團隊共用,手機可用,即時同步。
>
> 業務脈絡、銷售方法論、功能規格見 [`docs/BUSINESS_CONTEXT.md`](./docs/BUSINESS_CONTEXT.md);資料安全架構見 [`docs/SECURITY.md`](./docs/SECURITY.md)、誤刪還原見 [`docs/RECOVERY.md`](./docs/RECOVERY.md)。

> ⚠️ Playbook v2.1 已升級為 MEDDPICC(MEDDIC + Paper Process),目前 codebase 實作仍為 MEDDIC,Paper Process 欄位尚未落入 schema/UI,列為 backlog。L0(Source)與 L8(Expand)同樣為 Playbook 已定義、實作未完成。

---

## 特色

- **Google 登入**(Supabase Auth)
- **MEDDIC 評分卡**:8 項 × 0–10,自動算總分與建議階段
- **L1–L7 七階段漏斗**:視覺化 + KPI + 加權預測
- **階段退出 checklist**:每階段的關鍵問題,全勾才能推進
- **痛點 → 商品** 即時對應建議
- **紅旗警示**:EB 未確認、總分過低、30+ 天未更新
- **即時同步**(Supabase Realtime):團隊成員編輯,其他人即時看到
- **三層權限**(rm / team_lead / admin):RM 只看自己客戶、team_lead 看團隊、admin 看全部
- **AI 助手**:互動記錄解析、成交路徑規劃(Claude Opus 4.7)
- **任務追蹤、檔案/圖片附件、每週 email 戰報**
- **Market Intel**(市場情報)Phase 0
- **完全響應式**:手機、平板、桌機都順

---

## Tech Stack & Key Dependencies

| 類別 | 技術 | 版本 |
|---|---|---|
| Framework | Next.js (App Router) | ^15.5.4 |
| UI | React / React DOM | ^19.0.0 |
| 語言 | TypeScript (strict) | ^5.7.3 |
| 樣式 | Tailwind CSS | ^3.4.17 |
| BaaS | Supabase (Postgres + Auth + Realtime + RLS + Storage) | js ^2.47.10 / ssr ^0.5.2 |
| AI | @anthropic-ai/sdk | ^0.68.0 |
| Email | resend | ^4.0.1 |
| 驗證 | zod | ^3.24.1 |
| 圖示 | lucide-react | ^0.469.0 |
| 樣式工具 | clsx ^2.1.1 / tailwind-merge ^2.6.0 | — |
| 部署 | Vercel Pro| — |

主力 AI 模型:Claude **Opus 4.7**(`claude-opus-4-7`),adaptive thinking。
成本:約 $0 / 月(Supabase Free + Vercel,10 人規模內;現用 Vercel Pro 取 300s 函式上限)。

---

## 目錄結構

```
src/
  app/
    api/
      ai/{generate-plan,parse-interaction}/route.ts   # Opus 4.7,maxDuration=300
      cron/weekly-report/route.ts                      # Vercel Cron 觸發
    auth/callback/route.ts                             # Google OAuth callback
    login/page.tsx
    page.tsx · layout.tsx · globals.css
  components/
    {AIChatModal,Dashboard,DealDetail,NewDealModal,
     PlanModal,SettingsModal,TasksTab}.tsx
    ui/{Button,Input,Textarea}.tsx                     # forwardRef + variant/size map
  lib/
    anthropic/{client,playbook,schemas}.ts             # PLAYBOOK_KNOWLEDGE 系統 prompt
    supabase/{client,server}.ts
    {cn,constants,types,utils}.ts
  middleware.ts                                        # Auth 守門,排除 /api/*

supabase/
  schema.sql · seed.sql
  migration_2_team_members.sql … migration_25_comments_update_policy.sql
```

- Server Components 取資料 → 傳給 Client Components 渲染
- Path alias:`@/*` → `./src/*`(見 tsconfig.json)
- `next.config.mjs`:`{ typedRoutes: false }`、`experimental.staleTimes`

---

## 環境變數

| 變數 | 用途 | 必要性 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | 必設 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 瀏覽器端 anon key | 必設 |
| `SUPABASE_SERVICE_ROLE_KEY` | 僅 weekly-report cron 用 | 必設(server only) |
| `ANTHROPIC_API_KEY` | Claude Opus 4.7 | 必設 |
| `RESEND_API_KEY` | 每週戰報寄送 | 必設 |
| `RESEND_FROM_ADDRESS` | 寄件者(網域驗證前限本人信箱) | 必設 |
| `CRON_SECRET` | 保護 cron endpoint | 生產視為必設(見下) |

---

## 本地開發

```bash
cp .env.local.example .env.local   # 填入 Supabase URL 與 anon key 等
npm install                        # 首次 / 換相依套件後必跑(repo 預設無 node_modules)
npm run dev                        # 本機開發 → http://localhost:3000
```

其他指令:

```bash
npm run build       # 生產建置(等同 Vercel 會跑的;含 ESLint)
npm run start       # 啟動生產 server
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # vitest 單元測試
```

> **發布前驗證流程(必遵守)**:任何改動 **推 main 前一定先在本機跑 `npm run typecheck` 且 `npm run build`**,兩者皆綠燈才 commit / push。不要盲推 Vercel 才發現 build 失敗。純文件(.md)變更可略過 build。
> ⚠️ dev 模式每條路由「第一次」進去會即時編譯(1–2 秒),量效能請用 `npm run build && npm run start` 或實際部署。

---

## 程式碼慣例

- **TypeScript strict**;Supabase 回傳型別不合時用 `as unknown as <Type>` 收斂,勿用 `any` 散落。
- **UI primitives**:`forwardRef` + `variant`/`size` 的 `Record` map,以 `cn()`(clsx + tailwind-merge)合併 class。
- **Server / Client 分界**:資料抓取放 Server Component,互動放 Client Component。
- **Supabase client**:瀏覽器用 `lib/supabase/client.ts`,server 用 `lib/supabase/server.ts`,勿混用。
- **Migration**:手動於 Supabase SQL Editor 執行,寫成 idempotent(`if not exists` / `drop … if exists` 後重建)。
- **AI route**:`export const runtime = 'nodejs'`、`export const maxDuration = 300`;大 `max_tokens` 需用 `client.messages.stream()` + `await stream.finalMessage()`。

---

## Security / Production Readiness

- **`CRON_SECRET`** 在生產環境視為**必設**,正式營運前須補上。
- **`SUPABASE_SERVICE_ROLE_KEY`** 僅用於 `/api/cron/weekly-report`,**不得**在任何 client component 或瀏覽器可達路徑出現。
- **RLS 政策**變更後一律手動驗證 `can_access_deal()` helper 涵蓋三層權限(rm / team_lead / admin)。
- **AI endpoint(`/api/ai/*`)** 務必確認有 server-side 認證,**不可僅靠 middleware**(middleware 的 matcher 已排除 `/api/*`)。

---

## 資料安全(必讀)

所有 RLS policy、helper functions、audit log 架構與一鍵還原 SQL 詳見 [`docs/SECURITY.md`](./docs/SECURITY.md)。
**誤刪案件緊急還原**:admin 照 [`docs/RECOVERY.md`](./docs/RECOVERY.md) 的兩行 SOP 操作即可。

### 修改 schema 時的必做事項

1. **新增 table**:必須 `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` + 至少一條 policy;評估是否加 audit trigger(見 SECURITY.md 4.4);同步更新 SECURITY.md 附錄 A。
2. **修改既有 table 欄位**:不需改 RLS(除非新欄位涉及權限判斷);audit trigger 用 `to_jsonb(NEW)` 全表抓取會自動適應。
3. **修改 helper functions**(is_admin / can_access_deal 等):必須保留 `SECURITY DEFINER` + `SET search_path = public`;同步更新 SECURITY.md 附錄 A。

### 紅線

- **絕對不要** disable RLS(即使只是「測試一下」)。
- **絕對不要** 給 audit_log 新增 INSERT/UPDATE/DELETE policy。
- **絕對不要** 把 service_role key 暴露到前端。

---

## 部署

平台:**Vercel Pro**(函式上限 300s),推 `main` 即自動建置部署。Supabase migration 需**手動**於 SQL Editor 貼上執行(無自動化管道)。

### 首次部署(約 20–30 分鐘)

架構:

```
[使用者 Chrome/Safari] → Google 登入
[Vercel] ← Next.js app ← 本 repo
[Supabase] ← Postgres + Auth + Realtime
[Google Cloud Console] ← OAuth Client
```

1. **建立 Supabase 專案**:supabase.com → New project(Region 選 Singapore / Tokyo,Plan Free)→ Project Settings → API 記下 `Project URL` 與 `anon public key`。
2. **建立資料表**:SQL Editor → New query → 貼上 `supabase/schema.sql` → Run;再貼上各 `supabase/migration_*.sql`(依編號順序)。
3. **設定 Google OAuth**:
   - Google Cloud Console → 新增專案 → OAuth 同意畫面(External,加入團隊 Gmail 為 test users,或發布應用程式)。
   - 憑證 → 建立 OAuth 用戶端 ID(Web 應用程式)。
   - Supabase → Authentication → Providers → Google → 複製 **Callback URL**(`https://<project>.supabase.co/auth/v1/callback`)貼進 Google「已授權的重新導向 URI」→ 建立 → 拿 Client ID / Secret。
   - 回 Supabase Google provider → 貼入 Client ID / Secret → Enable → Save。
4. **上傳程式碼到 GitHub**,於專案資料夾:
   ```bash
   git init && git add . && git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<帳號>/<repo>.git
   git push -u origin main
   ```
5. **部署到 Vercel**:vercel.com → Add New Project → Import repo → Framework 自動偵測 Next.js → 加環境變數(見上方「環境變數」表)→ Deploy → 拿到 `xxx.vercel.app`。
6. **設定 Auth 網域**:Supabase → Authentication → URL Configuration:
   - **Site URL**:你的正式網址(例 `https://sales-manage-flow.wsgfo.com`)。
   - **Redirect URLs**:加入 `https://<你的網域>/auth/callback`(自訂網域與 vercel preview 都要各自加;wildcard `*` 不跨網域)。
7. **第一次登入 + 升級管理員**:用自己的 Google 帳號登入一次,再到 SQL Editor 執行:
   ```sql
   update public.profiles set role = 'admin' where email = '你自己的@email';
   ```
   重新整理即為 admin。
8. **邀請團隊 + 匯入客戶**:請 RM 各登入一次(profile 自動建立)→ 改 `supabase/seed.sql` 最上面的 RM email 為實際登入帳號 → 貼到 SQL Editor Run。

### 持續部署

改完程式 `git push` → Vercel 自動重新部署(約 1–2 分鐘)。

- **Cron**:`vercel.json` → `0 1 * * 0`(週日 01:00 UTC = 台北週日 09:00),觸發 `/api/cron/weekly-report`。
- **Email**:Resend 網域(wsgfo.com)驗證完成前,戰報只能寄到本人信箱;完成後將 `RESEND_FROM_ADDRESS` 改為正式寄件者。
- **自訂網域**:Vercel → Settings → Domains 綁網域;綁完**務必**回 Supabase URL Configuration 更新 Site URL 與 Redirect URLs,否則登入後會彈回 vercel.app。
- **git push 注意**:token-in-URL 推送不會更新本機 `origin/main` ref,推完若顯示 "ahead by N" 用 `git fetch origin` 同步。

### 維運備忘

- **新 RM 加入**:請他用 Google 登入一次,profile 自動建立,之後可指派案件。
- **升級管理員**:`update public.profiles set role = 'admin' where email = '...';`
- **備份**:Supabase Free 方案每天自動備份、保留 7 天。

### 常見問題

- **登入跳回登入頁 / 彈回 vercel.app**:Supabase URL Configuration 的 Site URL / Redirect URLs 沒設對。
- **看不到任何 deals**:RLS 是「RM 只看自己的」,確認 role 已升為 admin,或帳號名下有 deal。
- **Google 按下去沒反應**:OAuth 同意畫面還在「測試中」而你的 Gmail 沒加入 test users。

---

## AI 模型與成本

- **主力模型**:Claude **Opus 4.7**(互動解析 `/api/ai/parse-interaction`、成交路徑規劃 `/api/ai/generate-plan`)。
- **系統 prompt** 透過 `lib/anthropic/PLAYBOOK_KNOWLEDGE` 啟用 **prompt caching**,務必保持**靜態字串**,**不得動態插值或拼接**(任何 byte 變動都會使 cache 失效)。
- **降本路徑**(未實施,僅備忘):結構簡單的輔助 endpoint(task 摘要、自動標籤)未來可評估切換至 Sonnet 4.6 / Haiku 4.5。

---

## Git Workflow

- 單一 `main` branch;協作改走 **PR review 流程**。
- **Migration 編號規則**:新增前先 `ls supabase/migration_*.sql` 確認最大編號 + 1。
- 既有的編號衝突(`migration_7` / `migration_8` 各有兩支)**不回頭改名**,以**已套用版本**為準,新檔從未衝突的下一個編號繼續。

---

## 已知 TODO / In-Progress

- **Resend 網域驗證**:wsgfo.com 經 Cloudflare 設定,完成前戰報僅達本人信箱。
- **MEDDPICC 升級**:Paper Process 欄位尚未進 schema/UI(backlog)。
- **L0(Source)/ L8(Expand)**:Playbook 已定義、實作未完成。
