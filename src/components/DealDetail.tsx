'use client';

import { useState } from 'react';
import { STAGES, MEDDIC, CHECKLIST, STAGE_PROMPTS, QUESTION_BANK, TIER_STYLES } from '@/lib/constants';
import type { Deal, PainPoint, Profile, Scores, Settings, Tier } from '@/lib/types';
import { fmtMoney, totalScore, recommendStage, redFlag, scoreColor, nextStage, contactOverdue, contactDaysSince, getTierFromAum } from '@/lib/utils';

interface Props {
  deal: Deal;
  settings: Settings;
  allProfiles: Profile[];
  profile: Profile;
  painPoints: PainPoint[];
  onClose: () => void;
  onPatchDeal: (patch: Partial<Deal>) => void;
  onPatchScore: (patch: Partial<Scores>) => void;
  onUpsertNote: (field: keyof Scores, patch: { evidence?: string; next_action?: string }) => void;
  onToggleChecklist: (itemKey: string) => void;
  onToggleQuestion: (questionKey: string) => void;
  onAddComment: (body: string) => void;
  onAdvance: () => void;
  onDelete: () => void;
}

export function DealDetail({
  deal, settings, allProfiles, profile, painPoints, onClose,
  onPatchDeal, onPatchScore, onUpsertNote, onToggleChecklist, onToggleQuestion, onAddComment, onAdvance, onDelete
}: Props) {
  const [newComment, setNewComment] = useState('');
  const scores = deal.scores ?? { m:0, e:0, d1:0, d2:0, p:0, i:0, c1:0, c2:0 };
  const total = totalScore(deal);
  const flag = redFlag(deal, settings);
  const items = CHECKLIST[deal.stage] ?? [];
  const done = items.filter(it => deal.stage_checklist?.some(c => c.item_key === it.key && c.checked)).length;
  const canAdvance = items.length > 0 && done === items.length;
  const next = nextStage(deal.stage);
  const tierCfg = settings.tier_config?.tiers ?? [];
  const contactInfo = contactOverdue(deal, tierCfg);
  const suggestedTier = getTierFromAum(Number(deal.aum_usd ?? 0), tierCfg);

  async function logContact() {
    const now = new Date().toISOString();
    onPatchDeal({ last_contact_at: now });
    onAddComment(`📞 已記錄本次聯繫`);
  }

  const getNote = (field: keyof Scores) => deal.score_notes?.find(n => n.field === field) ?? { evidence: '', next_action: '' };

  function submitComment() {
    if (!newComment.trim()) return;
    onAddComment(newComment.trim());
    setNewComment('');
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 top-4 sm:top-10 sm:inset-x-auto sm:right-4 sm:w-[720px] sm:max-w-[95vw] bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 shrink-0">
          <div className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center font-bold text-xs stage-${deal.stage}`}>
            <div>{deal.stage}</div>
            <div className="text-[10px] font-normal opacity-80">{settings.stage_probs[deal.stage]}%</div>
          </div>
          <div className="flex-1 min-w-0">
            <input
              value={deal.name}
              onChange={(e) => onPatchDeal({ name: e.target.value })}
              className="font-semibold text-base w-full bg-transparent outline-none border-b border-transparent focus:border-indigo-400"
            />
            <div className="text-xs text-slate-500 mt-0.5">
              {total}/80 · 建議 {recommendStage(total)} {flag && <>· 🚩 {flag}</>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4">
          {/* Stage prompt — what to do at this stage */}
          {STAGE_PROMPTS[deal.stage] && (
            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-3 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold stage-${deal.stage}`}>{deal.stage}</span>
                <span className="font-semibold text-slate-800">{STAGE_PROMPTS[deal.stage].goal}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white/60 rounded px-2 py-1.5">
                  <div className="text-slate-500 mb-0.5">📥 入口條件</div>
                  <div>{STAGE_PROMPTS[deal.stage].entry}</div>
                </div>
                <div className="bg-white/60 rounded px-2 py-1.5">
                  <div className="text-slate-500 mb-0.5">📤 出口標準</div>
                  <div>{STAGE_PROMPTS[deal.stage].exit}</div>
                </div>
              </div>
              <div className="mt-2 text-xs">
                <div className="text-slate-500 mb-1">🎯 這階段必記</div>
                <ul className="space-y-0.5">
                  {STAGE_PROMPTS[deal.stage].keyRecords.map((r, i) => (
                    <li key={i} className="flex gap-1"><span className="text-amber-600">•</span>{r}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 text-xs">
                <div className="text-slate-500 mb-1">💡 建議動作</div>
                <ul className="space-y-0.5">
                  {STAGE_PROMPTS[deal.stage].nextActions.map((a, i) => (
                    <li key={i} className="flex gap-1"><span className="text-indigo-500">→</span>{a}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="block">
              <span className="text-xs text-slate-500">RM 負責人</span>
              <select
                value={deal.rm_id}
                onChange={(e) => onPatchDeal({ rm_id: e.target.value })}
                disabled={profile.role !== 'manager' && profile.id !== deal.rm_id}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded bg-white"
              >
                {allProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">潛在 AUM (USD)</span>
              <input
                type="text"
                inputMode="numeric"
                value={Number(deal.aum_usd ?? 0).toLocaleString('en-US')}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  onPatchDeal({ aum_usd: raw === '' ? 0 : Number(raw) });
                }}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded font-mono"
              />
            </label>
            <label className="block col-span-2">
              <span className="text-xs text-slate-500">目標商品</span>
              <input
                type="text"
                value={deal.product ?? ''}
                onChange={(e) => onPatchDeal({ product: e.target.value })}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">首次接觸</span>
              <input
                type="date"
                value={deal.first_contact}
                onChange={(e) => onPatchDeal({ first_contact: e.target.value })}
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded"
              />
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">最近更新</span>
              <input
                type="date"
                value={deal.last_updated.slice(0, 10)}
                readOnly
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded bg-slate-50 text-slate-500"
              />
            </label>
          </div>

          {/* Customer Tier + Last Contact */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <span>🎖 客戶等級 + 聯繫提醒</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-slate-500">客戶等級 <span className="text-slate-400">(建議 {suggestedTier} 依 AUM)</span></span>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {tierCfg.map(tc => (
                    <button
                      key={tc.key}
                      onClick={() => onPatchDeal({ tier: tc.key })}
                      className={`flex-1 min-w-[48px] text-xs px-2 py-1.5 rounded font-bold transition ${deal.tier === tc.key ? TIER_STYLES[tc.key] : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >{tc.key}</button>
                  ))}
                </div>
                {deal.tier && (
                  <div className="text-[10px] text-slate-500 mt-1">
                    {tierCfg.find(tc => tc.key === deal.tier)?.name} · 建議每 {tierCfg.find(tc => tc.key === deal.tier)?.contact_days} 天聯繫
                  </div>
                )}
              </label>
              <div className="block">
                <span className="text-xs text-slate-500">最後聯繫</span>
                <div className="mt-1 flex gap-1">
                  <input
                    type="date"
                    value={deal.last_contact_at ? deal.last_contact_at.slice(0, 10) : ''}
                    onChange={e => onPatchDeal({ last_contact_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm bg-white"
                  />
                  <button
                    onClick={logContact}
                    title="按下代表今天剛聯繫過"
                    className="px-2 py-1.5 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 font-semibold whitespace-nowrap"
                  >📞 剛聯繫過</button>
                </div>
                {contactInfo && (
                  <div className={`text-[11px] mt-1 font-medium ${
                    contactInfo.status === 'overdue' ? 'text-rose-600' :
                    contactInfo.status === 'due_soon' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    {contactInfo.status === 'overdue' && `⚠ 已逾期 ${contactInfo.deltaDays} 天未聯繫`}
                    {contactInfo.status === 'due_soon' && `🔔 ${Math.abs(contactInfo.deltaDays)} 天內需聯繫`}
                    {contactInfo.status === 'ok' && `✓ 已聯繫 ${contactInfo.daysSince} 天(週期內)`}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stage control */}
          <div>
            <div className="text-xs text-slate-500 mb-1">目前階段 (手動覆寫 / 分數建議)</div>
            <div className="flex gap-1 flex-wrap">
              {STAGES.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => onPatchDeal({ stage: stage.id })}
                  className={`text-xs px-2.5 py-1 rounded font-semibold border ${deal.stage === stage.id ? `stage-${stage.id} border-transparent` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                >
                  {stage.id}
                </button>
              ))}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              推進門檻:L3≥48 · L4≥56 · L5≥64 · 目前分數建議:{recommendStage(total)}
            </div>
          </div>

          {/* MEDDIC scoring */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">MEDDIC 評分卡 <span className="text-slate-400 text-xs font-normal">(0–10)</span></h3>
              <div className="text-sm"><span className="font-bold text-indigo-700">{total}</span><span className="text-slate-400">/80</span></div>
            </div>
            <div className="space-y-3">
              {MEDDIC.map(field => (
                <div key={field.key} className="border border-slate-200 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="font-semibold text-sm shrink-0">{field.label}</div>
                    <div className="flex-1 text-xs text-slate-500">{field.hint}</div>
                    <div className="shrink-0 text-sm font-bold w-8 text-right">{scores[field.key]}</div>
                  </div>
                  {(() => {
                    const qs = QUESTION_BANK[field.key] ?? [];
                    if (qs.length === 0) return null;
                    const answeredSet = new Set((deal.deal_questions ?? []).filter(q => q.answered).map(q => q.question_key));
                    const done = qs.filter(q => answeredSet.has(q.key)).length;
                    const pct = Math.round(done / qs.length * 100);
                    return (
                      <details className="mb-2 text-xs">
                        <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800 select-none flex items-center gap-2">
                          <span>💬 實戰題庫</span>
                          <span className="text-slate-500 font-normal">{done}/{qs.length} 題已釐清</span>
                          <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden max-w-[120px]">
                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </summary>
                        <ul className="mt-1 space-y-0.5 bg-slate-50 rounded p-2">
                          {qs.map(item => {
                            const checked = answeredSet.has(item.key);
                            return (
                              <li key={item.key} className="flex items-start gap-1.5 py-0.5 px-1 rounded hover:bg-white cursor-pointer" onClick={() => onToggleQuestion(item.key)}>
                                <input type="checkbox" checked={checked} readOnly className="mt-0.5 accent-emerald-600 shrink-0" />
                                <span className={checked ? 'text-slate-400 line-through' : 'text-slate-700'}>
                                  {item.priority === 'high' && <span className="text-rose-500 mr-0.5" title="高優先">★</span>}
                                  {item.q}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </details>
                    );
                  })()}
                  <div className="grid grid-cols-11 gap-1">
                    {Array.from({ length: 11 }, (_, n) => (
                      <button
                        key={n}
                        onClick={() => onPatchScore({ [field.key]: n } as Partial<Scores>)}
                        className={`h-7 text-xs rounded font-semibold border transition ${scores[field.key] === n ? `${scoreColor(n)} border-transparent scale-110` : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="證據 / 筆記"
                      defaultValue={getNote(field.key).evidence}
                      onBlur={(e) => onUpsertNote(field.key, { evidence: e.target.value })}
                      className="px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                    <input
                      type="text"
                      placeholder="下一步動作"
                      defaultValue={getNote(field.key).next_action}
                      onBlur={(e) => onUpsertNote(field.key, { next_action: e.target.value })}
                      className="px-2 py-1 text-xs border border-slate-200 rounded"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage exit checklist */}
          {items.length > 0 && next && (
            <div>
              <h3 className="font-semibold text-sm mb-2">
                推進到下一階段的關鍵問題
                <span className="text-xs text-slate-500 font-normal ml-1">({deal.stage} → {next})</span>
              </h3>
              <div className="space-y-1.5 bg-slate-50 rounded-lg p-3 border border-slate-200">
                {items.map(item => {
                  const checked = deal.stage_checklist?.some(c => c.item_key === item.key && c.checked);
                  return (
                    <label key={item.key} className="flex items-start gap-2 text-sm cursor-pointer py-1 px-1 rounded hover:bg-white">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleChecklist(item.key)}
                        className="mt-0.5 accent-indigo-600"
                      />
                      <span className={checked ? 'line-through text-slate-400' : ''}>{item.label}</span>
                    </label>
                  );
                })}
                <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">已完成 <span className="font-semibold">{done}</span> / {items.length}</div>
                  <button
                    onClick={onAdvance}
                    disabled={!canAdvance}
                    className={`text-xs px-3 py-1.5 rounded font-semibold ${canAdvance ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                  >
                    ✓ 推進到 {next}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Pain → product */}
          <div>
            <h3 className="font-semibold text-sm mb-2">痛點 → 建議商品 <span className="text-xs text-slate-400 font-normal">({painPoints.length} 條)</span></h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {painPoints.map(row => (
                <div key={row.id} className="border border-slate-200 rounded p-2 text-xs">
                  <div className="font-semibold text-slate-700">「{row.pain}」</div>
                  <div className="text-indigo-700 font-medium mt-0.5">→ {row.product}</div>
                  {row.tiers && <div className="text-[10px] text-slate-500 mt-0.5">適用層級:{row.tiers}</div>}
                  <div className="text-slate-500 mt-0.5">{row.pitch}</div>
                </div>
              ))}
              {painPoints.length === 0 && <div className="col-span-full text-xs text-slate-400 text-center py-4">尚未設定,請到設定頁新增</div>}
            </div>
          </div>

          {/* Next step + comments */}
          <div>
            <label className="block">
              <span className="text-xs text-slate-500">🎯 下一步具體動作</span>
              <input
                type="text"
                defaultValue={deal.next_step ?? ''}
                onBlur={(e) => onPatchDeal({ next_step: e.target.value })}
                placeholder="要見誰 / 交付什麼 / 什麼時候"
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm"
              />
            </label>
            <div className="mt-3">
              <h3 className="font-semibold text-sm mb-2">註解時間軸</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                  placeholder="加一筆註解 (Enter 送出)"
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-sm"
                />
                <button onClick={submitComment} className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded">加入</button>
              </div>
              <ul className="mt-2 space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
                {(deal.comments ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(c => (
                  <li key={c.id} className="text-sm bg-slate-50 rounded px-2 py-1.5 border border-slate-100">
                    <div className="text-xs text-slate-400">{new Date(c.created_at).toLocaleString('zh-TW', { hour12: false })}</div>
                    <div>{c.is_system ? <span className="text-slate-500">【系統】</span> : null}{c.body}</div>
                  </li>
                ))}
                {!(deal.comments ?? []).length && <li className="text-xs text-slate-400">暫無註解</li>}
              </ul>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <button onClick={() => { if (confirm(`刪除「${deal.name}」?此動作無法復原`)) onDelete(); }} className="text-xs text-rose-600 hover:underline">刪除此案件</button>
          </div>
        </div>
      </div>
    </>
  );
}
