// ============================================================
// Dashboard 頂部 Header — Logo / 角色 / 動作按鈕
// ============================================================
// 純展示元件,不持有任何狀態。所有按鈕事件透過 props callback 往上拋。
//
// 由誰 render:src/components/Dashboard.tsx
// 不直接讀 DB,所有 deals / settings 計算都在 Dashboard 那邊算好再 props 傳入。
//
// 顯示內容:
//   左:WORLDSUN logo + 沃勝聯合家族辦公室 + 登入者姓名/角色/團隊
//   右:📥 匯出 CSV、＋ 新增案件、🧠 市場大腦、⚙︎ 設定、⏻ 登出
//      (Demo 模式只保留 CSV,其他隱藏)
// ============================================================
'use client';

import type { Profile, Team } from '@/lib/types';
import { IS_DEMO } from '@/lib/demo';

interface Props {
  profile: Profile;
  teams: Team[];
  onExportCSV: () => void;
  onNewDeal: () => void;
  onOpenMarket: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export function Header({ profile, teams, onExportCSV, onNewDeal, onOpenMarket, onOpenSettings, onSignOut }: Props) {
  // 依角色決定徽章文字 — admin 看全部、team_lead 看團隊、rm 只看自己
  const roleLine =
    profile.role === 'admin' ? '🛡 管理員 (看全部)'
    : profile.role === 'team_lead'
      ? `👥 Team Lead (${teams.find(t => t.id === profile.team_id)?.name ?? '未分團隊'})`
      : `RM (${teams.find(t => t.id === profile.team_id)?.name ?? '未分團隊'})`;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">沃</div>
          <div>
            <div className="font-semibold text-sm leading-tight">WORLDSUN MEDDIC Pipeline</div>
            <div className="text-[10px] text-slate-400 leading-tight">沃勝聯合家族辦公室</div>
            <div className="text-xs text-slate-500 leading-tight">{profile.full_name} · {roleLine}</div>
          </div>
        </div>
        <div className="flex-1" />
        <button onClick={onExportCSV} className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50" title="匯出 CSV(可直接貼進 Google Sheets)">📥</button>
        {!IS_DEMO && (
          <>
            <button onClick={onNewDeal} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              ＋ 新增案件
            </button>
            <button onClick={onNewDeal} className="sm:hidden inline-flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-lg font-bold">＋</button>
            <button onClick={onOpenMarket} className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50" title="金融資訊大腦">
              🧠 市場大腦
            </button>
            <button onClick={onOpenMarket} className="sm:hidden inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg" title="市場大腦">🧠</button>
            <button onClick={onOpenSettings} className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50" title="設定">⚙︎</button>
            <button onClick={onSignOut} className="inline-flex items-center justify-center w-9 h-9 border border-slate-200 rounded-lg hover:bg-slate-50" title="登出">⏻</button>
          </>
        )}
      </div>
    </header>
  );
}
