'use client';

// ============================================================
// 成交日確認 view(admin 限定)
// ============================================================
// 把有設定「目標成交日(target_close_date)」的客戶集中,依日期由近到遠排列。
// 每列由左到右:tier / 客戶名稱 / 業務名 / 產品名 / AUM / 目標成交日 / 已收款,
// 點整列(除「已收款」打勾外)超連結到該客戶詳情頁。
//
// 已收款打勾後:該列移到清單最下方、移除「已過 N 天」倒數、日期變回一般字體。
// 未收款的依日期由近到遠(逾期者最前,逾期/7 天內以顏色標示)。
//
// 日期以 Asia/Taipei 計算(伺服器 UTC,避免清晨差一天 + 不會 hydration mismatch)。
// ============================================================
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarCheck, Check } from 'lucide-react';
import type { LightDeal } from '@/lib/v4/data';
import { fmtMoney, TIER_STYLES } from '@/lib/v4/utils';
import { setPaymentReceived } from '@/lib/v4/mutations';
import { RealtimeRefresher } from '@/components/v4/RealtimeRefresher';

const WD = ['日', '一', '二', '三', '四', '五', '六'];
const GRID = 'sm:grid-cols-[52px_minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,1fr)_64px]';

// 'YYYY-MM-DD' → M/D(週X)(預計收款日只顯示日期,不做倒數)
function fmtDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(週${WD[d.getUTCDay()]})`;
}

function closeDateInfo(due: string, todayMs: number): { label: string; countdown: string; tone: 'overdue' | 'soon' | 'normal' } {
  const d = new Date(`${due}T00:00:00Z`);
  const diff = Math.round((d.getTime() - todayMs) / 86_400_000);
  const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(週${WD[d.getUTCDay()]})`;
  let countdown: string;
  if (diff < 0) countdown = `已過 ${Math.abs(diff)} 天`;
  else if (diff === 0) countdown = '今天';
  else if (diff === 1) countdown = '明天';
  else countdown = `${diff} 天後`;
  const tone = diff < 0 ? 'overdue' : diff <= 7 ? 'soon' : 'normal';
  return { label, countdown, tone };
}

export function CloseDateView({ deals, base }: { deals: LightDeal[]; base: '/workspace' | '/hub' }) {
  // 本地 override：使用者打勾後立刻反映,不被 realtime 重抓蓋掉;沒 override 的看 DB 值
  const [paidOverride, setPaidOverride] = useState<Record<string, boolean>>({});
  const isPaid = (d: LightDeal) => paidOverride[d.id] ?? !!d.payment_received;

  function togglePaid(d: LightDeal, next: boolean) {
    setPaidOverride((m) => ({ ...m, [d.id]: next }));
    setPaymentReceived(d.id, next).catch(() => {
      setPaidOverride((m) => ({ ...m, [d.id]: !next })); // 失敗回滾
    });
  }

  const rows = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' });
    const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
    return deals
      .filter((d) => d.target_close_date)
      .map((d) => ({ deal: d, info: closeDateInfo(d.target_close_date!, todayMs), paid: isPaid(d) }))
      .sort((a, b) => {
        if (a.paid !== b.paid) return a.paid ? 1 : -1; // 已收款排最後
        // 同一組內:'YYYY-MM-DD' 字典序 = 時間序,由近到遠
        return a.deal.target_close_date! < b.deal.target_close_date! ? -1
          : a.deal.target_close_date! > b.deal.target_close_date! ? 1 : 0;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals, paidOverride]);

  return (
    <div className="grid gap-8 px-4 py-6 sm:px-8 sm:py-10 lg:px-14 lg:py-14">
      <RealtimeRefresher isFixtures={false} tables={['deals']} />

      <header className="grid gap-2">
        <div className="label-caps inline-flex items-center gap-1.5 text-ink/45">
          <CalendarCheck className="h-3.5 w-3.5" strokeWidth={2} /> Close Dates
        </div>
        <h1 className="font-v4-serif text-[32px] font-medium leading-[1.05] tracking-tight text-ink sm:text-[44px] lg:text-[56px]">
          成交日確認
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-ink/65 sm:text-base sm:leading-7">
          已設定「目標成交日」的客戶,依日期由近到遠排列{rows.length > 0 ? ` · 共 ${rows.length} 位` : ''}
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-ink/15 bg-paper/60 px-6 py-16 text-center text-sm text-ink/45">
          目前沒有客戶設定目標成交日。到客戶詳情頁的「下一步」區塊設定後即會出現在這裡。
        </div>
      ) : (
        <section className="grid gap-2">
          {/* 欄位標題(桌機) */}
          <div className={`hidden items-center gap-3 px-4 sm:grid ${GRID}`}>
            <span className="label-caps text-ink/40">Tier</span>
            <span className="label-caps text-ink/40">客戶</span>
            <span className="label-caps text-ink/40">業務</span>
            <span className="label-caps text-ink/40">產品</span>
            <span className="label-caps text-ink/40">AUM</span>
            <span className="label-caps text-ink/40">目標成交日</span>
            <span className="label-caps text-ink/40">預計收款日</span>
            <span className="label-caps text-center text-ink/40">已收款</span>
          </div>

          <ul className="grid gap-2">
            {rows.map(({ deal: d, info, paid }) => {
              // 已收款:一律一般樣式、不顯示倒數;未收款才套逾期/即將顏色
              const accent = paid ? 'border-l-ink/15 bg-paper'
                : info.tone === 'overdue' ? 'border-l-claret bg-claret/4'
                  : info.tone === 'soon' ? 'border-l-brass bg-brass/4'
                    : 'border-l-ink/20 bg-paper';
              const dateTone = paid ? 'text-ink/65'
                : info.tone === 'overdue' ? 'text-claret'
                  : info.tone === 'soon' ? 'text-brass' : 'text-ink/65';
              return (
                <li key={d.id}>
                  {/* stretched-link:整列可點(連結),只有「已收款」打勾不觸發導頁 */}
                  <div className={`relative grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 rounded-md border border-ink/10 border-l-4 p-4 transition hover:border-ink/30 hover:shadow-panel ${GRID} ${accent}`}>
                    <Link
                      href={`${base}/clients/${d.id}` as never}
                      aria-label={`${d.name.replace(/^【範例】/, '')} 詳情`}
                      className="absolute inset-0 z-0 rounded-md"
                    />

                    {/* tier */}
                    <span className={`pointer-events-none relative z-10 grid h-7 w-9 place-items-center rounded-sm font-v4-mono text-[11px] font-bold ${d.tier ? TIER_STYLES[d.tier] : 'bg-ink/10 text-ink/45'}`}>
                      {d.tier ?? '—'}
                    </span>

                    {/* 客戶名稱(+ 手機補充列:業務 · 產品 · AUM) */}
                    <div className="pointer-events-none relative z-10 min-w-0">
                      <div className="truncate font-v4-serif text-base font-semibold text-ink">
                        {d.name.replace(/^【範例】/, '')}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-v4-mono text-[11px] text-ink/55 sm:hidden">
                        <span>{d.rm?.full_name ?? '—'}</span>
                        <span className="text-ink/25">·</span>
                        <span className="truncate">{d.product ?? '—'}</span>
                        <span className="text-ink/25">·</span>
                        <span className="numeric">{fmtMoney(Number(d.aum_usd))}</span>
                        <span className="text-ink/25">·</span>
                        <span className="numeric">收款 {d.expected_payment_date ? fmtDate(d.expected_payment_date) : '未定'}</span>
                      </div>
                    </div>

                    {/* 業務名(桌機) */}
                    <div className="pointer-events-none relative z-10 hidden min-w-0 truncate text-sm text-ink/75 sm:block">{d.rm?.full_name ?? '—'}</div>
                    {/* 產品名(桌機) */}
                    <div className="pointer-events-none relative z-10 hidden min-w-0 truncate text-sm text-ink/75 sm:block">{d.product ?? '—'}</div>
                    {/* AUM(桌機) */}
                    <div className="numeric pointer-events-none relative z-10 hidden font-v4-mono text-sm font-semibold text-ink sm:block">{fmtMoney(Number(d.aum_usd))}</div>

                    {/* 目標成交日 */}
                    <div className="pointer-events-none relative z-10 min-w-0">
                      <div className={`numeric font-v4-mono text-sm font-semibold ${dateTone}`}>{info.label}</div>
                      {!paid && <div className={`font-v4-mono text-[11px] ${dateTone}`}>{info.countdown}</div>}
                    </div>

                    {/* 預計收款日(桌機) */}
                    <div className="numeric pointer-events-none relative z-10 hidden font-v4-mono text-sm text-ink/65 sm:block">
                      {d.expected_payment_date ? fmtDate(d.expected_payment_date) : <span className="text-ink/35">未定</span>}
                    </div>

                    {/* 已收款打勾 */}
                    <div className="relative z-10 flex items-center justify-end gap-1.5 sm:justify-center">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={paid}
                        aria-label="已收款"
                        title={paid ? '已收款(點一下取消)' : '標記為已收款'}
                        onClick={() => togglePaid(d, !paid)}
                        className={`grid h-6 w-6 place-items-center rounded-sm border transition ${
                          paid ? 'border-forest bg-forest text-paper' : 'border-ink/30 bg-paper hover:border-forest/60'
                        }`}
                      >
                        {paid && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </button>
                      <ArrowUpRight className="pointer-events-none h-4 w-4 shrink-0 text-ink/25 sm:hidden" strokeWidth={1.75} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
