import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Deal, Scores, StageId, Tier, TierConfigItem } from '@/lib/v4/types';
import { RED_FLAG } from '@/lib/v4/constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtMoney(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString('en-US')}`;
}

export function daysSince(iso: string | null): number {
  if (!iso) return 999;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return 999;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const due = new Date(value.length === 10 ? `${value}T00:00:00` : value).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(due)) return null;
  return Math.round((due - today.getTime()) / 86_400_000);
}

export function totalScore(deal: Deal): number {
  const s = deal.scores;
  if (!s) return 0;
  return s.m + s.e + s.d1 + s.d2 + s.p + s.i + s.c1 + s.c2;
}

export function redFlag(deal: Deal): string | null {
  if (!deal.scores) return null;
  if (deal.scores.e < RED_FLAG.ebScore) return 'EB 未確認';
  if (totalScore(deal) < RED_FLAG.totalScore) return '總分過低';
  if (daysSince(deal.last_updated) > RED_FLAG.staleDays) return `${daysSince(deal.last_updated)} 天未更新`;
  return null;
}

export function contactOverdue(deal: Deal, tierConfig: TierConfigItem[]): { status: 'overdue' | 'due_soon' | 'ok'; deltaDays: number } | null {
  if (!deal.tier || !deal.last_contact_at) return null;
  const cfg = tierConfig.find((t) => t.key === deal.tier);
  if (!cfg) return null;
  const since = daysSince(deal.last_contact_at);
  const delta = since - cfg.contact_days;
  if (delta > 0) return { status: 'overdue', deltaDays: delta };
  if (delta >= -3) return { status: 'due_soon', deltaDays: delta };
  return { status: 'ok', deltaDays: delta };
}

export interface PriorityReason {
  text: string;
  tone: 'rose' | 'orange' | 'amber';
  icon: string;
  weight: number;
}

export function priorityReason(deal: Deal, tierConfig: TierConfigItem[]): PriorityReason | null {
  const rf = redFlag(deal);
  if (rf) return { text: `🚩 ${rf}`, tone: 'rose', icon: '🚩', weight: 100 };
  const ci = contactOverdue(deal, tierConfig);
  if (ci?.status === 'overdue') return { text: `逾期聯繫 ${ci.deltaDays} 天`, tone: 'orange', icon: '🔔', weight: 80 };
  const stageIdx = (['L1','L2','L3','L4','L5','L6','L7'] as StageId[]).indexOf(deal.stage);
  if (stageIdx >= 3 && daysSince(deal.last_updated) > 14) {
    return { text: `${deal.stage} 卡關 ${daysSince(deal.last_updated)} 天`, tone: 'amber', icon: '⏸', weight: 60 };
  }
  if (ci?.status === 'due_soon') return { text: `${Math.abs(ci.deltaDays)} 天內需聯繫`, tone: 'amber', icon: '🕒', weight: 40 };
  return null;
}

export function urgencyScore(deal: Deal, tierConfig: TierConfigItem[]): number {
  const reason = priorityReason(deal, tierConfig);
  if (!reason) return 0;
  const tierBonus = deal.tier === 'SSS' ? 30 : deal.tier === 'S' ? 20 : deal.tier === 'A' ? 10 : 0;
  return reason.weight + tierBonus;
}

export const TIER_STYLES: Record<Tier, string> = {
  SSS: 'bg-gradient-to-r from-cobalt to-graphite text-paper',
  S:   'bg-cobalt text-paper',
  A:   'bg-forest text-paper',
  B:   'bg-brass text-paper',
  C:   'bg-ash text-paper',
};
