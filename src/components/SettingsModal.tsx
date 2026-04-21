'use client';
import type { Profile, Settings, StageId } from '@/lib/types';
import { STAGES } from '@/lib/constants';

interface Props {
  settings: Settings;
  profile: Profile;
  onClose: () => void;
  onSave: (patch: Partial<Settings>) => Promise<void>;
}

export function SettingsModal({ settings, profile, onClose, onSave }: Props) {
  const isManager = profile.role === 'manager';

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-8 bottom-8 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[560px] sm:top-12 sm:bottom-12 bg-white rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col">
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">設定 {!isManager && <span className="text-xs text-slate-400 font-normal ml-2">(唯讀 — 需管理員修改)</span>}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded hover:bg-slate-100">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-5 text-sm">
          <div>
            <h3 className="font-semibold mb-2">階段成交機率 (%) — 加權預測用</h3>
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
                      const newProbs = { ...settings.stage_probs, [stage.id]: Number(e.target.value) };
                      onSave({ stage_probs: newProbs as Record<StageId, number> });
                    }}
                    className="mt-1 w-full px-2 py-1 border border-slate-200 rounded disabled:bg-slate-50"
                  />
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">紅旗門檻</h3>
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

          <div className="text-xs text-slate-500 pt-3 border-t border-slate-100">
            <p className="mb-1"><b>RM 管理</b>:新 RM 請用其公司 Google 帳號登入一次,系統會自動建立 profile。</p>
            <p className="mb-1"><b>升級管理員</b>:在 Supabase SQL Editor 執行:</p>
            <code className="block bg-slate-50 p-2 rounded text-[11px] mt-1">update public.profiles set role = 'manager' where email = 'user@example.com';</code>
          </div>
        </div>
      </div>
    </>
  );
}
