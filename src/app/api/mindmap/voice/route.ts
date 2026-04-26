import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;          // Whisper 通常數秒,給 60s 緩衝

/** POST /api/mindmap/voice
 * 接收 multipart/form-data,欄位 `audio`(音檔 blob)。
 * 轉發到 OpenAI Whisper,回傳 { text }。
 *
 * 用 fetch 直接打 OpenAI API,不用裝 openai SDK(省依賴)。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '未登入' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY 未設定。請到 Vercel → Settings → Environment Variables 加上。' },
      { status: 500 }
    );
  }

  // 收 multipart
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: '無法讀取上傳的音檔' }, { status: 400 });
  }
  const audio = form.get('audio');
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: '缺少 audio 欄位或格式不正確' }, { status: 400 });
  }

  // 組 OpenAI Whisper 請求
  const upstream = new FormData();
  // OpenAI 需要明確的副檔名,給 webm(MediaRecorder 預設)
  const filename = (audio as File).name || 'voice.webm';
  upstream.append('file', audio, filename);
  upstream.append('model', 'whisper-1');
  upstream.append('language', 'zh');
  upstream.append('response_format', 'json');

  try {
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[mindmap/voice] OpenAI error', res.status, errText);
      return NextResponse.json({ error: `Whisper 失敗 (${res.status}): ${errText.slice(0, 200)}` }, { status: 502 });
    }

    const json = (await res.json()) as { text?: string };
    return NextResponse.json({ text: json.text ?? '' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mindmap/voice] fetch failed', message);
    return NextResponse.json({ error: '語音服務暫時無法使用:' + message }, { status: 502 });
  }
}
