'use client';
import { useState } from 'react';
import type { Profile, TierConfigItem } from '@/lib/types';
import { TIER_STYLES } from '@/lib/constants';
import { getTierFromAum } from '@/lib/utils';

interface Props {
  defaultRmId: string;
  allProfiles: Profile[];
  tierConfig: TierConfigItem[];
  onClose: () => void;
  onCreate: (input: { name: string; rm_id: string; aum_usd: number; product: string; first_contact: string }) => Promise<void>;
}

export function NewDealModal({ defaultRmId, allProfiles, tierConfig, onClose, onCreate }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState('');
  const [rmId, setRmId] = useState(defaultRmId);
  const [aumUsd, setAumUsd] = useState(0);
  const [product, setProduct] = useState('');
  const [firstContact, setFirstContact] = useState(today);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) { alert('請輸入客戶名稱'); return; }
    setSaving(true);
    await onCreate({ name, rm_id: rmId, aum_usd: aumUsd, product, first_contact: firstContact });
    setSaving(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 z-40" onClick={onClose} />
      <div className="fixed inset-x-4 top-16 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[480px] bg-white rounded-2xl shadow-2xl z-50 p-5">
        <h2 className="font-semibold mb-3">新增案件</h2>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500">客戶名稱 *</span>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-slate-500">RM *</span>
              <select value={rmId} onChange={e => setRmId(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded bg-white text-sm">
                {allProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name || p.email}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-slate-500">潛在 AUM (USD) *</span>
              <input
                type="text"
                inputMode="numeric"
                value={aumUsd > 0 ? aumUsd.toLocaleString('en-US') : ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, '');
                  setAumUsd(raw === '' ? 0 : Number(raw));
                }}
                placeholder="例:1,000,000"
                className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm font-mono"
              />
              {aumUsd > 0 && (() => {
                const tier = getTierFromAum(aumUsd, tierConfig);
                const cfg = tierConfig.find(t => t.key === tier);
                return (
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                    自動分級:
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${TIER_STYLES[tier]}`}>{tier}</span>
                    <span>{cfg?.name} · 每 {cfg?.contact_days} 天聯繫</span>
                  </div>
                );
              })()}
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-slate-500">目標商品</span>
            <input type="text" value={product} onChange={e => setProduct(e.target.value)} placeholder="例如:宏利 5M" className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">首次接觸日</span>
            <input type="date" value={firstContact} onChange={e => setFirstContact(e.target.value)} className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded text-sm" />
          </label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border border-slate-200 rounded hover:bg-slate-50">取消</button>
          <button onClick={submit} disabled={saving} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
            {saving ? '建立中...' : '建立'}
          </button>
        </div>
      </div>
    </>
  );
}
