// 已收款 / 未收款 小徽章(唯讀顯示)。打勾操作在 admin 的「成交日確認」頁。
// 客戶詳情頁只在「有設目標成交日」時才顯示(由呼叫端判斷後再 render)。
import { Check, Clock } from 'lucide-react';

export function PaymentBadge({ received }: { received: boolean }) {
  return received ? (
    <span className="inline-flex items-center gap-1 rounded-sm border border-forest/30 bg-forest/10 px-1.5 py-0.5 font-v4-mono text-[11px] font-semibold text-forest">
      <Check className="h-3 w-3" strokeWidth={2.5} /> 已收款
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-sm border border-brass/30 bg-brass/10 px-1.5 py-0.5 font-v4-mono text-[11px] font-semibold text-brass">
      <Clock className="h-3 w-3" strokeWidth={2} /> 未收款
    </span>
  );
}
