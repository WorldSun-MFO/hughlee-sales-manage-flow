'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MarketIntel, MarketTag } from '@/lib/types';
import { IntelForm } from './IntelForm';
import {
  REGION_LABEL, SOURCE_TYPE_LABEL,
  STANCES, STANCE_STYLE,
  TAG_CATEGORY_STYLE, TAG_CATEGORY_LABEL,
} from '@/lib/market/constants';

export function IntelDetailView({
  intel,
  canEdit,
  existingTags,
}: {
  intel: MarketIntel;
  canEdit: boolean;
  existingTags: MarketTag[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleDelete() {
    if (!confirm('確定刪除這筆情報?此動作無法復原。')) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`/api/market/intel/${intel.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error ?? '刪除失敗');
        setDeleting(false);
        return;
      }
      router.push('/market');
      router.refresh();
    } catch {
      setError('網路錯誤,請再試一次');
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-3">
        <button onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:underline">← 取消編輯</button>
        <IntelForm mode="edit" initial={intel} existingTags={existingTags} />
      </div>
    );
  }

  const stanceLabel = STANCES.find(s => s.key === intel.stance)?.label ?? '未標';

  return (
    <div className="max-w-3xl space-y-4">
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-600">{REGION_LABEL[intel.region]}</span>
          <span className="text-slate-300">·</span>
          <span className="text-slate-600">{SOURCE_TYPE_LABEL[intel.source_type]}</span>
          {intel.source_name && <span className="text-slate-500">· {intel.source_name}</span>}
          <span className={`px-2 py-0.5 rounded-full ${STANCE_STYLE[intel.stance]}`}>{stanceLabel}</span>
        </div>

        <h1 className="text-xl font-bold text-slate-900">{intel.title}</h1>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
          {intel.author && <span>分析師:{intel.author}</span>}
          {intel.published_at && <span>原文發布:{intel.published_at}</span>}
          <span>建檔:{intel.created_at.slice(0, 10)}</span>
          {intel.creator?.full_name && <span>by {intel.creator.full_name}</span>}
        </div>

        {intel.source_url && (
          <a href={intel.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline break-all">
            🔗 看原文
          </a>
        )}

        {intel.summary && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">摘要</div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{intel.summary}</p>
          </div>
        )}

        {(intel.key_points?.length ?? 0) > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-1">重點</div>
            <ul className="list-disc list-inside space-y-1 text-sm text-slate-700">
              {intel.key_points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </div>
        )}

        {(intel.tags?.length ?? 0) > 0 && (
          <div>
            <div className="text-xs font-medium text-slate-500 mb-2">標籤</div>
            <div className="flex flex-wrap gap-1.5">
              {intel.tags!.map(t => (
                <span key={t.id} className={`text-xs px-2 py-0.5 rounded-full ${TAG_CATEGORY_STYLE[t.category]}`}>
                  <span className="opacity-60">{TAG_CATEGORY_LABEL[t.category]}·</span>{t.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {canEdit ? (
        <div className="flex gap-3">
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center px-4 h-10 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
            ✏️ 編輯
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="inline-flex items-center px-4 h-10 border border-rose-200 text-rose-600 rounded-lg text-sm hover:bg-rose-50 disabled:opacity-50">
            {deleting ? '刪除中…' : '🗑 刪除'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-slate-400">這筆情報由他人建立,你可以閱讀但不能編輯/刪除。</p>
      )}
    </div>
  );
}
