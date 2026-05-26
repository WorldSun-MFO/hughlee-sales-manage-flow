'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, HelpCircle, Loader2 } from 'lucide-react';
import type { DealQuestion } from '@/lib/v4/types';
import { QUESTION_BANK } from '@/lib/constants';
import { cn } from '@/lib/v4/utils';
import { setDealQuestion } from '@/lib/v4/mutations';

export function QuestionsClient({
  dealId, questions, isFixtures,
}: {
  dealId: string;
  questions: DealQuestion[];
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  const askedKeys = new Set(questions.map((q) => q.question_key));
  if (askedKeys.size === 0) return null;

  type BankItem = { key: string; q: string };
  const allBank: Array<{ field: keyof typeof QUESTION_BANK; item: BankItem }> = [];
  for (const [field, items] of Object.entries(QUESTION_BANK)) {
    for (const it of items as BankItem[]) {
      if (askedKeys.has(it.key)) allBank.push({ field: field as keyof typeof QUESTION_BANK, item: it });
    }
  }
  if (allBank.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
          <HelpCircle className="h-3 w-3" strokeWidth={2} /> 待澄清題目 · {allBank.length}
        </div>
        <div className="font-v4-mono text-[10.5px] text-ink/45">勾「已答」+ 補答案內容</div>
      </div>
      <ul className="grid gap-2 rounded-md border border-ink/10 bg-paper p-4">
        {allBank.map(({ field, item }) => {
          const row = questions.find((q) => q.question_key === item.key);
          return (
            <li key={item.key}>
              <Row
                dealId={dealId} field={field} item={item}
                answered={row?.answered ?? false}
                note={row?.note ?? ''}
                isFixtures={isFixtures}
                onChanged={refresh}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Row({
  dealId, field, item, answered, note, isFixtures, onChanged,
}: {
  dealId: string;
  field: string;
  item: { key: string; q: string };
  answered: boolean;
  note: string;
  isFixtures: boolean;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState(note);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggleAnswered() {
    if (busy || isFixtures) return;
    setBusy(true);
    try { await setDealQuestion(dealId, item.key, !answered, note); onChanged(); }
    finally { setBusy(false); }
  }
  async function saveNote() {
    if (busy || isFixtures) return;
    if (draft.trim() === note.trim()) { setEditing(false); return; }
    setBusy(true);
    try { await setDealQuestion(dealId, item.key, answered, draft.trim()); setEditing(false); onChanged(); }
    finally { setBusy(false); }
  }

  return (
    <div className="grid grid-cols-[auto_1fr] items-start gap-3 border-t border-ink/8 pt-2 first:border-t-0 first:pt-0">
      <button type="button" onClick={toggleAnswered} disabled={busy || isFixtures}
        className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border transition',
          answered ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper')}>
        {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2.5} /> : answered && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="grid gap-1">
        <div className="flex items-baseline gap-2">
          <span className="font-v4-mono text-[10px] font-bold uppercase tracking-widest text-ink/55">{field}</span>
          <span className={cn('text-sm leading-6', answered ? 'text-ink/55' : 'text-ink/85')}>{item.q}</span>
        </div>
        {editing ? (
          <div className="grid gap-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2} autoFocus disabled={busy}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveNote(); }
                if (e.key === 'Escape') { setDraft(note); setEditing(false); }
              }}
              placeholder="客戶說了什麼?"
              className="w-full resize-vertical rounded-sm border border-ink/25 bg-cream/40 px-2 py-1 text-xs leading-5 text-ink focus:border-ink/45 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDraft(note); setEditing(false); }} className="text-[11px] text-ink/55 hover:text-ink">取消</button>
              <button type="button" onClick={saveNote} disabled={busy}
                className="inline-flex items-center gap-1 rounded-sm bg-ink px-2 py-0.5 text-[11px] font-semibold text-paper hover:bg-graphite disabled:bg-ink/30">
                {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" strokeWidth={2} /> : null} 儲存
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => !isFixtures && setEditing(true)} disabled={isFixtures} className="text-left">
            {note ? (
              <p className="text-xs leading-5 text-ink/65 whitespace-pre-wrap">{note}</p>
            ) : (
              !isFixtures && <span className="font-v4-mono text-[10px] text-ink/35 opacity-60 hover:opacity-100">+ 補答案</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
