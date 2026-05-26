// 痛點 → 建議商品 — 純展示,折疊式(預設收合,要看才展開)
import { getPainPoints } from '@/lib/v4/data';

export async function PainMatrixSection() {
  const painPoints = await getPainPoints();
  if (painPoints.length === 0) return null;

  return (
    <section>
      <details className="rounded-md border border-ink/10 bg-paper">
        <summary className="label-caps cursor-pointer select-none px-4 py-3 text-ink/55">
          痛點 → 建議商品 · {painPoints.length} 條
        </summary>
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2">
          {painPoints.map((row) => (
            <div
              key={row.id}
              className="rounded-sm border border-ink/10 bg-paper p-3 text-xs"
            >
              <div className="font-semibold text-ink">「{row.pain}」</div>
              <div className="mt-0.5 text-cobalt">→ {row.product}</div>
              {row.tiers && (
                <div className="mt-0.5 text-[10px] text-ink/50">
                  適用層級:{row.tiers}
                </div>
              )}
              <div className="mt-0.5 text-xs text-ink/65">{row.pitch}</div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
