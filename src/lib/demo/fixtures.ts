// ============================================================
// DEMO 假資料 — 全部為虛構範例,與真實客戶無關
// ============================================================
// 僅在 IS_DEMO 時被 page.tsx 使用,餵給 <Dashboard>。
// 型別嚴格對齊 src/lib/types.ts,確保 typecheck / build 通過。
//
// 設計刻意觸發:紅旗(EB 未確認 / 總分過低 / 久未更新)、逾期聯繫、
// 已存 AI 成交路徑、對話原稿,讓 demo 一進去就有戲。
import type {
  Deal, Profile, Team, Task, Settings, PainPoint, Scores, DealPlan,
} from '@/lib/types';
import { DEFAULT_TIER_CONFIG, PAIN_MATRIX } from '@/lib/constants';

const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString();
const ymd = (daysAgo: number) => iso(daysAgo).slice(0, 10);
const ymdAhead = (daysAhead: number) => new Date(Date.now() + daysAhead * DAY).toISOString().slice(0, 10);

const s = (m: number, e: number, d1: number, d2: number, p: number, i: number, c1: number, c2: number): Scores =>
  ({ m, e, d1, d2, p, i, c1, c2 });

// ---------- 團隊 ----------
export const demoTeams: Team[] = [
  { id: 'demo-team-1', name: '台北一隊', created_at: iso(400) },
  { id: 'demo-team-2', name: '台北二隊', created_at: iso(400) },
];

// ---------- 成員(觀看者為 admin,看得到全部)----------
export const demoProfile: Profile = {
  id: 'demo-admin',
  email: 'demo.admin@worldsun.demo',
  full_name: '示範管理員',
  rm_code: 'DEMO',
  role: 'admin',
  team_id: null,
};

const rmLin: Profile = { id: 'demo-rm-lin', email: 'lin@worldsun.demo', full_name: '林雅婷', rm_code: 'LYT', role: 'rm', team_id: 'demo-team-1' };
const rmChang: Profile = { id: 'demo-rm-chang', email: 'chang@worldsun.demo', full_name: '張承恩', rm_code: 'ZCE', role: 'rm', team_id: 'demo-team-1' };
const rmHuang: Profile = { id: 'demo-rm-huang', email: 'huang@worldsun.demo', full_name: '黃國維', rm_code: 'HKW', role: 'team_lead', team_id: 'demo-team-2' };
const rmWu: Profile = { id: 'demo-rm-wu', email: 'wu@worldsun.demo', full_name: '吳孟潔', rm_code: 'WMC', role: 'rm', team_id: 'demo-team-2' };

export const demoProfiles: Profile[] = [demoProfile, rmLin, rmChang, rmHuang, rmWu];

// ---------- 設定 ----------
export const demoSettings: Settings = {
  id: 1,
  stage_probs: { L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100 },
  red_flag: { ebScore: 4, totalScore: 40, staleDays: 30, contactWarnDays: 14 },
  tier_config: { tiers: DEFAULT_TIER_CONFIG },
};

// ---------- 痛點 → 商品(沿用內建矩陣)----------
export const demoPainPoints: PainPoint[] = PAIN_MATRIX.map((p, idx) => ({
  id: `demo-pp-${idx + 1}`,
  pain: p.pain,
  product: p.product,
  pitch: p.pitch,
  tiers: '',
  order_idx: (idx + 1) * 10,
  is_active: true,
}));

// ---------- 一份示範用 AI 成交路徑 ----------
const samplePlan = (targetDays: number): DealPlan => ({
  target_date: ymdAhead(targetDays),
  generated_at: iso(6),
  model: 'claude-opus-4-7',
  overview: '客戶對香港分紅保險的傳承功能高度認同,EB(配偶)已浮現但尚未正式參與。建議先鎖定決策標準,再促成 EB 同席,最後進入核保。',
  feasibility: 'high',
  feasibility_reason: 'AUM 充足、痛點明確(傳承 + 流動性)、已有 Champion(配偶),主要變數是 EB 同席時間。',
  top_risks: ['EB(配偶)行程難約,可能拖慢決策', '客戶同時在比較另一家私銀方案'],
  steps: [
    {
      id: 'st-1', title: '鎖定前三大決策標準並書面覆述', target_date: ymdAhead(7),
      stage_transition: 'L4 → L4', focus: ['用「給您三個方案」法問出 DC 排序', '當場手寫覆述並請客戶確認'],
      talking_points: ['如果給您三個方案,您最在意哪三件事?', '我覆述一下,確保我幫您設計的方向沒偏。'],
      risks: ['客戶說「都重要」→ 用強迫排序法'], completed: true, completed_at: iso(3),
    },
    {
      id: 'st-2', title: '促成 EB(配偶)同席一次 30 分鐘會談', target_date: ymdAhead(18),
      stage_transition: 'L4 → L5', focus: ['請 Champion 協助安排配偶同席', '準備 EB 版一頁摘要'],
      talking_points: ['這個安排會影響到家庭的長期分配,想請太太一起聽一次,只要 30 分鐘。'],
      risks: ['配偶態度保守 → 先給摘要預熱'], completed: false, completed_at: null,
    },
    {
      id: 'st-3', title: '送出客製提案 + 壓力測試,啟動 Paper Process', target_date: ymdAhead(30),
      stage_transition: 'L5 → L6', focus: ['提案含分紅 -20% 壓測', '同步索取資產證明清單'],
      talking_points: ['我把最壞情況也算給您看,這樣您比較安心。'],
      risks: ['資產證明文件齊備需時間 → 提前列清單'], completed: false, completed_at: null,
    },
  ],
});

// ---------- 案件 ----------
// rm 物件直接掛上,對齊 page.tsx 的 join 結構
function withRm(rm: Profile) {
  return { id: rm.id, email: rm.email, full_name: rm.full_name, rm_code: rm.rm_code, role: rm.role, team_id: rm.team_id } as Profile;
}

export const demoDeals: Deal[] = [
  // L5 — 旗艦,高分,已有 AI 路徑 + 對話原稿(展示重點)
  {
    id: 'demo-d-01', name: '【範例】宏遠家族辦公室 — 陳董', rm_id: rmHuang.id, aum_usd: 95_000_000,
    product: '香港分紅保險 + HSBC 3000萬級', first_contact: ymd(120), last_updated: iso(2),
    last_contact_at: iso(5), tier: 'SSS', stage: 'L5', next_step: 'A. 約配偶同席 30 分鐘\nB. 送出含壓測的客製提案\nC. 索取近三個月銀行對帳單',
    target_close_date: ymdAhead(30), plan: samplePlan(30), created_at: iso(120),
    scores: s(9, 8, 9, 8, 7, 9, 8, 6),
    score_notes: [
      { deal_id: 'demo-d-01', field: 'i', evidence: '最擔心二代不善理財、傳承被稀釋', next_action: '帶分紅保單拆單贈與案例' },
      { deal_id: 'demo-d-01', field: 'e', evidence: '配偶為實質共同決策者', next_action: '促成配偶同席' },
    ],
    stage_checklist: [
      { deal_id: 'demo-d-01', item_key: 'l5_obj', checked: true, checked_at: iso(8) },
      { deal_id: 'demo-d-01', item_key: 'l5_comp', checked: true, checked_at: iso(8) },
    ],
    deal_questions: [
      { deal_id: 'demo-d-01', question_key: 'm_aum', answered: true, note: '', asked_at: iso(60) },
      { deal_id: 'demo-d-01', question_key: 'i_succession', answered: true, note: '', asked_at: iso(40) },
      { deal_id: 'demo-d-01', question_key: 'e_eb_test', answered: true, note: '', asked_at: iso(20) },
    ],
    deal_attachments: [],
    comments: [
      { id: 'c-01a', deal_id: 'demo-d-01', author_id: rmHuang.id, body: '客戶明確表示傳承是首要考量,對分紅保單可變更要保人很有興趣。', is_system: false, is_raw: true, created_at: iso(20) },
      { id: 'c-01b', deal_id: 'demo-d-01', author_id: null, body: '🤖 已從對話擷取:I(痛點)+3、E(EB)+2;建議下一步促成配偶同席。', is_system: false, is_raw: false, created_at: iso(20) },
      { id: 'c-01c', deal_id: 'demo-d-01', author_id: null, body: '🎯 AI 產生成交路徑 (目標 ' + ymdAhead(30) + ',可行性 high)', is_system: true, is_raw: false, created_at: iso(6) },
      { id: 'c-01d', deal_id: 'demo-d-01', author_id: rmHuang.id, body: '推進:L4 → L5', is_system: true, is_raw: false, created_at: iso(6) },
    ],
    rm: withRm(rmHuang),
  },

  // L6 — 核保中,接近成交
  {
    id: 'demo-d-02', name: '【範例】鼎新生技 — 王總', rm_id: rmLin.id, aum_usd: 62_000_000,
    product: '宏利財摯宏耀(公司戶)', first_contact: ymd(150), last_updated: iso(4),
    last_contact_at: iso(9), tier: 'S', stage: 'L6', next_step: '追蹤核保進度;補件:公司董事會決議',
    target_close_date: ymdAhead(20), plan: null, created_at: iso(150),
    scores: s(9, 9, 8, 8, 8, 8, 7, 6),
    score_notes: [], stage_checklist: [
      { deal_id: 'demo-d-02', item_key: 'l6_uw', checked: true, checked_at: iso(10) },
      { deal_id: 'demo-d-02', item_key: 'l6_loan', checked: true, checked_at: iso(10) },
    ],
    deal_questions: [], deal_attachments: [],
    comments: [
      { id: 'c-02a', deal_id: 'demo-d-02', author_id: rmLin.id, body: '保險公司已收件,預估兩週內出核保結果。', is_system: false, is_raw: false, created_at: iso(9) },
    ],
    rm: withRm(rmLin),
  },

  // L4 — 已有 AI 路徑,逾期聯繫(SSS 14 天週期,40 天沒聯繫 → overdue)
  {
    id: 'demo-d-03', name: '【範例】長青營造 — 李副董', rm_id: rmChang.id, aum_usd: 88_000_000,
    product: 'FCN + 保費融資', first_contact: ymd(95), last_updated: iso(12),
    last_contact_at: iso(40), tier: 'SSS', stage: 'L4', next_step: '重新約見,提案已備妥待客戶回覆',
    target_close_date: ymdAhead(45), plan: samplePlan(45), created_at: iso(95),
    scores: s(8, 7, 7, 6, 6, 8, 6, 5),
    score_notes: [], stage_checklist: [
      { deal_id: 'demo-d-03', item_key: 'l4_prop', checked: true, checked_at: iso(15) },
    ],
    deal_questions: [], deal_attachments: [],
    comments: [
      { id: 'c-03a', deal_id: 'demo-d-03', author_id: rmChang.id, body: '客戶出國,回國後再約;提案已寄出。', is_system: false, is_raw: false, created_at: iso(40) },
    ],
    rm: withRm(rmChang),
  },

  // L4 — 久未更新紅旗(last_updated 38 天 > staleDays 30,且 e>=4、total>=40)
  {
    id: 'demo-d-04', name: '【範例】晟泰投資 — 周先生', rm_id: rmLin.id, aum_usd: 24_000_000,
    product: '保誠 + DBS', first_contact: ymd(110), last_updated: iso(38),
    last_contact_at: iso(34), tier: 'A', stage: 'L4', next_step: '提案後客戶未回,需主動跟進',
    target_close_date: null, plan: null, created_at: iso(110),
    scores: s(7, 5, 6, 5, 5, 7, 5, 4),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmLin),
  },

  // L3 — EB 未確認紅旗(e=2 < 4)
  {
    id: 'demo-d-05', name: '【範例】和田貿易 — 趙小姐', rm_id: rmWu.id, aum_usd: 14_000_000,
    product: 'PLR + CIMB (2.5x)', first_contact: ymd(48), last_updated: iso(6),
    last_contact_at: iso(7), tier: 'A', stage: 'L3', next_step: '釐清真正簽字人是否為其配偶',
    target_close_date: null, plan: null, created_at: iso(48),
    scores: s(7, 2, 6, 5, 4, 7, 4, 5),
    score_notes: [
      { deal_id: 'demo-d-05', field: 'e', evidence: '客戶提到「要跟先生討論」,EB 可能不是本人', next_action: '下次邀配偶同席' },
    ],
    stage_checklist: [], deal_questions: [
      { deal_id: 'demo-d-05', question_key: 'e_who_agrees', answered: true, note: '', asked_at: iso(7) },
    ],
    deal_attachments: [],
    comments: [
      { id: 'c-05a', deal_id: 'demo-d-05', author_id: rmWu.id, body: '配置方向認同,但決策需與配偶共同決定。', is_system: false, is_raw: true, created_at: iso(7) },
    ],
    rm: withRm(rmWu),
  },

  // L3 — 健康,進行中
  {
    id: 'demo-d-06', name: '【範例】方圓科技 — 林執行長', rm_id: rmChang.id, aum_usd: 11_500_000,
    product: 'BEN + 香港分紅保險', first_contact: ymd(40), last_updated: iso(3),
    last_contact_at: iso(4), tier: 'A', stage: 'L3', next_step: '深問決策標準,邀 EB 下次同席',
    target_close_date: null, plan: null, created_at: iso(40),
    scores: s(7, 6, 6, 5, 4, 7, 6, 4),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmChang),
  },

  // L2 — 總分過低紅旗(e>=4 但 total < 40)
  {
    id: 'demo-d-07', name: '【範例】康橋實業 — 何先生', rm_id: rmWu.id, aum_usd: 6_200_000,
    product: '待確認', first_contact: ymd(22), last_updated: iso(5),
    last_contact_at: iso(6), tier: 'B', stage: 'L2', next_step: '確認可投資資產與主要痛點',
    target_close_date: null, plan: null, created_at: iso(22),
    scores: s(5, 4, 4, 3, 2, 5, 3, 3),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmWu),
  },

  // L2 — 健康
  {
    id: 'demo-d-08', name: '【範例】青田建設 — 楊女士', rm_id: rmLin.id, aum_usd: 5_400_000,
    product: '保費融資方案', first_contact: ymd(18), last_updated: iso(2),
    last_contact_at: iso(3), tier: 'B', stage: 'L2', next_step: '安排第二次面談,帶情境試算',
    target_close_date: null, plan: null, created_at: iso(18),
    scores: s(6, 5, 4, 4, 3, 6, 4, 3),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmLin),
  },

  // L1 — 新線索
  {
    id: 'demo-d-09', name: '【範例】立群投顧 — 蔡總(推薦)', rm_id: rmChang.id, aum_usd: 3_000_000,
    product: '', first_contact: ymd(5), last_updated: iso(5),
    last_contact_at: iso(5), tier: 'C', stage: 'L1', next_step: '寄確認信、加 LINE,做會前蒐集',
    target_close_date: null, plan: null, created_at: iso(5),
    scores: s(3, 2, 1, 1, 0, 3, 1, 0),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmChang),
  },

  // L1 — 新線索(研討會名單)
  {
    id: 'demo-d-10', name: '【範例】晉鴻物流 — 郭先生(研討會)', rm_id: rmWu.id, aum_usd: 2_100_000,
    product: '', first_contact: ymd(8), last_updated: iso(8),
    last_contact_at: iso(8), tier: 'C', stage: 'L1', next_step: '電話初篩,確認是否本人決策',
    target_close_date: null, plan: null, created_at: iso(8),
    scores: s(2, 2, 1, 1, 0, 2, 1, 0),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmWu),
  },

  // L7 — 已成交客戶(可加碼)
  {
    id: 'demo-d-11', name: '【範例】聯豐控股 — 許董(已成交)', rm_id: rmHuang.id, aum_usd: 120_000_000,
    product: 'HSBC 3000萬級 + 宏利', first_contact: ymd(400), last_updated: iso(25),
    last_contact_at: iso(25), tier: 'SSS', stage: 'L7', next_step: '年度檢視 + 開口請求轉介',
    target_close_date: null, plan: null, created_at: iso(400),
    scores: s(10, 9, 9, 9, 8, 9, 9, 7),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [
      { id: 'c-11a', deal_id: 'demo-d-11', author_id: rmHuang.id, body: '年度檢視已排程,客戶滿意度高,擬請求轉介兩位友人。', is_system: false, is_raw: false, created_at: iso(25) },
    ],
    rm: withRm(rmHuang),
  },

  // L5 — 逾期聯繫(A 等級 30 天週期,48 天沒聯繫 → overdue)
  {
    id: 'demo-d-12', name: '【範例】昇陽材料 — 邱副總', rm_id: rmChang.id, aum_usd: 18_000_000,
    product: 'FCN', first_contact: ymd(70), last_updated: iso(16),
    last_contact_at: iso(48), tier: 'A', stage: 'L5', next_step: '客戶考慮中,需重新接觸推進',
    target_close_date: ymdAhead(25), plan: null, created_at: iso(70),
    scores: s(7, 6, 6, 5, 5, 7, 5, 5),
    score_notes: [], stage_checklist: [], deal_questions: [], deal_attachments: [],
    comments: [], rm: withRm(rmChang),
  },
];

// ---------- 任務 ----------
export const demoTasks: Task[] = [
  { id: 'demo-t-1', deal_id: 'demo-d-01', title: '準備配偶同席的一頁 EB 摘要', description: '', assignee_id: rmHuang.id, due_date: ymdAhead(4), status: 'doing', priority: 'high', source_type: 'ai_plan_step', source_ref: 'st-2', created_by: demoProfile.id, created_at: iso(3), completed_at: null },
  { id: 'demo-t-2', deal_id: 'demo-d-01', title: '索取近三個月銀行對帳單', description: '', assignee_id: rmHuang.id, due_date: ymdAhead(7), status: 'todo', priority: 'normal', source_type: 'deal_next_step', source_ref: '', created_by: demoProfile.id, created_at: iso(2), completed_at: null },
  { id: 'demo-t-3', deal_id: 'demo-d-03', title: '客戶回國後重新約見', description: '', assignee_id: rmChang.id, due_date: ymdAhead(10), status: 'todo', priority: 'high', source_type: 'manual', source_ref: '', created_by: demoProfile.id, created_at: iso(12), completed_at: null },
  { id: 'demo-t-4', deal_id: 'demo-d-02', title: '追蹤核保結果並回報客戶', description: '', assignee_id: rmLin.id, due_date: ymdAhead(6), status: 'todo', priority: 'high', source_type: 'manual', source_ref: '', created_by: demoProfile.id, created_at: iso(8), completed_at: null },
  { id: 'demo-t-5', deal_id: 'demo-d-11', title: '安排年度檢視會議', description: '', assignee_id: rmHuang.id, due_date: ymdAhead(14), status: 'todo', priority: 'normal', source_type: 'manual', source_ref: '', created_by: demoProfile.id, created_at: iso(25), completed_at: null },
  { id: 'demo-t-6', deal_id: 'demo-d-04', title: '主動致電周先生跟進提案', description: '', assignee_id: rmLin.id, due_date: ymd(2), status: 'todo', priority: 'high', source_type: 'manual', source_ref: '', created_by: demoProfile.id, created_at: iso(20), completed_at: null },
  { id: 'demo-t-7', deal_id: null, title: '更新本週 pipeline 戰報', description: '', assignee_id: demoProfile.id, due_date: ymdAhead(2), status: 'done', priority: 'normal', source_type: 'manual', source_ref: '', created_by: demoProfile.id, created_at: iso(7), completed_at: iso(1) },
];
