import type { MarketIntel, MarketTag, IntelDealLink } from '@/lib/types';

type DealEmbed = { id: string; name: string } | { id: string; name: string }[] | null;

/** Supabase 巢狀 join 回來的形狀 → 攤平成乾淨的 MarketIntel */
interface RawIntelRow {
  intel_tags?: Array<{ market_tags: MarketTag | null }> | null;
  intel_deal_links?: Array<{ relevance_reason: string | null; deal: DealEmbed }> | null;
  creator?: { full_name: string | null } | { full_name: string | null }[] | null;
  [k: string]: unknown;
}

export function flattenIntel(row: RawIntelRow): MarketIntel {
  const { intel_tags, intel_deal_links, creator, ...rest } = row;

  const tags: MarketTag[] = (intel_tags ?? [])
    .map(t => t.market_tags)
    .filter((t): t is MarketTag => !!t)
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const deal_links: IntelDealLink[] = (intel_deal_links ?? [])
    .map(l => {
      const d = Array.isArray(l.deal) ? l.deal[0] ?? null : l.deal ?? null;
      if (!d) return null;
      return {
        deal_id: d.id,
        relevance_reason: l.relevance_reason ?? '',
        deal: { id: d.id, name: d.name },
      } as IntelDealLink;
    })
    .filter((x): x is IntelDealLink => !!x);

  const creatorObj = Array.isArray(creator) ? creator[0] ?? null : creator ?? null;
  return { ...(rest as unknown as MarketIntel), tags, deal_links, creator: creatorObj };
}

export function flattenIntelList(rows: RawIntelRow[] | null | undefined): MarketIntel[] {
  return (rows ?? []).map(flattenIntel);
}
