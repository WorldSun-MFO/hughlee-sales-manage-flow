# BUSINESS_CONTEXT.md

本檔案是 WORLDSUN MEDDIC Pipeline 的業務脈絡層文件,提供 Claude Code 在做業務判斷時的單一參考來源(single source of truth)。

**與 README.md 的分工:**

- README.md(repo 根目錄)= 工程層,描述 codebase 怎麼運作、部署與維運
- docs/BUSINESS_CONTEXT.md(本檔)= 業務層,描述商業邏輯、銷售方法論、為什麼某個欄位這樣設計

**何時讀本檔:**

- 新增與 MEDDPICC、CEG、客戶分級、案件階段相關的功能時
- AI endpoint 的 prompt 涉及銷售判斷邏輯時
- 看不懂某個欄位為什麼存在、或某個 constraint 為什麼這樣設時
- 不需要每次都讀;當前任務若純屬工程實作(typo 修正、樣式調整、依賴升級)無需讀

版本:v1.0 · 維護:Hugh(業務面)· 對應 Playbook 版本:v2.1

---

## 目錄

- WorldSun MFO 業務脈絡
- MEDDPICC 八維度
- L0–L8 Funnel 階段
- 四階客戶分級
- Standard Case Library 六個案例
- CEG Seven-Dimension Discovery v1.1
- 18 Training Scenarios
- Soft Seminar 五大主題群
- 商品光譜對照表
- 給 AI Endpoint 的判斷規則

---

## 1. WorldSun MFO 業務脈絡

> 何時讀本段:設計與「公司定位、收費模式、合規」相關功能;產出客戶溝通文案時。

### 公司定位

沃勝聯合家族辦公室(WorldSun Multi-Family Office,簡稱 WorldSun MFO)是台灣的家族辦公室,服務台灣高資產家族(HNW),核心價值在於資產守護(Protection)、增長(Growth)、跨代傳承(Succession)。

團隊核心成員多為私人銀行(Private Banking)出身,熟悉 KYC、合規流程、跨境結構;與台灣外部會計師、律師長期合作,並於香港、新加坡、百慕達借助當地法規完成客戶傳承規劃(因台灣民法與遺贈稅法對信託架構有結構性限制)。

### 收費模式

機構反傭(Institutional Retrocession)為主,客戶端不直接收費。

> → 對工具設計的影響:

- 客戶端 UI 不顯示「服務費」、「諮詢費」這類欄位
- 案件成交後的「公司收入」記錄在 deal 層級,但對客戶不可見
- 反傭收入結構複雜(機構別、產品別、層級別),需與薪酬制度 v5 對齊

### 合作夥伴

- 香港 EAM(External Asset Manager):跨境配置與保單通路
- 新加坡 CMS(Capital Markets Services):資本市場商品
- 百慕達:長期信託架構
- 香港泓瑞資本:中國企業港股 IPO、滬港通

### 三層權限

| 角色 | 看得到 | 主要動作 |
| --- | --- | --- |
| admin | 全公司所有案件 + 全公司所有客戶 | 設定、跨團隊調度、看週報 |
| team_lead | 自己團隊內所有 RM 的案件與客戶 | 團隊管理、coaching、簽核 |
| rm | 只看自己的案件與客戶 | 日常銷售動作、更新階段、AI 解析 |

> → RLS 由 can_access_deal() helper 統一控制,變更任何權限相關邏輯都要先讀本段確認三層原則不被破壞。

---

## 2. MEDDPICC 八維度

> 何時讀本段:設計 deal scorecard、修改 MEDDIC/MEDDPICC 相關 schema、調整 AI 解析 prompt 的判斷邏輯時。

> ⚠️ 現況:目前 codebase 為 MEDDIC(六字母),Paper Process與 Champion 尚未進 schema/UI。本段提供完整 MEDDPICC 八維度定義,作為未來升級的規格依據。

### 為什麼從 MEDDIC 升級為 MEDDPICC

MEDDIC 缺的兩個字母在 HNW 跨境傳承業務裡是最關鍵的兩個:

- Paper Process:跨境案件卡在 KYC / source of funds 會讓案件晚 3–6 個月落地;沒納入追蹤等於系統性低估完工時點
- Champion:HNW 銷售裡沒有 Champion 的案件成交率低於 15%;不追蹤等於放任低勝率案件吃掉 RM 時間

### 八維度定義

每維度評分 0–3 分(0=未知/未驗證, 1=有訊號但模糊, 2=已確認, 3=已書面/已執行),總分 24 分。

| 字母 | 維度 | HNW 場景的判斷準則 | 評分典型訊號 |
| --- | --- | --- | --- |
| M | Metrics(成功標準) | 客戶用什麼具體指標衡量「這次配置是成功的」?例如「20 年後資產不縮水並完成傳承」、「下一代每月可用現金流 X 萬」、「遺產稅降低 ≥ Y%」 | 0=「投資成功就好」籠統;3=有具體數字 + 時間軸 |
| E | Economic Buyer(經濟決策人) | 在這個家族裡誰能拍板?重點不是誰最有錢,是誰能拍板。常見:家族長輩、太太、企業實際控制人 | 0=不知道;2=已見過;3=已單獨深談 |
| D1 | Decision Criteria(決策標準) | 家族最在意什麼?隱私 / 稅務 / 流動性 / 法律安全 / 傳承公平?排序為何? | 0=猜測;3=客戶口頭明列前三 |
| D2 | Decision Process(決策流程) | 從第一次討論到簽約要經過誰?需要家族會議嗎?需要外部律師看嗎?要多長時間? | 0=不清楚;3=已畫出時間線 |
| P | Paper Process(文件流程) | KYC、source of funds、開戶、核保、融資審批的實際時程與卡點 | 0=未啟動;3=所有文件已備妥 |
| I | Identify Pain(痛點識別) | 不是「商品需求」,是情感痛點——怕兄弟反目、怕配偶接不住、怕政治風險、怕子女被綁架 | 0=表層需求;3=客戶親口說出情感層 |
| C1 | Champion(內部擁護者) | 家族內或顧問圈內有沒有一個人會在我們不在場時替我們說話? | 0=沒有;3=已驗證(對方主動 push 案件) |
| C2 | Competition(競爭) | 客戶同時跟誰談?既有私銀關係多深?是否有家族律師會卡架構? | 0=不知道;3=完全掌握競爭態勢 |

### 進階門檻(hard gates)

- L3 → L4:MEDDPICC 總分 ≥ 16/24,且 M、E、I、C1 任一不可為 0
- L5 → L6:總分 ≥ 19/24,且 P ≥ 2
- 紅旗:任一維度連續兩次會議仍為 0,系統應自動標記

### 對應工具欄位建議

```ts
// 建議的 deal scorecard schema
type MEDDPICCScore = {
  metrics: 0|1|2|3
  economic_buyer: 0|1|2|3
  decision_criteria: 0|1|2|3
  decision_process: 0|1|2|3
  paper_process: 0|1|2|3        // 新增,MEDDIC→MEDDPICC
  identify_pain: 0|1|2|3
  champion: 0|1|2|3              // 新增
  competition: 0|1|2|3
  notes: Record<keyof MEDDPICCScore, string>  // 每維度文字補述
  last_updated_at: Timestamp
}
```

---

## 3. L0–L8 Funnel 階段

> 何時讀本段:修改 STAGES 常數、漏斗視覺化、階段切換邏輯、自動推進規則時。

> ⚠️ 現況:目前實作 L1–L7,L0(Source)與 L8(Expand)為 backlog。本段提供完整定義作為未來實作依據。

### 階段總表

| 階段 | 名稱 | 入口條件 | 出口標準 | 需驗證的 MEDDPICC | 典型時長 |
| --- | --- | --- | --- | --- | --- |
| L0 | Source 分流 | 來源訊號出現 | 來源類型已標記、初判層級(Foundation/Advanced/Premier/Flagship/Nurture)、CRM 卡片建立 | — | 1–2 週(轉介) / 1–6 月(outbound) |
| L1 | 線索 / 初接觸 | 取得聯絡資訊 | 同意 30 分鐘會面 | — | 1–2 週 |
| L2 | 資格初判(MQL) | 會面已確認 | L1+:bankable AUM ≥ 100 萬 USD;非純詢價、非競爭、非假單;或 Nurture(有上升軌跡) | M、I(基礎) | 會面當場–1 週 |
| L3 | 需求探詢(SQL / Discovery) | MQL 通過 | MEDDPICC 總分 ≥ 16/24;Champion 已浮現;EB 已見或明確安排;CEG 七面向 Discovery 已完成 | M、E、D1、D2、I、C1 | 1–3 次會面、2–6 週 |
| L4 | 方案設計 | SQL 通過 | 提案+情境+壓測交付;客戶口頭認同 | + D1 鎖定商品 | 1–2 週 |
| L5 | 談判 / 異議 | 提案已看過 | 總分 ≥ 19/24;EB 同意;重大異議已回應;Paper Process 啟動 | + P、C2 | 1–4 週 |
| L6 | 核保 / 融資 | 簽約意向 | 資產證明提交 / 開戶 / 核保 / 融資審批完成 | P 實際執行 | 4–12 週 |
| L7 | Closed Won | 首期入帳 | 首筆交易執行、黃金 30 天 onboarding 完成 | M 首次驗收 | 4 週(onboarding) |
| L8 | Expand 擴大 | Onboarded | 加碼、新商品、家族延伸、主動轉介請求 | M 重新檢視、新 I 辨識 | 持續 |

### 退場規則(Closed Lost)

從任一階段都可轉為 Closed Lost,需記錄退場原因(列舉):

- 客戶選擇競爭對手
- 家族內部反對
- 規模不符(降為 Nurture 或刪除)
- KYC 無法通過
- 客戶停止回應 3 個月以上
- 其他(自由填寫)

退場原因會餵入週報的「失單分析」段。

### 對應工具實作建議

```ts
type Stage = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7' | 'L8' | 'CLOSED_LOST'

// 階段切換時需驗證的條件(放 lib/constants.ts)
const STAGE_GATES: Record<Stage, StageGate> = {
  L3: {
    requires: { meddpicc_total: 16, must_not_be_zero: ['M', 'E', 'I', 'C1'] },
    error: 'L3 進場需 MEDDPICC ≥ 16 且 M/E/I/C1 任一不可為 0'
  },
  L5: {
    requires: { meddpicc_total: 19, paper_process_min: 2 },
    error: 'L5 進場需 MEDDPICC ≥ 19 且 Paper Process ≥ 2'
  },
  // ...
}
```

---

## 4. 四階客戶分級

> 何時讀本段:處理客戶層級(tier)、服務模式分流、商品可行性矩陣時。

### 分級門檻(以 bankable AUM 為準)

| 層級 | Bankable AUM | 服務模式 | RM 配置 |
| --- | --- | --- | --- |
| L1 Foundation | 100–1,000 萬 USD | 精簡漏斗(L1–L6, 不跑 L0/L8) | 一般 RM 主責 |
| L2 Advanced | 1,000–5,000 萬 USD | 完整漏斗 | Senior RM 主責 |
| L3 Premier | 5,000–8,000 萬 USD | 完整漏斗 + 季度 review | Senior Partner 主責 |
| L4 Flagship | 8,000 萬 USD 以上 | 完整漏斗 + 月度 review + 創辦人介入 | 創辦人 / Senior Partner 主責,新人僅旁聽 |
| Nurture | < 100 萬,但有上升軌跡 | 季度 check-in、內容接觸,不走漏斗 | 由 RM 認領但不計入 pipeline |

### Bankable AUM 定義(重要)

計入:銀行存款、上市股票/ETF、公開基金/債券、上市股權(質押成數內) 不計入:保單現金價值、不動產、未上市股權、收藏品、加密貨幣

> → 這是計算客戶分級的唯一標準,任何 UI/AI 提及 AUM 時都要遵循此定義,避免把不動產或保單算進去造成虛胖。

### 層級升降規則

- 自動升級:當客戶確認的 bankable AUM 跨越門檻 ≥ 6 個月,系統提示 RM 確認升級
- 自動降級:bankable AUM 跌破門檻 ≥ 12 個月,系統提示降級;但 Flagship 一旦進入,不自動降級,需 admin 手動處理
- Nurture → L1:需 RM 主動 promote,系統不自動升

---

## 5. Standard Case Library 六個案例

> 何時讀本段:設計案例庫模組、AI 案例推薦邏輯、RM 訪談前的案例匹配建議時。

### 用途

六個案例為 RM 在 L1–L3 階段「破冰 → Discovery」過程中使用的家族鏡像故事(family mirror stories),不是英雄故事。每個案例 2–3 分鐘可講完,現場依客戶背景挑最相關的一個,目的是引發客戶內在投射、自然進入 Discovery。

### 六個案例

| 編號 | 標題 | 觸發的內在議題 | 適用客戶類型 |
| --- | --- | --- | --- |
| CASE-01 | 兄弟股權分產的世代陰影 | 傳承公平性、世代記憶 | 一代企業主、子女多人、企業股權集中、家族中有過分產衝突歷史 |
| CASE-02 | 驟逝後接不住的太太 | 配偶能力建構、自身在場與否的安全感 | 一代企業主、配偶不熟財務、資產跨多地 |
| CASE-03 | 賣公司後的失序 | 重新定位人生意義 | 剛賣公司套現、資金一次入帳、稅務與配置失序 |
| CASE-04 | CRS 後的多地關注 | 隱私與合規 | 跨國企業主、家族被多地稅局關注 |
| CASE-05 | 二代離開家族企業 | 世代信任、放權時機 | 一代不放權導致二代離開的家族 |
| CASE-06 | 母女投資觀念衝突 | 世代差異、女性主導 | 母女共同決策、世代理財觀差異大 |

### 每個案例的結構欄位

每個案例在工具中應包含以下結構化欄位(供未來案例庫模組使用):

```ts
type CaseStudy = {
  code: string                    // CASE-01 ~ CASE-06
  title: string
  profile: string                 // 客戶基本資料描述
  trigger: string                 // 觸發的內在議題
  audience: string                // 適用對象
  duration: string                // 預期講述時長
  pain: string                    // 情感痛點層(不是技術問題)
  turning_points: Array<{         // 案例轉折點(2-3 個)
    title: string
    detail: string
  }>
  value_process: string           // 過程價值(陪伴、自我發現)
  value_result: string            // 結果價值(架構、稅務、報酬)
  script: string[]                // 口語講述腳本(含停頓標記)
  invitation_questions: string[]  // 故事結尾的 3 個邀請題
  warnings: string[]              // 使用禁忌
}
```

### 給 AI 推薦邏輯的判斷規則

當 RM 在 L1–L2 階段請求「給我推薦適合這個客戶的案例」時,AI 應該:

- 從客戶檔案抓:子女數、企業狀態、是否近期套現、跨境資產、配偶情況
- 比對六個案例的 audience 欄位
- 回傳 1–2 個最相關的案例,並標註為什麼推薦這個
- 不要回傳「全部六個都可以」——這對 RM 沒幫助,逼 AI 做判斷

---

## 6. CEG Seven-Dimension Discovery v1.1

> 何時讀本段:設計 Discovery 訪談相關 UI、AI 解析會議紀錄時、產出 Family Blueprint 時。

### 學理基礎

CEG Worldwide(John Bowen, Russ Alan Prince)的 Wealth Management Formula:WM = IC + AP + RM(Investment Consulting + Advanced Planning + Relationship Management)。Discovery Meeting 是約兩小時的結構化深度訪談,完全不講商品,目的是建立 Family Blueprint(家族藍圖)。

### v1.1 vs v1.0 的差異

v1.1 加入:

- 明確區分「現場使用」(綠色題)與「會後記錄」(黃色區)
- 綠色題=可在客戶面前提問;金色題=會後 RM 自行記錄不問客戶
- 每個面向獨立的會後記錄區

### 七個面向

| 面向 | 中文 | 探詢的核心問題 | 配套技術 |
| --- | --- | --- | --- |
| Values | 價值觀 | 「對你來說,金錢的意義是什麼?」反覆 laddering | Bachrach Values-Based Laddering |
| Goals | 目標 | 5/10/20 年要達成什麼?具體可量化嗎? | Mitch Anthony Life Transitions |
| Relationships | 關係 | 家族成員地圖(誰、什麼關係、誰跟誰親近) | 家族系譜圖繪製 |
| Assets | 資產 | 資產分佈、持有形式、跨境配置 | (會後記錄為主) |
| Advisors | 顧問圈 | 現有的會計師、律師、私銀 RM 是誰? | (不批評既有顧問) |
| Process | 流程 | 過去做過哪些規劃?為什麼放棄? | (找痛點線索) |
| Interests | 興趣與轉折 | 近期生命事件、健康變化、退休計畫 | Mitch Anthony Life-Centered |

### 對應工具的欄位設計

CEG 七面向資料應放在 account 層級(客戶/家族),不是 deal 層級。一個家族可能有多個 deal(不同商品、不同階段),但 CEG 資料一份。

```ts
type CEGProfile = {
  account_id: string
  values: { laddering_notes: string, core_values: string[] }
  goals: { five_year: string, ten_year: string, twenty_year: string }
  relationships: { family_tree: FamilyNode[] }
  assets: { bankable_aum_usd: number, structure_notes: string }
  advisors: { accountants: string, lawyers: string, banks: string }
  process: { prior_planning: string, why_abandoned: string }
  interests: { life_transitions: string[] }
  last_discovery_meeting_at: Timestamp
  family_blueprint_status: 'NOT_STARTED' | 'DRAFT' | 'CONFIRMED'
}
```

### 給 AI 解析會議紀錄的提示

當 RM 上傳會議紀錄請 AI 解析時,AI 應該:

- 標記每段話對應到哪個 CEG 面向
- 特別標出 Values 線索(客戶談到「我希望」、「我擔心」、「我覺得最重要的是」等句型)
- 找出「沒問到的面向」並提醒 RM 下次補上
- 不要試圖在 Discovery 階段推薦商品

---

## 7. 18 Training Scenarios

> 何時讀本段:設計訓練模組、模擬對話 AI、RM coaching 工具時。

> ⚠️ 狀態:18 個情境的完整列表由 Hugh 維護,本段保留結構,具體內容待補。

### 結構

18 個訓練情境分為三大類,各 6 個:

A 類:破冰與信任建立(L1–L2)

- A1–A6:不同類型客戶的破冰應對(轉介客 / 冷接觸 / 二代 / 配偶 / 既有私銀關係深的 / 跨國背景的)

B 類:Discovery 深挖(L3)

- B1–B6:不同情緒狀態的 Discovery 處理(防衛型 / 自信過頭型 / 哀傷型 / 不信任 AI / 過度依賴專業術語 / 家族內部意見分歧)

C 類:異議處理與成交(L4–L6)

- C1–C6:不同異議類型的應對(「我不信任 RM 換來換去」/ 「太貴」/ 「我已經有人做了」/ 「我要回去問律師」/ 「等景氣好再說」/ 「我家人不同意」)

### 給工具設計的建議

每個情境應結構化為:

```ts
type TrainingScenario = {
  code: string                   // A1 ~ C6
  category: 'A' | 'B' | 'C'
  stage: Stage[]                 // 適用的漏斗階段
  client_archetype: string       // 客戶原型描述
  initial_situation: string      // 起手情境
  ideal_response_outline: string // 理想回應的結構(非逐字稿)
  common_mistakes: string[]      // RM 常犯的錯誤
  scoring_rubric: {              // RM 演練後的評分標準
    dimension: string
    weight: number
  }[]
}
```

> → 這個模組的具體 18 個情境需 Hugh 補齊文字內容後再實作。 目前 backlog,優先序低於 MEDDPICC 升級與 L0/L8 階段。

---

## 8. Soft Seminar 五大主題群

> 何時讀本段:設計 Soft Seminar 模組、RM 個人網絡開發工具時。

### 用途

Soft Seminar 是 RM 用個人網絡開發新客戶的工具,不是直接行銷材料。10–12 人 intimate session,roundtable 格式,結尾用反思 checklist 而非產品 deck。目的是讓 RM 在朋友圈中以「組織思考者」而非「賣保險的」身份出現。

### 五大主題群

| 主題群 | 中心議題 | 適合客群 |
| --- | --- | --- |
| Legacy | 跨代傳承、家族治理、遺產規劃 | 50 歲以上、有成年子女 |
| International Mobility | 居留權、第二護照、稅務居住地 | 跨境生活、子女海外發展 |
| Lifestyle / Collectibles | 藝術品、酒、錶、私人飛機 | 已有充足財務基礎、追求生活品質 |
| Longevity | 長壽風險、醫療規劃、退休現金流 | 50 歲以上、健康意識強 |
| Women / Next-Gen | 女性財務自主、二代接班 | 配偶共同決策、二代尚未獨立 |

### 對應工具設計

Soft Seminar 模組應包含:

- 場次管理(主題、時間、地點、講者、與會名單)
- 與會者 → CRM 客戶的關聯(自動建立 Nurture 或 L1 線索)
- 場後 follow-up 提醒(反思 checklist 發送、個別 1-on-1 邀約)
- 場次 ROI tracking(會後 6/12 個月內轉化為案件的數量)

> → 當前不需立刻實作,但設計新功能涉及客戶來源時應考慮 Soft Seminar 為來源之一。

---

## 9. 商品光譜對照表

> 何時讀本段:設計痛點商品矩陣、AI 推薦商品邏輯、客戶層級與商品配對時。

### 商品分類

| 類別 | 商品 | 期間 | 預期報酬 | 適用層級(最低) |
| --- | --- | --- | --- | --- |
| 短中期(3–12M) | FCN(逢低承接) | 3–12 月 | 年化 12–15% | L1 Foundation |
|  | BEN(買入等待) | 3–12 月 | 年化 30%+ | L2 Advanced |
| 中期避險 | 美國和頓土地基金 | 3–5 年 | 年息 6.6% | L1 Foundation |
|  | 高盈基金 | 視商品 | 年息 8% | L2 Advanced |
| 長期傳承主力 | 香港分紅保險 | 25 年 IRR | ~6.5% | L1 Foundation(小單)/ L2+(大單) |
| Lombard Lending | 大東方 + CIMB(1:1.5) | 持續 | PLR 4.2%, LL 後約 9.2% | L2 Advanced |
|  | HSBC Infinite Wealth(非私銀) | 持續 | 固定 2.80%, 500 萬起, 9.52x 槓桿 | L2 Advanced |
|  | HSBC 私銀版 | 持續 | 外部私銀 LL 76.5% | L3 Premier |
|  | 保誠世譽 + DBS | 10Y IRR | 8.2–9.1% | L2 Advanced |
|  | 宏利特別借貸 | 5Y IRR | 5.68–10.8% | L2 Advanced(10M USD 起)/ L3+(50M+) |

### 痛點 → 商品 → 話術對照(節錄)

| 客戶痛點 | 商品 | 話術切入 | 適用層級 |
| --- | --- | --- | --- |
| 「我是超高淨值,一般產品不夠看」 | HSBC 3000 萬級 | 「自付 10.5%,5 年 IRR 24%。」 | L3 Premier |
| 「我錢不夠買大型保單」 | 保誠 + DBS | 「10 萬級距就能進場,港幣 HIBOR 低利套利。」 | L2 Advanced |
| 「希望資產不離手,又要有現金流」 | 所有保費融資 | 「資產不離手,流動性倍增——撬動國際金融資源。」 | L2 Advanced |
| 「擔心台灣政治風險 / 想分散」 | 百慕達信託 + 香港保單 | 「雙管轄區、一走法律、一走合約。」 | L3 Premier |
| 「下一代在國外讀書 / 工作」 | 香港保單 + 信託 | 「受益人可跨境、稅務處理靈活。」 | L2 Advanced |

### SN 成本術語(重要)

- 「私行費」(Private Bank Fee),不是「四行費」
- 100bps SN 案件 default ~ TP × 0.2%

> → 工具中任何顯示 SN 成本的地方都應使用「私行費」一詞,避免使用「四行費」(已知錯誤用法)。

---

## 10. 給 AI Endpoint 的判斷規則

> 何時讀本段:修改 /api/ai/parse-interaction 或 /api/ai/generate-plan 的 prompt 邏輯時。

### 通用原則

- AI 回應一律使用繁體中文,金融專有名詞保留英文(FCN, BEN, Lombard, PLR, EAM, CMS, IRR, KYC, AUM 等)
- 不解釋基礎概念(目標使用者是私銀出身的 RM)
- 直接給判斷,避免免責聲明堆疊
- 數字相關必須明列假設

### /api/ai/parse-interaction(互動解析)

輸入:RM 上傳的會議紀錄、LINE 對話、語音轉文字

輸出:結構化 JSON,包含以下欄位:

- meddpicc_signals:每維度抓到的訊號 + 建議分數變動(±1)
- ceg_signals:對應到 CEG 七面向的線索(Values 線索特別標記)
- stage_recommendation:建議是否進階,並列出滿足/不滿足的 gate 條件
- red_flags:風險訊號(客戶 ghost、Champion 失聯、競爭對手介入等)
- next_action:給 RM 的下一步建議

重要:AI 不可主動推薦商品,商品推薦是另一個 endpoint(/api/ai/generate-plan)的工作。

### /api/ai/generate-plan(成交路徑規劃)

輸入:當前 deal 全部 MEDDPICC + CEG + 互動紀錄

輸出:結構化成交路徑:

- current_health_score:綜合健康度(0–100)
- gaps_to_close:離下一階段還差什麼(具體到「需要見到 EB」、「需要 Paper Process 啟動」等)
- recommended_products:根據客戶層級 + 痛點推薦商品(參考 §9)
- case_recommendations:若在 L1–L3,推薦適用的 Standard Case(參考 §5)
- timeline_estimate:成交時點預估
- key_risks:主要風險與緩解動作

重要:此 endpoint 是高 token 消耗的場景,系統 prompt 必須走 prompt caching(lib/anthropic/PLAYBOOK_KNOWLEDGE),動態內容只放在 user message 中。

### Prompt Caching 注意事項

PLAYBOOK_KNOWLEDGE 系統 prompt 包含:

- 本 BUSINESS_CONTEXT.md 的核心摘要(MEDDPICC 八維度、L0–L8、四階分級、CEG 七面向)
- 不要動態插值任何客戶資料、deal 資料、日期(會破壞 cache)
- 客戶資料、deal 資料一律走 user message
- 更新 PLAYBOOK_KNOWLEDGE 需謹慎,每次更新等於拋棄現有 cache,初期 24–48 小時 token 成本會上升

---

## 版本與維護

| 版本 | 日期 | 主要變更 |
| --- | --- | --- |
| v1.0 | 2026-05-15 | 初版,涵蓋 MEDDPICC 八維度、L0–L8、四階分級、六個案例、CEG v1.1、Soft Seminar、商品光譜、AI 判斷規則 |

待補項目(下一版優先):

- 18 Training Scenarios 的具體文字內容
- 痛點商品對照矩陣的完整 12 組(目前只列 5 組節錄)
- Family Blueprint 的視覺化規格

維護原則:

- 本檔由 Hugh 主導維護,業務邏輯變更時優先更新本檔再修 code
- 重大變更(如 Playbook 升級為 v2.2)應同步更新本檔頂部版本號
- 與 README.md 的工程層描述若有矛盾,以本檔為準(因業務優先於實作)
