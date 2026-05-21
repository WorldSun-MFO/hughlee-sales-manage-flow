import type { Deal, Profile, Scores, Snapshot, Task, Team } from '@/lib/v4/types';
import { DEFAULT_TIER_CONFIG } from '@/lib/v4/constants';

const DAY = 86_400_000;
const iso = (d: number) => new Date(Date.now() - d * DAY).toISOString();
const ymd = (d: number) => iso(d).slice(0, 10);
const ymdAhead = (d: number) => new Date(Date.now() + d * DAY).toISOString().slice(0, 10);
const s = (m: number, e: number, d1: number, d2: number, p: number, i: number, c1: number, c2: number): Scores =>
  ({ m, e, d1, d2, p, i, c1, c2 });

const teams: Team[] = [
  { id: 't-1', name: '台北一隊' },
  { id: 't-2', name: '台北二隊' },
];

const profiles: Profile[] = [
  { id: 'admin', email: 'admin@worldsun.demo', full_name: '示範管理員', rm_code: 'ADM', role: 'admin', team_id: null },
  { id: 'rm-lin', email: 'lin@worldsun.demo', full_name: '林雅婷', rm_code: 'LYT', role: 'rm', team_id: 't-1' },
  { id: 'rm-chang', email: 'chang@worldsun.demo', full_name: '張承恩', rm_code: 'ZCE', role: 'rm', team_id: 't-1' },
  { id: 'rm-huang', email: 'huang@worldsun.demo', full_name: '黃國維', rm_code: 'HKW', role: 'team_lead', team_id: 't-2' },
  { id: 'rm-wu', email: 'wu@worldsun.demo', full_name: '吳孟潔', rm_code: 'WMC', role: 'rm', team_id: 't-2' },
];

const rm = (id: string) => profiles.find((p) => p.id === id) ?? null;

const deals: Deal[] = [
  {
    id: 'd-01', name: '宏遠家族辦公室 — 陳董', rm_id: 'rm-huang', aum_usd: 95_000_000,
    product: '香港分紅保險 + HSBC 3000萬級', first_contact: ymd(120), last_updated: iso(2),
    last_contact_at: iso(5), tier: 'SSS', stage: 'L5',
    next_step: '約配偶同席 30 分鐘；送出含壓測的客製提案；索取近三個月銀行對帳單',
    target_close_date: ymdAhead(30), created_at: iso(120),
    scores: s(9, 8, 9, 8, 7, 9, 8, 6),
    comments: [
      { id: 'c-01a', deal_id: 'd-01', author_id: 'rm-huang', body: '客戶明確表示傳承是首要考量，對分紅保單可變更要保人很有興趣。', is_system: false, is_raw: true, created_at: iso(20) },
      { id: 'c-01b', deal_id: 'd-01', author_id: null, body: '🤖 已從對話擷取：I(痛點)+3、E(EB)+2；建議下一步促成配偶同席。', is_system: false, is_raw: false, created_at: iso(20) },
    ],
    rm: rm('rm-huang'),
  },
  {
    id: 'd-02', name: '鼎新生技 — 王總', rm_id: 'rm-lin', aum_usd: 62_000_000,
    product: '宏利財摯宏耀(公司戶)', first_contact: ymd(150), last_updated: iso(4),
    last_contact_at: iso(9), tier: 'S', stage: 'L6',
    next_step: '追蹤核保進度；補件：公司董事會決議',
    target_close_date: ymdAhead(20), created_at: iso(150),
    scores: s(9, 9, 8, 8, 8, 8, 7, 6),
    comments: [{ id: 'c-02a', deal_id: 'd-02', author_id: 'rm-lin', body: '保險公司已收件，預估兩週內出核保結果。', is_system: false, is_raw: false, created_at: iso(9) }],
    rm: rm('rm-lin'),
  },
  {
    id: 'd-03', name: '長青營造 — 李副董', rm_id: 'rm-chang', aum_usd: 88_000_000,
    product: 'FCN + 保費融資', first_contact: ymd(95), last_updated: iso(12),
    last_contact_at: iso(40), tier: 'SSS', stage: 'L4',
    next_step: '重新約見，提案已備妥待客戶回覆',
    target_close_date: ymdAhead(45), created_at: iso(95),
    scores: s(8, 7, 7, 6, 6, 8, 6, 5),
    comments: [{ id: 'c-03a', deal_id: 'd-03', author_id: 'rm-chang', body: '客戶出國，回國後再約；提案已寄出。', is_system: false, is_raw: false, created_at: iso(40) }],
    rm: rm('rm-chang'),
  },
  {
    id: 'd-04', name: '晟泰投資 — 周先生', rm_id: 'rm-lin', aum_usd: 24_000_000,
    product: '保誠 + DBS', first_contact: ymd(110), last_updated: iso(38),
    last_contact_at: iso(34), tier: 'A', stage: 'L4',
    next_step: '提案後客戶未回，需主動跟進',
    target_close_date: null, created_at: iso(110),
    scores: s(7, 5, 6, 5, 5, 7, 5, 4),
    comments: [], rm: rm('rm-lin'),
  },
  {
    id: 'd-05', name: '和田貿易 — 趙小姐', rm_id: 'rm-wu', aum_usd: 14_000_000,
    product: 'PLR + CIMB (2.5x)', first_contact: ymd(48), last_updated: iso(6),
    last_contact_at: iso(7), tier: 'A', stage: 'L3',
    next_step: '釐清真正簽字人是否為其配偶',
    target_close_date: null, created_at: iso(48),
    scores: s(7, 2, 6, 5, 4, 7, 4, 5),
    comments: [{ id: 'c-05a', deal_id: 'd-05', author_id: 'rm-wu', body: '配置方向認同，但決策需與配偶共同決定。', is_system: false, is_raw: true, created_at: iso(7) }],
    rm: rm('rm-wu'),
  },
  {
    id: 'd-06', name: '方圓科技 — 林執行長', rm_id: 'rm-chang', aum_usd: 11_500_000,
    product: 'BEN + 香港分紅保險', first_contact: ymd(40), last_updated: iso(3),
    last_contact_at: iso(4), tier: 'A', stage: 'L3',
    next_step: '深問決策標準，邀 EB 下次同席',
    target_close_date: null, created_at: iso(40),
    scores: s(7, 6, 6, 5, 4, 7, 6, 4),
    comments: [], rm: rm('rm-chang'),
  },
  {
    id: 'd-07', name: '康橋實業 — 何先生', rm_id: 'rm-wu', aum_usd: 6_200_000,
    product: '待確認', first_contact: ymd(22), last_updated: iso(5),
    last_contact_at: iso(6), tier: 'B', stage: 'L2',
    next_step: '確認可投資資產與主要痛點',
    target_close_date: null, created_at: iso(22),
    scores: s(5, 4, 4, 3, 2, 5, 3, 3),
    comments: [], rm: rm('rm-wu'),
  },
  {
    id: 'd-08', name: '青田建設 — 楊女士', rm_id: 'rm-lin', aum_usd: 5_400_000,
    product: '保費融資方案', first_contact: ymd(18), last_updated: iso(2),
    last_contact_at: iso(3), tier: 'B', stage: 'L2',
    next_step: '安排第二次面談，帶情境試算',
    target_close_date: null, created_at: iso(18),
    scores: s(6, 5, 4, 4, 3, 6, 4, 3),
    comments: [], rm: rm('rm-lin'),
  },
  {
    id: 'd-09', name: '立群投顧 — 蔡總（推薦）', rm_id: 'rm-chang', aum_usd: 3_000_000,
    product: '', first_contact: ymd(5), last_updated: iso(5),
    last_contact_at: iso(5), tier: 'C', stage: 'L1',
    next_step: '寄確認信、加 LINE，做會前蒐集',
    target_close_date: null, created_at: iso(5),
    scores: s(3, 2, 1, 1, 0, 3, 1, 0),
    comments: [], rm: rm('rm-chang'),
  },
  {
    id: 'd-10', name: '晉鴻物流 — 郭先生（研討會）', rm_id: 'rm-wu', aum_usd: 2_100_000,
    product: '', first_contact: ymd(8), last_updated: iso(8),
    last_contact_at: iso(8), tier: 'C', stage: 'L1',
    next_step: '電話初篩，確認是否本人決策',
    target_close_date: null, created_at: iso(8),
    scores: s(2, 2, 1, 1, 0, 2, 1, 0),
    comments: [], rm: rm('rm-wu'),
  },
  {
    id: 'd-11', name: '聯豐控股 — 許董（已成交）', rm_id: 'rm-huang', aum_usd: 120_000_000,
    product: 'HSBC 3000萬級 + 宏利', first_contact: ymd(400), last_updated: iso(25),
    last_contact_at: iso(25), tier: 'SSS', stage: 'L7',
    next_step: '年度檢視 + 開口請求轉介',
    target_close_date: null, created_at: iso(400),
    scores: s(10, 9, 9, 9, 8, 9, 9, 7),
    comments: [{ id: 'c-11a', deal_id: 'd-11', author_id: 'rm-huang', body: '年度檢視已排程，客戶滿意度高，擬請求轉介兩位友人。', is_system: false, is_raw: false, created_at: iso(25) }],
    rm: rm('rm-huang'),
  },
  {
    id: 'd-12', name: '昇陽材料 — 邱副總', rm_id: 'rm-chang', aum_usd: 18_000_000,
    product: 'FCN', first_contact: ymd(70), last_updated: iso(16),
    last_contact_at: iso(48), tier: 'A', stage: 'L5',
    next_step: '客戶考慮中，需重新接觸推進',
    target_close_date: ymdAhead(25), created_at: iso(70),
    scores: s(7, 6, 6, 5, 5, 7, 5, 5),
    comments: [], rm: rm('rm-chang'),
  },
];

const tasks: Task[] = [
  { id: 'tk-1', deal_id: 'd-01', title: '準備配偶同席的一頁 EB 摘要', description: '', assignee_id: 'rm-huang', due_date: ymdAhead(4), status: 'doing', priority: 'high', created_at: iso(3), completed_at: null },
  { id: 'tk-2', deal_id: 'd-01', title: '索取近三個月銀行對帳單', description: '', assignee_id: 'rm-huang', due_date: ymdAhead(7), status: 'todo', priority: 'normal', created_at: iso(2), completed_at: null },
  { id: 'tk-3', deal_id: 'd-03', title: '客戶回國後重新約見', description: '', assignee_id: 'rm-chang', due_date: ymdAhead(10), status: 'todo', priority: 'high', created_at: iso(12), completed_at: null },
  { id: 'tk-4', deal_id: 'd-02', title: '追蹤核保結果並回報客戶', description: '', assignee_id: 'rm-lin', due_date: ymdAhead(6), status: 'todo', priority: 'high', created_at: iso(8), completed_at: null },
  { id: 'tk-5', deal_id: 'd-11', title: '安排年度檢視會議', description: '', assignee_id: 'rm-huang', due_date: ymdAhead(14), status: 'todo', priority: 'normal', created_at: iso(25), completed_at: null },
  { id: 'tk-6', deal_id: 'd-04', title: '主動致電周先生跟進提案', description: '', assignee_id: 'rm-lin', due_date: ymd(2), status: 'todo', priority: 'high', created_at: iso(20), completed_at: null },
  { id: 'tk-7', deal_id: null, title: '更新本週 pipeline 戰報', description: '', assignee_id: 'admin', due_date: ymdAhead(2), status: 'done', priority: 'normal', created_at: iso(7), completed_at: iso(1) },
];

export const fixtureSnapshot: Snapshot = {
  deals,
  profiles,
  tasks,
  teams,
  tierConfig: DEFAULT_TIER_CONFIG,
  source: 'fixtures',
  fetchedAt: new Date().toISOString(),
};
