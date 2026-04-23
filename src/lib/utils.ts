import type { Deal, Scores, Settings, StageId, Tier, TierConfigItem } from './types';
import { STAGES } from './constants';

export function fmtMoney(n: number | null | undefined): string {
  if (!n) return '$0';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}

export function sumScores(s: Scores | null | undefined): number {
  if (!s) return 0;
  return s.m + s.e + s.d1 + s.d2 + s.p + s.i + s.c1 + s.c2;
}

export function totalScore(deal: Deal): number {
  return sumScores(deal.scores);
}

export function recommendStage(total: number): StageId {
  if (total >= 64) return 'L5';
  if (total >= 56) return 'L4';
  if (total >= 48) return 'L3';
  if (total >= 24) return 'L2';
  return 'L1';
}

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return 0;
  const diff = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  return Math.max(0, Math.floor(diff));
}

export function redFlag(deal: Deal, settings: Settings): string | null {
  const { ebScore, totalScore: minTotal, staleDays } = settings.red_flag;
  if ((deal.scores?.e ?? 0) < ebScore) return 'EB 未確認';
  if (totalScore(deal) < minTotal) return '總分過低';
  if (daysSince(deal.last_updated) > staleDays) return `${staleDays}+ 天未更新`;
  return null;
}

export function stageIdx(stageId: StageId): number {
  return STAGES.findIndex(s => s.id === stageId);
}

export function nextStage(stageId: StageId): StageId | null {
  const i = stageIdx(stageId);
  if (i < 0 || i >= STAGES.length - 1) return null;
  return STAGES[i + 1].id;
}

export function scoreColor(n: number): string {
  if (n >= 8) return 'bg-emerald-600 text-white';
  if (n >= 5) return 'bg-indigo-500 text-white';
  if (n >= 3) return 'bg-amber-500 text-white';
  return 'bg-rose-500 text-white';
}

export function getTierFromAum(aumUsd: number, tiers: TierConfigItem[]): Tier {
  // 找出 aum 達到最低門檻的最高等級
  const sorted = [...tiers].sort((a, b) => b.aum_min - a.aum_min);
  for (const t of sorted) {
    if (aumUsd >= t.aum_min) return t.key;
  }
  return 'C';
}

export function contactDaysSince(deal: Deal): number | null {
  if (!deal.last_contact_at) return null;
  return Math.floor((Date.now() - new Date(deal.last_contact_at).getTime()) / 86400000);
}

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

export function priorityReason(deal: Deal, settings: Settings, tiers: TierConfigItem[]): PriorityReason | null {
  if (deal.stage === 'L7') return null;
  const flag = redFlag(deal, settings);
  if (flag) return { icon: '🚩', text: flag, tone: 'rose', weight: 1000 };

  const ci = contactOverdue(deal, tiers);
  if (ci?.status === 'overdue') return { icon: '⚠️', text: `已逾期 ${ci.deltaDays} 天未聯繫`, tone: 'amber', weight: 500 + ci.deltaDays * 5 };

  const staleDays = daysSince(deal.last_updated);
  if (['L4','L5','L6'].includes(deal.stage) && staleDays > 14) {
    return { icon: '📌', text: `${deal.stage} 卡 ${staleDays} 天沒動`, tone: 'orange', weight: 200 + staleDays };
  }

  if (ci?.status === 'due_soon') return { icon: '🔔', text: `${Math.abs(ci.deltaDays)} 天內需聯繫`, tone: 'amber', weight: 100 };

  return null;
}

export function urgencyScore(deal: Deal, settings: Settings, tiers: TierConfigItem[]): number {
  const reason = priorityReason(deal, settings, tiers);
  if (!reason) return 0;
  const tierWeight: Record<string, number> = { SSS: 50, S: 30, A: 20, B: 10, C: 5 };
  return reason.weight + (tierWeight[deal.tier ?? ''] ?? 0);
}

// CSV export — 把 deals 轉成可匯入 Google Sheets / Excel 的 CSV 字串
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

export function downloadCSV(filename: string, csv: string) {
  // Prepend BOM so Excel / Google Sheets auto-detect UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
