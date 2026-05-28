'use client';

// ============================================================
// V4 市場情報 詳情頁 — 對應舊 IntelDetailView,套 v4 視覺
// ============================================================
// 顯示:地區/來源/立場、標題、分析師/發布/建檔、原文連結、摘要、重點、標籤、關聯客戶。
// canEdit(建立者或 admin):可切到 V4IntelForm 編輯,或刪除(DELETE /api/market/intel/[id])。
// ============================================================
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react';
import type { MarketIntel, MarketTag, DealLite, IntelStance } from '@/lib/types';
import { REGION_LABEL, SOURCE_TYPE_LABEL, STANCES, TAG_CATEGORY_LABEL } from '@/lib/market/constants';
import { V4IntelForm } from '@/components/v4/market/V4IntelForm';
import { cn } from '@/lib/v4/utils';

const STANCE_TONE: Record<IntelStance, string> = {
  bullish: 'border-forest/30 bg-forest/8 text-forest',
  bearish: 'border-claret/30 bg-claret/8 text-claret',
  neutral: 'border-brass/30 bg-brass/8 text-brass',
  na: 'border-ink/15 bg-ink/4 text-ink/55',
};

export function IntelDetailV4({
  intel, canEdit, existingTags, deals, base,
}: {
  intel: MarketIntel;
  canEdit: boolean;
  existingTags: MarketTag[];
  deals: DealLite[];
  base: '/workspace' | '/hub';
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!confirm('確定刪除這筆情報?此動作無法復原。')) return;
    setDeleting(true); setError('');
    try {
      const res = await fetch(`/api/market/intel/${intel.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? '刪除失敗'); setDeleting(false); return;
      }
      router.push(`${base}/market` as never);
      router.refresh();
    } catch {
      setError('網路錯誤,請再試一次'); setDeleting(false);
    }
  }

  const stanceLabel = STANCES.find((s) => s.key === intel.stance)?.label ?? '未標';

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <Link href={`${base}/market` as never} className="inline-flex items-center gap-1.5 font-v4-mono text-xs font-semibold text-ink/55 transition hover:text-ink">
        <ArrowLeft className="h-3 w-3" strokeWidth={2} /> 回市場大腦
      </Link>

      {editing ? (
        <div className="grid gap-3">
          <button type="button" onClick={() => setEditing(false)} className="justify-self-start font-v4-mono text-xs text-ink/55 hover:text-ink">← 取消編輯</button>
          <V4IntelForm mode="edit" initial={intel} existingTags={existingTags} deals={deals} />
        </div>
      ) : (
        <>
          {error && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-sm text-claret">{error}</div>}

          <article className="grid max-w-3xl gap-4 rounded-md border border-ink/10 bg-paper p-6">
            <div className="flex flex-wrap items-center gap-2 font-v4-mono text-[11px] text-ink/55">
              <span>{REGION_LABEL[intel.region]}</span>
              <span className="text-ink/25">·</span>
              <span>{SOURCE_TYPE_LABEL[intel.source_type]}</span>
              {intel.source_name && <span className="text-ink/45">· {intel.source_name}</span>}
              <span className={cn('rounded-sm border px-2 py-0.5 font-bold', STANCE_TONE[intel.stance])}>{stanceLabel}</span>
            </div>

            <h1 className="font-v4-serif text-3xl font-semibold leading-tight text-ink">{intel.title}</h1>

            <div className="flex flex-wrap gap-x-4 gap-y-1 font-v4-mono text-[11px] text-ink/45">
              {intel.author && <span>分析師:{intel.author}</span>}
              {intel.published_at && <span>原文發布:{intel.published_at}</span>}
              <span>建檔:{intel.created_at.slice(0, 10)}</span>
              {intel.creator?.full_name && <span>by {intel.creator.full_name}</span>}
            </div>

            {intel.source_url && (
              <a href={intel.source_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-v4-mono text-sm text-cobalt hover:underline break-all">
                <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} /> 看原文
              </a>
            )}

            {intel.summary && (
              <div className="grid gap-1">
                <div className="label-caps text-ink/45">摘要</div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink/85">{intel.summary}</p>
              </div>
            )}

            {(intel.key_points?.length ?? 0) > 0 && (
              <div className="grid gap-1">
                <div className="label-caps text-ink/45">重點</div>
                <ul className="grid list-inside list-disc gap-1 text-sm text-ink/80">
                  {intel.key_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {(intel.tags?.length ?? 0) > 0 && (
              <div className="grid gap-1.5">
                <div className="label-caps text-ink/45">標籤</div>
                <div className="flex flex-wrap gap-1.5">
                  {intel.tags!.map((t) => (
                    <span key={t.id} className="rounded-sm border border-ink/15 bg-cream/40 px-2 py-0.5 font-v4-mono text-[11px] text-ink/70">
                      <span className="text-ink/40">{TAG_CATEGORY_LABEL[t.category]}·</span>{t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(intel.deal_links?.length ?? 0) > 0 && (
              <div className="grid gap-1.5">
                <div className="label-caps text-ink/45">🔗 關聯客戶</div>
                <ul className="grid gap-1.5">
                  {intel.deal_links!.map((l) => (
                    <li key={l.deal_id} className="text-sm text-ink/80">
                      <span className="font-semibold text-ink">{l.deal?.name ?? '(無權限或已不存在的客戶)'}</span>
                      {l.relevance_reason && <span className="text-ink/55"> — {l.relevance_reason}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          {canEdit ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-4 text-sm font-semibold text-ink/75 transition hover:border-ink/30 hover:text-ink">
                <Pencil className="h-3.5 w-3.5" strokeWidth={2} /> 編輯
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-claret/30 px-4 text-sm font-semibold text-claret transition hover:bg-claret/5 disabled:opacity-50">
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />}
                {deleting ? '刪除中…' : '刪除'}
              </button>
            </div>
          ) : (
            <p className="font-v4-mono text-[11px] text-ink/45">這筆情報由他人建立,你可以閱讀但不能編輯/刪除。</p>
          )}
        </>
      )}
    </div>
  );
}
