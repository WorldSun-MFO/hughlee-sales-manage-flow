import type { IntelSourceType, IntelRegion, IntelStance, TagCategory } from '@/lib/types';

// 來源類型(中文 label + emoji)
export const SOURCE_TYPES: Array<{ key: IntelSourceType; label: string; emoji: string }> = [
  { key: 'broker_research', label: '券商研報 / 晨會', emoji: '📑' },
  { key: 'media',           label: '財經媒體',        emoji: '📰' },
  { key: 'filing',          label: '公開財報 / 法說', emoji: '🏛' },
  { key: 'internal',        label: '內部觀察筆記',    emoji: '✍️' },
];

export const SOURCE_TYPE_LABEL: Record<IntelSourceType, string> =
  Object.fromEntries(SOURCE_TYPES.map(s => [s.key, `${s.emoji} ${s.label}`])) as Record<IntelSourceType, string>;

// 市場地區
export const REGIONS: Array<{ key: IntelRegion; label: string; flag: string }> = [
  { key: 'TW',     label: '台股',  flag: '🇹🇼' },
  { key: 'US',     label: '美股',  flag: '🇺🇸' },
  { key: 'JP',     label: '日股',  flag: '🇯🇵' },
  { key: 'CN',     label: '陸股',  flag: '🇨🇳' },
  { key: 'GLOBAL', label: '全球',  flag: '🌐' },
];

export const REGION_LABEL: Record<IntelRegion, string> =
  Object.fromEntries(REGIONS.map(r => [r.key, `${r.flag} ${r.label}`])) as Record<IntelRegion, string>;

// 立場(看多 / 看空 / 中性 / 不適用)
export const STANCES: Array<{ key: IntelStance; label: string; style: string }> = [
  { key: 'bullish', label: '看多', style: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  { key: 'bearish', label: '看空', style: 'bg-rose-100 text-rose-700 border border-rose-200' },
  { key: 'neutral', label: '中性', style: 'bg-amber-100 text-amber-700 border border-amber-200' },
  { key: 'na',      label: '未標', style: 'bg-slate-100 text-slate-500 border border-slate-200' },
];

export const STANCE_LABEL: Record<IntelStance, string> =
  Object.fromEntries(STANCES.map(s => [s.key, s.label])) as Record<IntelStance, string>;
export const STANCE_STYLE: Record<IntelStance, string> =
  Object.fromEntries(STANCES.map(s => [s.key, s.style])) as Record<IntelStance, string>;

// 標籤分類
export const TAG_CATEGORIES: Array<{ key: TagCategory; label: string; style: string }> = [
  { key: 'region',   label: '地區',   style: 'bg-sky-100 text-sky-700' },
  { key: 'industry', label: '產業',   style: 'bg-violet-100 text-violet-700' },
  { key: 'ticker',   label: '個股',   style: 'bg-indigo-100 text-indigo-700' },
  { key: 'macro',    label: '總經',   style: 'bg-orange-100 text-orange-700' },
  { key: 'theme',    label: '主題',   style: 'bg-teal-100 text-teal-700' },
];

export const TAG_CATEGORY_LABEL: Record<TagCategory, string> =
  Object.fromEntries(TAG_CATEGORIES.map(t => [t.key, t.label])) as Record<TagCategory, string>;
export const TAG_CATEGORY_STYLE: Record<TagCategory, string> =
  Object.fromEntries(TAG_CATEGORIES.map(t => [t.key, t.style])) as Record<TagCategory, string>;
