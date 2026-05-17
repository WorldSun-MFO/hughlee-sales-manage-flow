# Session 2026-05-17 — Migration 15 + UX Polish v1

## 時段
09:30 - 17:55 (約 8.5 小時)

## 完成項目

### Migration 15 (production 已落地)
- commit: 05ce830
- DB 改動: public.deals 新增 3 欄 (family_wallet_map_*) + 
  public.wallet_map_audit_log 表 + 2 條 RLS policy + 1 trigger
- 對 production UI 隱形 (NULL 預設,前端不讀)
- Hugh 親自 Supabase SQL Editor dry-run + real-run + 14 項驗證

### UX Polish v1 (preview, 未推 main)
- commit: f294f1e
- 2 檔: Dashboard.tsx + DealDetail.tsx
- 卡點 1: 漏斗階段分佈預設收起
- 卡點 2: Case detail modal 桌機置中 80vw / 手機全螢幕 / ESC 關閉

## 重大方向轉折

Hugh 揭露既有系統已有市場大腦 (Phase 5.x) + ClientAmmoCard。
Wallet map markdown blob 無法被市場大腦 query,功能重疊。

決議:
- Session 3-5 wallet map 前端暫停不做
- DB 結構保留 (Session 2 投資不浪費)
- Next sprint = Pipeline UX Polish (v1 已起步)

## PENDING (給明天的 Hugh)

### 高優先
1. UX v1 眼睛驗證 (今天 SSO 卡死沒驗證)
   - 解法:無痕視窗 → 先登 Vercel → 進 Deployments → HozHuWWSk → Visit
   - 驗證清單:桌機 7 項 + 手機 3 項 (見下方)
   
2. feature/family-wallet-map merge main 決策
   - 3 個 commit: d613c8f, 05ce830, f294f1e
   - merge 後 UX 改動會上 production,同事會看到新版
   - 建議:先 v1 自己驗證 OK + 用 1-2 天確認沒 regression,再 merge

### 中優先 (這週)
3. Hugh 自己當 RM 用既有系統一週,累積 UX 卡點清單
4. 累積 8-15 條卡點後 batch 改 (UX Polish v2)

### 低優先
5. 結構化客戶資料設計 (餵食市場大腦) — 需先觀察既有 matching 效果
6. Notion client database Name 欄真名→代號改造 (80 筆)

## 驗證清單 (UX v1)

桌機 7 項:
□ 漏斗階段分佈預設收起
□ DealDetail 置中 modal 寬約 80vw
□ DealDetail 不貼邊(max 1200px)
□ 點背景關閉
□ 按 ESC 關閉
□ 右上 ✕ 關閉
□ 開 AI 助手後按 ESC,DealDetail 不關

手機 3 項:
□ DealDetail 整頁切換
□ 左上 ← 鍵可返回
□ 漏斗階段分佈預設收起

## 認知收穫

- production migration 完整流程 (dry-run → real-run → 驗證)
- Claude Code 寫 SQL、Hugh 親跑 Supabase 的角色分離
- 截圖前打碼客戶資料的紀律
- 「這個建議跟我現有系統怎麼配?」的提問習慣
- solo founder 該做拍板者、不該做 debugger
- 卡死時選擇收手 > 硬突破打開資安洞

## 重新進入指引

下次開機:
1. 讀這份 report (3 分鐘)
2. 開無痕視窗,先登 vercel.com,再去 Deployments 找 HozHuWWSk
3. 跑驗證清單
4. 全 OK → 評估 merge main
5. 有 NG → v1.1 修
