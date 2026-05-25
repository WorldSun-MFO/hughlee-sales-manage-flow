'use client';

// 案件刪除 — 故意做小、放底部,避免誤點。
// fixtures 模式不顯示(沒 supabase,刪了也是假的)。
//
// 復原機制:
//   - audit_log trigger 自動記錄全表變動(見 docs/SECURITY.md 第 4.4)
//   - admin 誤刪兩行 SQL 即可還原(見 docs/RECOVERY.md)
//   - confirm 對話框會提醒這件事,讓 RM 不會以為「無法復原」就放棄
//
// 快取修正:
//   - 刪除後 router.refresh() 強制清空 client-side route cache
//     (next.config.mjs 的 staleTimes.dynamic=30s 會讓 /clients 列表還在
//      cache 中,不 refresh 的話跳回去看到舊資料,要 F5 才刷掉)
//   - 然後 router.push 才會去到「無此案件」的新版列表
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { deleteDeal } from '@/lib/v4/mutations';

export function DeleteDealButton({
  dealId,
  dealName,
  base,
  isFixtures,
}: {
  dealId: string;
  dealName: string;
  base: '/workspace' | '/hub';
  isFixtures: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (isFixtures) return null;

  async function onClick() {
    if (busy) return;
    const ok = window.confirm(
      `刪除「${dealName}」?\n\n` +
      `案件會立即從清單消失,但資料庫保留 audit log。\n` +
      `誤刪可請 admin 照 docs/RECOVERY.md 兩行 SQL 復原。`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await deleteDeal(dealId);
      // 1) 先 refresh 把 /clients 列表的 route cache 弄髒(否則 staleTimes 會給快取的舊頁)
      router.refresh();
      // 2) 再導去 /clients,這次拿到的是不含此 deal 的新版
      router.push(`${base}/clients`);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-ink/10 pt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs text-claret hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
        ) : (
          <Trash2 className="h-3 w-3" strokeWidth={1.75} />
        )}
        {busy ? '刪除中…' : '刪除此案件'}
      </button>
      <span className="font-v4-mono text-[10.5px] text-ink/45">
        誤刪可 admin 兩行 SQL 復原(audit_log 已記錄)
      </span>
    </div>
  );
}
