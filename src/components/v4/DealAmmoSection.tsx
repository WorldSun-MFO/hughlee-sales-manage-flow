'use client';

// ============================================================
// 客戶彈藥庫 — 跑 /api/ai/client-talking-points
// ============================================================
// 給選定客戶從近期 market_intel 找 2–5 條相關情報,
// Claude 把它轉成「hook / angle / opener / caution」可直接拿出去聊的話術
//
// 對應 ws_crm 既有 ClientAmmoCard.tsx,但 v4 版本砍掉「配對建議審核」流程
// (suggestions accept/dismiss)— 那個需要更多 UI 表面,等 Sprint L 之後
// 再做。這版只負責「給 RM 立刻能用的話術」。
// ============================================================
import { useState } from 'react';
import { Briefcase, Sparkles, Wand2, Loader2, AlertTriangle, Check, X } from 'lucide-react';
import { cn } from '@/lib/v4/utils';

interface TalkingPoint {
  hook: string;
  angle: string;
  opener: string;
  intel_id: string;
  intel_title: string;
  caution: string;
}
interface AmmoResponse {
  has_relevant: boolean;
  overall: string;
  talking_points: TalkingPoint[];
}

export function DealAmmoSection({ dealId, isFixtures }: { dealId: string; isFixtures: boolean }) {
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<AmmoResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    if (busy) return;
    if (isFixtures) { setErr('fixtures 模式無法跑 AI'); return; }
    setBusy(true); setErr(null); setData(null);
    try {
      const res = await fetch('/api/ai/client-talking-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      });
      const raw = await res.text();
      let json: { data?: AmmoResponse; error?: string };
      try { json = JSON.parse(raw); } catch { throw new Error(`回應格式錯誤(HTTP ${res.status})`); }
      if (!res.ok) throw new Error(json.error || '生成失敗');
      if (!json.data) throw new Error('AI 沒有回傳資料');
      setData(json.data);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="grid gap-3">
      <div className="flex items-baseline justify-between">
        <div className="label-caps text-ink/55 inline-flex items-center gap-1.5">
          <Briefcase className="h-3 w-3" strokeWidth={2} /> 客戶彈藥庫
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
            data ? 'border border-ink/15 bg-paper text-ink/75 hover:border-ink/30' : 'bg-ink text-paper hover:bg-graphite',
            'disabled:cursor-not-allowed disabled:opacity-60',
          )}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Wand2 className="h-3.5 w-3.5" strokeWidth={2} />}
          {busy ? '配對中…' : data ? '重新配對' : '配對市場情報'}
        </button>
      </div>

      {err && <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{err}</div>}

      {data && (
        <div className="grid gap-3">
          {/* 整體判斷 */}
          <article className="grid gap-1.5 rounded-md border border-ink/10 bg-paper p-4">
            <div className="label-caps text-cobalt inline-flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" strokeWidth={2} /> AI 整體判斷
            </div>
            <p className="text-sm leading-6 text-ink/85">{data.overall}</p>
          </article>

          {/* 沒抓到相關情報 */}
          {!data.has_relevant && data.talking_points.length === 0 && (
            <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-10 text-center text-xs text-ink/55">
              近期市場情報跟這位客戶比較沒有直接相關。建議去 /market 補充情報後再試。
            </div>
          )}

          {/* Talking points */}
          {data.talking_points.length > 0 && (
            <ol className="grid gap-2">
              {data.talking_points.map((tp, idx) => (
                <TalkingPointCard key={tp.intel_id + idx} tp={tp} idx={idx} dealId={dealId} isFixtures={isFixtures} />
              ))}
            </ol>
          )}
        </div>
      )}

      {!data && !busy && !err && (
        <div className="grid place-items-center gap-2 rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-8 text-center">
          <Briefcase className="h-5 w-5 text-ink/30" strokeWidth={1.5} />
          <div className="text-xs text-ink/55">
            按上方「配對市場情報」 → AI 從近期 market_intel 找出跟這位客戶相關的 2–5 條
          </div>
        </div>
      )}
    </section>
  );
}

// ============================================================
// 單一 talking_point 卡 — 含「採納關聯」按鈕(對應原 ClientAmmoCard 功能)
// ============================================================
function TalkingPointCard({
  tp, idx, dealId, isFixtures,
}: {
  tp: TalkingPoint;
  idx: number;
  dealId: string;
  isFixtures: boolean;
}) {
  const [linkState, setLinkState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [linkErr, setLinkErr] = useState<string | null>(null);

  async function accept() {
    if (isFixtures || linkState === 'busy' || linkState === 'done') return;
    setLinkState('busy'); setLinkErr(null);
    try {
      const { linkIntelToDeal } = await import('@/lib/v4/mutations');
      // reason 帶 AI hook + angle 簡述,review 時看得到關聯理由
      await linkIntelToDeal(tp.intel_id, dealId, `${tp.hook} — ${tp.angle}`.slice(0, 280));
      setLinkState('done');
    } catch (e) {
      setLinkErr((e as Error).message);
      setLinkState('error');
    }
  }

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-md border border-ink/10 bg-paper p-4">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-cobalt/10 font-v4-serif text-base font-semibold text-cobalt numeric">{idx + 1}</div>
      <div className="grid gap-2 min-w-0">
        <div className="grid gap-0.5">
          <div className="text-sm font-semibold text-ink">{tp.hook}</div>
          <div className="font-v4-mono text-[11px] text-ink/55">{tp.angle}</div>
        </div>
        <div className="rounded-sm border border-forest/20 bg-forest/5 px-3 py-2">
          <div className="label-caps mb-1 text-forest/80">開場話術(可直接複製)</div>
          <pre className="whitespace-pre-wrap font-v4-sans text-sm leading-6 text-ink/85">{tp.opener}</pre>
        </div>
        {tp.caution && (
          <div className="grid grid-cols-[auto_1fr] items-start gap-1.5 rounded-sm border border-claret/20 bg-claret/5 px-2.5 py-1.5">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-claret" strokeWidth={2} />
            <span className="text-xs leading-5 text-claret">{tp.caution}</span>
          </div>
        )}
        <div className="font-v4-mono text-[10.5px] text-ink/45">
          來源:{tp.intel_title}
        </div>
        {linkErr && <div className="text-[11px] text-claret">{linkErr}</div>}
      </div>
      <button
        type="button"
        onClick={accept}
        disabled={isFixtures || linkState === 'busy' || linkState === 'done'}
        title={linkState === 'done' ? '已關聯到本案件' : '把這篇 intel 正式關聯到本案件(寫入 intel_deal_links)'}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold transition shrink-0',
          linkState === 'done'
            ? 'border-forest bg-forest text-paper cursor-default'
            : linkState === 'error'
              ? 'border-claret/40 bg-claret/5 text-claret'
              : 'border-forest/40 bg-forest/8 text-forest hover:bg-forest/15',
          isFixtures && 'cursor-not-allowed opacity-50',
        )}
      >
        {linkState === 'busy' ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
          : linkState === 'done' ? <Check className="h-3 w-3" strokeWidth={2.5} />
          : <Sparkles className="h-3 w-3" strokeWidth={2} />}
        {linkState === 'done' ? '已採納' : linkState === 'error' ? '再試' : '採納關聯'}
      </button>
    </li>
  );
}
