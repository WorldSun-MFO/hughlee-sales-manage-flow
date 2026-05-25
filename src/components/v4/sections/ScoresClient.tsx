'use client';

// MEDDIC 評分區 — inline edit + score_notes(每分數的文字理由)
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { ScoreField, ScoreNote, Scores } from '@/lib/v4/types';
import { cn } from '@/lib/v4/utils';
import { InlineScore } from '@/components/v4/InlineEdit';
import { patchScores, setScoreNote } from '@/lib/v4/mutations';

const MEDDIC_LABELS: Array<[ScoreField, string, string]> = [
  ['m', 'M', 'Metrics'],
  ['e', 'E', 'Economic Buyer'],
  ['d1', 'D₁', 'Decision Criteria'],
  ['d2', 'D₂', 'Decision Process'],
  ['p', 'P', 'Paper Process'],
  ['i', 'I', 'Identify Pain'],
  ['c1', 'C₁', 'Champion'],
  ['c2', 'C₂', 'Competition'],
];

export function ScoresClient({
  dealId, scores, notes, isFixtures,
}: {
  dealId: string;
  scores: Scores | null;
  notes: ScoreNote[];
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">MEDDIC 評分</div>
        <div className="font-v4-mono text-[10.5px] text-ink/45">點分數改 0–10 · 點「+ 加備註」寫理由</div>
      </div>
      <div className="grid gap-2 rounded-md border border-ink/10 bg-paper p-5">
        {MEDDIC_LABELS.map(([k, key, label]) => {
          const v = scores?.[k] ?? 0;
          const tone = v >= 8 ? 'bg-forest' : v >= 5 ? 'bg-brass' : v >= 3 ? 'bg-ink/40' : 'bg-claret/70';
          const noteRow = notes.find((sn) => sn.field === k);
          return (
            <div key={k} className="grid gap-1 rounded-sm border border-ink/8 px-3 py-2">
              <div className="grid grid-cols-[40px_1fr_90px] items-center gap-3">
                <span className="font-v4-mono text-sm font-bold text-ink">{key}</span>
                <span className="text-xs text-ink/65">{label}</span>
                <div className="flex items-center justify-end gap-2">
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink/8">
                    <div className={cn('h-full', tone)} style={{ width: `${v * 10}%` }} />
                  </div>
                  <InlineScore
                    value={v}
                    onSave={async (next) => { await patchScores(dealId, { [k]: next } as Partial<Scores>); refresh(); }}
                    isFixtures={isFixtures}
                  />
                </div>
              </div>
              <ScoreNoteEditor
                dealId={dealId} field={k}
                initialNote={noteRow?.note ?? ''}
                isFixtures={isFixtures}
                onSaved={refresh}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoreNoteEditor({
  dealId, field, initialNote, isFixtures, onSaved,
}: {
  dealId: string; field: ScoreField; initialNote: string; isFixtures: boolean; onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (draft.trim() === initialNote.trim()) { setEditing(false); return; }
    if (isFixtures) { setErr('fixtures 模式無法寫入'); return; }
    setBusy(true); setErr(null);
    try { await setScoreNote(dealId, field, draft.trim()); setEditing(false); onSaved(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => !isFixtures && setEditing(true)}
        disabled={isFixtures}
        className={cn(
          'group grid gap-1 text-left',
          !isFixtures && 'hover:bg-cream/40 rounded-sm -mx-1 px-1 py-0.5',
          isFixtures && 'cursor-not-allowed',
        )}
      >
        {initialNote ? (
          <span className="text-[12px] leading-5 text-ink/65 whitespace-pre-wrap">{initialNote}</span>
        ) : (
          !isFixtures && <span className="font-v4-mono text-[10px] font-semibold text-ink/35 opacity-0 transition group-hover:opacity-100">+ 加備註</span>
        )}
      </button>
    );
  }
  return (
    <div className="grid gap-1">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
          if (e.key === 'Escape') { setDraft(initialNote); setEditing(false); }
        }}
        rows={2}
        autoFocus
        disabled={busy}
        placeholder="這個分數的根據(看到什麼證據、客戶說了什麼...)"
        className="w-full resize-vertical rounded-sm border border-ink/25 bg-cream/40 px-2 py-1 text-xs leading-5 text-ink focus:border-ink/45 focus:outline-none"
      />
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={() => { setDraft(initialNote); setEditing(false); }} disabled={busy} className="text-[11px] text-ink/55 hover:text-ink">取消</button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper hover:bg-graphite disabled:bg-ink/30">
          {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2} /> : null}
          儲存
        </button>
      </div>
      {err && <div className="text-[10px] text-claret">{err}</div>}
    </div>
  );
}
