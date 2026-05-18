# WORLDSUN Pipeline v2 美編交付包

本文件給協助修改舊版 Pipeline 的老師使用。`/v2` 是純視覺與互動原型，用來定義新版平台應該長什麼樣、怎麼展示、怎麼操作；正式功能仍以舊版第一版 Pipeline 的資料流、Supabase、RLS、AI endpoint 為準。

## 交付目的

把第一版 Pipeline 從「可用的管理頁」升級成「RM 每天願意打開的工作平台」。

核心改版方向：

- 保留舊版正式功能：登入、權限、Supabase tables、AI 解析、成交路徑、任務、附件、週報。
- 只改美編與操作體驗：版面、資訊優先順序、卡片密度、按鈕狀態、視覺節奏。
- 不直接搬 `/v2` 的 demo data 或獨立 model 回正式系統。
- 不新增資料表作為美編前提；若需要新欄位，另開 schema 設計任務。

## 如何查看設計稿

本機啟動：

```bash
npm run dev -- --hostname 127.0.0.1
```

開啟：

```text
http://127.0.0.1:3000/v2
```

若 3000 被佔用，Next.js 會自動改到 3001 或其他 port，依 terminal 顯示為準。

## 切割原則

`/v2` 已經與舊 Pipeline 切開：

- 不讀 Supabase。
- 不走舊登入狀態。
- 不使用舊 `@/lib/types`、`@/lib/constants`、`@/lib/utils`。
- 不連回 `/`、`/market` 或其他舊版頁面。
- 只作為設計參考，不作為正式資料來源。

老師改第一版時，請以「套用設計語言」為主，不要把 `/v2` 當成正式架構搬移。

## 整體設計語言

風格關鍵字：

- 高淨值客戶管理工具
- 安靜、專業、可掃讀
- 少裝飾，多資訊層次
- 像投資委員會 cockpit，不像一般 CRM 表格

視覺規則：

- 主背景：`zinc-50`
- 主文字：`zinc-950`
- 卡片：白底、`border-zinc-200`、`rounded-xl`
- 重要動作：深色底 `zinc-950`
- 風險：`rose`
- 跟進警示：`amber`
- 進度良好：`emerald`
- 分析與建議：`sky` / `violet`

元件圓角以 `rounded-lg` / `rounded-xl` 為主，不要做過度圓潤或花俏漸層。

## 資訊架構

新版主介面分成五個工作視角：

1. Executive Cockpit
2. RM Daily Desk
3. Task Management
4. Deal War Room
5. Market Signals

第一版可以不一定完整新增四個 route；建議先在現有 Dashboard 內用 tab / segmented nav 呈現。

### Executive Cockpit

用途：給 Hugh / team lead / admin 快速看整體狀態。

要呈現：

- Pipeline AUM
- Weighted Forecast
- L4+ 比例
- Red Flag 數量
- 各 stage 案件分布
- 最近推進案件
- 逾期聯繫案件
- team performance

設計重點：

- 第一眼看到「現在哪裡有風險」。
- 數字卡不要太大，保持儀表板密度。
- Stage 分布用橫向 bar / compact card，不要只用大表格。

### RM Daily Desk

用途：RM 每天打開就知道今天該追誰。

要呈現：

- Next best action
- overdue contact
- open tasks
- due soon / late 標籤
- 由 next step 拆出的任務

設計重點：

- 按 urgency 排序，而不是照建立時間。
- 每張卡只顯示「客戶、金額、stage、下一步、原因」。
- 按鈕文字要是動作，不要只是「查看」。

### Task Management

用途：給 COO 每天追蹤全團隊任務進度。

要呈現：

- 未完成任務數
- 已逾期任務數
- 本週到期任務數
- 指派給我的任務數
- 已完成任務數
- 狀態篩選：全部 / 待辦 / 進行中 / 完成
- 指派人篩選
- 案件篩選
- 只看逾期 toggle
- 搜尋任務 / 客戶 / 指派人
- 分組方式：指派人 / 案件 / 到期日

設計重點：

- 這是 COO 的 daily control board，不是 RM 的個人待辦清單。
- 預設應按「指派人」分組，讓 COO 一眼看出誰手上有多少任務。
- 已逾期與本週到期要在第一屏直接露出。
- 任務列要同時顯示 owner、linked deal、due date、priority、status。
- 可保留「新增任務」入口，但第一階段美編可以先不做 modal 細節。

### Deal War Room

用途：單一案件作戰室。

要呈現：

- 左側案件清單與 stage filter
- 右側案件摘要
- MEDDPICC / score evidence map
- 下一步任務拆解
- paper process / decision path
- conversation notes
- linked market signals
- pain-to-product library

設計重點：

- 這是第一版最值得優先改的區塊。
- 原本 DealDetail 若資訊太長，請拆成明確 panel。
- 每個 panel 都要回答一個問題，例如「為什麼這案子卡住」、「下一步做什麼」、「誰是拍板者」。

### Market Signals

用途：把市場資訊轉成客戶推進彈藥。

要呈現：

- signal title
- stance
- region / theme / ticker tags
- summary
- linked clients

設計重點：

- 若第一版暫時沒有完整 Market Intel，先做靜態區塊或隱藏。
- 不要讓市場資訊變成另一個資料列表；它要服務成交推進。

## 第一版建議修改檔案

優先順序如下：

1. `src/components/Dashboard.tsx`
   - 導入 cockpit layout。
   - 調整 pipeline cards、stage summary、風險案件區塊。

2. `src/components/DealDetail.tsx`
   - 改成 War Room 結構。
   - 把 score、notes、plan、tasks、attachments 拆成 panels。

3. `src/components/TasksTab.tsx`
   - 改成 RM Daily Desk 的任務密度與優先排序。
   - 強化 due date、priority、deal context。

4. `src/components/NewDealModal.tsx`
   - 保持功能不變，只調整表單視覺與欄位分組。

5. `src/app/page.tsx`
   - 若目前頁面只包 Dashboard，盡量少動。
   - 資料抓取邏輯不要移到 client component。

## 不建議直接搬的東西

不要直接搬：

- `/src/components/v2/data.ts` 的 demo records。
- `/src/components/v2/model.ts` 的獨立型別，正式系統仍應用現有 `src/lib/types.ts`。
- `/v2` 的 standalone page 架構。
- middleware 裡 `/v2` 的放行邏輯到正式頁面。

可以參考：

- `V2Workspace.tsx` 的資訊分區。
- 卡片、badge、button、panel 的視覺語言。
- cockpit / daily desk / war room / signals 的工作流。

## 元件規格

### Header

目標：

- 左側：產品名與使用者角色。
- 右側：目前視角或主要狀態，不放太多 navigation。

避免：

- 大 hero。
- 行銷式 slogan。
- 過多 CTA。

### Side Nav / View Tabs

使用五個視角：

- Executive Cockpit
- RM Daily Desk
- Task Management
- Deal War Room
- Market Signals

active 狀態：

- `border-zinc-950 bg-zinc-950 text-white`

inactive 狀態：

- `border-zinc-200 bg-white text-zinc-600`

### Metric Card

內容：

- icon
- label
- value
- note

語氣：

- 像管理報表，不像廣告 banner。

### Deal Card

內容順序：

1. 客戶 / 案件名稱
2. RM / owner
3. AUM
4. stage
5. score
6. red flag / next action

避免：

- 一張卡塞完整備註。
- 用太多顏色搶注意力。

### Risk Badge

顏色規則：

- 紅色：會影響成交或合規。
- 黃色：需要追蹤但未必立即危險。
- 綠色：已完成或狀態健康。
- 藍色：分析、建議、下一步。

### Task Row

內容順序：

1. 完成狀態 checkbox
2. 任務標題
3. 任務描述或補充說明
4. 指派人
5. linked deal 或 COO / 內部營運
6. due date
7. priority badge
8. due status badge
9. task status badge

狀態顏色：

- 高優先：rose
- 中優先：amber
- 低優先：zinc
- 逾期：rose
- 三天內到期：amber
- 本週內到期：sky
- 完成：emerald

## 舊版資料邏輯保留清單

老師改美編時，以下邏輯不要動：

- Supabase server/client 分界。
- RLS 權限。
- `can_access_deal()` 相關政策。
- `SUPABASE_SERVICE_ROLE_KEY` 只留在 server-only cron。
- `/api/ai/*` server-side auth。
- AI prompt caching 靜態字串。
- weekly report cron。
- mindmap PWA 獨立模組。

## 驗收清單

第一版改完後，用以下標準驗收：

- RM 進首頁 10 秒內知道今天最該追哪三個案件。
- Admin 進首頁 10 秒內知道 pipeline 風險在哪。
- COO 進任務管理 10 秒內知道誰的任務逾期、哪些本週要完成。
- 任一案件點開後，可以立刻看到下一步、風險、拍板者、文件進度。
- 所有正式資料仍從原本 Supabase 讀取。
- RM / team lead / admin 權限行為不變。
- `npm run typecheck` 通過。
- `npm run build` 通過。

## 建議開發順序

1. 先改 Dashboard cockpit。
2. 再改 DealDetail war room。
3. 再新增 COO Task Management。
4. 再整理 RM Daily Desk。
5. 最後補 Market Signals 或先保留入口。

這樣可以先讓主 Pipeline 變好用，不會因為市場情報或新模組拖慢主流程。
