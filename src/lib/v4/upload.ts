// ============================================================
// V4 附檔上傳 helper — DealAIPanel / AIChatView 共用
// ============================================================
// 完全照搬 ws_crm 既有 Dashboard.tsx 的 uploadAttachment / deleteAttachment
// 邏輯(storage bucket = deal-attachments,DB 表 = deal_attachments),
// 只把它從 Dashboard 內 closure 抽出來變獨立可重用。
//
// RLS:deal_attachments 的 insert policy 限定 deal_id 必須是 can_access_deal
// (rm 自己 / team_lead 同隊 / admin 全部)。Storage 的 access 由 bucket
// policy 控管(deal-attachments 預設只准 authenticated 讀寫該 deal 路徑)。
// ============================================================
'use client';
import { createClient } from '@/lib/supabase/client';

export interface UploadedAttachment {
  id: string;
  deal_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  created_at: string;
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB,跟既有 AIChatModal 一致

export async function uploadDealAttachment(dealId: string, file: File): Promise<UploadedAttachment> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`「${file.name}」超過 50 MB`);
  }
  const supabase = createClient();
  const ext = file.name.split('.').pop() ?? 'bin';
  const storagePath = `${dealId}/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from('deal-attachments')
    .upload(storagePath, file, { contentType: file.type });
  if (upErr) throw upErr;

  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('deal_attachments')
    .insert({
      deal_id: dealId,
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single();
  if (error) {
    // 上傳成功但 DB insert 失敗 → 回滾 storage,避免孤兒檔
    await supabase.storage.from('deal-attachments').remove([storagePath]).catch(() => undefined);
    throw error;
  }
  return data as UploadedAttachment;
}

export async function removeDealAttachment(att: Pick<UploadedAttachment, 'id' | 'storage_path'>): Promise<void> {
  const supabase = createClient();
  // 先刪 DB(被 RLS 擋會在這裡就出錯),再刪 storage
  const { error } = await supabase.from('deal_attachments').delete().eq('id', att.id);
  if (error) throw error;
  await supabase.storage.from('deal-attachments').remove([att.storage_path]).catch(() => undefined);
}

export function attachmentIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.startsWith('audio/')) return '🎙';
  if (mimeType.startsWith('video/')) return '🎬';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return '📊';
  if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
  return '📎';
}
