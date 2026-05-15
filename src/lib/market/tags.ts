import type { createClient } from '@/lib/supabase/server';
import type { TagCategory } from '@/lib/types';

// 用本專案 server client 的實際回傳型別,避免額外依賴 @supabase/supabase-js 的型別匯出
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface TagInput {
  name: string;
  category: TagCategory;
}

/**
 * 找出或建立標籤(market_tags 有 unique(category,name))。
 * 注意:market_tags 沒有 UPDATE 的 RLS policy,所以「先查、查不到才 insert」,
 * 不能用 upsert(upsert 在衝突時會走 UPDATE → 被 RLS 擋)。
 * 回傳所有 tag id。
 */
export async function resolveTagIds(
  supabase: SupabaseClient,
  tags: TagInput[]
): Promise<string[]> {
  const ids: string[] = [];
  // 去重(同 category+name 只處理一次)
  const seen = new Set<string>();
  const clean = tags
    .map(t => ({ name: t.name.trim(), category: t.category }))
    .filter(t => {
      if (!t.name) return false;
      const k = `${t.category}::${t.name}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

  for (const t of clean) {
    // 1) 先查
    const { data: existing } = await supabase
      .from('market_tags')
      .select('id')
      .eq('category', t.category)
      .eq('name', t.name)
      .maybeSingle();

    if (existing?.id) {
      ids.push(existing.id);
      continue;
    }

    // 2) 查不到才 insert;若剛好被別人搶建(unique 衝突)再查一次
    const { data: inserted, error } = await supabase
      .from('market_tags')
      .insert({ name: t.name, category: t.category })
      .select('id')
      .single();

    if (inserted?.id) {
      ids.push(inserted.id);
    } else if (error) {
      const { data: retry } = await supabase
        .from('market_tags')
        .select('id')
        .eq('category', t.category)
        .eq('name', t.name)
        .maybeSingle();
      if (retry?.id) ids.push(retry.id);
    }
  }
  return ids;
}

/** 同步一筆情報的標籤關聯:刪掉舊的、補上新的 */
export async function syncIntelTags(
  supabase: SupabaseClient,
  intelId: string,
  tagIds: string[]
): Promise<void> {
  await supabase.from('intel_tags').delete().eq('intel_id', intelId);
  if (tagIds.length === 0) return;
  await supabase
    .from('intel_tags')
    .insert(tagIds.map(tag_id => ({ intel_id: intelId, tag_id })));
}
