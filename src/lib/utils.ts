// ============================================================
// 業務邏輯工具函式 — 紅旗、聯繫週期、優先序、CSV、任務拆解
// ============================================================
// 這個檔案是「整個 CRM 為什麼這個案件被標紅」的答案所在。
// 不碰 DB、不碰 React,純函式,易測試。
//
// 主要被誰呼叫:
//   - Dashboard.tsx       : 計算 KPI、優先序、過濾排序、CSV 匯出
//   - DealDetail.tsx      : 顯示紅旗、tier 建議、聯繫狀態
//   - NewDealModal.tsx    : 建立案件時依 AUM 自動分級(getTierFromAum)
//   - api/cron/weekly-report : 戰報統計用到 fmtMoney(複製了一份,未共用)
//
// 沒對應任何單一資料表,但讀寫流經這裡的型別都來自 ./types。
// ============================================================
import type { Deal, Scores, Settings, StageId, Tier, TierConfigItem } from './types';
import { STAGES } from './constants';

/** 把金額格式化成 $1.2M / $300K / $80 的人類可讀字串 */
export function fmtMoney(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

/** MEDDIC 8 個字母總分(0-80) */
export function sumScores(s: Scores | null | undefined): number {
  if (!s) return 0;
  return s.m + s.e + s.d1 + s.d2 + s.p + s.i + s.c1 + s.c2;
}

/** 同 sumScores,但接 Deal 物件 */
export function totalScore(deal: Deal): number {
  return sumScores(deal.scores);
}

/**
 * 依總分推薦階段。
 * 與 Playbook 的硬性門檻一致:L3≥48 / L4≥56 / L5≥64。
 * 只是建議值,RM 仍可在 DealDetail 手動覆寫階段。
 */
export function recommendStage(total: number): StageId {
  if (total >= 64) return 'L5';
  if (total >= 56) return 'L4';
  if (total >= 48) return 'L3';
  if (total >= 24) return 'L2';
  return 'L1';
}

/** 從 ISO 日期字串算到現在幾天(向下取整,不會為負) */
export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.max(0, Math.floor(diff));
}

/**
 * 紅旗判定(三條中任一觸發即紅旗,有先後順序)。
 * 門檻來自 settings.red_flag(admin 在 SettingsModal 改)。
 * 回傳 null = 無紅旗;非 null = 中文原因字串。
 */
export function redFlag(deal: Deal, settings: Settings): string | null {
  const { ebScore, totalScore: minTotal, staleDays } = settings.red_flag;
  if ((deal.scores?.e ?? 0) < ebScore) return 'EB 未確認';
  if (totalScore(deal) < minTotal) return '總分過低';
  if (daysSince(deal.last_updated) > staleDays) return `${staleDays}+ 天未更新`;
  return null;
}

/** 階段在 STAGES 陣列中的索引(L1=0, L2=1, ..., L7=6) */
export function stageIdx(stageId: StageId): number {
  return STAGES.findIndex(s => s.id === stageId);
}

/** 下一個階段;已經 L7 回 null */
export function nextStage(stageId: StageId): StageId | null {
  const i = stageIdx(stageId);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1].id;
}

/** 0-10 分對應的徽章顏色 class(emerald/indigo/amber/rose) */
export function scoreColor(n: number): string {
  if (n >= 8) return 'bg-emerald-600 text-white';
  if (n >= 5) return 'bg-indigo-500 text-white';
  if (n >= 3) return 'bg-amber-500 text-white';
  return 'bg-rose-500 text-white';
}

/**
 * 依 AUM 找出符合的最高 tier。
 * 用在 NewDealModal 自動分級,以及 DealDetail 顯示「建議 X 依 AUM」提示。
 */
export function getTierFromAum(aumUsd: number, tiers: TierConfigItem[]): Tier {
  // 從高到低排序,第一個 aum 達門檻的就是它
  const sorted = [...tiers].sort((a, b) => b.aum_min - a.aum_min);
  for (const t of sorted) {
    if (aumUsd >= t.aum_min) return t.key;
  }
  return 'C';
}

/** 距上次聯繫幾天;沒記錄過回 null */
export function contactDaysSince(deal: Deal): number | null {
  if (!deal.last_contact_at) return null;
  return Math.floor((Date.now() - new Date(deal.last_contact_at).getTime()) / 86400000);
}

/**
 * 聯繫週期狀態判斷。
 * 依 tier_config 的 contact_days(SSS=14 / S=A=30 / B=60 / C=90)比對。
 * - overdue  : 已超過週期
 * - due_soon : 3 天內到期
 * - ok       : 還在週期內
 * 沒設 tier 或沒聯繫紀錄回 null(無法判斷)
 */
export function contactOverdue(deal: Deal, tiers: TierConfigItem[]): { status: 'ok' | 'due_soon' | 'overdue'; daysSince: number; interval: number; deltaDays: number } | null {
  if (!deal.tier || !deal.last_contact_at) return null;
  const tierCfg = tiers.find(t => t.key === deal.tier);
  if (!tierCfg) return null;
  const daysSince = contactDaysSince(deal) ?? 0;
  const deltaDays = daysSince - tierCfg.contact_days;
  let status: 'ok' | 'due_soon' | 'overdue' = 'ok';
  if (deltaDays > 0) status = 'overdue';
  else if (deltaDays >= -3) status = 'due_soon';
  return { status, daysSince, interval: tierCfg.contact_days, deltaDays };
}

export type PriorityTone = 'rose' | 'amber' | 'orange';

export interface PriorityReason {
  icon: string;
  text: string;
  tone: PriorityTone;
  weight: number;
}

/**
 * 「今日追蹤清單」的單筆原因 + 權重。
 * 優先序由上到下檢查,第一個命中就回傳。
 * 權重設計(weight):
 *   1000+ 紅旗
 *    500+ 逾期聯繫(依 tier 週期)
 *    350+ 2 週通用警示(不分 tier)
 *    200+ L4-L6 卡 14 天沒動
 *    100  3 天內到期
 *
 * 被 Dashboard 用來排「🎯 今日追蹤清單」的 top 10。
 */
export function priorityReason(deal: Deal, settings: Settings, tiers: TierConfigItem[]): PriorityReason | null {
  if (deal.stage === 'L7') return null;  // 已成交不再追蹤
  const flag = redFlag(deal, settings);
  if (flag) return { icon: '🚩', text: flag, tone: 'rose', weight: 1000 };

  const ci = contactOverdue(deal, tiers);
  if (ci?.status === 'overdue') return { icon: '⚠️', text: `已逾期 ${ci.deltaDays} 天未聯繫(${deal.tier ?? '?'} 等級週期)`, tone: 'amber', weight: 500 + ci.deltaDays * 5 };

  // 2 週警示(不分 tier 的通用警示,B/C 等級在 tier 規則前先觸發)
  const warnDays = settings.red_flag.contactWarnDays ?? 14;
  if (deal.last_contact_at) {
    const daysSinceContact = contactDaysSince(deal) ?? 0;
    if (daysSinceContact >= warnDays) {
      return { icon: '🔔', text: `已 ${daysSinceContact} 天未聯繫(超過 ${warnDays} 天警戒)`, tone: 'amber', weight: 350 + daysSinceContact };
    }
  }

  const staleDays = daysSince(deal.last_updated);
  if (['L4','L5','L6'].includes(deal.stage) && staleDays > 14) {
    return { icon: '📌', text: `${deal.stage} 卡 ${staleDays} 天沒動`, tone: 'orange', weight: 200 + staleDays };
  }

  if (ci?.status === 'due_soon') return { icon: '🔔', text: `${Math.abs(ci.deltaDays)} 天內需聯繫`, tone: 'amber', weight: 100 };

  return null;
}

/**
 * 今日追蹤清單的最終排序分數 = priorityReason.weight + tier 加權。
 * Tier 加權:SSS=50, S=30, A=20, B=10, C=5(高 tier 同樣紅旗排前面)。
 * 沒有任何 priority reason 回 0。
 */
export function urgencyScore(deal: Deal, settings: Settings, tiers: TierConfigItem[]): number {
  const reason = priorityReason(deal, settings, tiers);
  if (!reason) return 0;
  const tierWeight: Record<string, number> = { SSS: 50, S: 30, A: 20, B: 10, C: 5 };
  return reason.weight + (tierWeight[deal.tier ?? ''] ?? 0);
}

/**
 * 把 deals 轉成 CSV 字串(可直接貼進 Google Sheets / Excel)。
 * 由 Dashboard 的「📥 匯出」按鈕觸發 → downloadCSV 觸發瀏覽器下載。
 * 注意:含逗號/引號/換行的欄位會用雙引號包(esc 函式)。
 */
export function dealsToCSV(deals: Deal[], settings: Settings, tiers: TierConfigItem[]): string {
  const header = [
    '客戶名','RM','等級','階段','階段機率(%)','AUM (USD)','MEDDIC 總分',
    '建議商品','最後聯繫','聯繫狀態','紅旗','下一步','首次接觸','最近更新',
  ];

  const rows = deals.map(d => {
    const ci = contactOverdue(d, tiers);
    const contactStatus = ci
      ? (ci.status === 'overdue' ? `逾期 ${ci.deltaDays} 天`
        : ci.status === 'due_soon' ? `${Math.abs(ci.deltaDays)} 天內需聯繫`
        : `已聯繫 ${ci.daysSince} 天`)
      : '—';
    return [
      d.name,
      d.rm?.full_name ?? '—',
      d.tier ?? '—',
      d.stage,
      String(settings.stage_probs[d.stage] ?? 0),
      String(Number(d.aum_usd ?? 0)),
      String(totalScore(d)),
      d.product ?? '',
      d.last_contact_at ? d.last_contact_at.slice(0, 10) : '—',
      contactStatus,
      redFlag(d, settings) ?? '',
      d.next_step ?? '',
      d.first_contact,
      d.last_updated.slice(0, 10),
    ];
  });

  // CSV escape:把含逗號/引號/換行的欄位用雙引號包住
  const esc = (s: string) => {
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [header, ...rows].map(row => row.map(esc).join(',')).join('\n');
}

// ============================================================
// 任務拆解 — splitNextStepIntoTasks
// ============================================================
// 把 deal.next_step 文字拆成「一項一筆」的任務標題陣列。
// 同時支援:
//   ① 換行分隔(理想格式)
//   ② 同一行用「1. A 2. B」「1、A 2、B」「(1) A (2) B」串在一起的退化格式
//
// 為什麼有 (b) 圈號特例:
//   AI 與 RM 常把多個動作擠在同一行,單純照換行拆會只剝外殼,
//   一旦遇到沒空白的「①xx②yy」會被當成一句。圈號 ②-⑩ 在中文裡
//   幾乎不會出現在句中,當作隱式分隔符是安全的。
//
// 被 DealDetail 「📋 全部加到任務管理」按鈕觸發,
// 進入 Dashboard.tsx 的 promoteNextStepToTask → 寫 public.tasks。
// ============================================================
const ENUM_MARK =
  '(?:\\d{1,2}\\.(?!\\d)|\\d{1,2}[、)）．:：]|[（(]\\d{1,2}[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|[一二三四五六七八九十]{1,2}、)';

export function splitNextStepIntoTasks(raw: string | null | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  let s = raw.replace(/\r\n?/g, '\n');
  // (a) 行內:遇到「空白/標點 + 編號標記 + 內容」就在標記前斷行
  //     只在有明確邊界時切,避免誤切金額/小數(如 1,000.5)
  s = s.replace(new RegExp(`([\\s、,;；。．])(?=${ENUM_MARK}\\s*\\S)`, 'g'), '$1\n');
  // (b) 圈號 ②–⑩ 幾乎不會出現在句中,即使沒有空白也視為新項目起點
  s = s.replace(/(?!^)(?=[②③④⑤⑥⑦⑧⑨⑩])/g, '\n');
  return s
    .split('\n')
    .map(l =>
      l
        .trim()
        // 去掉開頭的編號/項目符號:1. 1、 1) (1) （1） A. a) ① 一、 - • *
        // (數字+點後若接數字視為小數,不剝除,所以用 \d{1,2}\.(?!\d))
        .replace(
          /^(?:\d{1,2}\.(?!\d)|\d{1,2}[、)）．:：]|[（(]\d{1,2}[)）]|[A-Za-z][.)、]|[①②③④⑤⑥⑦⑧⑨⑩]|[（(]?[一二三四五六七八九十]{1,2}[)）]?、|[-•*‧·–—])\s*/,
          ''
        )
        .trim()
    )
    .filter(l => l.length > 0);
}

/**
 * 觸發瀏覽器下載 CSV。
 * 前置 BOM (﻿) 讓 Excel / Google Sheets 自動偵測為 UTF-8,
 * 否則開檔會中文亂碼。
 */
export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
