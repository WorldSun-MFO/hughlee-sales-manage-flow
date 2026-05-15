import type { MarketIntel, MarketTag } from '@/lib/types';

/** Supabase 巢狀 join 回來的形狀 → 攤平成乾淨的 MarketIntel(tags 為陣列) */
interface RawIntelRow {
  intel_tags?: Array<{ market_tags: MarketTag | null }> | null;
  creator?: { full_name: string | null } | { full_name: string | null }[] | null;
  [k: string]: unknown;
}

export function flattenIntel(row: RawIntelRow): MarketIntel {
  const { intel_tags, creator, ...rest } = row;
  const tags: MarketTag[] = (intel_tags ?? [])
    .map(t => t.market_tags)
    .filter((t): t is MarketTag => !!t)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const creatorObj = Array.isArray(creator) ? creator[0] ?? null : creator ?? null;
  return { ...(rest as unknown as MarketIntel), tags, creator: creatorObj };
}

export function flattenIntelList(rows: RawIntelRow[] | null | undefined): MarketIntel[] {
  return (rows ?? []).map(flattenIntel);
}
