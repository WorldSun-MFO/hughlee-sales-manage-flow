// 輕量 RSS 解析(免依賴,Phase 5.1)。
// 鉅亨等標準 RSS 2.0 夠用;5.2 接多來源時再換 fast-xml-parser 強化。

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

function stripHtml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pick(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
}

/** 解析 RSS 2.0 / Atom 文字 → 條目陣列。失敗回空陣列(不丟例外)。 */
export function parseRssItems(xml: string): RssItem[] {
  if (!xml) return [];
  const items: RssItem[] = [];

  // RSS 2.0 <item>
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const block of itemBlocks) {
    const title = stripHtml(pick(block, 'title'));
    let link = stripHtml(pick(block, 'link'));
    if (!link) {
      const g = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i);
      if (g && /^https?:\/\//i.test(g[1].trim())) link = g[1].trim();
    }
    const desc = stripHtml(pick(block, 'content:encoded') || pick(block, 'description'));
    const pubDate = stripHtml(pick(block, 'pubDate')) || null;
    if (title && link) items.push({ title, link, description: desc, pubDate });
  }
  if (items.length > 0) return items;

  // Atom <entry> 後備
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of entryBlocks) {
    const title = stripHtml(pick(block, 'title'));
    const lm = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    const link = lm ? lm[1].trim() : '';
    const desc = stripHtml(pick(block, 'summary') || pick(block, 'content'));
    const pubDate = stripHtml(pick(block, 'updated') || pick(block, 'published')) || null;
    if (title && link) items.push({ title, link, description: desc, pubDate });
  }
  return items;
}

/** 標題轉 2-gram 集合(中文無空白,用字元 bigram 判相似)。 */
export function titleBigrams(s: string): Set<string> {
  const t = (s || '').replace(/\s+/g, '');
  const g = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) g.add(t.slice(i, i + 2));
  return g;
}

/** 重疊係數:交集 / 較小集合大小。>~0.45 視為同一則故事。 */
export function bigramOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / Math.min(a.size, b.size);
}

/** RSS pubDate → 'YYYY-MM-DD'(失敗回 null)。 */
export function toDateOnly(pubDate: string | null): string | null {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}
