'use client';

// 已收款 / 未收款 可切換徽章(客戶詳情頁用)。點一下切換,樂觀更新、失敗回滾。
// 由呼叫端判斷「有設目標成交日」時才 render。RLS:deals_update(rm 本人或 manager)。
import { useEffect, useState } from 'react';
import { Check, Clock, Loader2 } from 'lucide-react';
import { setPaymentReceived } from '@/lib/v4/mutations';

export function PaymentToggle({ dealId, received, isFixtures }: { dealId: string; received: boolean; isFixtures: boolean }) {
  const [paid, setPaid] = useState(received);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setPaid(received); }, [received]);

  async function toggle() {
    if (isFixtures || busy) return;
    const next = !paid;
    setPaid(next);
    setBusy(true);
    try { await setPaymentReceived(dealId, next); }
    catch { setPaid(!next); }
    finally { setBusy(false); }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={paid}
      onClick={toggle}
      disabled={isFixtures || busy}
      title={paid ? '已收款(點一下改未收款)' : '未收款(點一下改已收款)'}
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 font-v4-mono text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        paid
          ? 'border-forest/30 bg-forest/10 text-forest hover:bg-forest/20'
          : 'border-brass/30 bg-brass/10 text-brass hover:bg-brass/20'
      }`}
    >
      {busy
        ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        : paid ? <Check className="h-3 w-3" strokeWidth={2.5} /> : <Clock className="h-3 w-3" strokeWidth={2} />}
      {paid ? '已收款' : '未收款'}
    </button>
  );
}
