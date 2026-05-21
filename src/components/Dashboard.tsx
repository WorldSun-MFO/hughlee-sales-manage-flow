// ============================================================
// Dashboard — 整個 CRM 的 client 端中樞
// ============================================================
// 職責(只剩三類):
//   1. 持有全站 state(deals / profiles / tasks / teams / painPoints / settings / filter)
//   2. 提供所有寫入動作函式(patchDeal、addTask、banMember...),
//      子元件透過 props callback 觸發
//   3. 組裝 UI section(Header / KpiTiles / FocusList / Funnel / FilterBar / DealList +
//      三個 Modal: DealDetail / NewDealModal / SettingsModal + TasksTab)
//
// 不再內聯 UI section — 全部抽到 src/components/dashboard/ 下,各檔有自己的 header doc。
//
// 互動表(這支會寫到的 Supabase tables 與 storage):
//   deals / scores / score_notes / stage_checklist / deal_questions / comments /
//   deal_attachments / tasks / profiles / teams / pain_points / settings
//   Storage bucket: deal-attachments
//   RPC: admin_member_status / admin_ban_user / admin_unban_user
//   API route: /api/admin/login-link
//
// 所有寫入都用 optimistic update(先改本地 state,Supabase 寫入失敗時不會自動 rollback,
// 但 useRealtimeSync 會 250ms 後拿回真相覆蓋)。
// ============================================================
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { IS_DEMO } from '@/lib/demo';
import { STAGES } from '@/lib/constants';
import type { Deal, DealAttachment, DealPlan, PainPoint, Profile, Role, Settings, StageId, Scores, Task, TaskPriority, Team, Tier } from '@/lib/types';
import { totalScore, redFlag, stageIdx, contactOverdue, getTierFromAum, dealsToCSV, downloadCSV, splitNextStepIntoTasks } from '@/lib/utils';
import { DealDetail } from './DealDetail';
import { NewDealModal } from './NewDealModal';
import { SettingsModal } from './SettingsModal';
import { TasksTab } from './TasksTab';
import { Header } from './dashboard/Header';
import { KpiTiles } from './dashboard/KpiTiles';
import { FocusList } from './dashboard/FocusList';
import { Funnel } from './dashboard/Funnel';
import { FilterBar, type FilterState } from './dashboard/FilterBar';
import { DealList } from './dashboard/DealList';
import { useRealtimeSync } from './dashboard/useRealtimeSync';

interface Props {
  initialDeals: Deal[];
  profile: Profile;
  allProfiles: Profile[];
  initialPainPoints: PainPoint[];
  initialTeams: Team[];
  initialTasks: Task[];
  settings: Settings;
}

export function Dashboard({ initialDeals, profile, allProfiles, initialPainPoints, initialTeams, initialTasks, settings: initialSettings }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  // ===== 全站 state =====
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [profiles, setProfiles] = useState<Profile[]>(allProfiles);
  const [painPoints, setPainPoints] = useState<PainPoint[]>(initialPainPoints);
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  // memberStatus 是 admin RPC 抓的「使用者是否已建 auth、是否被停用」,非 admin 拿到空物件
  const [memberStatus, setMemberStatus] = useState<Record<string, { has_auth: boolean; banned: boolean }>>({});

  // ===== UI state =====
  const [activeTab, setActiveTab] = useState<'pipeline' | 'tasks'>('pipeline');
  const [currentDealId, setCurrentDealId] = useState<string | null>(null);
  const [showNewDeal, setShowNewDeal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [focusCollapsed, setFocusCollapsed] = useState(false);
  const [funnelCollapsed, setFunnelCollapsed] = useState(true);
  const [filter, setFilter] = useState<FilterState>({
    rm: '', team: '', stage: '' as StageId | '', tier: '' as Tier | '',
    redFlag: false, overdue: false, search: '', sort: 'updated',
  });
  const tierCfg = settings.tier_config?.tiers ?? [];

  // ===== Realtime 訂閱 =====
  useRealtimeSync(supabase, { setDeals, setProfiles, setPainPoints, setTeams, setTasks });

  // ===== Demo 唯讀守門 =====
  // demo 環境任何寫入都會被 blockDemo() 攔下,顯示「示範環境唯讀」提示 2.6s
  const [demoNotice, setDemoNotice] = useState(false);
  const demoNoticeTimer = useRef<number | null>(null);
  function blockDemo() {
    setDemoNotice(true);
    if (demoNoticeTimer.current) window.clearTimeout(demoNoticeTimer.current);
    demoNoticeTimer.current = window.setTimeout(() => setDemoNotice(false), 2600);
  }

  // ===== 衍生資料 =====
  const currentDeal = currentDealId ? deals.find(d => d.id === currentDealId) ?? null : null;

  // rm_id → team_id 對照表(deals 的 rm join 沒帶 team_id,要靠 profiles 補)
  const teamOfRm = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of profiles) m.set(p.id, p.team_id);
    return m;
  }, [profiles]);

  // 經過 filter + sort 的案件清單,傳給 DealList 直接渲染
  const filteredDeals = useMemo(() => {
    const list = deals.filter(d => {
      if (filter.rm && d.rm_id !== filter.rm) return false;
      if (filter.team && teamOfRm.get(d.rm_id) !== filter.team) return false;
      if (filter.stage && d.stage !== filter.stage) return false;
      if (filter.tier && d.tier !== filter.tier) return false;
      if (filter.redFlag && !redFlag(d, settings)) return false;
      if (filter.overdue && contactOverdue(d, tierCfg)?.status !== 'overdue') return false;
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
  }, [deals, filter, settings, tierCfg, teamOfRm]);

  // 成員 auth/ban 狀態:admin 才會抓(前端讀不到 auth schema,走 admin-only RPC)
  useEffect(() => {
    if (IS_DEMO || profile.role !== 'admin') return;
    refetchMemberStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refetchMemberStatus() {
    if (IS_DEMO || profile.role !== 'admin') return;
    const { data } = await supabase.rpc('admin_member_status');
    const rows = (data ?? []) as Array<{ id: string; has_auth: boolean; banned: boolean }>;
    setMemberStatus(Object.fromEntries(rows.map(r => [r.id, { has_auth: r.has_auth, banned: r.banned }])));
  }

  // ============================================================
  // 動作函式 — 全部 optimistic(先改本地,再 await 寫 DB)
  // ============================================================
  // 為什麼 optimistic:UI 反應要即時,使用者不該等網路 round trip。
  // 失敗時不自動 rollback(本系統可接受;realtime 會在 250ms 後拿回真相覆蓋)。
  //
  // IS_DEMO 守門:demo 環境一律 blockDemo() 並 return,確保不打 Supabase。
  // ============================================================

  // ---------- 一般 ----------
  async function signOut() {
    if (IS_DEMO) return;
    await supabase.auth.signOut();
    router.push('/login');
  }

  function handleExportCSV() {
    const csv = dealsToCSV(deals, settings, tierCfg);
    const date = new Date().toISOString().slice(0, 10);
    downloadCSV(`worldsun-pipeline-${date}.csv`, csv);
  }

  // ---------- Deal CRUD(deals 表)----------
  async function patchDeal(dealId: string, patch: Partial<Deal>) {
    if (IS_DEMO) { blockDemo(); return; }
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, ...patch, last_updated: new Date().toISOString() } : d));
    const payload: Record<string, unknown> = { ...patch, last_updated: new Date().toISOString() };
    await supabase.from('deals').update(payload).eq('id', dealId);
  }

  async function createDeal(input: { name: string; rm_id: string; aum_usd: number; product: string; first_contact: string }) {
    if (IS_DEMO) { blockDemo(); return; }
    const tier = getTierFromAum(input.aum_usd, tierCfg);
    const nowIso = new Date().toISOString();
    const { data } = await supabase.from('deals').insert({
      name: input.name.trim(), rm_id: input.rm_id, aum_usd: input.aum_usd, product: input.product,
      first_contact: input.first_contact, stage: 'L1', tier, last_contact_at: nowIso, created_by: profile.id,
    }).select('*, scores(*), rm:profiles!deals_rm_id_fkey(id, email, full_name, rm_code, role)').single();
    if (data) {
      setDeals(prev => [data as Deal, ...prev]);
      setShowNewDeal(false);
      setCurrentDealId((data as Deal).id);
    }
  }

  async function deleteDeal(dealId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    setDeals(prev => prev.filter(d => d.id !== dealId));
    setCurrentDealId(null);
    // 注意:刪除後可由 admin 用 restore_deleted_deal(uuid) 從 audit_log 還原
    //      詳見 migration_17 與 docs/RECOVERY.md
    await supabase.from('deals').delete().eq('id', dealId);
  }

  async function advanceStage(dealId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const deal = deals.find(d => d.id === dealId); if (!deal) return;
    const next = stageIdx(deal.stage) < STAGES.length - 1 ? STAGES[stageIdx(deal.stage) + 1].id : null;
    if (!next) return;
    await patchDeal(dealId, { stage: next });
    await addComment(dealId, `推進:${deal.stage} → ${next}`, true);
  }

  async function quickLogContact(dealId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const nowIso = new Date().toISOString();
    await patchDeal(dealId, { last_contact_at: nowIso });
    await addComment(dealId, `📞 已記錄本次聯繫`);
  }

  // ---------- Score / 筆記(scores、score_notes 表)----------
  async function patchScore(dealId: string, patch: Partial<Scores>) {
    if (IS_DEMO) { blockDemo(); return; }
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, scores: { ...d.scores!, ...patch }, last_updated: new Date().toISOString() } : d));
    await supabase.from('scores').update(patch).eq('deal_id', dealId);
    await supabase.from('deals').update({ last_updated: new Date().toISOString() }).eq('id', dealId);
  }

  async function upsertNote(dealId: string, field: keyof Scores, patch: { evidence?: string; next_action?: string }) {
    if (IS_DEMO) { blockDemo(); return; }
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

  // ---------- Checklist / 題庫(stage_checklist、deal_questions 表)----------
  async function toggleChecklist(dealId: string, itemKey: string) {
    if (IS_DEMO) { blockDemo(); return; }
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

  async function toggleQuestion(dealId: string, questionKey: string) {
    if (IS_DEMO) { blockDemo(); return; }
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

  // ---------- Comments(comments 表)----------
  // is_system=true → 系統訊息(階段推進、AI 套用後寫入)
  // is_raw=true   → 原始對話(從 AI 助手「分析」按下時觸發,保留 audit trail)
  async function addComment(dealId: string, body: string, isSystem = false, isRaw = false) {
    if (IS_DEMO) { blockDemo(); return; }
    const { data } = await supabase.from('comments')
      .insert({ deal_id: dealId, author_id: profile.id, body, is_system: isSystem, is_raw: isRaw })
      .select().single();
    if (data) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, comments: [...(d.comments ?? []), data] } : d));
    }
  }

  // 存原始未經 AI 處理的文字
  async function saveRawText(dealId: string, rawText: string) {
    if (IS_DEMO) { blockDemo(); return; }
    await addComment(dealId, rawText, false, true);
  }

  // ---------- Tasks(tasks 表,Sprint B)----------
  async function addTask(input: {
    title: string; deal_id: string | null; assignee_id: string | null;
    due_date: string | null; priority: TaskPriority;
  }) {
    if (IS_DEMO) { blockDemo(); return; }
    const { data, error } = await supabase.from('tasks')
      .insert({ ...input, status: 'todo', source_type: 'manual', created_by: profile.id })
      .select().single();
    if (error) throw error;
    if (data) setTasks(ts => [...ts, data as Task]);
  }

  async function updateTask(id: string, patch: Partial<Task>) {
    if (IS_DEMO) { blockDemo(); return; }
    setTasks(ts => ts.map(t => t.id === id ? { ...t, ...patch } : t));
    await supabase.from('tasks').update(patch).eq('id', id);
  }

  async function deleteTask(id: string) {
    if (IS_DEMO) { blockDemo(); return; }
    setTasks(ts => ts.filter(t => t.id !== id));
    await supabase.from('tasks').delete().eq('id', id);
  }

  // 把 deal.next_step 拆成多筆獨立任務(用 splitNextStepIntoTasks 支援多種編號格式)
  async function promoteNextStepToTask(dealId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const deal = deals.find(d => d.id === dealId);
    if (!deal?.next_step?.trim()) { alert('此案件沒有下一步可升級'); return; }
    const lines = splitNextStepIntoTasks(deal.next_step);
    if (lines.length === 0) { alert('沒有可升級的任務內容'); return; }
    for (const line of lines) {
      await addTask({ title: line, deal_id: dealId, assignee_id: deal.rm_id, due_date: null, priority: 'normal' });
    }
    alert(`已建立 ${lines.length} 筆任務`);
  }

  // 把 Plan 的單一 focus 動作升級成任務
  async function promotePlanFocus(dealId: string, opts: { title: string; targetDate?: string | null; sourceRef?: string }) {
    if (IS_DEMO) { blockDemo(); return; }
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    await addTask({ title: opts.title, deal_id: dealId, assignee_id: deal.rm_id, due_date: opts.targetDate ?? null, priority: 'normal' });
  }

  // ---------- Attachments(deal_attachments 表 + Storage bucket deal-attachments)----------
  async function uploadAttachment(dealId: string, file: File): Promise<DealAttachment> {
    if (IS_DEMO) { blockDemo(); throw new Error('示範環境為唯讀,無法上傳'); }
    const ext = file.name.split('.').pop() ?? 'bin';
    const storagePath = `${dealId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('deal-attachments').upload(storagePath, file, { contentType: file.type });
    if (upErr) throw upErr;
    const { data, error } = await supabase.from('deal_attachments')
      .insert({ deal_id: dealId, storage_path: storagePath, file_name: file.name, mime_type: file.type, size_bytes: file.size, uploaded_by: profile.id })
      .select().single();
    if (error) throw error;
    setDeals(prev => prev.map(d => d.id === dealId
      ? { ...d, deal_attachments: [...(d.deal_attachments ?? []), data as DealAttachment] }
      : d));
    return data as DealAttachment;
  }

  async function deleteAttachment(attachmentId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const att = deals.flatMap(d => d.deal_attachments ?? []).find(a => a.id === attachmentId);
    if (!att) return;
    setDeals(prev => prev.map(d => ({
      ...d,
      deal_attachments: (d.deal_attachments ?? []).filter(a => a.id !== attachmentId),
    })));
    await supabase.storage.from('deal-attachments').remove([att.storage_path]);
    await supabase.from('deal_attachments').delete().eq('id', attachmentId);
  }

  async function getAttachmentUrl(storagePath: string): Promise<string> {
    if (IS_DEMO) return '';
    const { data } = await supabase.storage.from('deal-attachments').createSignedUrl(storagePath, 3600);
    return data?.signedUrl ?? '';
  }

  // ---------- Settings(settings 表,singleton id=1)----------
  async function saveSettings(patch: Partial<Settings>) {
    if (IS_DEMO) { blockDemo(); return; }
    setSettings(s => ({ ...s, ...patch }));
    await supabase.from('settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1);
  }

  // ---------- Members(profiles 表 + auth.users 透過 RPC)----------
  async function addMember(input: { email: string; full_name: string; role: Role; team_id: string | null }) {
    if (IS_DEMO) { blockDemo(); return; }
    const email = input.email.trim().toLowerCase();
    if (profiles.some(p => p.email.toLowerCase() === email)) {
      throw new Error(`此 email (${email}) 已存在於成員清單,請改用編輯模式更新角色/團隊。`);
    }
    const { data, error } = await supabase.from('profiles')
      .insert({ id: crypto.randomUUID(), email, full_name: input.full_name, rm_code: input.full_name, role: input.role, team_id: input.team_id })
      .select().single();
    if (error) {
      if (error.code === '23505') throw new Error(`此 email (${email}) 已存在於資料庫,請改用編輯模式更新。`);
      throw error;
    }
    if (data) setProfiles(ps => [...ps, data as Profile].sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '')));
  }

  async function updateMember(id: string, patch: { full_name?: string; role?: Role; team_id?: string | null }) {
    if (IS_DEMO) { blockDemo(); return; }
    setProfiles(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('profiles').update(patch).eq('id', id);
  }

  async function removeMember(id: string) {
    if (IS_DEMO) { blockDemo(); return; }
    setProfiles(ps => ps.filter(p => p.id !== id));
    await supabase.from('profiles').delete().eq('id', id);
  }

  // 軟撤銷:停用 / 復原登入(admin-only RPC,後端 SQL function 再次把關)
  async function banMember(email: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const { error } = await supabase.rpc('admin_ban_user', { p_email: email });
    if (error) throw error;
    await refetchMemberStatus();
  }

  async function unbanMember(email: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const { error } = await supabase.rpc('admin_unban_user', { p_email: email });
    if (error) throw error;
    await refetchMemberStatus();
  }

  // 產生「不經 Google」的一次性登入連結(走 /api/admin/login-link,server 端用 service role)
  async function generateLoginLink(email: string): Promise<string> {
    if (IS_DEMO) { blockDemo(); return ''; }
    const res = await fetch('/api/admin/login-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j as { error?: string }).error || '產生連結失敗');
    return (j as { link: string }).link;
  }

  // ---------- Teams(teams 表,admin only)----------
  async function addTeam(name: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const trimmed = name.trim();
    if (!trimmed) throw new Error('團隊名稱不可空白');
    if (teams.some(t => t.name === trimmed)) throw new Error(`「${trimmed}」團隊已存在`);
    const { data, error } = await supabase.from('teams').insert({ name: trimmed }).select().single();
    if (error) throw error;
    if (data) setTeams(ts => [...ts, data as Team].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function updateTeam(id: string, name: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const trimmed = name.trim();
    setTeams(ts => ts.map(t => t.id === id ? { ...t, name: trimmed } : t));
    await supabase.from('teams').update({ name: trimmed }).eq('id', id);
  }

  async function removeTeam(id: string) {
    if (IS_DEMO) { blockDemo(); return; }
    // 先把這個 team 的成員 team_id 設為 null,避免外鍵卡住
    setProfiles(ps => ps.map(p => p.team_id === id ? { ...p, team_id: null } : p));
    setTeams(ts => ts.filter(t => t.id !== id));
    await supabase.from('profiles').update({ team_id: null }).eq('team_id', id);
    await supabase.from('teams').delete().eq('id', id);
  }

  // ---------- Pain points(pain_points 表,admin only)----------
  async function addPain(input: { pain: string; product: string; pitch: string; tiers: string }) {
    if (IS_DEMO) { blockDemo(); return; }
    const maxIdx = Math.max(0, ...painPoints.map(p => p.order_idx));
    const { data, error } = await supabase.from('pain_points')
      .insert({ ...input, order_idx: maxIdx + 10, is_active: true, created_by: profile.id })
      .select().single();
    if (error) throw error;
    if (data) setPainPoints(ps => [...ps, data as PainPoint].sort((a, b) => a.order_idx - b.order_idx));
  }

  async function updatePain(id: string, patch: Partial<PainPoint>) {
    if (IS_DEMO) { blockDemo(); return; }
    setPainPoints(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    await supabase.from('pain_points').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  }

  async function removePain(id: string) {
    if (IS_DEMO) { blockDemo(); return; }
    setPainPoints(ps => ps.filter(p => p.id !== id));
    await supabase.from('pain_points').delete().eq('id', id);
  }

  // ---------- AI 結果套用 ----------
  // AIChatModal 回傳的建議(score、next_step、comment、questions、stage)
  // 由 RM 勾選 + 編輯後送來這裡,逐項寫回對應的表
  async function applyAISuggestion(dealId: string, patch: {
    scores?: Partial<Scores>;
    next_step?: string | null;
    comment?: string;
    questions_to_check?: string[];
    stage?: StageId;
  }) {
    if (IS_DEMO) { blockDemo(); return; }
    if (patch.scores && Object.keys(patch.scores).length > 0) {
      await patchScore(dealId, patch.scores);
    }
    const dealPatch: Partial<Deal> = {};
    if (patch.next_step !== undefined) dealPatch.next_step = patch.next_step;
    if (patch.stage) dealPatch.stage = patch.stage;
    if (Object.keys(dealPatch).length > 0) {
      await patchDeal(dealId, dealPatch);
    }
    if (patch.comment) {
      await addComment(dealId, `🤖 ${patch.comment}`);
    }
    if (patch.questions_to_check && patch.questions_to_check.length > 0) {
      setDeals(prev => prev.map(d => {
        if (d.id !== dealId) return d;
        const existing = new Set((d.deal_questions ?? []).map(q => q.question_key));
        const newOnes = patch.questions_to_check!.filter(k => !existing.has(k)).map(k => ({
          deal_id: dealId, question_key: k, answered: true, note: '', asked_at: new Date().toISOString(),
        }));
        return { ...d, deal_questions: [...(d.deal_questions ?? []), ...newOnes] };
      }));
      const rows = patch.questions_to_check.map(k => ({
        deal_id: dealId, question_key: k, answered: true, asked_by: profile.id,
      }));
      await supabase.from('deal_questions').upsert(rows);
    }
  }

  // PlanModal 產出的 plan 整包存進 deals.plan (JSONB)
  async function savePlan(dealId: string, plan: DealPlan, targetDate: string) {
    if (IS_DEMO) { blockDemo(); return; }
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, plan, target_close_date: targetDate } : d));
    await supabase.from('deals').update({
      plan: plan as unknown as Record<string, unknown>,
      target_close_date: targetDate,
      last_updated: new Date().toISOString(),
    }).eq('id', dealId);
    await addComment(dealId, `🎯 AI 產生成交路徑 (目標 ${targetDate},可行性 ${plan.feasibility})`);
  }

  // 切換 plan 內某一 step 的 completed
  async function togglePlanStep(dealId: string, stepId: string) {
    if (IS_DEMO) { blockDemo(); return; }
    const deal = deals.find(d => d.id === dealId);
    if (!deal?.plan) return;
    const newSteps = deal.plan.steps.map(s => s.id === stepId
      ? { ...s, completed: !s.completed, completed_at: !s.completed ? new Date().toISOString() : null }
      : s
    );
    const newPlan = { ...deal.plan, steps: newSteps };
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, plan: newPlan } : d));
    await supabase.from('deals').update({
      plan: newPlan as unknown as Record<string, unknown>,
      last_updated: new Date().toISOString(),
    }).eq('id', dealId);
  }

  // ============================================================
  // Render — 只負責組裝,所有 UI section 都在 ./dashboard/ 下
  // ============================================================
  return (
    <>
      {IS_DEMO && (
        <div className="bg-amber-100 text-amber-900 text-xs sm:text-sm text-center px-3 py-2 border-b border-amber-200">
          🔒 示範環境 · 以下資料皆為虛構範例,與真實客戶無關 · 唯讀,任何變更不會被儲存
        </div>
      )}

      <Header
        profile={profile}
        teams={teams}
        onExportCSV={handleExportCSV}
        onNewDeal={() => setShowNewDeal(true)}
        onOpenMarket={() => router.push('/market')}
        onOpenSettings={() => setShowSettings(true)}
        onSignOut={signOut}
      />

      <main className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-24">
        <KpiTiles
          deals={deals}
          settings={settings}
          tierCfg={tierCfg}
          filterOverdue={filter.overdue}
          filterRedFlag={filter.redFlag}
          onToggleOverdue={() => setFilter(f => ({ ...f, overdue: !f.overdue, redFlag: false }))}
          onToggleRedFlag={() => setFilter(f => ({ ...f, redFlag: !f.redFlag, overdue: false }))}
        />

        <FocusList
          deals={deals}
          settings={settings}
          tierCfg={tierCfg}
          collapsed={focusCollapsed}
          onToggleCollapsed={() => setFocusCollapsed(v => !v)}
          onOpenDeal={(id) => setCurrentDealId(id)}
          onQuickLogContact={quickLogContact}
        />

        {/* Tab 切換:銷售漏斗 / 任務管理 */}
        <div className="flex gap-1 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'pipeline' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >📊 銷售漏斗</button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${activeTab === 'tasks' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            📋 任務管理
            {tasks.filter(t => t.status !== 'done').length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 rounded-full">
                {tasks.filter(t => t.status !== 'done').length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'tasks' ? (
          <TasksTab
            tasks={tasks}
            deals={deals}
            profiles={profiles}
            profile={profile}
            onOpenDeal={(id) => setCurrentDealId(id)}
            onAddTask={addTask}
            onUpdateTask={updateTask}
            onDeleteTask={deleteTask}
          />
        ) : (
          <>
            <Funnel
              deals={deals}
              filterStage={filter.stage}
              collapsed={funnelCollapsed}
              onToggleCollapsed={() => setFunnelCollapsed(v => !v)}
              onSetStageFilter={(stage) => setFilter(f => ({ ...f, stage }))}
            />

            <FilterBar
              filter={filter}
              setFilter={setFilter}
              profiles={profiles}
              teams={teams}
              tierCfg={tierCfg}
            />

            <DealList
              deals={filteredDeals}
              settings={settings}
              tierCfg={tierCfg}
              onOpenDeal={(id) => setCurrentDealId(id)}
            />
          </>
        )}
      </main>

      {/* 三個 Modal 與一個 toast */}
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
          onSaveRawText={(raw) => saveRawText(currentDeal.id, raw)}
          onPromoteNextStep={() => promoteNextStepToTask(currentDeal.id)}
          onPromotePlanFocus={(opts) => promotePlanFocus(currentDeal.id, opts)}
          onUploadAttachment={(file) => uploadAttachment(currentDeal.id, file)}
          onDeleteAttachment={(id) => deleteAttachment(id)}
          onGetAttachmentUrl={getAttachmentUrl}
          onApplyAISuggestion={(patch) => applyAISuggestion(currentDeal.id, patch)}
          onSavePlan={(plan, td) => savePlan(currentDeal.id, plan, td)}
          onTogglePlanStep={(stepId) => togglePlanStep(currentDeal.id, stepId)}
        />
      )}

      {showNewDeal && (
        <NewDealModal
          defaultRmId={profile.id}
          allProfiles={profiles}
          tierConfig={tierCfg}
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
          teams={teams}
          onClose={() => setShowSettings(false)}
          onSave={saveSettings}
          onAddMember={addMember}
          onUpdateMember={updateMember}
          onRemoveMember={removeMember}
          memberStatus={memberStatus}
          onBanMember={banMember}
          onUnbanMember={unbanMember}
          onGenerateLoginLink={generateLoginLink}
          onAddTeam={addTeam}
          onUpdateTeam={updateTeam}
          onRemoveTeam={removeTeam}
          onAddPain={addPain}
          onUpdatePain={updatePain}
          onRemovePain={removePain}
        />
      )}

      {IS_DEMO && demoNotice && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          🔒 示範環境為唯讀,變更不會儲存
        </div>
      )}
    </>
  );
}
