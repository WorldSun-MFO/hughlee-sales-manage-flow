'use client';

// ============================================================
// 附檔上傳元件 — DealAIPanel / AIChatView 共用
// ============================================================
// 提供「加上檔案或圖片」按鈕 + 已上傳檔案列(可刪除)。
// 上傳真的會打 Supabase Storage(bucket=deal-attachments),
// 不是 staging — 一上傳就進 deal_attachments,客戶詳情頁立刻看得到。
// ============================================================
import { useState } from 'react';
import { Paperclip, Loader2, X, Download } from 'lucide-react';
import { attachmentIcon, getAttachmentSignedUrl, removeDealAttachment, uploadDealAttachment, type UploadedAttachment } from '@/lib/v4/upload';
import { cn } from '@/lib/v4/utils';

export function AttachmentTray({
  dealId,
  isFixtures,
  attachments,
  onChange,
}: {
  dealId: string;
  isFixtures: boolean;
  attachments: UploadedAttachment[];
  onChange: (next: UploadedAttachment[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (isFixtures) {
      setError('目前是 fixtures 模式(未接 Supabase),無法上傳檔案');
      return;
    }
    setBusy(true);
    setError(null);
    const next: UploadedAttachment[] = [...attachments];
    for (const f of Array.from(files)) {
      try {
        const att = await uploadDealAttachment(dealId, f);
        next.push(att);
      } catch (err) {
        setError(`「${f.name}」上傳失敗:${(err as Error).message}`);
      }
    }
    onChange(next);
    setBusy(false);
  }

  async function handleRemove(att: UploadedAttachment) {
    if (isFixtures) return;
    try {
      await removeDealAttachment(att);
      onChange(attachments.filter((a) => a.id !== att.id));
    } catch (err) {
      setError(`刪除失敗:${(err as Error).message}`);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className={cn(
          'inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-ink/15 bg-cream/50 px-3 py-1.5 text-xs font-semibold text-ink/75 transition hover:border-ink/30 hover:text-ink',
          busy && 'pointer-events-none opacity-60',
        )}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} /> : <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />}
          {busy ? '上傳中…' : '加上檔案或圖片'}
          <input
            type="file"
            multiple
            disabled={busy}
            onChange={(e) => { handleFiles(e.target.files); e.currentTarget.value = ''; }}
            className="hidden"
          />
        </label>
        <span className="font-v4-mono text-[10.5px] text-ink/45">每檔 ≤ 50 MB · 圖片/PDF/語音/合約皆可</span>
      </div>

      {attachments.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <AttachmentChip key={a.id} att={a} onRemove={() => handleRemove(a)} />
          ))}
        </ul>
      )}

      {error && (
        <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">{error}</div>
      )}
    </div>
  );
}

// ============================================================
// 附檔 chip — 點檔名下載 / 預覽,X 移除
// ============================================================
export function AttachmentChip({
  att, onRemove,
}: {
  att: UploadedAttachment;
  onRemove?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const url = await getAttachmentSignedUrl(att.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      alert(`無法開啟:${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="group inline-flex items-center gap-1.5 rounded-md border border-forest/25 bg-forest/8 px-2 py-1 text-xs text-forest">
      <span aria-hidden>{attachmentIcon(att.mime_type)}</span>
      <button
        type="button"
        onClick={open}
        disabled={busy}
        title="點開或下載"
        className="inline-flex items-center gap-1 max-w-[200px] truncate font-semibold hover:underline disabled:cursor-wait"
      >
        <span className="truncate">{att.file_name}</span>
        {busy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} /> : <Download className="h-3 w-3 opacity-60" strokeWidth={2} />}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="grid h-4 w-4 place-items-center rounded-sm text-forest/55 transition hover:bg-forest/15 hover:text-forest"
          aria-label={`移除 ${att.file_name}`}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
    </li>
  );
}
