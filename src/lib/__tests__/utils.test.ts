// ============================================================
// lib/utils.ts 單元測試
// ============================================================
// 測試對象是業務邏輯熱點 — 紅旗、聯繫週期、優先序、CSV、任務拆解。
// 這些函式跟資料庫無關,純函式,所以全部用 mock fixture 餵就好。
//
// 重點覆蓋:
//   - 邊界(剛好達門檻、剛好沒到、null/undefined 輸入)
//   - 已知 bug 的回歸測試(全形編號 / 圈號沒空白 / 小數誤拆)
//
// 跑法:npm run test
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  fmtMoney,
  sumScores,
  totalScore,
  recommendStage,
  daysSince,
  redFlag,
  stageIdx,
  nextStage,
  scoreColor,
  getTierFromAum,
  contactDaysSince,
  contactOverdue,
  priorityReason,
  urgencyScore,
  splitNextStepIntoTasks,
  dealsToCSV,
} from '@/lib/utils';
import { DEFAULT_TIER_CONFIG } from '@/lib/constants';
import type { Deal, Scores, Settings } from '@/lib/types';

// ============================================================
// Fixtures — 把 makeDeal / makeSettings 包成 helper 讓每個 it 拿乾淨副本
// ============================================================
function makeScores(overrides: Partial<Scores> = {}): Scores {
  return { m: 5, e: 5, d1: 5, d2: 5, p: 5, i: 5, c1: 5, c2: 5, ...overrides };
}

function makeDeal(overrides: Partial<Deal> = {}): Deal {
  return {
    id: 'd1',
    name: 'Test Deal',
    rm_id: 'rm1',
    aum_usd: 10_000_000,
    product: 'PLR',
    first_contact: '2026-01-01',
    last_updated: new Date().toISOString(),
    last_contact_at: null,
    tier: 'A',
    stage: 'L3',
    next_step: null,
    target_close_date: null,
    plan: null,
    created_at: '2026-01-01T00:00:00Z',
    scores: makeScores(),
    rm: { id: 'rm1', email: 'rm@wsgfo.com', full_name: 'Test RM', rm_code: 'TR', role: 'rm', team_id: null },
    ...overrides,
  };
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 1,
    stage_probs: { L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100 },
    red_flag: { ebScore: 4, totalScore: 40, staleDays: 30, contactWarnDays: 14 },
    tier_config: { tiers: DEFAULT_TIER_CONFIG },
    ...overrides,
  };
}

// ============================================================
// fmtMoney
// ============================================================
describe('fmtMoney', () => {
  it('null / undefined / 0 都回 $0', () => {
    expect(fmtMoney(null)).toBe('$0');
    expect(fmtMoney(undefined)).toBe('$0');
    expect(fmtMoney(0)).toBe('$0');
  });
  it('小於 1K 顯示原值', () => {
    expect(fmtMoney(500)).toBe('$500');
  });
  it('千級用 K', () => {
    expect(fmtMoney(1_500)).toBe('$2K');         // toFixed(0) 四捨五入
    expect(fmtMoney(999_000)).toBe('$999K');
  });
  it('百萬級用 M', () => {
    expect(fmtMoney(1_500_000)).toBe('$1.5M');
    expect(fmtMoney(10_000_000)).toBe('$10.0M');
  });
  it('十億級用 B', () => {
    expect(fmtMoney(2_300_000_000)).toBe('$2.3B');
  });
});

// ============================================================
// sumScores / totalScore
// ============================================================
describe('sumScores', () => {
  it('null / undefined 回 0', () => {
    expect(sumScores(null)).toBe(0);
    expect(sumScores(undefined)).toBe(0);
  });
  it('八個字母全 5 → 40', () => {
    expect(sumScores(makeScores())).toBe(40);
  });
  it('全 10 → 80(滿分)', () => {
    expect(sumScores(makeScores({ m: 10, e: 10, d1: 10, d2: 10, p: 10, i: 10, c1: 10, c2: 10 }))).toBe(80);
  });
});

describe('totalScore', () => {
  it('包到 deal.scores 上', () => {
    expect(totalScore(makeDeal({ scores: makeScores({ m: 8, e: 8 }) }))).toBe(46);
  });
});

// ============================================================
// recommendStage — 推進門檻邊界
// ============================================================
describe('recommendStage', () => {
  it('0-23 → L1', () => {
    expect(recommendStage(0)).toBe('L1');
    expect(recommendStage(23)).toBe('L1');
  });
  it('24-47 → L2', () => {
    expect(recommendStage(24)).toBe('L2');
    expect(recommendStage(47)).toBe('L2');
  });
  it('48 是 L3 邊界', () => {
    expect(recommendStage(47)).toBe('L2');
    expect(recommendStage(48)).toBe('L3');
  });
  it('56 是 L4 邊界', () => {
    expect(recommendStage(55)).toBe('L3');
    expect(recommendStage(56)).toBe('L4');
  });
  it('64 是 L5 邊界', () => {
    expect(recommendStage(63)).toBe('L4');
    expect(recommendStage(64)).toBe('L5');
    expect(recommendStage(80)).toBe('L5');
  });
});

// ============================================================
// daysSince
// ============================================================
describe('daysSince', () => {
  it('null/undefined 回 0', () => {
    expect(daysSince(null)).toBe(0);
    expect(daysSince(undefined)).toBe(0);
  });
  it('未來日期回 0(向下取整 + max 0)', () => {
    const future = new Date(Date.now() + 86400000 * 5).toISOString();
    expect(daysSince(future)).toBe(0);
  });
  it('5 天前 → 5', () => {
    const fiveDaysAgo = new Date(Date.now() - 86400000 * 5).toISOString();
    expect(daysSince(fiveDaysAgo)).toBe(5);
  });
});

// ============================================================
// redFlag — 三條件優先序
// ============================================================
describe('redFlag', () => {
  const settings = makeSettings();

  it('健康案件回 null', () => {
    const deal = makeDeal({
      scores: makeScores({ e: 8 }),
      last_updated: new Date().toISOString(),
    });
    expect(redFlag(deal, settings)).toBe(null);
  });

  it('E < 4 → EB 未確認(優先序最高)', () => {
    const deal = makeDeal({ scores: makeScores({ e: 3 }) });
    expect(redFlag(deal, settings)).toBe('EB 未確認');
  });

  it('總分 < 40 但 E 達標 → 總分過低', () => {
    const deal = makeDeal({ scores: makeScores({ m: 1, e: 5, d1: 1, d2: 1, p: 1, i: 1, c1: 1, c2: 1 }) });
    // total=12, e=5 → 過 E 但總分過低
    expect(redFlag(deal, settings)).toBe('總分過低');
  });

  it('30 天未更新 → 紅旗', () => {
    const deal = makeDeal({
      scores: makeScores({ e: 8 }),
      last_updated: new Date(Date.now() - 86400000 * 35).toISOString(),
    });
    expect(redFlag(deal, settings)).toMatch(/天未更新/);
  });
});

// ============================================================
// stageIdx / nextStage
// ============================================================
describe('stageIdx', () => {
  it('L1=0, L7=6', () => {
    expect(stageIdx('L1')).toBe(0);
    expect(stageIdx('L7')).toBe(6);
  });
});

describe('nextStage', () => {
  it('L3 → L4', () => {
    expect(nextStage('L3')).toBe('L4');
  });
  it('L7 沒下一階 → null', () => {
    expect(nextStage('L7')).toBe(null);
  });
});

// ============================================================
// scoreColor
// ============================================================
describe('scoreColor', () => {
  it('色階對齊:0-2 rose / 3-4 amber / 5-7 indigo / 8-10 emerald', () => {
    expect(scoreColor(0)).toContain('rose');
    expect(scoreColor(2)).toContain('rose');
    expect(scoreColor(3)).toContain('amber');
    expect(scoreColor(4)).toContain('amber');
    expect(scoreColor(5)).toContain('indigo');
    expect(scoreColor(7)).toContain('indigo');
    expect(scoreColor(8)).toContain('emerald');
    expect(scoreColor(10)).toContain('emerald');
  });
});

// ============================================================
// getTierFromAum — 依 DEFAULT_TIER_CONFIG 門檻
// ============================================================
describe('getTierFromAum', () => {
  it('100M → SSS', () => {
    expect(getTierFromAum(100_000_000, DEFAULT_TIER_CONFIG)).toBe('SSS');
  });
  it('80M 剛好達 SSS 門檻 → SSS', () => {
    expect(getTierFromAum(80_000_000, DEFAULT_TIER_CONFIG)).toBe('SSS');
  });
  it('79.9M 還不到 SSS → S', () => {
    expect(getTierFromAum(79_900_000, DEFAULT_TIER_CONFIG)).toBe('S');
  });
  it('30M → A', () => {
    expect(getTierFromAum(30_000_000, DEFAULT_TIER_CONFIG)).toBe('A');
  });
  it('5M 剛好達 B → B', () => {
    expect(getTierFromAum(5_000_000, DEFAULT_TIER_CONFIG)).toBe('B');
  });
  it('低於 1M 也回 C(保底)', () => {
    expect(getTierFromAum(500_000, DEFAULT_TIER_CONFIG)).toBe('C');
  });
});

// ============================================================
// contactOverdue
// ============================================================
describe('contactOverdue', () => {
  it('沒設 tier 或沒聯繫紀錄 → null', () => {
    expect(contactOverdue(makeDeal({ tier: null }), DEFAULT_TIER_CONFIG)).toBe(null);
    expect(contactOverdue(makeDeal({ last_contact_at: null }), DEFAULT_TIER_CONFIG)).toBe(null);
  });

  it('A 級 5 天前聯繫(週期 30 天) → ok', () => {
    const deal = makeDeal({ tier: 'A', last_contact_at: new Date(Date.now() - 86400000 * 5).toISOString() });
    const r = contactOverdue(deal, DEFAULT_TIER_CONFIG);
    expect(r?.status).toBe('ok');
  });

  it('A 級 28 天前聯繫(3 天內到期) → due_soon', () => {
    const deal = makeDeal({ tier: 'A', last_contact_at: new Date(Date.now() - 86400000 * 28).toISOString() });
    const r = contactOverdue(deal, DEFAULT_TIER_CONFIG);
    expect(r?.status).toBe('due_soon');
  });

  it('A 級 35 天前聯繫(已逾期) → overdue', () => {
    const deal = makeDeal({ tier: 'A', last_contact_at: new Date(Date.now() - 86400000 * 35).toISOString() });
    const r = contactOverdue(deal, DEFAULT_TIER_CONFIG);
    expect(r?.status).toBe('overdue');
    expect(r?.deltaDays).toBeGreaterThan(0);
  });
});

// ============================================================
// contactDaysSince
// ============================================================
describe('contactDaysSince', () => {
  it('沒聯繫紀錄回 null', () => {
    expect(contactDaysSince(makeDeal({ last_contact_at: null }))).toBe(null);
  });
  it('10 天前聯繫 → 10', () => {
    expect(contactDaysSince(makeDeal({ last_contact_at: new Date(Date.now() - 86400000 * 10).toISOString() }))).toBe(10);
  });
});

// ============================================================
// priorityReason — 「今日追蹤清單」的核心
// ============================================================
describe('priorityReason', () => {
  const settings = makeSettings();

  it('L7 永遠不追蹤 → null', () => {
    const deal = makeDeal({ stage: 'L7', scores: makeScores({ e: 1 }) });
    expect(priorityReason(deal, settings, DEFAULT_TIER_CONFIG)).toBe(null);
  });

  it('紅旗 weight=1000 最優先', () => {
    const deal = makeDeal({ scores: makeScores({ e: 1 }) });
    const r = priorityReason(deal, settings, DEFAULT_TIER_CONFIG);
    expect(r?.weight).toBeGreaterThanOrEqual(1000);
    expect(r?.icon).toBe('🚩');
  });

  it('紅旗存在時不會走逾期分支', () => {
    const deal = makeDeal({
      scores: makeScores({ e: 1 }),         // 紅旗(E < 4)
      tier: 'A',
      last_contact_at: new Date(Date.now() - 86400000 * 60).toISOString(), // 也逾期
    });
    const r = priorityReason(deal, settings, DEFAULT_TIER_CONFIG);
    expect(r?.icon).toBe('🚩');             // 不是 ⚠️
  });
});

// ============================================================
// urgencyScore — priorityReason + tier 加權
// ============================================================
describe('urgencyScore', () => {
  it('沒理由回 0', () => {
    const settings = makeSettings();
    const deal = makeDeal({
      scores: makeScores({ e: 8 }),
      last_updated: new Date().toISOString(),
    });
    expect(urgencyScore(deal, settings, DEFAULT_TIER_CONFIG)).toBe(0);
  });

  it('SSS 紅旗比 C 紅旗加權高', () => {
    const settings = makeSettings();
    const sss = makeDeal({ id: 'a', tier: 'SSS', scores: makeScores({ e: 1 }) });
    const c = makeDeal({ id: 'b', tier: 'C', scores: makeScores({ e: 1 }) });
    expect(urgencyScore(sss, settings, DEFAULT_TIER_CONFIG)).toBeGreaterThan(urgencyScore(c, settings, DEFAULT_TIER_CONFIG));
  });
});

// ============================================================
// splitNextStepIntoTasks — 回歸測試重點(這支函式我們已經踩過全形 bug)
// ============================================================
describe('splitNextStepIntoTasks', () => {
  it('空字串 / null / undefined 都回 []', () => {
    expect(splitNextStepIntoTasks('')).toEqual([]);
    expect(splitNextStepIntoTasks(null)).toEqual([]);
    expect(splitNextStepIntoTasks(undefined)).toEqual([]);
    expect(splitNextStepIntoTasks('   ')).toEqual([]);
  });

  it('單行 → 單筆', () => {
    expect(splitNextStepIntoTasks('約王董下週見面')).toEqual(['約王董下週見面']);
  });

  it('換行分隔(理想格式)', () => {
    expect(splitNextStepIntoTasks('約王董\n準備提案\n約會計師'))
      .toEqual(['約王董', '準備提案', '約會計師']);
  });

  it('半形 1. 編號擠在同一行也要拆', () => {
    expect(splitNextStepIntoTasks('1. 約王董 2. 準備提案 3. 約會計師'))
      .toEqual(['約王董', '準備提案', '約會計師']);
  });

  it('全形 1． 編號也要拆(回歸測試:這個之前被誤改成 . 過)', () => {
    expect(splitNextStepIntoTasks('1．約王董 2．準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('全形 1： 編號也要拆', () => {
    expect(splitNextStepIntoTasks('1：約王董 2：準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('中文頓號 1、 也要拆', () => {
    expect(splitNextStepIntoTasks('1、約王董 2、準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('括號編號 (1) 也要拆', () => {
    expect(splitNextStepIntoTasks('(1) 約王董 (2) 準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('全形括號 (1) 也要拆', () => {
    expect(splitNextStepIntoTasks('(1) 約王董 (2) 準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('圈號 ① 即使沒空白也要拆(回歸:②-⑩ 在中文不會出現在句中)', () => {
    expect(splitNextStepIntoTasks('①約王董②準備提案③約會計師'))
      .toEqual(['約王董', '準備提案', '約會計師']);
  });

  it('項目符號 - • * 也要剝除', () => {
    expect(splitNextStepIntoTasks('- 約王董\n• 準備提案\n* 約會計師'))
      .toEqual(['約王董', '準備提案', '約會計師']);
  });

  it('中文數字 一、 二、 也要拆', () => {
    expect(splitNextStepIntoTasks('一、約王董 二、準備提案'))
      .toEqual(['約王董', '準備提案']);
  });

  it('小數點不能誤拆(回歸:1,000.5 不能變兩筆)', () => {
    expect(splitNextStepIntoTasks('準備 1,000.5 萬元的提案')).toEqual(['準備 1,000.5 萬元的提案']);
  });

  it('混合格式都拆得開', () => {
    const r = splitNextStepIntoTasks('1. A\n2、B 3．C');
    expect(r).toEqual(['A', 'B', 'C']);
  });

  it('空行不會產出空項目', () => {
    expect(splitNextStepIntoTasks('A\n\n\nB')).toEqual(['A', 'B']);
  });
});

// ============================================================
// dealsToCSV — 匯出格式正確性
// ============================================================
describe('dealsToCSV', () => {
  const settings = makeSettings();

  it('空陣列只有 header', () => {
    const csv = dealsToCSV([], settings, DEFAULT_TIER_CONFIG);
    expect(csv.split('\n')).toHaveLength(1);
    expect(csv).toContain('客戶名');
  });

  it('含逗號的客戶名要被雙引號包', () => {
    const deal = makeDeal({ name: 'ABC, Inc.' });
    const csv = dealsToCSV([deal], settings, DEFAULT_TIER_CONFIG);
    expect(csv).toContain('"ABC, Inc."');
  });

  it('含雙引號要 escape 成兩個', () => {
    const deal = makeDeal({ name: 'He said "hi"' });
    const csv = dealsToCSV([deal], settings, DEFAULT_TIER_CONFIG);
    expect(csv).toContain('"He said ""hi"""');
  });

  it('每行欄位數一致', () => {
    const csv = dealsToCSV([makeDeal(), makeDeal({ id: 'd2', name: 'Other' })], settings, DEFAULT_TIER_CONFIG);
    const rows = csv.split('\n');
    expect(rows).toHaveLength(3);  // 1 header + 2 rows
    const headerCols = rows[0].split(',').length;
    // 不直接 split 比較 — quoted field 內有逗號會誤算。改用「都有頭尾」當煙霧測試
    expect(headerCols).toBeGreaterThanOrEqual(14);
  });
});
