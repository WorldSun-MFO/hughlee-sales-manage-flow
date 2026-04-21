import type { Deal, Scores, Settings, StageId } from './types';
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
