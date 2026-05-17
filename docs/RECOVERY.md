# 誤刪案件還原 SOP（Recovery Runbook）

> WORLDSUN MEDDIC Pipeline ｜ 給 admin 的緊急操作手冊
> 深層架構與設計理由見 [`docs/SECURITY.md`](./SECURITY.md)；本文只講「出事了怎麼救」。
> 最後更新：2026-05-17

---

## 🚨 緊急：有人誤刪了案件，怎麼救？

**admin 進 Supabase → 左側 `SQL Editor` → 貼上、按 Run。兩行搞定：**

```sql
-- 第 1 行：列出近 30 天被刪、目前不存在的案件，找到要救的那筆，複製它的 deal_id
SELECT * FROM public.list_deleted_deals();

-- 第 2 行：把 deal_id 貼進去，一行還原（連評分等子資料一起）
SELECT public.restore_deleted_deal('貼上剛剛複製的 deal_id');
```

- 結果出現在畫面**下半部表格區**。第 2 行會回一段 jsonb 摘要（各子表還原幾筆）。
- 回 pipeline 平台**重新整理頁面**，案件就回來了（你是 admin，看得到所有案件）。
- 找更舊的：`SELECT * FROM public.list_deleted_deals(365);`（列近一年）。
  清單看不到不代表救不回——只要知道 deal_id，`restore_deleted_deal` 不限時間。

就這樣。不需要、也**不要**用「整庫 Daily Backup 還原」去救單一案件（那會把全團隊之後輸入的資料一起倒退）。

---

## 救得回什麼？救不回什麼？（誠實邊界）

| | 範圍 |
|---|---|
| ✅ 救得回 | 案件本體 `deals` ＋ `scores`（MEDDIC 評分）、`score_notes`、`stage_checklist`、`deal_questions`、`comments`、該案件的 `tasks` |
| ❌ 救不回 | `stage_history`（階段變動史）、上傳的**附件檔案**、市場情報連結、family wallet map —— 這些不在 audit 範圍（設計上接受） |

⚠️ **時間分界（重要）**：`2026-05-17` 的 `migration_16` 修好 audit 安全網**之前**就被刪的案件，只救得回「殼」（當時 `scores` 等 4 張子表的刪除沒被記錄）。**那天之後**的誤刪 = 完整還原。jsonb 摘要會逐表標明筆數，0 筆代表當次沒抓到。

---

## 它為什麼有效？（30 秒理解，建立信任）

- 系統**沒有做軟刪除**（這是 `SECURITY.md` §6.1 的刻意決策）。
- 取而代之：`audit_log` 是一張**不可篡改**的表，自動把每一次 INSERT/UPDATE/**DELETE** 的完整資料以 JSONB 永久存下來。
- `restore_deleted_deal()` 就是讀 audit_log 那筆 DELETE 紀錄、自動把案件重建回去。
- **還原動作本身也會記進 audit_log** → 誰在何時救了哪筆，合規可追溯。
- 函數有保護：若該案件目前仍存在，會**拒絕執行**（不會蓋掉現有資料）。

---

## 操作須知

- **權限**：僅 admin。在 SQL Editor 以特權角色直接跑也可（那本來就是 DB 管理者的場域）。
- **想先預覽不寫入**：把指令前後包起來——
  `BEGIN;` … 你的 `SELECT restore_deleted_deal(...);` … `ROLLBACK;`
  → 看得到結果但不會真的存檔（`ROLLBACK` = 撤銷）。確定要救才改成 `COMMIT;`，或直接跑不包（函數是原子交易，安全）。
- **救完驗證**：回平台重新整理，案件出現在對應漏斗階段即可；或 `SELECT id,name,stage FROM deals WHERE name='案件名';`。

---

## 背景（institutional memory，給未來維護者）

`2026-05-17`：發現 prod 的 `audit_trigger_func()` 把 `record_id` 寫死 `NEW.id`，但 `scores`/`score_notes`/`stage_checklist`/`deal_questions` 沒有 `id` 欄 → 寫入癱瘓，4 張表的 audit trigger 曾被緊急 DROP 止血。`migration_16` 改用通用 record_id 根治並補回 30 個 trigger；`migration_17` 新增本文的兩個還原函數。詳見：

- [`supabase/migration_16_fix_audit_trigger_recordid.sql`](../supabase/migration_16_fix_audit_trigger_recordid.sql) — audit 安全網根治
- [`supabase/migration_17_restore_deleted_deal.sql`](../supabase/migration_17_restore_deleted_deal.sql) — 還原工具本體
- [`docs/SECURITY.md`](./SECURITY.md) §4.6 / §6.1 / 附錄 A — 完整架構與決策

> 可選後續（尚未做）：把這兩個函數接成 app 內 admin 的「最近刪除」頁面，做成滑鼠一鍵。
