'use client';
import { useState } from 'react';
import type { Deal, ParseInteractionSuggestion, Scores, StageId } from '@/lib/types';
import { MEDDIC } from '@/lib/constants';

interface Props {
  deal: Deal;
  onClose: () => void;
  onSaveRawText: (rawText: string) => Promise<void>;     // 保留原始未修改文字
  onApply: (patch: {
    scores?: Partial<Scores>;
    next_step?: string | null;
    comment?: string;
    questions_to_check?: string[];
    stage?: StageId;
  }) => Promise<void>;
}

export function AIChatModal({ deal, onClose, onSaveRawText, onApply }: Props) {
  const [userText, setUserText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<ParseInteractionSuggestion | null>(null);
  const [selected, setSelected] = useState<{
    scoreIdx: Record<number, boolean>;
    comment: boolean;
    nextStep: boolean;
    questions: Record<string, boolean>;
    stage: boolean;
  }>({ scoreIdx: {}, comment: true, nextStep: true, questions: {}, stage: true });
  const [applying, setApplying] = useState(false);

  async function analyze() {
    if (!userText.trim()) { setError('請先描述這次跟客戶的互動'); return; }
    setError(null);
    setLoading(true);
    setSuggestion(null);
    try {
      // ⓵ 先把原始文字存進註解時間軸(標記 is_raw),保留客戶真實對話
      await onSaveRawText(userText.trim());

      // ⓶ 呼叫 AI 解析
      const res = await fetch('/api/ai/parse-interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, userText: userText.trim() }),
      });
      const raw = await res.text();
      let json: { data?: ParseInteractionSuggestion; error?: string };
      try { json = JSON.parse(raw); } catch { throw new Error(`回應格式錯誤(HTTP ${res.status})`); }
      if (!res.ok) throw new Error(json.error || '解析失敗');
      const data = json.data as ParseInteractionSuggestion;
      setSuggestion(data);
      const scoreIdx: Record<number, boolean> = {};
      data.score_updates.forEach((_, i) => { scoreIdx[i] = true; });
      const qs: Record<string, boolean> = {};
      data.question_checkoffs.forEach(k => { qs[k] = true; });
      setSelected({
        scoreIdx,
        comment: !!data.new_comment,
        nextStep: !!data.next_step_update,
        questions: qs,
        stage: !!data.stage_suggestion,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // === 編輯 AI 建議的 helper ===
  function updateScoreNew(i: number, newVal: number) {
    if (!suggestion) return;
    const updates = [...suggestion.score_updates];
    updates[i] = { ...updates[i], new: Math.max(0, Math.min(10, newVal)) };
    setSuggestion({ ...suggestion, score_updates: updates });
  }
  function updateScoreReason(i: number, reason: string) {
    if (!suggestion) return;
    const updates = [...suggestion.score_updates];
    updates[i] = { ...updates[i], reason };
    setSuggestion({ ...suggestion, score_updates: updates });
  }
  function updateComment(v: string) {
    if (!suggestion) return;
    setSuggestion({ ...suggestion, new_comment: v });
  }
  function updateNextStep(v: string) {
    if (!suggestion) return;
    setSuggestion({ ...suggestion, next_step_update: v || null });
  }

  async function applySelected() {
    if (!suggestion) return;
    setApplying(true);
    try {
      const scores: Partial<Scores> = {};
      suggestion.score_updates.forEach((u, i) => {
        if (selected.scoreIdx[i]) {
          (scores as Record<string, number>)[u.field] = u.new;
        }
      });
      const questions_to_check = Object.entries(selected.questions)
        .filter(([, v]) => v).map(([k]) => k);

      await onApply({
        scores: Object.keys(scores).length > 0 ? scores : undefined,
        next_step: selected.nextStep && suggestion.next_step_update !== null ? suggestion.next_step_update : undefined,
        comment: selected.comment && suggestion.new_comment ? suggestion.new_comment : undefined,
        questions_to_check: questions_to_check.length > 0 ? questions_to_check : undefined,
        stage: selected.stage && suggestion.stage_suggestion ? suggestion.stage_suggestion : undefined,
      });
      onClose();
    } catch (err) {
      setError('套用失敗:' + (err as Error).message);
    } finally {
      setApplying(false);
    }
  }

  const scoreFieldLabel = (f: string) => MEDDIC.find(m => m.key === f)?.label ?? f;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px] sm:top-12 sm:bottom-12 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold">🤖</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">AI 助手 · 對話記錄</div>
            <div className="text-xs text-slate-500 truncate">{deal.name} · {deal.stage}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {!suggestion && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">描述這次跟客戶的互動</span>
                <textarea
                  value={userText}
                  onChange={e => setUserText(e.target.value)}
                  rows={10}
                  placeholder="例如:今天下午打電話給陳先生,他說他考慮加碼到 300 萬美金,但太太還沒點頭。下週三要一起吃晚餐讓我見太太。他擔心銀行抽銀根,問我宏利財摯宏耀有沒有 Margin Call 條款。我解釋了沒有,他有興趣,但要回去跟太太討論..."
                  className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-vertical"
                />
              </label>
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                💡 <b>原話會被完整保留</b>(時間軸 + 對話原稿區),AI 摘要另存。建議建議可<b>逐項編輯</b>後再套用。
              </div>
              <button
                onClick={analyze}
                disabled={loading || !userText.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:shadow"
              >
                {loading ? '🤖 AI 分析中...(約 5-15 秒)' : '🤖 請 AI 分析並建議更新'}
              </button>
              {error && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded">{error}</div>}
            </>
          )}

          {suggestion && (
            <>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="text-xs text-indigo-700 font-semibold mb-1">📝 AI 摘要</div>
                <div className="text-sm text-slate-800">{suggestion.summary}</div>
              </div>

              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                ✅ 你的原始描述已存進「對話原稿」與時間軸(📝 標記)。下面的 AI 建議可逐項<b>修改</b>後再套用。
              </div>

              {suggestion.score_updates.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">📊 建議的 MEDDIC 分數更新 <span className="text-xs text-slate-400 font-normal">(可改數字 + 理由)</span></div>
                  <div className="space-y-1.5">
                    {suggestion.score_updates.map((u, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 border border-slate-200 rounded-lg">
                        <input
                          type="checkbox"
                          checked={!!selected.scoreIdx[i]}
                          onChange={e => setSelected(s => ({ ...s, scoreIdx: { ...s.scoreIdx, [i]: e.target.checked } }))}
                          className="mt-2 accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium">{scoreFieldLabel(u.field)}</span>
                            <span className="text-slate-400 line-through">{u.old}</span>
                            <span className="text-slate-400">→</span>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={u.new}
                              onChange={e => updateScoreNew(i, Number(e.target.value))}
                              className="w-14 px-1 py-0.5 border border-indigo-300 rounded text-indigo-700 font-bold text-center"
                            />
                          </div>
                          <input
                            type="text"
                            value={u.reason}
                            onChange={e => updateScoreReason(i, e.target.value)}
                            placeholder="理由"
                            className="mt-1 w-full px-1.5 py-0.5 text-xs border border-slate-200 hover:border-slate-300 rounded text-slate-600"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-semibold mb-2">💬 加入註解 <span className="text-xs text-slate-400 font-normal">(可修改)</span></div>
                <label className="flex items-start gap-2 p-2 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selected.comment}
                    onChange={e => setSelected(s => ({ ...s, comment: e.target.checked }))}
                    className="mt-2 accent-indigo-600"
                  />
                  <textarea
                    value={suggestion.new_comment ?? ''}
                    onChange={e => updateComment(e.target.value)}
                    rows={2}
                    className="flex-1 px-2 py-1 border border-slate-200 hover:border-slate-300 rounded text-sm resize-vertical"
                  />
                </label>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">🎯 下一步動作 <span className="text-xs text-slate-400 font-normal">(可修改)</span></div>
                <label className="flex items-start gap-2 p-2 border border-slate-200 rounded-lg">
                  <input
                    type="checkbox"
                    checked={selected.nextStep}
                    onChange={e => setSelected(s => ({ ...s, nextStep: e.target.checked }))}
                    className="mt-2 accent-indigo-600"
                  />
                  <input
                    type="text"
                    value={suggestion.next_step_update ?? ''}
                    onChange={e => updateNextStep(e.target.value)}
                    placeholder="什麼時候 / 跟誰 / 做什麼"
                    className="flex-1 px-2 py-1 border border-slate-200 hover:border-slate-300 rounded text-sm"
                  />
                </label>
              </div>

              {suggestion.question_checkoffs.length > 0 && (
                <div>
                  <div className="text-sm font-semibold mb-2">✅ 已釐清的題目</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.question_checkoffs.map(key => (
                      <label key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-1 border rounded cursor-pointer ${selected.questions[key] ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-slate-200 text-slate-500'}`}>
                        <input
                          type="checkbox"
                          checked={!!selected.questions[key]}
                          onChange={e => setSelected(s => ({ ...s, questions: { ...s.questions, [key]: e.target.checked } }))}
                          className="accent-emerald-600"
                        />
                        {key}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {suggestion.stage_suggestion && suggestion.stage_suggestion !== deal.stage && (
                <div>
                  <div className="text-sm font-semibold mb-2">🚀 建議推進階段</div>
                  <label className="flex items-center gap-2 p-2 border border-amber-200 bg-amber-50 rounded-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.stage}
                      onChange={e => setSelected(s => ({ ...s, stage: e.target.checked }))}
                      className="accent-amber-600"
                    />
                    <div className="text-sm">目前 {deal.stage} → 推進為 <span className="font-bold">{suggestion.stage_suggestion}</span></div>
                  </label>
                </div>
              )}

              {suggestion.ask_back.length > 0 && (
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="text-xs font-semibold text-slate-600 mb-1">🔍 下次建議追問(僅參考,不套用)</div>
                  <ul className="text-xs text-slate-700 space-y-0.5">
                    {suggestion.ask_back.map((q, i) => <li key={i}>• {q}</li>)}
                  </ul>
                </div>
              )}

              {error && <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded">{error}</div>}
            </>
          )}
        </div>

        {suggestion && (
          <div className="px-5 py-3 border-t border-slate-200 flex gap-2">
            <button
              onClick={() => { setSuggestion(null); setUserText(''); }}
              className="px-3 py-2 text-sm border border-slate-200 rounded hover:bg-slate-50"
            >重來</button>
            <button
              onClick={applySelected}
              disabled={applying}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >{applying ? '套用中...' : '✓ 套用(已修改的版本)'}</button>
          </div>
        )}
      </div>
    </>
  );
}
