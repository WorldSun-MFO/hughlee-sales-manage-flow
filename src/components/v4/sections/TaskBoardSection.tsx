// ============================================================
// 任務概覽卡片列 — 放在「下一步」上方,一眼看完此客戶的待辦規劃
// ============================================================
// 兩張卡:
//   未來規劃   → due_date 有值的任務,由左到右日期近 → 遠(橫向時間序)
//   後續需要做 → due_date 為 null 的任務(還沒排時間的待安排事項)
// 已完成(status==='done')的任務不列入 —— 這是規劃板,只放待辦。
//
// 純展示伺服器元件;完整的新增 / 編輯 / 完成 操作在下方 TasksSection。
// 日期以 Asia/Taipei 計算(伺服器跑 UTC,避免清晨算錯一天)。
// ============================================================
import { CalendarClock, ListTodo } from 'lucide-react';
import { getDealTasks } from '@/lib/v4/data';

// 'YYYY-MM-DD' → 今天 / 明天 / 昨天 / M/D(週X),並標出逾期 / 即將到期
function makeDateLabel(todayStr: string) {
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  return (due: string): { text: string; tone: 'overdue' | 'soon' | 'normal' } => {
    const d = new Date(`${due}T00:00:00Z`);
    const diff = Math.round((d.getTime() - todayMs) / 86_400_000);
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getUTCDay()];
    let text: string;
    if (diff === 0) text = '今天';
    else if (diff === 1) text = '明天';
    else if (diff === -1) text = '昨天';
    else text = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(週${wd})`;
    const tone = diff < 0 ? 'overdue' : diff <= 3 ? 'soon' : 'normal';
    return { text, tone };
  };
}

export async function TaskBoardSection({ dealId }: { dealId: string }) {
  const tasks = await getDealTasks(dealId); // React.cache():與下方 TasksSection 共用同一次查詢
  const pending = tasks.filter((t) => t.status !== 'done');
  // 'YYYY-MM-DD' 字串字典序 = 時間序,直接排即由近到遠
  const planned = pending
    .filter((t) => t.due_date)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : a.due_date! > b.due_date! ? 1 : 0));
  const backlog = pending.filter((t) => !t.due_date);

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
  const label = makeDateLabel(todayStr);

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {/* 未來規劃 — 有排時間,左→右近到遠 */}
      <div className="grid content-start gap-2 rounded-md border border-ink/10 bg-paper p-4">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5 text-cobalt" strokeWidth={2} />
          <span className="label-caps text-ink/55">未來規劃</span>
          <span className="font-v4-mono text-[10px] font-bold text-ink/45 numeric">{planned.length}</span>
        </div>
        {planned.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {planned.map((t) => {
              const lb = label(t.due_date!);
              const cardTone = lb.tone === 'overdue' ? 'border-claret/40 bg-claret/5'
                : lb.tone === 'soon' ? 'border-brass/40 bg-brass/5'
                  : 'border-ink/12 bg-cream/40';
              const dateTone = lb.tone === 'overdue' ? 'text-claret'
                : lb.tone === 'soon' ? 'text-brass' : 'text-ink/55';
              return (
                <div key={t.id} className={`grid w-36 shrink-0 content-start gap-1 rounded-sm border px-2.5 py-2 ${cardTone}`}>
                  <div className="flex items-center gap-1">
                    <span className={`font-v4-mono text-[11px] font-bold numeric ${dateTone}`}>{lb.text}</span>
                    {t.start_time && (
                      <span className="font-v4-mono text-[10px] text-ink/40">{t.start_time.slice(0, 5)}</span>
                    )}
                  </div>
                  <span className="line-clamp-2 text-xs leading-5 text-ink">{t.title}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-sm border border-dashed border-ink/12 px-3 py-4 text-center text-[11px] text-ink/40">
            還沒有排定時間的任務
          </div>
        )}
      </div>

      {/* 後續需要做 — 還沒排時間 */}
      <div className="grid content-start gap-2 rounded-md border border-ink/10 bg-paper p-4">
        <div className="flex items-center gap-1.5">
          <ListTodo className="h-3.5 w-3.5 text-forest" strokeWidth={2} />
          <span className="label-caps text-ink/55">後續需要做</span>
          <span className="font-v4-mono text-[10px] font-bold text-ink/45 numeric">{backlog.length}</span>
        </div>
        {backlog.length > 0 ? (
          <ul className="grid gap-1.5">
            {backlog.map((t) => (
              <li key={t.id} className="flex items-start gap-2 rounded-sm border border-ink/8 bg-cream/30 px-2.5 py-1.5">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${t.priority === 'high' ? 'bg-claret' : t.priority === 'low' ? 'bg-ink/25' : 'bg-cobalt/60'}`} />
                <span className="text-xs leading-5 text-ink">{t.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-sm border border-dashed border-ink/12 px-3 py-4 text-center text-[11px] text-ink/40">
            沒有待安排的任務
          </div>
        )}
      </div>
    </section>
  );
}
