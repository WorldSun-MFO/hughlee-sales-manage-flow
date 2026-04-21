'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { STAGES } from '@/lib/constants';
import type { Deal, PainPoint, Profile, Settings, StageId, Scores } from '@/lib/types';
import { fmtMoney, totalScore, redFlag, daysSince, stageIdx } from '@/lib/utils';
import { DealDetail } from './DealDetail';
import { NewDealModal } from './NewDealModal';
import { SettingsModal } from './SettingsModal';

interface Props {
  initialDeals: Deal[];
  profile: Profile;
  allProfiles: Profile[];
  initialPainPoints: PainPoint[];
  settings: Settings;
}

export function Dashboard({ initialDeals, profile, allProfiles, initialPainPoints, settings: initialSettings }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [profiles, setProfiles] = useState<Profile[]>(allProfiles);
  const [painPoints, setPainPoints] = useState<PainPoint[]>(initialPainPoints);
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState({ rm: '', stage: '' as StageId | '', redFlag: false, search: '', sort: 'updated' as 'updated' | 'aum' | 'score' | 'stage' });

  const currentDeal = currentDealId ? deals.find(d => d.id === currentDealId) ?? null : null;

  // --- Realtime sync ---
  useEffect(() => {
    const channel = supabase
      .channel('pipeline-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deals' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_notes' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stage_checklist' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deal_questions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetchProfiles())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pain_points' }, () => refetchPainPoints())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchRef = useRef<number | null>(null);
  const refetch = useCallback(() => {
    if (refetchRef.current) window.clearTimeout(refetchRef.current);
    refetchRef.current = window.setTimeout(async () => {
      const { data } = await supabase
        .from('deals')
        .select('*, scores(*), score_notes(*), stage_checklist(*), deal_questions(*), comments(id, deal_id, author_id, body, is_system, created_at), rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)')
        .order('last_updated', { ascending: false });
      if (data) setDeals(data as Deal[]);
    }, 250);
  }, [supabase]);

  const refetchProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setProfiles(data as Profile[]);
  }, [supabase]);

  const refetchPainPoints = useCallback(async () => {
    const { data } = await supabase.from('pain_points').select('*').eq('is_active', true).order('order_idx');
    if (data) setPainPoints(data as PainPoint[]);
  }, [supabase]);

  // --- Derived ---
  const totalAum = useMemo(() => deals.filter(d => d.stage !== 'L7').reduce((s, d) => s + Number(d.aum_usd ?? 0), 0), [deals]);
  const weightedForecast = useMemo(() => deals.reduce((s, d) => s + Number(d.aum_usd ?? 0) * (settings.stage_probs[d.stage] ?? 0) / 100, 0), [deals, settings]);
  const l4PlusCount = deals.filter(d => ['L4','L5','L6','L7'].includes(d.stage)).length;
  const l4PlusPct = deals.length ? Math.round(l4PlusCount / deals.length * 100) : 0;
  const redFlagCount = deals.filter(d => redFlag(d, settings)).length;
  const activeDealsCount = deals.filter(d => d.stage !== 'L7').length;

  const filteredDeals = useMemo(() => {
    const list = deals.filter(d => {
      if (filter.rm && d.rm_id !== filter.rm) return false;
      if (filter.stage && d.stage !== filter.stage) return false;
      if (filter.redFlag && !redFlag(d, settings)) return false;
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const hay = `${d.name} ${d.product ?? ''} ${d.next_step ?? ''} ${d.rm?.full_name ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      if (filter.sort === 'aum') return Number(b.aum_usd) - Number(a.aum_usd);
      if (filter.sort === 'score') return totalScore(b) - totalScore(a);
      if (filter.sort === 'stage') return stageIdx(b.stage) - stageIdx(a.stage);
      return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime();
    });
    return list;
  }, [deals, filter, settings]);

  const stageCount = (id: StageId) => deals.filter(d => d.stage === id).length;
  const stageAum = (id: StageId) => deals.filter(d => d.stage === id).reduce((s, d) => s + Number(d.aum_usd ?? 0), 0);
  const stageBarPct = (id: StageId) => {
    const maxCount = Math.max(1, ...STAGES.map(s => stageCount(s.id)));
    return stageCount(id) / maxCount * 100;
  };

  // --- Actions ---
  async function signOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Patch a deal locally (optimistic) then persist
  async function patchDeal(dealId: string, patch: Partial<Deal>) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...patch, last_updated: new Date().toISOString() } : d));
    const payload: Record<string, unknown> = { ...patch, last_updated: new Date().toISOString() };
    await supabase.from('deals').update(payload).eq('id', dealId);
  }

  async function patchScore(dealId: string, patch: Partial<Scores>) {
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, scores: { ...d.scores!, ...patch }, last_updated: new Date().toISOString() } : d));
    await supabase.from('scores').update(patch).eq('deal_id', dealId);
    await supabase.from('deals').update({ last_updated: new Date().toISOString() }).eq('id', dealId);
  }

  async function upsertNote(dealId: string, field: keyof Scores, patch: { evidence?: string; next_action?: string }) {
    setDeals(prev => prev.map(d => {
      if (d.id !== dealId) return d;
      const notes = [...(d.score_notes ?? [])];
      const idx = notes.findIndex(n => n.field === field);
      const base = idx >= 0 ? notes[idx] : { deal_id: dealId, field, evidence: '', next_action: '' };
      const updated = { ...base, ...patch };
      if (idx >= 0) notes[idx] = updated; else notes.push(updated);
      return { ...d, score_notes: notes };
    }));
    await supabase.from('score_notes').upsert({ deal_id: dealId, field, ...patch });
  }

  async function toggleChecklist(dealId: string, itemKey: string) {
    const deal = deals.find(d => d.id === dealId); if (!deal) return;
    const existing = deal.stage_checklist?.find(c => c.item_key === itemKey);
    if (existing) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_checklist: d.stage_checklist?.filter(c => c.item_key !== itemKey) } : d));
      await supabase.from('stage_checklist').delete().eq('deal_id', dealId).eq('item_key', itemKey);
    } else {
      const newItem = { deal_id: dealId, item_key: itemKey, checked: true, checked_at: new Date().toISOString() };
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage_checklist: [...(d.stage_checklist ?? []), newItem] } : d));
      await supabase.from('stage_checklist').upsert({ deal_id: dealId, item_key: itemKey, checked: true, checked_by: profile.id });
    }
  }

  async function addComment(dealId: string, body: string, isSystem = false) {
    const { data } = await supabase.from('comments').insert({ deal_id: dealId, author_id: profile.id, body, is_system: isSystem }).select().single();
    if (data) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, comments: [...(d.comments ?? []), data] } : d));
    }
  }

  async function advanceStage(dealId: string) {
    const deal = deals.find(d => d.id === dealId); if (!deal) return;
    const next = stageIdx(deal.stage) < STAGES.length - 1 ? STAGES[stageIdx(deal.stage) + 1].id : null;
    if (!next) return;
    await patchDeal(dealId, { stage: next });
    await addComment(dealId, `推進:${deal.stage} → ${next}`, true);
  }

  async function createDeal(input: { name: string; rm_id: string; aum_usd: number; product: string; first_contact: string }) {
    const { data } = await supabase.from('deals').insert({
      name: input.name.trim(), rm_id: input.rm_id, aum_usd: input.aum_usd, product: input.product,
      first_contact: input.first_contact, stage: 'L1', created_by: profile.id,
    }).select('*, scores(*), rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)').single();
    if (data) {
      setDeals(prev => [data as Deal, ...prev]);
      setShowNewDeal(false);
      setCurrentDealId((data as Deal).id);
    }
  }

  async function deleteDeal(dealId: string) {
    setDeals(prev => prev.filter(d => d.id !== dealId));
    setCurrentDealId(null);
    await supabase.from('deals').delete().eq('id', dealId);
  }

  async function saveSettings(patch: Partial<Settings>) {
    setSettings(s => ({ ...s, ...patch }));
    await supabase.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  }

  async function addMember(input: { email: string; full_name: string; role: 'rm' | 'manager' }) {
    const email = input.email.trim().toLowerCase();
    const { data, error } = await supabase.from('profiles')
      .insert({ id: crypto.randomUUID(), email, full_name: input.full_name, rm_code: input.full_name, role: input.role })
      .select().single();
    if (error) throw error;
    if (data) setProfiles(ps => [...ps, data as Profile].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')));
  }

  async function updateMember(id: string, patch: { full_name?: string; role?: 'rm' | 'manager' }) {
    setProfiles(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('profiles').update(patch).eq('id', id);
  }

  async function removeMember(id: string) {
    setProfiles(ps => ps.filter(p => p.id !== id));
    await supabase.from('profiles').delete().eq('id', id);
  }

  async function toggleQuestion(dealId: string, questionKey: string) {
    const deal = deals.find(d => d.id === dealId); if (!deal) return;
    const existing = deal.deal_questions?.find(q => q.question_key === questionKey);
    if (existing?.answered) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_questions: (d.deal_questions ?? []).filter(q => q.question_key !== questionKey) } : d));
      await supabase.from('deal_questions').delete().eq('deal_id', dealId).eq('question_key', questionKey);
    } else {
      const item = { deal_id: dealId, question_key: questionKey, answered: true, note: '', asked_at: new Date().toISOString() };
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, deal_questions: [...(d.deal_questions ?? []), item] } : d));
      await supabase.from('deal_questions').upsert({ deal_id: dealId, question_key: questionKey, answered: true, asked_by: profile.id });
    }
  }

  async function addPain(input: { pain: string; product: string; pitch: string; tiers: string }) {
    const maxIdx = Math.max(0, ...painPoints.map(p => p.order_idx));
    const { data, error } = await supabase.from('pain_points')
      .insert({ ...input, order_idx: maxIdx + 10, is_active: true, created_by: profile.id })
      .select().single();
    if (error) throw error;
    if (data) setPainPoints(ps => [...ps, data as PainPoint].sort((a, b) => a.order_idx - b.order_idx));
  }

  async function updatePain(id: string, patch: Partial<PainPoint>) {
    setPainPoints(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('pain_points').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  }

  async function removePain(id: string) {
    setPainPoints(ps => ps.filter(p => p.id !== id));
    await supabase.from('pain_points').delete().eq('id', id);
  }

  // --- Render ---
  return (
    <>
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">沃</div>
            <div>
              <div className="font-semibold text-sm leading-tight">沃勝 MEDDIC Pipeline</div>
              <div className="text-xs text-slate-500 leading-tight">
                {profile.full_name} · {profile.role === 'manager' ? '管理員 (看全部)' : 'RM (看自己)'}
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <button onClick={() => setShowNewDeal(true)} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            ＋ 新增案件
          </button>
          <button onClick={() => setShowNewDeal(true)} className="sm:hidden inline-flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-lg font-bold">＋</button>
          <button onClick={() => setShowSettings(true)} className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50" title="設定">⚙︎</button>
          <button onClick={signOut} className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50" title="登出">⏻</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-24">

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiTile label="Pipeline 總 AUM" value={fmtMoney(totalAum)} hint={`${activeDealsCount} 個活躍案件`} />
          <KpiTile label="加權預測" value={fmtMoney(weightedForecast)} hint="依階段機率加權" valueClass="text-indigo-700" />
          <KpiTile label="L4+ 高品質案件" value={`${l4PlusCount} 件`} hint={`佔比 ${l4PlusPct}% (健康 ≥25%)`} valueClass="text-emerald-600" />
          <KpiTile label="🚩 紅旗案件" value={`${redFlagCount} 件`} hint="建議優先處理或放棄" valueClass={redFlagCount > 0 ? 'text-rose-600' : 'text-slate-400'} />
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">漏斗階段分佈</h2>
            {filter.stage && <button onClick={() => setFilter(f => ({ ...f, stage: '' }))} className="text-xs text-indigo-600 hover:underline">清除階段篩選</button>}
          </div>
          <div className="space-y-2">
            {STAGES.map(stage => (
              <button key={stage.id} onClick={() => setFilter(f => ({ ...f, stage: f.stage === stage.id ? '' : stage.id }))}
                className={`w-full flex items-center gap-3 p-2 rounded-lg transition ${filter.stage === stage.id ? 'ring-2 ring-indigo-400 bg-indigo-50' : 'hover:bg-slate-50'}`}>
                <div className="w-10 text-xs font-bold text-right">{stage.id}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="text-xs text-slate-600 truncate">{stage.name}</div>
                    <div className="text-xs text-slate-400">推進率目標 {stage.targetConv}</div>
                  </div>
                  <div className="h-6 rounded-md relative overflow-hidden border border-slate-200 bg-slate-50">
                    <div className={`h-full stage-${stage.id} transition-all duration-500 flex items-center px-2`} style={{ width: `${Math.max(stageBarPct(stage.id), 4)}%` }}>
                      <span className="text-xs font-semibold whitespace-nowrap">{stageCount(stage.id)} 件</span>
                    </div>
                    <div className="absolute right-2 top-0 h-full flex items-center">
                      <span className="text-xs font-medium text-slate-600">{fmtMoney(stageAum(stage.id))}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            總案件 <span className="font-semibold text-slate-700">{deals.length}</span> · L4+ 佔比 {l4PlusPct}% (建議 ≥25%) · Pipeline 覆蓋率建議 ≥ 3× 月目標
          </div>
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap gap-2 items-center">
          <select value={filter.rm} onChange={e => setFilter(f => ({ ...f, rm: e.target.value }))} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
            <option value="">所有 RM</option>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
          </select>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <input type="checkbox" checked={filter.redFlag} onChange={e => setFilter(f => ({ ...f, redFlag: e.target.checked }))} className="accent-rose-600" />
            <span>🚩 只看紅旗</span>
          </label>
          <input type="search" value={filter.search} onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} placeholder="搜尋客戶/商品/下一步..." className="flex-1 min-w-[140px] px-3 py-1.5 text-sm border border-slate-200 rounded-lg" />
          <select value={filter.sort} onChange={e => setFilter(f => ({ ...f, sort: e.target.value as 'updated' | 'aum' | 'score' | 'stage' }))} className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-white">
            <option value="updated">排序:最近更新</option>
            <option value="aum">排序:AUM 大到小</option>
            <option value="score">排序:總分高到低</option>
            <option value="stage">排序:階段高到低</option>
          </select>
        </section>

        <section className="space-y-2">
          {filteredDeals.length === 0 && <div className="text-center py-10 text-slate-400 text-sm">沒有符合條件的案件</div>}
          {filteredDeals.map(d => (
            <button key={d.id} onClick={() => setCurrentDealId(d.id)} className="w-full text-left bg-white rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-lg flex flex-col items-center justify-center font-bold text-xs stage-${d.stage}`}>
                    <div>{d.stage}</div>
                    <div className="text-[10px] font-normal opacity-80">{settings.stage_probs[d.stage]}%</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                        <span>{d.name}</span>
                        <span className="text-xs text-slate-400 font-normal">RM {d.rm?.full_name || '—'}</span>
                        {redFlag(d, settings) && <span className="text-xs px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">🚩 {redFlag(d, settings)}</span>}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{d.product}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm sm:text-base font-semibold">{fmtMoney(Number(d.aum_usd))}</div>
                      <div className="text-xs text-slate-500">{totalScore(d)}/80 分</div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${totalScore(d) / 80 * 100}%` }} />
                    </div>
                    <span>{daysSince(d.last_updated)} 天前更新</span>
                  </div>
                  {d.next_step && (
                    <div className="mt-2 text-xs bg-amber-50 text-amber-900 px-2 py-1 rounded border border-amber-100">
                      <span className="font-semibold">下一步:</span> {d.next_step}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </section>
      </main>

      {currentDeal && (
        <DealDetail
          deal={currentDeal}
          settings={settings}
          allProfiles={profiles}
          profile={profile}
          painPoints={painPoints}
          onClose={() => setCurrentDealId(null)}
          onPatchDeal={(patch) => patchDeal(currentDeal.id, patch)}
          onPatchScore={(patch) => patchScore(currentDeal.id, patch)}
          onUpsertNote={(field, patch) => upsertNote(currentDeal.id, field, patch)}
          onToggleChecklist={(key) => toggleChecklist(currentDeal.id, key)}
          onToggleQuestion={(key) => toggleQuestion(currentDeal.id, key)}
          onAddComment={(body) => addComment(currentDeal.id, body)}
          onAdvance={() => advanceStage(currentDeal.id)}
          onDelete={() => deleteDeal(currentDeal.id)}
        />
      )}

      {showNewDeal && (
        <NewDealModal
          defaultRmId={profile.id}
          allProfiles={profiles}
          onClose={() => setShowNewDeal(false)}
          onCreate={createDeal}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          profile={profile}
          allProfiles={profiles}
          painPoints={painPoints}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onRemoveMember={removeMember}
          onAddPain={addPain}
          onUpdatePain={updatePain}
          onRemovePain={removePain}
        />
      )}
    </>
  );
}

function KpiTile({ label, value, hint, valueClass }: { label: string; value: string; hint: string; valueClass?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl sm:text-2xl font-bold ${valueClass ?? ''}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{hint}</div>
    </div>
  );
}
