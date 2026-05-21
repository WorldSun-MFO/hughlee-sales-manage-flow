import Link from 'next/link';
import { ArrowUpRight, Calendar, ClipboardList } from 'lucide-react';
import type { Snapshot } from '@/lib/v4/types';
import { cn, daysUntil, fmtMoney, priorityReason, TIER_STYLES, urgencyScore } from '@/lib/v4/utils';

export function TodayView({ snapshot, base }: { snapshot: Snapshot; base: '/v4/workspace' | '/v4/hub' }) {
  const priorityDeals = snapshot.deals
    .map((d) => ({ deal: d, score: urgencyScore(d, snapshot.tierConfig) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.deal);

  const myTasks = snapshot.tasks.filter((t) => t.status !== 'done');

  const today = new Date().toLocaleDateString('zh-Hant-TW', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <div className="grid gap-12 px-8 py-10 lg:px-14 lg:py-14">
      <header className="grid gap-2">
        <div className="label-caps text-ink/45">Today · {today}</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[1.05] tracking-tight text-ink lg:text-[56px]">
          今天要做的事
        </h1>
        <p className="max-w-2xl text-base leading-7 text-ink/65">
          {priorityDeals.length > 0
            ? `${priorityDeals.length} 個客戶需要關注、${myTasks.length} 個未完成任務。從上而下處理。`
            : '所有客戶都健康。今天可以選擇主動轉介或精進案件品質。'}
        </p>
      </header>

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label-caps text-ink/55">優先客戶 · {priorityDeals.length} 位</div>
            <h2 className="mt-1 font-v4-serif text-2xl font-medium text-ink">今日追蹤清單</h2>
          </div>
        </div>

        {priorityDeals.length === 0 ? (
          <div className="rounded-md border border-forest/30 bg-forest/5 px-6 py-10 text-center text-sm font-semibold text-forest">
            🎉 沒有待追蹤的案件，全部健康。
          </div>
        ) : (
          <ul className="grid gap-2">
            {priorityDeals.map((d) => {
              const reason = priorityReason(d, snapshot.tierConfig);
              const tone = reason?.tone ?? 'amber';
              const accent = tone === 'rose' ? 'border-l-claret bg-claret/4' : tone === 'orange' ? 'border-l-brass bg-brass/4' : 'border-l-ink/30 bg-cream/40';
              return (
                <li key={d.id}>
                  <Link
                    href={`${base}/clients/${d.id}`}
                    className={cn(
                      'group grid grid-cols-[60px_1fr_auto] items-center gap-4 rounded-md border border-ink/10 border-l-4 p-4 transition hover:border-ink/30 hover:shadow-panel',
                      accent,
                    )}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {d.tier ? (
                        <span className={`rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-bold ${TIER_STYLES[d.tier]}`}>{d.tier}</span>
                      ) : null}
                      <span className={`stage-${d.stage} rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-bold`}>{d.stage}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-v4-serif text-lg font-semibold leading-tight text-ink">
                        {d.name.replace(/^【範例】/, '')}
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-v4-mono text-xs text-ink/55">
                        <span>{d.rm?.full_name ?? '—'}</span>
                        <span className="text-ink/25">·</span>
                        <span className="truncate">{d.product ?? '—'}</span>
                      </div>
                      {reason ? (
                        <div className="mt-1.5 text-sm font-semibold text-ink/85">
                          {reason.icon} {reason.text}
                        </div>
                      ) : null}
                      {d.next_step ? (
                        <div className="mt-1 line-clamp-1 text-xs text-ink/55">👉 {d.next_step}</div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-v4-mono text-base font-semibold text-ink numeric">{fmtMoney(Number(d.aum_usd))}</span>
                      <ArrowUpRight className="h-4 w-4 text-ink/30 transition group-hover:text-ink" strokeWidth={1.75} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="label-caps text-ink/55">Tasks · {myTasks.length} 件未完成</div>
            <h2 className="mt-1 font-v4-serif text-2xl font-medium text-ink">我的任務</h2>
          </div>
        </div>

        {myTasks.length === 0 ? (
          <div className="rounded-md border border-ink/10 bg-cream/40 px-6 py-10 text-center text-sm font-semibold text-ink/45">
            沒有未完成任務。
          </div>
        ) : (
          <ul className="grid gap-2">
            {myTasks.map((t) => {
              const due = daysUntil(t.due_date);
              const dueLabel = due === null ? '無期限' : due < 0 ? `逾期 ${Math.abs(due)} 天` : due === 0 ? '今天' : `${due} 天後`;
              const dueTone = due !== null && due < 0 ? 'text-claret' : due !== null && due <= 2 ? 'text-brass' : 'text-ink/55';
              const linkedDeal = snapshot.deals.find((d) => d.id === t.deal_id);
              return (
                <li key={t.id}>
                  <div className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 rounded-md border border-ink/10 bg-paper px-4 py-3">
                    <input type="checkbox" readOnly className="h-4 w-4 rounded border-ink/25 accent-forest" />
                    <div className="min-w-0">
                      <div className="font-v4-serif text-base font-medium text-ink">{t.title}</div>
                      {linkedDeal ? (
                        <Link href={`${base}/clients/${linkedDeal.id}`} className="mt-0.5 inline-flex items-center gap-1 font-v4-mono text-[11px] text-ink/55 hover:text-ink">
                          {linkedDeal.name.replace(/^【範例】/, '')} <ArrowUpRight className="h-3 w-3" strokeWidth={1.75} />
                        </Link>
                      ) : null}
                    </div>
                    <span
                      className={cn(
                        'rounded-sm border px-1.5 py-0.5 font-v4-mono text-[10px] font-bold',
                        t.priority === 'high' ? 'border-claret/30 bg-claret/8 text-claret'
                          : t.priority === 'normal' ? 'border-ink/15 text-ink/65'
                            : 'border-ink/10 text-ink/40',
                      )}
                    >
                      {t.priority}
                    </span>
                    <span className={cn('font-v4-mono text-xs font-semibold numeric', dueTone)}>{dueLabel}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
