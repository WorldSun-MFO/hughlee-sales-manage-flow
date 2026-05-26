import { Paperclip } from 'lucide-react';
import { getDealAttachments } from '@/lib/v4/data';
import { AttachmentChip } from '@/components/v4/AttachmentTray';

export async function AttachmentsSection({ dealId }: { dealId: string }) {
  const attachments = await getDealAttachments(dealId);
  if (attachments.length === 0) return null;
  return (
    <section className="grid gap-3">
      <div className="label-caps text-ink/55 inline-flex items-center gap-2">
        <Paperclip className="h-3 w-3" strokeWidth={2} />
        附檔 · {attachments.length}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {attachments.map((a) => (<AttachmentChip key={a.id} att={a} />))}
      </ul>
      <div className="font-v4-mono text-[10.5px] text-ink/45">點檔名下載 / 預覽(signed URL,1 小時有效)</div>
    </section>
  );
}
