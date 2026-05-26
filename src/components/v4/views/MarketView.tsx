'use client';

// ============================================================
// V4 市場大腦主頁 — 完整 filter / search / sort + v4 視覺
// ============================================================
// 上半:3 顆 quick-action 卡(新增 / 多空綜合 / 來源管理)
// 下半:filter bar + intel list(搜尋、地區、來源、立場、進件方式)
// ============================================================
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Brain, FileText, Globe, Plus, Scale, Database,
  Search, Sparkles, Hand,
} from 'lucide-react';
import type { MarketIntelRow, IntelRegion, IntelStance, IntelSourceType, IntelOrigin } from '@/lib/v4/data';
import { cn, daysSince } from '@/lib/v4/utils';

// ─── v4 視覺 ─── stance / region / source_type / origin 的 v4 配色
const STANCE_TONE: Record<IntelStance, string> = {
  bullish: 'border-forest/40 bg-forest/8 text-forest',
  bearish: 'border-claret/40 bg-claret/8 text-claret',
  neutral: 'border-brass/40 bg-brass/8 text-brass',
  na: 'border-ink/15 bg-ink/3 text-ink/55',
};
const STANCE_LABEL: Record<IntelStance, string> = {
  bullish: '看多',
  bearish: '看空',
  neutral: '中性',
  na: '未標',
};
const REGION_LABEL: Record<IntelRegion, string> = {
  TW: '🇹🇼 台股', US: '🇺🇸 美股', JP: '🇯🇵 日股', CN: '🇨🇳 陸股', GLOBAL: '🌐 全球',
};
const SOURCE_TYPE_LABEL: Record<IntelSourceType, string> = {
  broker_research: '📑 券商研報',
  media: '📰 財經媒體',
  filing: '🏛 公開財報',
  internal: '✍️ 內部筆記',
};
const REGION_OPTIONS: IntelRegion[] = ['TW', 'US', 'JP', 'CN', 'GLOBAL'];
const STANCE_OPTIONS: IntelStance[] = ['bullish', 'bearish', 'neutral', 'na'];
const SOURCE_TYPE_OPTIONS: IntelSourceType[] = ['broker_research', 'media', 'filing', 'internal'];

export function MarketView({
  rows, base,
}: {
  rows: MarketIntelRow[];
  base: '/workspace' | '/hub';
}) {
  const [q, setQ] = useState('');
  const [region, setRegion] = useState<IntelRegion | ''>('');
  const [sourceType, setSourceType] = useState<IntelSourceType | ''>('');
  const [stance, setStance] = useState<IntelStance | ''>('');
  const [origin, setOrigin] = useState<IntelOrigin | ''>('');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (region && r.region !== region) return false;
      if (sourceType && r.source_type !== sourceType) return false;
      if (stance && r.stance !== stance) return false;
      if (origin && r.source_origin !== origin) return false;
      if (kw) {
        const haystack = `${r.title} ${r.summary ?? ''} ${r.source_name ?? ''} ${r.author ?? ''}`.toLowerCase();
        if (!haystack.includes(kw)) return false;
      }
      return true;
    });
  }, [rows, q, region, sourceType, stance, origin]);

  const hasFilter = !!(q || region || sourceType || stance || origin);

  return (
    <div className="grid gap-8 px-4 py-6 sm:gap-10 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Market Intel</div>
        <h1 className="font-v4-serif text-[32px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[44px] lg:text-[56px]">
          市場大腦
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-ink/65 sm:text-base sm:leading-7">
          每 3 小時自動抓來源 → AI 萃取摘要 → 與客戶配對
        </p>
      </header>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <ActionCard href={`${base}/market/new`} icon={Plus} tone="ink"
          label="新增情報" description="貼研報 / 網址 → AI 一鍵摘要 + 建議關聯客戶" />
        <ActionCard href={`${base}/market/synthesis`} icon={Scale} tone="cobalt"
          label="多空綜合" description="選一個標的 → AI 把多家券商觀點綜合成多空判斷" />
        <ActionCard href={`${base}/market/sources`} icon={Database} tone="forest"
          label="來源管理" description="RSS / API 來源清單 · 每 3 小時自動輪替抓取" />
      </section>

      {/* Filter bar + list */}
      <section className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex w-full items-center gap-2 rounded-md border border-ink/15 bg-paper px-2.5 py-1.5 sm:w-auto">
            <Search className="h-3.5 w-3.5 text-ink/45" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜尋標題 / 摘要 / 來源 / 作者"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink/35 sm:w-60"
            />
          </div>
          <FilterSelect value={region} onChange={(v) => setRegion(v as IntelRegion | '')}>
            <option value="">全部地區</option>
            {REGION_OPTIONS.map((r) => (<option key={r} value={r}>{REGION_LABEL[r]}</option>))}
          </FilterSelect>
          <FilterSelect value={sourceType} onChange={(v) => setSourceType(v as IntelSourceType | '')}>
            <option value="">全部來源</option>
            {SOURCE_TYPE_OPTIONS.map((s) => (<option key={s} value={s}>{SOURCE_TYPE_LABEL[s]}</option>))}
          </FilterSelect>
          <FilterSelect value={stance} onChange={(v) => setStance(v as IntelStance | '')}>
            <option value="">全部立場</option>
            {STANCE_OPTIONS.map((s) => (<option key={s} value={s}>{STANCE_LABEL[s]}</option>))}
          </FilterSelect>
          <FilterSelect value={origin} onChange={(v) => setOrigin(v as IntelOrigin | '')}>
            <option value="">全部進件</option>
            <option value="auto">🤖 自動抓取</option>
            <option value="manual">✍️ 人工建檔</option>
          </FilterSelect>
          {hasFilter && (
            <button
              type="button"
              onClick={() => { setQ(''); setRegion(''); setSourceType(''); setStance(''); setOrigin(''); }}
              className="font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink"
            >
              清除 ✕
            </button>
          )}
          <span className="ml-auto font-v4-mono text-[11px] text-ink/45 numeric">
            {filtered.length} / {rows.length} 篇
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-12 text-center">
            <Brain className="h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <div className="text-sm text-ink/55">
              {rows.length === 0 ? '尚未有任何市場情報。' : '沒有符合條件的情報。'}
            </div>
            {rows.length === 0 ? (
              <Link href={`${base}/market/new`} className="mt-2 inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/70 hover:text-ink">
                新增第一篇 → <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
              </Link>
            ) : (
              <button onClick={() => { setQ(''); setRegion(''); setSourceType(''); setStance(''); setOrigin(''); }} className="font-v4-mono text-xs text-ink/55 hover:text-ink">
                清除篩選 →
              </button>
            )}
          </div>
        ) : (
          <ul className="grid gap-3">
            {filtered.map((i) => <IntelCard key={i.id} intel={i} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

// ============================================================
// 子元件
// ============================================================
function ActionCard({
  href, icon: Icon, tone, label, description,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: 'ink' | 'cobalt' | 'forest';
  label: string;
  description: string;
}) {
  const iconBg = tone === 'cobalt' ? 'bg-cobalt/10 text-cobalt'
    : tone === 'forest' ? 'bg-forest/10 text-forest'
      : 'bg-ink/10 text-ink';
  return (
    <Link
      href={href as never}
      className="group grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:shadow-panel"
    >
      <span className={`grid h-10 w-10 place-items-center rounded-md ${iconBg}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <div className="font-v4-serif text-base font-semibold text-ink">{label}</div>
        <div className="mt-0.5 text-xs leading-5 text-ink/60">{description}</div>
      </div>
      <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
    </Link>
  );
}

function IntelCard({ intel }: { intel: MarketIntelRow }) {
  const OriginIcon = intel.source_origin === 'auto' ? Sparkles : Hand;
  return (
    <li>
      <Link
        href={`/market/${intel.id}` as never}
        className="group flex flex-col gap-3 rounded-md border border-ink/10 bg-paper p-4 transition hover:border-ink/25 hover:shadow-panel sm:grid sm:grid-cols-[100px_1fr_auto] sm:items-start sm:gap-4 sm:p-5"
      >
        <div className="flex flex-row flex-wrap items-center gap-2 sm:grid sm:gap-1.5">
          <span className={cn('inline-flex items-center justify-center rounded-sm border px-2 py-0.5 font-v4-mono text-[10px] font-bold', STANCE_TONE[intel.stance])}>
            {STANCE_LABEL[intel.stance]}
          </span>
          <span className="inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55">
            <Globe className="h-3 w-3" strokeWidth={2} /> {REGION_LABEL[intel.region]}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-v4-serif text-base font-semibold leading-tight text-ink sm:text-lg">{intel.title}</h3>
          {intel.summary && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-ink/65">{intel.summary}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 font-v4-mono text-[11px] text-ink/45">
            {intel.source_type && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3 w-3" strokeWidth={2} />
                {SOURCE_TYPE_LABEL[intel.source_type]}
              </span>
            )}
            {intel.source_name && (
              <>
                <span className="text-ink/25">·</span>
                <span className="truncate max-w-[200px]">{intel.source_name}</span>
              </>
            )}
            {intel.author && (
              <>
                <span className="text-ink/25">·</span>
                <span>{intel.author}</span>
              </>
            )}
            <span className="text-ink/25">·</span>
            <span className="inline-flex items-center gap-1">
              <OriginIcon className="h-3 w-3" strokeWidth={2} />
              {intel.source_origin === 'auto' ? '自動' : '人工'}
            </span>
            <span className="text-ink/25">·</span>
            <span className="numeric">{daysSince(intel.published_at ?? intel.created_at)} 天前</span>
          </div>
        </div>
        <ArrowUpRight className="hidden h-5 w-5 text-ink/30 transition group-hover:text-ink sm:block" strokeWidth={1.75} />
      </Link>
    </li>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 min-w-[120px] flex-1 rounded-md border border-ink/15 bg-paper px-2.5 text-sm font-semibold text-ink outline-none transition hover:border-ink/30 sm:flex-none sm:w-[140px]"
    >
      {children}
    </select>
  );
}
