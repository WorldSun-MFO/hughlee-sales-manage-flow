'use client';

import { useState } from 'react';
import { ArrowUp, Bot, Lightbulb, MessageSquare, Sparkles } from 'lucide-react';
import type { Snapshot } from '@/lib/v4/types';
import { cn } from '@/lib/v4/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts: string;
}

const SUGGESTED_PROMPTS = [
  { icon: Lightbulb, text: '幫我整理今天最該打給誰的優先順序與理由' },
  { icon: MessageSquare, text: '幫我寫一封追蹤信給「陳董」,語氣專業但有溫度' },
  { icon: Sparkles, text: '分析 d-01 案件目前最大的卡關點與下一步' },
  { icon: Bot, text: '這位客戶適合用 FCN + 保費融資嗎?幫我列利弊' },
];

export function AIChatView({ snapshot, base = '/v4/workspace' }: { snapshot: Snapshot; base?: string }) {
  void snapshot;
  void base;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: trimmed, ts: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    // Phase 1 走假回應;Phase 2 接 /api/ai/parse-interaction 或 /api/ai/generate-plan
    setTimeout(() => {
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '【示範回應】等 Phase 2 接上 Anthropic API 即可給真正的回覆。\n\n目前先驗證版型對話氣泡 / 輸入框 / 建議卡的整體質感是否到位。',
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
      setBusy(false);
    }, 500);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-[920px] grid-rows-[auto_1fr_auto] px-6 pb-8 pt-12 lg:px-10">
      <header className="grid gap-2 pb-8">
        <div className="label-caps text-ink/45">AI 助手</div>
        <h1 className="font-v4-serif text-[44px] font-medium leading-[0.95] tracking-tight text-ink lg:text-[56px]">
          問什麼<span className="italic text-forest">?</span>
        </h1>
        <p className="mt-1 text-sm leading-6 text-ink/65">
          根據你的 pipeline、客戶分數、互動歷史,給你具體可執行的下一步。
        </p>
      </header>

      <section className="grid content-start gap-4">
        {messages.length === 0 ? (
          <div className="grid gap-3 rounded-md border border-ink/10 bg-paper p-6">
            <div className="label-caps text-ink/50">建議起手式</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTED_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => send(p.text)}
                  className="group flex items-start gap-2.5 rounded-md border border-ink/8 bg-cream/60 px-3.5 py-3 text-left text-[13px] leading-5 text-ink/80 transition hover:border-ink/25 hover:bg-paper"
                >
                  <p.icon className="mt-0.5 h-4 w-4 shrink-0 text-forest/70 transition group-hover:text-forest" strokeWidth={1.75} />
                  {p.text}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="grid gap-3">
            {messages.map((m) => (
              <li key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[78%] rounded-md px-4 py-3 text-[14px] leading-6 whitespace-pre-wrap',
                    m.role === 'user'
                      ? 'bg-ink text-paper'
                      : 'border border-ink/10 bg-paper text-ink/90',
                  )}
                >
                  {m.role === 'assistant' && (
                    <div className="mb-1.5 flex items-center gap-1.5 font-v4-mono text-[10px] font-semibold uppercase tracking-widest text-forest/80">
                      <Sparkles className="h-3 w-3" strokeWidth={2} /> Assistant
                    </div>
                  )}
                  {m.content}
                </div>
              </li>
            ))}
            {busy && (
              <li className="flex justify-start">
                <div className="rounded-md border border-ink/10 bg-paper px-4 py-3 text-sm text-ink/55">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink/40 [animation-delay:240ms]" />
                  </span>
                </div>
              </li>
            )}
          </ol>
        )}
      </section>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="sticky bottom-4 mt-8 grid grid-cols-[1fr_auto] gap-2 rounded-md border border-ink/12 bg-paper p-2 shadow-panel"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="輸入問題,Enter 送出"
          className="bg-transparent px-3 text-[14px] text-ink placeholder:text-ink/40 focus:outline-none"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid h-9 w-9 place-items-center rounded-md bg-ink text-paper transition hover:bg-graphite disabled:bg-ink/25 disabled:cursor-not-allowed"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
