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
