import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { parseMarketIntel, type ParseDeal } from '@/lib/anthropic/market-parse-core';
import { resolveTagIds, syncIntelTags } from '@/lib/market/tags';
import { parseRssItems, toDateOnly, titleBigrams, bigramOverlap, type RssItem } from '@/lib/market/rss';
import { fetchProviderItems } from '@/lib/market/newsapi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const MAX_PER_RUN = 3;          // 每次最多 Opus 處理幾篇(壓在 300s 內穩定;每 3h 跑一次,量靠累積)
const MAX_PER_SOURCE = 1;       // 每源每輪最多收幾篇:配合來源「最久沒跑優先」排序,確保多源公平輪替,不被單一大源(如鉅亨頭條)吃光名額
const MAX_DEALS_FED = 80;
const MAX_ARTICLE_CHARS = 12000;
const SIMILAR_THRESHOLD = 0.45; // 標題重疊 > 此值視為同一則故事 → 跳過(主題多元化)

// WORLDSUN 核心主題關鍵字:任一命中就收(不必先有對應標籤)
const MFO_KEYWORDS = [
  '稅務', '節稅', '遺產稅', '贈與稅', '最低稅負', 'crs', 'obu', '海外所得', '實質課稅',
  '傳承', '接班', '家族傳承', '二代', '世代移轉', '家族辦公室',
  '信託', '家族信託', '保險金信託', '遺囑信託',
  '資產配置', '保單', '分紅保險', '保費融資', '結構型商品', '家族資產',
].map(k => k.toLowerCase());

// 國際財經 / MFO 英文關鍵字(對應上面中文,給外文新聞用;與中文清單併用,任一命中就收)
const MFO_KEYWORDS_EN = [
  'estate tax', 'inheritance tax', 'gift tax', 'wealth tax', 'tax planning', 'capital gains tax',
  'offshore', 'fatca', 'crs', 'succession', 'wealth transfer', 'family office', 'estate planning',
  'family trust', 'trust fund', 'private bank', 'high net worth', 'hnwi', 'family wealth',
  'wealth management', 'asset allocation', 'structured note', 'structured product',
  'premium financing', 'lombard', 'dividend', 'bond yield', 'interest rate', 'federal reserve',
  'inflation', 'recession', 'ipo',
].map(k => k.toLowerCase());

const FALLBACK_SOURCES = [
  { id: '', name: '鉅亨網 頭條', url: 'https://news.cnyes.com/rss/v1/news/category/headline', region: 'TW' as const, kind: 'rss', provider: null, skip_keyword_gate: false },
];

interface SourceRow {
  id: string;
  name: string;
  url: string;
  region: string | null;
  kind: string;
  provider: string | null;
  skip_keyword_gate: boolean;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }
  const supabase = createServerClient(supabaseUrl, serviceKey, {
    cookies: { getAll() { return []; }, setAll() {} },
  });

  // 1) 來源(資料庫註冊表;空的話用後備)
  const { data: srcRows } = await supabase
    .from('ingest_sources')
    .select('id, name, url, region, kind, provider, skip_keyword_gate')
    .eq('active', true)
    .in('kind', ['rss', 'api'])
    // 公平排程:最久沒跑(或從沒跑,nullsFirst)的源排前面 → 配合 MAX_PER_SOURCE 讓國際/新源輪得到
    .order('last_run_at', { ascending: true, nullsFirst: true });
  const sources: SourceRow[] =
    srcRows && srcRows.length > 0 ? (srcRows as SourceRow[]) : FALLBACK_SOURCES;

  // 2) 既有標籤名(相關性過濾用,與 MFO_KEYWORDS 併用,任一命中就收)
  const { data: tagRows } = await supabase.from('market_tags').select('name');
  const whitelist = (tagRows ?? [])
    .map((t: { name: string }) => t.name?.trim().toLowerCase())
    .filter(Boolean);

  // 3) 客戶清單(service role 看全部;餵 AI 建議配對)
  const { data: deals } = await supabase
    .from('deals')
    .select('id, name, product, stage')
    .order('last_updated', { ascending: false })
    .limit(MAX_DEALS_FED);
  const dealList = (deals ?? []) as ParseDeal[];

  const report = { sources: sources.length, fetched: 0, accepted: 0, ingested: 0, skipped_dup: 0, errors: [] as string[], notes: [] as string[] };
  const seen = new Set<string>();
  const queue: Array<{ src: SourceRow; title: string; link: string; text: string; pubDate: string | null }> = [];
  const queuedKeys: Set<string>[] = [];   // 已入列標題的 bigram,用於主題多元化

  for (const src of sources) {
    try {
      let items: RssItem[];
      if (src.kind === 'api') {
        const r = await fetchProviderItems(src);
        if (!r.ok) { report.errors.push(`${src.name}: ${r.error}`); continue; }
        if (r.note) report.notes.push(`${src.name}: ${r.note}`);
        items = r.items;
      } else {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(src.url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WorldSunBot/1.0)' },
        });
        clearTimeout(timer);
        if (!res.ok) { report.errors.push(`${src.name}: HTTP ${res.status}`); continue; }
        const xml = await res.text();
        items = parseRssItems(xml);
      }
      report.fetched += items.length;

      let takenFromSrc = 0;   // 本源本輪已收幾篇(per-source 上限用)
      for (const it of items) {
        if (queue.length >= MAX_PER_RUN) break;
        if (takenFromSrc >= MAX_PER_SOURCE) break;   // 本源本輪已達上限 → 換下一個源
        if (seen.has(it.link)) continue;
        seen.add(it.link);

        // 去重:此網址已進過 → 跳過
        const { data: dup } = await supabase
          .from('market_intel')
          .select('id')
          .eq('source_url', it.link)
          .limit(1);
        if (dup && dup.length > 0) { report.skipped_dup++; continue; }

        // 相關性過濾:skip_keyword_gate 來源(查詢型/已篩過)直接收;
        // 其餘命中「既有標籤」或 MFO 中/英關鍵字任一才收
        const hay = `${it.title} ${it.description}`.toLowerCase();
        const relevant =
          src.skip_keyword_gate ||
          whitelist.some(w => hay.includes(w)) ||
          MFO_KEYWORDS.some(k => hay.includes(k)) ||
          MFO_KEYWORDS_EN.some(k => hay.includes(k));
        if (!relevant) continue;

        // 主題多元化:標題與已入列的太像 → 視為同一則故事,跳過
        const key = titleBigrams(it.title);
        if (queuedKeys.some(k => bigramOverlap(key, k) > SIMILAR_THRESHOLD)) continue;

        report.accepted++;
        queuedKeys.push(key);
        queue.push({
          src,
          title: it.title,
          link: it.link,
          text: `${it.title}\n\n${it.description}`.slice(0, MAX_ARTICLE_CHARS),
          pubDate: it.pubDate,
        });
        takenFromSrc++;
      }

      if (src.id) {
        await supabase
          .from('ingest_sources')
          .update({ last_run_at: new Date().toISOString(), last_status: `ok: ${items.length} 篇` })
          .eq('id', src.id);
      }
    } catch (e: unknown) {
      report.errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 4) 逐篇 Opus 解析 → 進庫 + 標籤 + 配對建議(待審,不自動綁)
  for (const job of queue) {
    const parsed = await parseMarketIntel(job.text, dealList);
    if (!parsed.ok) { report.errors.push(`parse 失敗 ${job.title}: ${parsed.error}`); continue; }
    const d = parsed.data;

    const { data: intel, error: insErr } = await supabase
      .from('market_intel')
      .insert({
        title: d.title || job.title,
        source_type: 'media',
        source_name: d.source_name || job.src.name,
        source_url: job.link,
        region: d.region || job.src.region || 'TW',
        summary: d.summary,
        key_points: d.key_points,
        stance: d.stance,
        author: d.author,
        published_at: toDateOnly(job.pubDate),
        source_origin: 'auto',
        created_by: null,
      })
      .select('id')
      .single();

    if (insErr || !intel) { report.errors.push(`insert 失敗 ${job.title}: ${insErr?.message ?? '?'}`); continue; }

    if (d.tags.length > 0) {
      const tagIds = await resolveTagIds(supabase, d.tags);
      await syncIntelTags(supabase, intel.id, tagIds);
    }

    if (d.suggested_deal_links.length > 0) {
      await supabase.from('intel_link_suggestions').insert(
        d.suggested_deal_links.map(l => ({
          intel_id: intel.id,
          deal_id: l.deal_id,
          relevance_reason: l.relevance_reason,
          status: 'pending',
        }))
      );
    }
    report.ingested++;
  }

  return NextResponse.json({ ok: true, ...report });
}
