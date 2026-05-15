> 業務脈絡與功能規格請見 docs/BUSINESS_CONTEXT.md

# CLAUDE.md

本檔案提供 Claude Code 在此 repo 工作時的技術指引。商業邏輯、銷售方法論、功能規格請參閱上方 BUSINESS_CONTEXT.md。

---

## Project Overview

WORLDSUN MEDDIC Pipeline — 沃勝聯合家族辦公室(Multi-Family Office)的網頁版銷售管理系統。
以 MEDDIC 方法論為核心的銷售漏斗(L1–L7),供 10 人銷售團隊直接使用與跟進。

> ⚠️ Playbook v2.1 已升級為 MEDDPICC(MEDDIC + Paper Process),目前 codebase 實作仍為
> MEDDIC,Paper Process 欄位尚未落入 schema/UI,列為 backlog。L0(Source)與 L8(Expand)
> 同樣為 Playbook 已定義、實作未完成。

核心能力:
- 漏斗階段視覺化、案件階段切換的評分與積分
- 三層權限(rm / team_lead / admin),RM 只看自己客戶、team_lead 看團隊、admin 看全部
- AI 助手:互動記錄解析、成交路徑規劃(Claude Opus 4.7)
- 任務追蹤、檔案/圖片附件、每週 email 戰報
- 心智圖 PWA(語音轉文字)— 獨立模組
- Market Intel(市場情報)Phase 0

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
| 語音 | OpenAI Whisper(心智圖模組) | — |
| 部署 | Vercel Pro(函式上限 300s) | — |

主力 AI 模型:Claude **Opus 4.7**(`claude-opus-4-7`),adaptive thinking。

---

## 目錄結構

```
src/
  app/
    api/
      ai/{generate-plan,parse-interaction}/route.ts   # Opus 4.7,maxDuration=300
      cron/weekly-report/route.ts                      # Vercel Cron 觸發
      mindmap/{nodes,nodes/[id],voice}/route.ts        # 心智圖模組
    auth/callback/route.ts                             # Google OAuth callback
    login/page.tsx
    mindmap/{page,inbox/page,n/[id]/page,search/page}.tsx
    page.tsx · layout.tsx · globals.css
  components/
    {AIChatModal,Dashboard,DealDetail,NewDealModal,
     PlanModal,SettingsModal,TasksTab}.tsx
    mindmap/{MobileShell,NodeComposer,NodeEditor,NodeListItem,VoiceRecorder}.tsx
    ui/{Button,Input,Textarea}.tsx                     # forwardRef + variant/size map
  lib/
    anthropic/{client,playbook,schemas}.ts             # PLAYBOOK_KNOWLEDGE 系統 prompt
    supabase/{client,server}.ts
    mindmap/types.ts
    {cn,constants,types,utils}.ts
  middleware.ts                                        # Auth 守門,排除 /api/*

supabase/
  schema.sql · seed.sql
  migration_2_team_members.sql … migration_12_market_intel.sql
```

- Server Components 取資料 → 傳給 Client Components 渲染
- Path alias:`@/*` → `./src/*`(見 tsconfig.json)
- `next.config.mjs`:`{ typedRoutes: false }`

---

## 環境變數

| 變數 | 用途 | 必要性 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 專案 URL | 必設 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 瀏覽器端 anon key | 必設 |
| `SUPABASE_SERVICE_ROLE_KEY` | 僅 weekly-report cron 用 | 必設(server only) |
| `ANTHROPIC_API_KEY` | Claude Opus 4.7 | 必設 |
| `OPENAI_API_KEY` | Whisper 語音轉文字 | 心智圖模組需要 |
| `RESEND_API_KEY` | 每週戰報寄送 | 必設 |
| `RESEND_FROM_ADDRESS` | 寄件者(網域驗證前限本人信箱) | 必設 |
| `CRON_SECRET` | 保護 cron endpoint | 標「可選」(見下節) |

---

## Security / Production Readiness

- **`CRON_SECRET`** 在生產環境視為**必設**,目前標為「可選」僅為開發期權宜,
  正式營運前須補上。
- **`SUPABASE_SERVICE_ROLE_KEY`** 僅用於 `/api/cron/weekly-report`,
  **不得**在任何 client component 或瀏覽器可達路徑出現。
- **RLS 政策**變更後一律手動驗證 `can_access_deal()` helper 涵蓋三層權限
  (rm / team_lead / admin)。
- **AI endpoint(`/api/ai/*`)** 務必確認有 server-side 認證,
  **不可僅靠 middleware**(middleware 的 matcher 已排除 `/api/*`)。

---

## 開發指令

```bash
npm run dev        # 本機開發(注意:Hugh 的機器未裝 Node,實際以 Vercel build 驗證)
npm run build      # 生產建置
npm run start      # 啟動生產 server
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

> Hugh 的 MacBook Air 未安裝 Node.js。所有驗證以「推上 main → Vercel 自動建置」為準。
> 修改後請務必確認 TypeScript / build 能在 Vercel 通過再交付。

---

## 程式碼慣例

- **TypeScript strict**;Supabase 回傳型別不合時用 `as unknown as <Type>` 收斂,
  勿用 `any` 散落。
- **UI primitives**:`forwardRef` + `variant`/`size` 的 `Record` map,
  以 `cn()`(clsx + tailwind-merge)合併 class。
- **Server / Client 分界**:資料抓取放 Server Component,互動放 Client Component。
- **Supabase client**:瀏覽器用 `lib/supabase/client.ts`,
  server 用 `lib/supabase/server.ts`,勿混用。
- **Migration**:手動於 Supabase SQL Editor 執行,寫成 idempotent
  (`if not exists` / `drop ... if exists` 後重建)。
- **AI route**:`export const runtime = 'nodejs'`、`export const maxDuration = 300`;
  大 `max_tokens` 需用 `client.messages.stream()` + `await stream.finalMessage()`。

---

## AI Model Selection & Cost

- **主力模型**:Claude **Opus 4.7**(互動解析 `/api/ai/parse-interaction`、
  成交路徑規劃 `/api/ai/generate-plan`)。
- **系統 prompt** 透過 `lib/anthropic/PLAYBOOK_KNOWLEDGE` 啟用 **prompt caching**,
  務必保持**靜態字串**,**不得動態插值或拼接**(任何 byte 變動都會使 cache 失效)。
- **降本路徑**(未實施,僅備忘):結構簡單的輔助 endpoint(如 task 摘要、自動標籤)
  未來可評估切換至 Sonnet 4.6 / Haiku 4.5。
- **Whisper**(語音轉文字)僅用於心智圖 PWA,屬獨立模組,**不影響主 pipeline**。

---

## 部署

- **平台**:Vercel Pro(函式上限 300s),推 `main` 即自動建置部署。
- **Supabase**:migration 需手動於 SQL Editor 貼上執行(無自動化管道)。
- **Cron**:`vercel.json` → `0 1 * * 0`(週日 01:00 UTC = 台北週日 09:00),
  觸發 `/api/cron/weekly-report`。
- **Email**:Resend 網域(wsgfo.com)驗證完成前,戰報只能寄到 `hughlee@wsgfo.com`;
  完成後將 `RESEND_FROM_ADDRESS` 改為 `reports@wsgfo.com`。
- **git push 注意**:token-in-URL 推送不會更新本機 `origin/main` ref,
  推完若顯示 "ahead by N" 用 `git fetch origin` 同步;macOS Keychain 會快取憑證。

---

## Git Workflow

- 單一 `main` branch,目前 solo dev(Hugh)直接推 `main`。
- 未來若加入 collaborator(預計 Johnson),改走 **PR review 流程**。
- **Migration 編號規則**:新增前先 `ls supabase/migration_*.sql`
  確認最大編號 + 1。
- 既有的編號衝突(`migration_7` / `migration_8` 各有兩支)**不回頭改名**,
  以**已套用版本**為準,新檔從未衝突的下一個編號繼續。

---

## 已知 TODO / In-Progress

- **Resend 網域驗證**:wsgfo.com 經 Cloudflare 自動設定
  (NS:harley.ns.cloudflare.com / mimi.ns.cloudflare.com),完成前戰報僅達本人信箱。
- **MEDDPICC 升級**:Paper Process 欄位尚未進 schema/UI(backlog)。
- **L0(Source)/ L8(Expand)**:Playbook 已定義、實作未完成。
- **docs/BUSINESS_CONTEXT.md**:尚未建立(本檔頂端已引用,需補寫)。
- **多人協作準備**:repo 目前在 Hugh 個人帳號(`hughlee-star/`),
  Johnson 接手前需評估轉至組織帳號或加 collaborator,並建立 PR workflow。
