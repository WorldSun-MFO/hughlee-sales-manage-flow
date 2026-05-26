import type { StageId, TierConfigItem } from '@/lib/v4/types';

export const DEFAULT_TIER_CONFIG: TierConfigItem[] = [
  { key: 'SSS', name: '旗艦 Flagship', aum_min: 80_000_000, contact_days: 14 },
  { key: 'S',   name: '高階 Premier',  aum_min: 50_000_000, contact_days: 30 },
  { key: 'A',   name: '中階 Advanced', aum_min: 10_000_000, contact_days: 30 },
  { key: 'B',   name: '初階 Entry',    aum_min:  5_000_000, contact_days: 60 },
  { key: 'C',   name: '基礎 Foundation', aum_min: 1_000_000, contact_days: 90 },
];

export const STAGE_PROB: Record<StageId, number> = {
  L1: 7, L2: 13, L3: 20, L4: 44, L5: 68, L6: 90, L7: 100,
};

export const STAGES: Array<{ id: StageId; name: string }> = [
  { id: 'L1', name: '線索 / 初接觸' },
  { id: 'L2', name: '資格初判' },
  { id: 'L3', name: '需求探詢' },
  { id: 'L4', name: '方案設計' },
  { id: 'L5', name: '談判 / 異議處理' },
  { id: 'L6', name: '核保 / 融資' },
  { id: 'L7', name: '客戶 / 加碼' },
];

export const RED_FLAG = {
  ebScore: 4,
  totalScore: 40,
  staleDays: 30,
};
