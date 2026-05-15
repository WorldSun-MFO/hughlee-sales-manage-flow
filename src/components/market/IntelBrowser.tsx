'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { MarketIntel, IntelRegion, IntelSourceType, IntelStance } from '@/lib/types';
import {
  REGIONS, REGION_LABEL,
  SOURCE_TYPES, SOURCE_TYPE_LABEL,
  STANCES, STANCE_STYLE,
  TAG_CATEGORY_STYLE,
} from '@/lib/market/constants';

export function IntelBrowser({ initialIntel }: { initialIntel: MarketIntel[] }) {
  const [region, setRegion] = useState<IntelRegion | ''>('');
  const [sourceType, setSourceType] = useState<IntelSourceType | ''>('');
  const [stance, setStance] = useState<IntelStance | ''>('');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return initialIntel.filter(it => {
      if (region && it.region !== region) return false;
      if (sourceType && it.source_type !== sourceType) return false;
      if (stance && it.stance !== stance) return false;
      if (kw) {
        const hay = [
          it.title, it.summary, it.source_name, it.author,
          ...(it.key_points ?? []),
          ...(it.tags ?? []).map(t => t.name),
        ].join(' ').toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  }, [initialIntel, region, sourceType, stance, q]);

  const hasFilter = region || sourceType || stance || q.trim();

  return (
    <div className="space-y-4">
      {/* 工具列 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="🔍 搜尋標題 / 摘要 / 來源 / 標籤…"
          className="h-9 flex-1 min-w-[200px] rounded-lg border border-slate-200 px-3 text-sm focus:border-indigo-400 focus:outline-none"
        />
        <Link
          href="/market/new"
          className="inline-flex items-center gap-1 h-9 px-3 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
        >
          ＋ 新增情報
        </Link>
      </div>

      {/* 篩選列 */}
      <div className="flex flex-wrap gap-2 text-xs">
        <FilterGroup label="地區">
          <Chip active={region === ''} onClick={() => setRegion('')}>全部</Chip>
          {REGIONS.map(r => (
            <Chip key={r.key} active={region === r.key} onClick={() => setRegion(region === r.key ? '' : r.key)}>
              {r.flag} {r.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="來源">
          <Chip active={sourceType === ''} onClick={() => setSourceType('')}>全部</Chip>
          {SOURCE_TYPES.map(s => (
            <Chip key={s.key} active={sourceType === s.key} onClick={() => setSourceType(sourceType === s.key ? '' : s.key)}>
              {s.emoji} {s.label}
            </Chip>
          ))}
        </FilterGroup>
        <FilterGroup label="立場">
          <Chip active={stance === ''} onClick={() => setStance('')}>全部</Chip>
          {STANCES.map(s => (
            <Chip key={s.key} active={stance === s.key} onClick={() => setStance(stance === s.key ? '' : s.key)}>
              {s.label}
            </Chip>
          ))}
        </FilterGroup>
      </div>

      {/* 列表 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          {hasFilter ? '沒有符合篩選的情報。' : (
            <>還沒有任何情報。<Link href="/market/new" className="text-indigo-600 hover:underline">新增第一筆 →</Link></>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map(it => (
            <li key={it.id}>
              <Link
                href={`/market/${it.id}`}
                className="block bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-[11px] text-slate-500">{REGION_LABEL[it.region]}</span>
                      <span className="text-[11px] text-slate-400">·</span>
                      <span className="text-[11px] text-slate-500">{SOURCE_TYPE_LABEL[it.source_type]}</span>
                      {it.source_name && <span className="text-[11px] text-slate-400">· {it.source_name}</span>}
                      <span className={`text-[11px] px-2 py-0.5 rounded-full ${STANCE_STYLE[it.stance]}`}>
                        {STANCES.find(s => s.key === it.stance)?.label}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 truncate">{it.title}</div>
                    {it.summary && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{it.summary}</p>
                    )}
                    {(it.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {it.tags!.map(t => (
                          <span key={t.id} className={`text-[10px] px-2 py-0.5 rounded-full ${TAG_CATEGORY_STYLE[t.category]}`}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-400">
                      {it.published_at ? `發布 ${it.published_at}` : `建檔 ${it.created_at.slice(0, 10)}`}
                    </div>
                    {it.creator?.full_name && (
                      <div className="text-[11px] text-slate-400 mt-1">by {it.creator.full_name}</div>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-slate-400 mr-1">{label}</span>
      {children}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded-full border transition ${
        active
          ? 'bg-indigo-600 text-white border-indigo-600'
          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
      }`}
    >
      {children}
    </button>
  );
}
