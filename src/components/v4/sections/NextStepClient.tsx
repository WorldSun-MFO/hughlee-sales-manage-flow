'use client';

// 下一步 + 目標成交日,inline edit + 「拆成任務」按鈕
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Loader2, ListTodo } from 'lucide-react';
import type { Deal } from '@/lib/v4/types';
import { InlineTextarea, InlineDate } from '@/components/v4/InlineEdit';
import { PaymentBadge } from '@/components/v4/sections/PaymentBadge';
import { createTask, patchDeal, splitNextStepIntoTasks } from '@/lib/v4/mutations';
import { createClient } from '@/lib/supabase/client';

export function NextStepClient({ deal, isFixtures }: { deal: Deal; isFixtures: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [splitBusy, setSplitBusy] = useState(false);
  const [splitMsg, setSplitMsg] = useState<string | null>(null);
  const refresh = () => undefined; // fire-and-forget;不再 router.refresh,改靠本地 optimistic state

  // next_step 提到本地 state:讓「畫面顯示的值」與「加到我的任務要拆的值」是同一份。
  // 否則 inline 編輯(刪行)後 deal.next_step prop 尚未同步,拆任務會用到舊值、把刪掉的行又加回去。
  const [nextStep, setNextStep] = useState(deal.next_step);
  useEffect(() => { setNextStep(deal.next_step); }, [deal.next_step]);

  async function handleSplit() {
    if (!nextStep || splitBusy) return;
    if (isFixtures) { setSplitMsg('fixtures 模式無法寫入'); setTimeout(() => setSplitMsg(null), 2500); return; }
    const titles = splitNextStepIntoTasks(nextStep);
    if (titles.length === 0) { setSplitMsg('下一步沒有可加入的內容'); setTimeout(() => setSplitMsg(null), 2500); return; }
    setSplitBusy(true); setSplitMsg(null);
    try {
      // 指派給目前登入者,讓任務出現在側邊欄「我的任務」自己名下
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      for (const title of titles) {
        await createTask({ deal_id: deal.id, title, assignee_id: user?.id ?? null, priority: 'normal', status: 'todo' });
      }
      // 建立後主動刷新:同頁下方「任務」區 + 側邊欄「我的任務」立刻反映
      //(跨元件同步本來靠 Realtime,但 preview 未推播,故這裡明確 refresh)
      setSplitMsg(`✓ 已加入我的任務(${titles.length} 件)`);
      startTransition(() => router.refresh());
      setTimeout(() => setSplitMsg(null), 3000);
    } catch (err) { setSplitMsg(`失敗:${(err as Error).message}`); }
    finally { setSplitBusy(false); }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55">下一步</div>
        {nextStep && (
          <button
            type="button"
            onClick={handleSplit}
            disabled={splitBusy || isFixtures}
            title="把這個客戶的下一步加入「我的任務」(多行會拆成多筆,指派給自己)"
            className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-paper px-2.5 py-1 font-v4-mono text-[11px] font-semibold text-ink/70 transition hover:border-ink/30 hover:text-ink disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {splitBusy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <ListTodo className="h-3 w-3" strokeWidth={2} />}
            {splitBusy ? '加入中…' : '加到我的任務'}
          </button>
        )}
      </div>
      <div className="rounded-md border border-ink/10 bg-cream/60 p-4">
        <InlineTextarea
          value={nextStep}
          onSave={async (next) => { setNextStep(next); await patchDeal(deal.id, { next_step: next }); refresh(); }}
          isFixtures={isFixtures}
          placeholder="尚未填寫下一步。點擊撰寫..."
          rows={4}
          displayClassName="font-v4-serif text-lg leading-relaxed text-ink"
        />
      </div>
      {splitMsg && <div className="font-v4-mono text-[11px] text-ink/65">{splitMsg}</div>}
      <div className="flex items-center gap-2 font-v4-mono text-xs text-ink/55">
        <Calendar className="h-3 w-3 shrink-0" strokeWidth={2} />
        <span className="shrink-0 whitespace-nowrap">目標成交</span>
        <InlineDate
          value={deal.target_close_date}
          onSave={async (next) => { await patchDeal(deal.id, { target_close_date: next }); refresh(); }}
          isFixtures={isFixtures}
        />
        {/* 已收款 / 未收款:只在有設目標成交日時顯示 */}
        {deal.target_close_date && <PaymentBadge received={!!deal.payment_received} />}
      </div>
    </section>
  );
}
