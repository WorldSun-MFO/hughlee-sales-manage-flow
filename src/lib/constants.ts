import type { StageId, Scores } from './types';

export const STAGES: Array<{ id: StageId; name: string; targetConv: string }> = [
  { id: 'L1', name: '線索 / 初接觸',        targetConv: '50~60%' },
  { id: 'L2', name: '資格初判 (MQL)',       targetConv: '60~70%' },
  { id: 'L3', name: '需求探詢 (SQL)',       targetConv: '40~50%' },
  { id: 'L4', name: '方案設計 (Proposal)',  targetConv: '60~70%' },
  { id: 'L5', name: '談判 / 異議處理',      targetConv: '70~80%' },
  { id: 'L6', name: '核保 / 融資',          targetConv: '85~95%' },
  { id: 'L7', name: '客戶 / 加碼 (Won)',    targetConv: '—' },
];

export const MEDDIC: Array<{ key: keyof Scores; label: string; hint: string }> = [
  { key: 'm',  label: 'M — Metrics',          hint: '量化指標:AUM、目標報酬、現金流需求、鎖定期' },
  { key: 'e',  label: 'E — Economic Buyer',   hint: '真正簽字人是誰?見得到嗎?' },
  { key: 'd1', label: 'D₁ — Decision Criteria', hint: '客戶決策標準:零MC / IRR / 品牌 / 信託 排序' },
  { key: 'd2', label: 'D₂ — Decision Process', hint: '從認同到簽約的路徑、時程、關卡' },
  { key: 'p',  label: 'P — Paper Process',    hint: '資產證明、開戶、公司戶文件、核保文件' },
  { key: 'i',  label: 'I — Identify Pain',    hint: '客戶擔心什麼?分紅?流動性?傳承?' },
  { key: 'c1', label: 'C₁ — Champion',        hint: '內部倡議者:配偶 / CFO / 會計師' },
  { key: 'c2', label: 'C₂ — Competition',     hint: '競爭:其他經紀人、私銀、家族信託' },
];

export const CHECKLIST: Record<StageId, Array<{ key: string; label: string }>> = {
  L1: [],
  L2: [
    { key: 'l2_aum',     label: '客戶 AUM / 可投資資金水位已確認 (M)' },
    { key: 'l2_pain',    label: '客戶至少表達過一個明確痛點 (I)' },
    { key: 'l2_agree',   label: '客戶同意進入更深入的討論' },
    { key: 'l2_notfake', label: '非純詢價、非競爭對手、非假單' },
  ],
  L3: [
    { key: 'l3_m',  label: 'M:年化目標、鎖定期、現金流需求已明確' },
    { key: 'l3_e',  label: 'E:知道誰是真正簽字人,是否需家族/董事會同意' },
    { key: 'l3_dc', label: 'DC:客戶前 3 大決策標準已排序' },
    { key: 'l3_dp', label: 'DP:預估決策路徑與時程已問清' },
    { key: 'l3_i',  label: 'I:至少 2 個痛點已對應到沃勝商品' },
    { key: 'l3_c',  label: 'C:至少一位 Champion 已辨識' },
  ],
  L4: [
    { key: 'l4_prop',  label: '客製化提案書、情境分析、壓力測試已送出' },
    { key: 'l4_agree', label: '客戶口頭認同商品選擇方向' },
    { key: 'l4_date',  label: '已約定下一次面談日期或電話覆述' },
    { key: 'l4_eb',    label: 'EB 已看過提案摘要 (若 EB 不是客戶本人)' },
  ],
  L5: [
    { key: 'l5_obj',    label: '所有重大異議已回應並被接受' },
    { key: 'l5_docs',   label: '資產證明 / 健康問卷 / 公司戶文件 明確可取得' },
    { key: 'l5_eb',     label: 'EB 明確同意簽約' },
    { key: 'l5_comp',   label: '已辨識並回應競爭方案 (Competition)' },
    { key: 'l5_paper',  label: 'Paper Process 時程已排定' },
  ],
  L6: [
    { key: 'l6_uw',    label: '保險公司核保通過' },
    { key: 'l6_loan',  label: '融資額度核准 (銀行 / 保險公司內貸)' },
    { key: 'l6_pay',   label: '首期保費 / 自付款入帳' },
    { key: 'l6_file',  label: '客戶檔案建立並設定年度檢視提醒' },
  ],
  L7: [],
};

export const STAGE_PROMPTS: Record<StageId, {
  goal: string;
  entry: string;
  exit: string;
  keyRecords: string[];
  nextActions: string[];
}> = {
  L1: {
    goal: '建立聯繫 → 取得會面',
    entry: '名單產出(推薦、EDM、研討會)',
    exit: '取得聯繫方式 + 30 分鐘會面預約',
    keyRecords: ['客戶來源(推薦人 / 管道)', '聯絡方式與時段偏好', '會面時間與地點'],
    nextActions: ['寄確認信 / 加 LINE', '做會前資訊蒐集(公司、家族)', '準備開場切入點'],
  },
  L2: {
    goal: '驗證 AUM + 初步痛點 → 確認是健康潛在客戶',
    entry: '確認會面',
    exit: 'AUM ≥ 150k USD 且可投資金 > 60k;非純詢價',
    keyRecords: ['可投資資產規模 (M)', '目前資產配置比例', '至少 1 個明確痛點 (I)', '判斷:純詢價 / 競爭對手 / 假單?'],
    nextActions: ['提 M 問題:「您目前可投資資產規模大約?」', '提 I 問題:「您對目前配置最不滿意的是?」', '不合格就禮貌結束,不要硬推'],
  },
  L3: {
    goal: 'MEDDPICC 至少 6/8 有明確答案 + Champion 浮現',
    entry: 'MQL 通過',
    exit: 'MEDDPICC 8 個字母有 6 個以上明確答案;Champion 浮現',
    keyRecords: [
      'M:年化報酬目標、鎖定期、現金流需求',
      'E:真正簽字人是誰、是否需家族/董事會同意',
      'DC:前 3 大決策標準排序',
      'DP:決策路徑與時程',
      'I:2 個以上痛點已對應商品',
      'C:Champion 已辨識(可能是配偶 / CFO)',
    ],
    nextActions: ['深問 E:「如果要推進,需要誰同意?」', '深問 DC:「給您三個方案,您最在意哪三件事?」', '邀請 EB 一起來下次會面'],
  },
  L4: {
    goal: '交付客製化提案 + 情境分析 + 壓力測試',
    entry: 'SQL 通過',
    exit: '提案書 + 情境 + 壓測送出;客戶口頭認同方向',
    keyRecords: ['提案版本 / 交付日期', '情境假設(保守 / 基準 / 積極)', '壓測結果(利率 +3%、分紅 -20%)', '客戶初步反應與偏好'],
    nextActions: ['確認 DC 已鎖定商品', '約下次面談 cover 提案細節', '若 EB 不在場,送 EB 版本摘要'],
  },
  L5: {
    goal: '處理異議 + EB 同意 + 啟動 Paper Process',
    entry: 'Proposal 已看過',
    exit: '重大異議處理完;EB 同意;Paper Process 已啟動',
    keyRecords: ['客戶 3 大異議 + 回應內容', 'EB 同意狀況(口頭 / 書面)', '競爭方案(如有)與差異化', '資產證明 / 核保文件備妥狀況'],
    nextActions: ['準備 Q&A 文件正面回應', '約 EB 簡短通話或見面', '請客戶先備妥銀行對帳單'],
  },
  L6: {
    goal: '核保通過 + 融資核准 + 首期繳費',
    entry: '簽約意向',
    exit: '核保通過 / 開戶完成 / 融資核准 / 首期入帳',
    keyRecords: ['保險公司核保狀態 + 預估時程', '融資額度核准通知', '首期保費 / 自付款繳費日', '異常(加費、拒保)處理紀錄'],
    nextActions: ['每週追蹤核保進度', '協助客戶補件', '準備年度檢視提醒'],
  },
  L7: {
    goal: '年度檢視 + 客戶滿意度 + 加碼或轉介',
    entry: 'Closed Won',
    exit: '年度檢視完成;NPS 評分;加碼或介紹新客',
    keyRecords: ['年度檢視日期 + 結論', '客戶滿意度 / NPS', '加碼機會 / 轉介名單', 'M 是否有變化(退休、家族事件)'],
    nextActions: ['每季發市場觀點信', '年度主動 review 面談', '開口請求介紹親友'],
  },
};

export const MEDDIC_QUESTIONS: Record<keyof Scores, string[]> = {
  m: [
    '您目前可投資資產的規模大約是?',
    '資產配置比例?股票、債券、定存、保險各佔多少?',
    '您期待的年化報酬率是多少?目前實際拿到多少?',
    '保費融資,您願意「閒置」多少年?(5 年 / 10 年 / 更久)',
    '有沒有階段性的現金流需求?(孩子留學、退休)',
  ],
  e: [
    '這個配置如果要推進,需要誰同意?(配偶 / 長輩 / 董事會)',
    '家中財務決策主要由誰主導?',
    '如果用公司戶,是獨資還是有其他股東?',
    '最終簽字人有沒有可能一起來下次會面?',
  ],
  d1: [
    '如果給您三個方案,您最在意哪三件事?(IRR / 零 MC / 品牌 / 流動性 / 信託)',
    '過去有沒有做過類似規劃?當時為什麼沒繼續?',
    '如果報酬相同,您會選港幣、美金還是瑞郎產品?',
    '品牌對您來說有多重要?',
  ],
  d2: [
    '從認同方案到簽約,通常需要多久?',
    '過程中需要給誰看?(會計師 / 律師 / 家人)',
    '上一次做保險或投資規劃,決策花了多久?',
    '有沒有特定時間點要完成?(稅務截止 / 家庭事件)',
  ],
  p: [
    '您手上有現成的資產證明嗎?(銀行對帳單、不動產估值)',
    '之前在 CIMB / HSBC / DBS 開過戶嗎?',
    '公司戶投保,董事會決議流程大概多久?',
    '有沒有國籍 / 稅務身份要注意?(美籍、CRS)',
  ],
  i: [
    '您目前資產配置最不滿意的是哪一點?',
    '有沒有擔心過銀行抽銀根 / Margin Call 的經驗?',
    '傳承規劃有沒有想過?目前怎麼安排?',
    '公司資金和個人資金有沒有混雜的困擾?',
    '有沒有看好但還沒進場的個股?',
  ],
  c1: [
    '除了您以外,家中誰最關注財務規劃?',
    '要介紹給配偶 / 家人 / CFO,您覺得他們會先問什麼?',
    '可以安排下次您的會計師一起來嗎?',
  ],
  c2: [
    '您目前主要的財務顧問是誰?',
    '有沒有其他私銀 / 家族辦公室也在提案?',
    '他們的方案長什麼樣?',
  ],
};

export const PAIN_MATRIX = [
  { pain: '定存報酬太低',          product: '高盈基金 / 和頓土地',  pitch: '8% 年息是定存 4 倍,波動 ~3%' },
  { pain: '擔心銀行抽銀根',        product: '宏利財摯宏耀',          pitch: '內部特別貸款機制,無 Margin Call' },
  { pain: '想要槓桿但風險要低',    product: 'PLR + CIMB (2.5x)',     pitch: '60 萬撬動 150 萬,利率 0.8%' },
  { pain: '企業/個人資金混雜',     product: '宏利 (公司戶)',         pitch: '唯一支援 100% 單一股東公司戶投保' },
  { pain: '傳承分配頭痛',          product: '香港分紅保險',          pitch: '變更要保人、拆單贈與、指定受益人' },
  { pain: '看好股票但不想追高',    product: 'FCN',                   pitch: '等待每一天收 12~15% 票息' },
  { pain: '想買某股慢慢建倉',      product: 'BEN',                   pitch: '30%+ 票息 + 折價買入' },
  { pain: '超高淨值,一般產品不夠',product: 'HSBC 3000 萬級',        pitch: '自付 10.5%, 5 年 IRR 24%' },
  { pain: '錢不夠買大型保單',      product: '保誠 + DBS',            pitch: '10 萬級距起,HIBOR 低利套利' },
  { pain: '資產不離手 + 現金流',   product: '保費融資方案',          pitch: '資產不離手,流動性倍增' },
];
