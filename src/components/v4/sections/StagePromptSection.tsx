// Stage prompt — v4 訊息卡:顯示這個階段該做什麼(目標 / 入口 / 出口 / 必記 / 建議動作)
// 純展示伺服器元件,只讀常數,不需要 client interactivity。
import { Target, ArrowDown, ArrowUp, ClipboardList, Lightbulb } from 'lucide-react';
import { STAGE_PROMPTS } from '@/lib/constants';
import type { StageId } from '@/lib/v4/types';

export function StagePromptSection({ stage }: { stage: StageId }) {
  const prompt = STAGE_PROMPTS[stage];
  if (!prompt) return null;

  return (
    <section className="grid gap-3 rounded-md border border-brass/30 bg-brass/5 p-4">
      {/* 階段徽章 + 目標標題 */}
      <header className="flex items-center gap-2">
        <span className={`rounded-sm px-1.5 py-0.5 font-v4-mono text-[10px] font-semibold uppercase tracking-widest stage-${stage}`}>
          {stage}
        </span>
        <h3 className="font-v4-serif text-base font-semibold text-ink inline-flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-brass" strokeWidth={2} />
          {prompt.goal}
        </h3>
      </header>

      {/* 入口 / 出口 兩欄 */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-ink/10 bg-paper px-3 py-2">
          <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
            <ArrowDown className="h-2.5 w-2.5" strokeWidth={2} /> 入口條件
          </div>
          <div className="mt-1 text-xs leading-5 text-ink">{prompt.entry}</div>
        </div>
        <div className="rounded-md border border-ink/10 bg-paper px-3 py-2">
          <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
            <ArrowUp className="h-2.5 w-2.5" strokeWidth={2} /> 出口標準
          </div>
          <div className="mt-1 text-xs leading-5 text-ink">{prompt.exit}</div>
        </div>
      </div>

      {/* 這階段必記 */}
      {prompt.keyRecords.length > 0 && (
        <div className="grid gap-1.5">
          <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
            <ClipboardList className="h-2.5 w-2.5" strokeWidth={2} /> 這階段必記
          </div>
          <ul className="grid gap-1">
            {prompt.keyRecords.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-5 text-ink">
                <span className="mt-1.5 grid h-1.5 w-1.5 shrink-0 rounded-full bg-brass/70" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 建議動作 */}
      {prompt.nextActions.length > 0 && (
        <div className="grid gap-1.5">
          <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
            <Lightbulb className="h-2.5 w-2.5" strokeWidth={2} /> 建議動作
          </div>
          <ul className="grid gap-1">
            {prompt.nextActions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-5 text-ink">
                <span className="mt-1.5 grid h-1.5 w-1.5 shrink-0 rounded-full bg-forest/70" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
