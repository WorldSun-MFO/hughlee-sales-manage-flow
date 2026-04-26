'use client';

import { useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

interface Props {
  /** 轉文字成功後的 callback,把文字交給上層處理。 */
  onTranscribed: (text: string) => void;
  /** 額外 className(調整大小、顏色) */
  className?: string;
}

type State = 'idle' | 'recording' | 'transcribing';

export function VoiceRecorder({ onTranscribed, className }: Props) {
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = handleStop;
      mr.start();
      mediaRecorderRef.current = mr;
      setState('recording');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('無法開啟麥克風:' + msg);
    }
  }

  function stop() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  async function handleStop() {
    setState('transcribing');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const fd = new FormData();
    fd.append('audio', blob, 'voice.webm');
    try {
      const res = await fetch('/api/mindmap/voice', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '轉文字失敗');
      onTranscribed(json.text ?? '');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setState('idle');
    }
  }

  return (
    <div className={cn('flex flex-col items-stretch gap-2', className)}>
      {state === 'idle' && (
        <Button type="button" variant="primary" size="lg" onClick={start} className="w-full">
          <Mic className="h-5 w-5" />
          按住說話(放開送出)
        </Button>
      )}
      {state === 'recording' && (
        <Button type="button" variant="danger" size="lg" onClick={stop} className="w-full animate-pulse">
          <Square className="h-5 w-5" />
          錄音中…點此停止
        </Button>
      )}
      {state === 'transcribing' && (
        <Button type="button" variant="secondary" size="lg" disabled className="w-full">
          <Loader2 className="h-5 w-5 animate-spin" />
          轉文字中…
        </Button>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
