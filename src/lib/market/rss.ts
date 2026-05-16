// RSS / Atom 解析(fast-xml-parser,Phase 5.2-b)。
// 支援 RSS 2.0(鉅亨等)、Atom、Google News RSS。

import { XMLParser } from 'fast-xml-parser';

export interface RssItem {
  title: string;
  link: string;
  description: string;
  pubDate: string | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,   // 標題/連結保持字串,不要被轉成數字/日期
  trimValues: true,
});

function asArray<T>(x: T | T[] | undefined | null): T[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

/** 取節點文字:可能是字串、{ '#text': ... }、CDATA 解出的字串。 */
function txt(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o['#text'] === 'string') return o['#text'];
  }
  return '';
}

function stripHtml(s: string): string {
  return s
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

/** Atom link 可能是字串、{@_href}、或多個 link 物件 → 取 alternate/第一個 http 連結。 */
function atomLink(link: unknown): string {
  for (const l of asArray(link as unknown[])) {
    if (typeof l === 'string' && /^https?:\/\//i.test(l)) return l;
    if (l && typeof l === 'object') {
      const o = l as Record<string, unknown>;
      const href = typeof o['@_href'] === 'string' ? o['@_href'] : '';
      const rel = typeof o['@_rel'] === 'string' ? o['@_rel'] : '';
      if (href && (rel === '' || rel === 'alternate')) return href;
      if (href) return href;
    }
  }
  return '';
}

/** 解析 RSS/Atom 文字 → 條目陣列。失敗回空陣列(不丟例外)。 */
export function parseRssItems(xml: string): RssItem[] {
  if (!xml) return [];
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xml) as Record<string, unknown>;
  } catch {
    return [];
  }

  const items: RssItem[] = [];

  // RSS 2.0
  const rss = doc.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel) {
    for (const it of asArray(channel.item as unknown[])) {
      const o = it as Record<string, unknown>;
      const title = stripHtml(txt(o.title));
      let link = txt(o.link).trim();
      if (!link) {
        const guid = o.guid;
        const g = typeof guid === 'string' ? guid : txt(guid);
        if (/^https?:\/\//i.test(g)) link = g.trim();
      }
      const desc = stripHtml(txt(o['content:encoded']) || txt(o.description));
      const pubDate = txt(o.pubDate) || null;
      if (title && link) items.push({ title, link, description: desc, pubDate });
    }
    if (items.length > 0) return items;
  }

  // Atom
  const feed = doc.feed as Record<string, unknown> | undefined;
  if (feed) {
    for (const en of asArray(feed.entry as unknown[])) {
      const o = en as Record<string, unknown>;
      const title = stripHtml(txt(o.title));
      const link = atomLink(o.link);
      const desc = stripHtml(txt(o.summary) || txt(o.content));
      const pubDate = txt(o.updated) || txt(o.published) || null;
      if (title && link) items.push({ title, link, description: desc, pubDate });
    }
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
