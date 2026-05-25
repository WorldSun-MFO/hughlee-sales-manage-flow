// 對話原稿(is_raw=true 的 comment)— 純展示,折疊式
// 跟 AI 整理過的活動紀錄分開,要查原話才開
import { FileText, Pen } from 'lucide-react';
import { getDealComments } from '@/lib/v4/data';

export async function RawTranscriptSection({ dealId }: { dealId: string }) {
  const all = await getDealComments(dealId);
  const rawComments = all
    .filter((c) => c.is_raw)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  if (rawComments.length === 0) return null;

  return (
    <section>
      <details className="rounded-md border border-brass/25 bg-brass/5">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 font-v4-serif text-sm text-brass">
          <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
          對話原稿 · {rawComments.length} 筆(未經 AI 處理的原話)
        </summary>
        <ul className="grid gap-2 px-3 pb-3 max-h-72 overflow-y-auto">
          {rawComments.map((c) => (
            <li
              key={c.id}
              className="rounded border border-brass/15 bg-paper px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5 font-v4-mono text-[11px] text-brass numeric">
                <Pen className="h-3 w-3" strokeWidth={1.75} />
                {new Date(c.created_at).toLocaleString('zh-Hant-TW', {
                  hour12: false,
                })}
              </div>
              <div className="mt-0.5 whitespace-pre-wrap text-sm text-ink">
                {c.body}
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
