// ============================================================
// 任務概覽卡片列 — 放在「下一步」上方,一眼看完此客戶的待辦規劃
// ============================================================
// 上下兩張卡:
//   未來規劃   → due_date 有值的任務,由左到右日期近 → 遠(橫向時間序)
//   後續需要做 → due_date 為 null 的任務(還沒排時間的待安排事項)
// 已完成(status==='done')的任務不列入 —— 這是規劃板,只放待辦。
//
// 每個方塊都超連結到下方 TasksSection 對應任務(#task-<id>),點了會捲到
// 該任務並高亮,看得到完整細節 / 做編輯。
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

function priorityDot(priority: string): string {
  return priority === 'high' ? 'bg-claret' : priority === 'low' ? 'bg-ink/25' : 'bg-cobalt/60';
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
    <section className="grid gap-3">
      {/* 未來規劃 — 有排時間,左→右近到遠 */}
      <div className="grid content-start gap-3 rounded-md border border-ink/10 bg-paper p-5">
        <div className="flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4 text-cobalt" strokeWidth={2} />
          <span className="label-caps text-ink/55">未來規劃</span>
          <span className="font-v4-mono text-[11px] font-bold text-ink/45 numeric">{planned.length}</span>
        </div>
        {planned.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {planned.map((t) => {
              const lb = label(t.due_date!);
              const cardTone = lb.tone === 'overdue' ? 'border-claret/40 bg-claret/5 hover:border-claret/60'
                : lb.tone === 'soon' ? 'border-brass/40 bg-brass/5 hover:border-brass/60'
                  : 'border-ink/12 bg-cream/40 hover:border-ink/30';
              const dateTone = lb.tone === 'overdue' ? 'text-claret'
                : lb.tone === 'soon' ? 'text-brass' : 'text-ink/60';
              return (
                <a
                  key={t.id}
                  href={`#task-${t.id}`}
                  className={`grid min-h-[110px] w-52 shrink-0 content-start gap-2 rounded-md border px-4 py-3 transition hover:shadow-panel ${cardTone}`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`mt-0 h-2 w-2 shrink-0 rounded-full ${priorityDot(t.priority)}`} />
                    <span className={`font-v4-mono text-sm font-bold numeric ${dateTone}`}>{lb.text}</span>
                    {t.start_time && (
                      <span className="font-v4-mono text-[11px] text-ink/45">{t.start_time.slice(0, 5)}</span>
                    )}
                  </div>
                  <span className="line-clamp-3 text-sm leading-6 text-ink">{t.title}</span>
                </a>
              );
            })}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-ink/12 px-3 py-8 text-center text-xs text-ink/40">
            還沒有排定時間的任務
          </div>
        )}
      </div>

      {/* 後續需要做 — 還沒排時間 */}
      <div className="grid content-start gap-3 rounded-md border border-ink/10 bg-paper p-5">
        <div className="flex items-center gap-1.5">
          <ListTodo className="h-4 w-4 text-forest" strokeWidth={2} />
          <span className="label-caps text-ink/55">後續需要做</span>
          <span className="font-v4-mono text-[11px] font-bold text-ink/45 numeric">{backlog.length}</span>
        </div>
        {backlog.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {backlog.map((t) => (
              <li key={t.id}>
                <a
                  href={`#task-${t.id}`}
                  className="flex items-start gap-2.5 rounded-md border border-ink/10 bg-cream/30 px-4 py-3 transition hover:border-ink/30 hover:shadow-panel"
                >
                  <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${priorityDot(t.priority)}`} />
                  <span className="text-sm leading-6 text-ink">{t.title}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-ink/12 px-3 py-8 text-center text-xs text-ink/40">
            沒有待安排的任務
          </div>
        )}
      </div>
    </section>
  );
}
