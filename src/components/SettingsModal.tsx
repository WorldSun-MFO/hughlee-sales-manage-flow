'use client';
import { useState } from 'react';
import type { Profile, Settings, StageId } from '@/lib/types';
import { STAGES } from '@/lib/constants';

interface Props {
  settings: Settings;
  profile: Profile;
  allProfiles: Profile[];
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  onAddMember: (input: { email: string; full_name: string; role: 'rm' | 'manager' }) => Promise<void>;
  onUpdateMember: (id: string, patch: { full_name?: string; role?: 'rm' | 'manager' }) => Promise<void>;
  onRemoveMember: (id: string) => Promise<void>;
}

export function SettingsModal({ settings, profile, allProfiles, onClose, onSave, onAddMember, onUpdateMember, onRemoveMember }: Props) {
  const isManager = profile.role === 'manager';
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'rm' | 'manager'>('rm');
  const [adding, setAdding] = useState(false);

  async function submitNewMember() {
    if (!newEmail.trim() || !newName.trim()) { alert('請填 Email 與姓名'); return; }
    setAdding(true);
    try {
      await onAddMember({ email: newEmail.trim(), full_name: newName.trim(), role: newRole });
      setNewEmail(''); setNewName(''); setNewRole('rm');
    } catch (err) {
      alert('新增失敗:' + (err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[640px] sm:top-12 sm:bottom-12 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">設定 {!isManager && <span className="text-xs text-slate-400 font-normal ml-2">(唯讀 — 需管理員修改)</span>}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6 text-sm">

          {/* 團隊成員管理 */}
          <div>
            <h3 className="font-semibold mb-2">👥 團隊成員</h3>
            <p className="text-xs text-slate-500 mb-2">
              預建的 RM 對方一登入會自動合併,案件會保留。Manager 可以看全部案件,RM 只能看自己的。
            </p>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5">姓名</th>
                    <th className="text-left px-2 py-1.5">Email</th>
                    <th className="text-left px-2 py-1.5">角色</th>
                    <th className="text-right px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {allProfiles.map(p => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        {isManager && p.id !== profile.id ? (
                          <input
                            defaultValue={p.full_name ?? ''}
                            onBlur={e => { if (e.target.value !== p.full_name) onUpdateMember(p.id, { full_name: e.target.value }); }}
                            className="w-full px-1 py-0.5 border border-transparent hover:border-slate-200 rounded"
                          />
                        ) : <span>{p.full_name || '—'}</span>}
                        {p.id === profile.id && <span className="ml-1 text-[10px] text-indigo-600">(我)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{p.email}</td>
                      <td className="px-2 py-1.5">
                        {isManager && p.id !== profile.id ? (
                          <select
                            value={p.role}
                            onChange={e => onUpdateMember(p.id, { role: e.target.value as 'rm' | 'manager' })}
                            className="px-1 py-0.5 border border-slate-200 rounded bg-white text-xs"
                          >
                            <option value="rm">RM</option>
                            <option value="manager">Manager</option>
                          </select>
                        ) : (
                          <span className={p.role === 'manager' ? 'text-indigo-600 font-semibold' : 'text-slate-500'}>
                            {p.role === 'manager' ? 'Manager' : 'RM'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {isManager && p.id !== profile.id && (
                          <button
                            onClick={() => { if (confirm(`移除「${p.full_name || p.email}」?若對方已登入過,其案件會無法再指派`)) onRemoveMember(p.id); }}
                            className="text-rose-500 hover:underline"
                          >移除</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {isManager && (
              <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold mb-2">➕ 新增 RM / Manager(對方不用先登入)</div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
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
                    className="sm:col-span-2 px-2 py-1 border border-slate-200 rounded"
                  />
                  <div className="flex gap-1">
                    <select
                      value={newRole}
                      onChange={e => setNewRole(e.target.value as 'rm' | 'manager')}
                      className="flex-1 px-2 py-1 border border-slate-200 rounded bg-white"
                    >
                      <option value="rm">RM</option>
                      <option value="manager">Manager</option>
                    </select>
                    <button
                      onClick={submitNewMember}
                      disabled={adding}
                      className="px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                    >{adding ? '...' : '新增'}</button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  ⚠️ Email 必須跟對方的 Google 帳號完全一致(含大小寫)。新增後先在案件裡把 RM 指給他,等他首次登入時系統會自動接管。
                </p>
              </div>
            )}
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
                    disabled={!isManager}
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
                  disabled={!isManager}
                  onBlur={(e) => onSave({ red_flag: { ...settings.red_flag, ebScore: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">總分 &lt;</span>
                <input
                  type="number"
                  defaultValue={settings.red_flag.totalScore}
                  disabled={!isManager}
                  onBlur={(e) => onSave({ red_flag: { ...settings.red_flag, totalScore: Number(e.target.value) } })}
                  className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                />
              </label>
              <label className="block">
                <span className="text-xs text-slate-500">天數 &gt;</span>
                <input
                  type="number"
                  defaultValue={settings.red_flag.staleDays}
                  disabled={!isManager}
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
