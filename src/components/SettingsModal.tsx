'use client';
import { useState } from 'react';
import type { PainPoint, Profile, Role, Settings, StageId, Team, Tier, TierConfigItem } from '@/lib/types';
import { STAGES, TIER_STYLES } from '@/lib/constants';
import { fmtMoney } from '@/lib/utils';

interface Props {
  settings: Settings;
  profile: Profile;
  allProfiles: Profile[];
  painPoints: PainPoint[];
  teams: Team[];
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  onAddMember: (input: { email: string; full_name: string; role: Role; team_id: string | null }) => Promise<void>;
  onUpdateMember: (id: string, patch: { full_name?: string; role?: Role; team_id?: string | null }) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
  memberStatus: Record<string, { has_auth: boolean; banned: boolean }>;
  onBanMember: (email: string) => Promise<void>;
  onUnbanMember: (email: string) => Promise<void>;
  onGenerateLoginLink: (email: string) => Promise<string>;
  onAddTeam: (name: string) => Promise<void>;
  onUpdateTeam: (id: string, name: string) => Promise<void>;
  onRemoveTeam: (id: string) => Promise<void>;
  onAddPain: (input: { pain: string; product: string; pitch: string; tiers: string }) => Promise<void>;
  onUpdatePain: (id: string, patch: Partial<PainPoint>) => Promise<void>;
  onRemovePain: (id: string) => Promise<void>;
}

const ROLE_LABEL: Record<Role, string> = {
  rm: 'RM',
  team_lead: 'Team Lead',
  admin: 'Admin',
};

export function SettingsModal({ settings, profile, allProfiles, painPoints, teams, onClose, onSave, onAddMember, onUpdateMember, onRemoveMember, memberStatus, onBanMember, onUnbanMember, onGenerateLoginLink, onAddTeam, onUpdateTeam, onRemoveTeam, onAddPain, onUpdatePain, onRemovePain }: Props) {
  const isAdmin = profile.role === 'admin';
  const isTeamLead = profile.role === 'team_lead';
  const canEditMembers = isAdmin || isTeamLead;
  const canEditTeams = isAdmin;
  const canEditSettings = isAdmin;
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Role>('rm');
  const [newTeamId, setNewTeamId] = useState<string>(profile.team_id ?? '');
  const [adding, setAdding] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [newPain, setNewPain] = useState('');
  const [newProduct, setNewProduct] = useState('');
  const [newPitch, setNewPitch] = useState('');
  const [newTiers, setNewTiers] = useState('');
  const [addingPain, setAddingPain] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState<string | null>(null);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [genLinks, setGenLinks] = useState<Record<string, string>>({});

  async function handleBan(p: Profile) {
    const typed = window.prompt(
      `確定停用「${p.full_name || p.email}」的登入?\n對方會立即被踢出且無法再登入(資料保留、可日後復原)。\n\n請輸入對方 email 確認:`
    );
    if (typed == null) return;
    if (typed.trim().toLowerCase() !== p.email.toLowerCase()) { alert('輸入的 email 不符,已取消'); return; }
    setMemberBusyId(p.id);
    try { await onBanMember(p.email); }
    catch (err) { alert('停用失敗:' + (err as Error).message); }
    finally { setMemberBusyId(null); }
  }

  async function handleUnban(p: Profile) {
    if (!confirm(`復原「${p.full_name || p.email}」的登入?對方將可重新登入。`)) return;
    setMemberBusyId(p.id);
    try { await onUnbanMember(p.email); }
    catch (err) { alert('復原失敗:' + (err as Error).message); }
    finally { setMemberBusyId(null); }
  }

  async function handleGenLink(p: Profile) {
    setLinkBusyId(p.id);
    try {
      const link = await onGenerateLoginLink(p.email);
      if (link) setGenLinks(m => ({ ...m, [p.id]: link }));
    } catch (err) {
      alert('產生登入連結失敗:' + (err as Error).message);
    } finally {
      setLinkBusyId(null);
    }
  }

  async function submitNewMember() {
    if (!newEmail.trim() || !newName.trim()) { alert('請填 Email 與姓名'); return; }
    setAdding(true);
    try {
      await onAddMember({
        email: newEmail.trim(),
        full_name: newName.trim(),
        role: newRole,
        team_id: newTeamId || null,
      });
      setNewEmail(''); setNewName(''); setNewRole('rm');
    } catch (err) {
      alert('新增失敗:' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function submitNewTeam() {
    if (!newTeamName.trim()) { alert('請填團隊名稱'); return; }
    setAddingTeam(true);
    try {
      await onAddTeam(newTeamName);
      setNewTeamName('');
    } catch (err) {
      alert('新增失敗:' + (err as Error).message);
    } finally {
      setAddingTeam(false);
    }
  }

  async function submitNewPain() {
    if (!newPain.trim() || !newProduct.trim()) { alert('請填痛點與商品'); return; }
    setAddingPain(true);
    try {
      await onAddPain({ pain: newPain.trim(), product: newProduct.trim(), pitch: newPitch.trim(), tiers: newTiers.trim() });
      setNewPain(''); setNewProduct(''); setNewPitch(''); setNewTiers('');
    } catch (err) {
      alert('新增失敗:' + (err as Error).message);
    } finally {
      setAddingPain(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px] sm:top-12 sm:bottom-12 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">設定 {!isAdmin && <span className="text-xs text-slate-400 font-normal ml-2">(唯讀 — 需管理員修改)</span>}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6 text-sm">

          {/* 團隊管理(Admin only)*/}
          {isAdmin && (
            <div>
              <h3 className="font-semibold mb-2">🏢 團隊管理</h3>
              <p className="text-xs text-slate-500 mb-2">
                Admin 可建立業務組或地區團隊。Team Lead 只能看自己團隊的案件,RM 只能看自己的。
              </p>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-2 py-1.5">團隊名</th>
                      <th className="text-left px-2 py-1.5">成員數</th>
                      <th className="text-right px-2 py-1.5"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map(t => {
                      const memberCount = allProfiles.filter(p => p.team_id === t.id).length;
                      return (
                        <tr key={t.id} className="border-t border-slate-100">
                          <td className="px-2 py-1.5">
                            <input
                              defaultValue={t.name}
                              onBlur={e => { if (e.target.value.trim() && e.target.value !== t.name) onUpdateTeam(t.id, e.target.value); }}
                              className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 rounded font-medium"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-slate-600">{memberCount} 人</td>
                          <td className="px-2 py-1.5 text-right">
                            <button
                              onClick={() => { if (confirm(`刪除「${t.name}」團隊?裡面 ${memberCount} 位成員會變成「未分團隊」狀態`)) onRemoveTeam(t.id); }}
                              className="text-rose-500 hover:underline"
                            >刪</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="新團隊名稱(例如:Daniel 組、台北團隊)"
                  className="flex-1 px-2 py-1.5 border border-slate-200 rounded text-xs"
                />
                <button
                  onClick={submitNewTeam}
                  disabled={addingTeam}
                  className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                >{addingTeam ? '...' : '＋ 新增'}</button>
              </div>
            </div>
          )}

          {/* 團隊成員管理 */}
          <div>
            <h3 className="font-semibold mb-2">👥 團隊成員</h3>
            <p className="text-xs text-slate-500 mb-2">
              <b>權限</b>:Admin 看全部、Team Lead 看自己團隊、RM 只看自己。對方一登入會自動合併,案件保留。
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5">姓名</th>
                    <th className="text-left px-2 py-1.5">Email</th>
                    <th className="text-left px-2 py-1.5">角色</th>
                    <th className="text-left px-2 py-1.5">團隊</th>
                    <th className="text-right px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.map(p => {
                    const canEditThis = isAdmin && p.id !== profile.id;
                    const st = memberStatus[p.id];
                    return (
                      <tr key={p.id} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">
                          {canEditThis ? (
                            <input
                              defaultValue={p.full_name ?? ''}
                              onBlur={e => { if (e.target.value !== p.full_name) onUpdateMember(p.id, { full_name: e.target.value }); }}
                              className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 rounded"
                            />
                          ) : <span>{p.full_name || '—'}</span>}
                          {p.id === profile.id && <span className="ml-1 text-[10px] text-indigo-600">(我)</span>}
                          {st?.banned && <span className="ml-1 text-[10px] text-amber-600 font-semibold">(已停用)</span>}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600">{p.email}</td>
                        <td className="px-2 py-1.5">
                          {canEditThis ? (
                            <select
                              value={p.role}
                              onChange={e => onUpdateMember(p.id, { role: e.target.value as Role })}
                              className="px-1 py-0.5 border border-slate-200 rounded bg-white text-xs"
                            >
                              <option value="rm">RM</option>
                              <option value="team_lead">Team Lead</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span className={
                              p.role === 'admin' ? 'text-rose-600 font-semibold'
                              : p.role === 'team_lead' ? 'text-indigo-600 font-semibold'
                              : 'text-slate-500'
                            }>{ROLE_LABEL[p.role]}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          {canEditThis ? (
                            <select
                              value={p.team_id ?? ''}
                              onChange={e => onUpdateMember(p.id, { team_id: e.target.value || null })}
                              className="px-1 py-0.5 border border-slate-200 rounded bg-white text-xs"
                            >
                              <option value="">(未分)</option>
                              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-slate-600">{teams.find(t => t.id === p.team_id)?.name ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {canEditThis && (
                            <>
                              <span className="inline-flex items-center gap-2">
                                {st?.banned ? (
                                  <button
                                    onClick={() => handleUnban(p)}
                                    disabled={memberBusyId === p.id}
                                    className="text-emerald-600 hover:underline disabled:opacity-50"
                                  >{memberBusyId === p.id ? '...' : '復原登入'}</button>
                                ) : st?.has_auth ? (
                                  <button
                                    onClick={() => handleBan(p)}
                                    disabled={memberBusyId === p.id}
                                    className="text-amber-600 hover:underline disabled:opacity-50"
                                  >{memberBusyId === p.id ? '...' : '停用登入'}</button>
                                ) : null}
                                <button
                                  onClick={() => handleGenLink(p)}
                                  disabled={linkBusyId === p.id}
                                  className="text-indigo-600 hover:underline disabled:opacity-50"
                                  title="產生不經 Google 的一次性登入連結,複製後貼給對方"
                                >{linkBusyId === p.id ? '...' : '登入連結'}</button>
                                <button
                                  onClick={() => { if (confirm(`移除「${p.full_name || p.email}」?若對方已登入過,其案件會無法再指派`)) onRemoveMember(p.id); }}
                                  className="text-rose-500 hover:underline"
                                >移除</button>
                              </span>
                              {genLinks[p.id] && (
                                <div className="mt-1 flex items-center justify-end gap-1">
                                  <input
                                    readOnly
                                    value={genLinks[p.id]}
                                    onFocus={e => e.currentTarget.select()}
                                    className="w-44 px-1 py-0.5 border border-slate-200 rounded text-[10px] text-slate-600"
                                  />
                                  <button
                                    onClick={() => { navigator.clipboard?.writeText(genLinks[p.id]); }}
                                    className="text-indigo-600 hover:underline text-[11px]"
                                  >複製</button>
                                </div>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {isAdmin && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold mb-2">➕ 新增成員(對方不用先登入)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="姓名"
                    className="px-2 py-1 border border-slate-200 rounded"
                  />
                  <input
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder="Gmail / 公司 email"
                    className="px-2 py-1 border border-slate-200 rounded"
                  />
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as Role)}
                    className="px-2 py-1 border border-slate-200 rounded bg-white"
                  >
                    <option value="rm">RM(只看自己)</option>
                    <option value="team_lead">Team Lead(看自己團隊)</option>
                    <option value="admin">Admin(看全部)</option>
                  </select>
                  <select
                    value={newTeamId}
                    onChange={e => setNewTeamId(e.target.value)}
                    className="px-2 py-1 border border-slate-200 rounded bg-white"
                  >
                    <option value="">(未分團隊)</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={submitNewMember}
                  disabled={adding}
                  className="mt-2 w-full px-3 py-1.5 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700 disabled:opacity-50"
                >{adding ? '新增中...' : '✓ 新增成員'}</button>
                <p className="mt-2 text-xs text-slate-500">
                  ⚠️ Email 必須跟對方 Google 帳號完全一致(小寫)。建好後在案件指派 RM,對方首次登入會自動接管。
                </p>
              </div>
            )}
          </div>

          {/* 痛點 → 商品 矩陣管理 */}
          <div>
            <h3 className="font-semibold mb-2">🎯 痛點 → 商品 矩陣 <span className="text-xs text-slate-400 font-normal">({painPoints.length} 條)</span></h3>
            <p className="text-xs text-slate-500 mb-2">
              客戶說出痛點時,業務員會直接在案件頁看到建議商品 + 切入話術。Admin 可新增/編輯/刪除。
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto scrollbar-thin">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 w-10">#</th>
                    <th className="text-left px-2 py-1.5">客戶痛點</th>
                    <th className="text-left px-2 py-1.5">對應商品</th>
                    <th className="text-left px-2 py-1.5">切入話術</th>
                    <th className="text-left px-2 py-1.5">適用層級</th>
                    <th className="px-2 py-1.5 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {painPoints.map((p, i) => (
                    <tr key={p.id} className="border-t border-slate-100 align-top">
                      <td className="px-2 py-1.5 text-slate-400 text-xs">{i + 1}</td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <textarea
                            defaultValue={p.pain}
                            onBlur={e => { if (e.target.value !== p.pain) onUpdatePain(p.id, { pain: e.target.value }); }}
                            rows={2}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded text-xs resize-none"
                          />
                        ) : <span>{p.pain}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <textarea
                            defaultValue={p.product}
                            onBlur={e => { if (e.target.value !== p.product) onUpdatePain(p.id, { product: e.target.value }); }}
                            rows={2}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded text-xs text-indigo-700 resize-none"
                          />
                        ) : <span className="text-indigo-700">{p.product}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <textarea
                            defaultValue={p.pitch}
                            onBlur={e => { if (e.target.value !== p.pitch) onUpdatePain(p.id, { pitch: e.target.value }); }}
                            rows={2}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded text-xs text-slate-600 resize-none"
                          />
                        ) : <span className="text-slate-600">{p.pitch}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <input
                            defaultValue={p.tiers}
                            onBlur={e => { if (e.target.value !== p.tiers) onUpdatePain(p.id, { tiers: e.target.value }); }}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded text-xs"
                            placeholder="L1–L4"
                          />
                        ) : <span>{p.tiers}</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {isAdmin && (
                          <button
                            onClick={() => { if (confirm(`刪除「${p.pain}」?`)) onRemovePain(p.id); }}
                            className="text-rose-500 hover:underline"
                          >刪</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isAdmin && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold mb-2">➕ 新增痛點</div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newPain}
                    onChange={e => setNewPain(e.target.value)}
                    placeholder="客戶痛點(例:「擔心美元貶值」)"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={newProduct}
                    onChange={e => setNewProduct(e.target.value)}
                    placeholder="對應商品(例:「瑞郎分紅保單」)"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={newPitch}
                    onChange={e => setNewPitch(e.target.value)}
                    placeholder="切入話術(簡短、有數字)"
                    className="w-full px-2 py-1 border border-slate-200 rounded text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newTiers}
                      onChange={e => setNewTiers(e.target.value)}
                      placeholder="適用層級(例:L2–L4)"
                      className="flex-1 px-2 py-1 border border-slate-200 rounded text-xs"
                    />
                    <button
                      onClick={submitNewPain}
                      disabled={addingPain}
                      className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 text-xs whitespace-nowrap"
                    >{addingPain ? '...' : '新增'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 客戶等級 + 聯繫頻率 */}
          <div>
            <h3 className="font-semibold mb-2">🎖 客戶等級 + 聯繫頻率</h3>
            <p className="text-xs text-slate-500 mb-2">
              不同等級客戶有不同聯繫週期。系統會提醒 RM:「這個客戶已 X 天沒聯繫,該主動接觸了」。
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5 w-14">等級</th>
                    <th className="text-left px-2 py-1.5">顯示名稱</th>
                    <th className="text-left px-2 py-1.5">AUM 門檻 (USD)</th>
                    <th className="text-left px-2 py-1.5 w-28">聯繫週期 (天)</th>
                  </tr>
                </thead>
                <tbody>
                  {(settings.tier_config?.tiers ?? []).map((t, idx) => (
                    <tr key={t.key} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${TIER_STYLES[t.key] ?? 'bg-slate-200'}`}>{t.key}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <input
                            defaultValue={t.name}
                            onBlur={e => {
                              if (e.target.value !== t.name) {
                                const newTiers = [...(settings.tier_config?.tiers ?? [])];
                                newTiers[idx] = { ...newTiers[idx], name: e.target.value };
                                onSave({ tier_config: { tiers: newTiers } });
                              }
                            }}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded"
                          />
                        ) : <span>{t.name}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <input
                            type="text"
                            inputMode="numeric"
                            defaultValue={t.aum_min.toLocaleString('en-US')}
                            onBlur={e => {
                              const n = Number(e.target.value.replace(/[^\d]/g, ''));
                              if (n !== t.aum_min) {
                                const newTiers = [...(settings.tier_config?.tiers ?? [])];
                                newTiers[idx] = { ...newTiers[idx], aum_min: n };
                                onSave({ tier_config: { tiers: newTiers } });
                              }
                            }}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded font-mono"
                          />
                        ) : <span className="font-mono">{fmtMoney(t.aum_min)}</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {isAdmin ? (
                          <input
                            type="number"
                            min={1}
                            defaultValue={t.contact_days}
                            onBlur={e => {
                              const n = Number(e.target.value);
                              if (n > 0 && n !== t.contact_days) {
                                const newTiers = [...(settings.tier_config?.tiers ?? [])];
                                newTiers[idx] = { ...newTiers[idx], contact_days: n };
                                onSave({ tier_config: { tiers: newTiers } });
                              }
                            }}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 focus:border-slate-300 rounded"
                          />
                        ) : <span>{t.contact_days} 天</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              💡 等級依 AUM 門檻對應:SSS &ge; {fmtMoney(settings.tier_config?.tiers?.find(t => t.key === 'SSS')?.aum_min ?? 0)}、
              S &ge; {fmtMoney(settings.tier_config?.tiers?.find(t => t.key === 'S')?.aum_min ?? 0)}、
              A &ge; {fmtMoney(settings.tier_config?.tiers?.find(t => t.key === 'A')?.aum_min ?? 0)}、
              C &ge; {fmtMoney(settings.tier_config?.tiers?.find(t => t.key === 'C')?.aum_min ?? 0)}。
            </p>
          </div>

          {/* 階段機率 */}
          <div>
            <h3 className="font-semibold mb-2">📊 階段成交機率 (%) — 加權預測用</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STAGES.map(stage => (
                <label key={stage.id} className="block">
                  <span className="text-xs text-slate-500">{stage.id}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={settings.stage_probs[stage.id]}
                    disabled={!isAdmin}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== settings.stage_probs[stage.id]) {
                        const newProbs = { ...settings.stage_probs, [stage.id]: v };
                        onSave({ stage_probs: newProbs as Record<StageId, number> });
                      }
                    }}
                    className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* 紅旗門檻 */}
          <div>
            <h3 className="font-semibold mb-2">🚩 紅旗門檻</h3>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-xs text-slate-500">EB 分數 &lt;</span>
                <input
                  type="number"
                  defaultValue={settings.red_flag.ebScore}
                  disabled={!isAdmin}
                  onBlur={(e) => onSave({ red_flag: { ...settings.red_flag, ebScore: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">總分 &lt;</span>
                <input
                  type="number"
                  defaultValue={settings.red_flag.totalScore}
                  disabled={!isAdmin}
                  onBlur={(e) => onSave({ red_flag: { ...settings.red_flag, totalScore: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">天數 &gt;</span>
                <input
                  type="number"
                  defaultValue={settings.red_flag.staleDays}
                  disabled={!isAdmin}
                  onBlur={(e) => onSave({ red_flag: { ...settings.red_flag, staleDays: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                />
              </label>
            </div>
          </div>

          <div className="text-xs text-slate-400 pt-3 border-t border-slate-100">
            <p><b>權限規則</b>:Manager 可以看/改所有 RM 的案件;RM 只能看/改自己的。</p>
            <p className="mt-1"><b>建議</b>:把「專精某區客戶的業務」設為 RM,把「帶領團隊的主管」設為 Manager。</p>
          </div>
        </div>
      </div>
    </>
  );
}
