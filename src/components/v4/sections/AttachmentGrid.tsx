'use client';

// ============================================================
// 客戶附檔縮圖牆 — 顯示用(read-only)
// ============================================================
// 接 server 預載好的圖片 signed URLs,非圖片點開時才產 signed URL。
// 沒有刪除按鈕(管理一律從 DealAIPanel 的 AttachmentTray 操作)。
// ============================================================
import { useState } from 'react';
import { FileText, Music, Video, Paperclip, Loader2 } from 'lucide-react';
import type { DealAttachment } from '@/lib/v4/types';
import { getAttachmentSignedUrl } from '@/lib/v4/upload';
import { cn } from '@/lib/v4/utils';

const fmtSize = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;

function FileTypeIcon({ mimeType }: { mimeType: string }) {
  const cls = 'h-7 w-7 text-ink/45';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word') || mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) {
    return <FileText className={cls} strokeWidth={1.5} />;
  }
  if (mimeType.startsWith('audio/')) return <Music className={cls} strokeWidth={1.5} />;
  if (mimeType.startsWith('video/')) return <Video className={cls} strokeWidth={1.5} />;
  return <Paperclip className={cls} strokeWidth={1.5} />;
}

export function AttachmentGrid({
  attachments,
  imageUrls,
}: {
  attachments: DealAttachment[];
  imageUrls: Record<string, string>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function openFile(att: DealAttachment) {
    // 圖片已有預載 URL,直接開
    const preloaded = imageUrls[att.id];
    if (preloaded) {
      window.open(preloaded, '_blank', 'noopener,noreferrer');
      return;
    }
    if (busyId) return;
    setBusyId(att.id);
    setErr(null);
    try {
      const url = await getAttachmentSignedUrl(att.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setErr(`無法開啟「${att.file_name}」:${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {attachments.map((a) => {
          const isImage = a.mime_type.startsWith('image/');
          const url = imageUrls[a.id];
          const busy = busyId === a.id;
          return (
            <li
              key={a.id}
              className="rounded-md border border-ink/10 bg-paper p-2 transition hover:border-ink/25"
            >
              <button
                type="button"
                onClick={() => openFile(a)}
                disabled={busy}
                className="block w-full text-left disabled:cursor-wait"
                title={a.file_name}
              >
                {isImage && url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url}
                    alt={a.file_name}
                    className="w-full h-24 object-cover rounded"
                  />
                ) : (
                  <div className={cn(
                    'w-full h-24 flex items-center justify-center rounded bg-cream/40',
                  )}>
                    {busy ? (
                      <Loader2 className="h-6 w-6 animate-spin text-ink/45" strokeWidth={1.5} />
                    ) : (
                      <FileTypeIcon mimeType={a.mime_type} />
                    )}
                  </div>
                )}
                <div className="mt-1.5 truncate text-[11px] text-ink" title={a.file_name}>
                  {a.file_name}
                </div>
                <div className="flex items-center justify-between font-v4-mono text-[10px] text-ink/45 numeric">
                  <span>{fmtSize(a.size_bytes)}</span>
                  <span>{a.created_at.slice(5, 10)}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {err && (
        <div className="rounded-md border border-claret/30 bg-claret/5 px-3 py-2 text-xs text-claret">
          {err}
        </div>
      )}
    </>
  );
}
